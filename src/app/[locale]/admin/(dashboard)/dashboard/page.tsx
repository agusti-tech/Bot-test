import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { getSuggestedSeatingsForRestaurant } from "@/lib/waitlist";
import HostDashboard from "@/components/admin/HostDashboard";

async function getSessionRestaurantId(): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as unknown as Record<string, unknown>).role as string;
  const restaurantId = (session.user as unknown as Record<string, unknown>).restaurantId as string | null;
  if (role === "SUPER_ADMIN") {
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) throw new Error("No restaurant found");
    return restaurant.id;
  }
  if (!restaurantId) throw new Error("No restaurant assigned");
  return restaurantId;
}

export default async function DashboardPage() {
  const t = await getTranslations("admin");
  const restaurantId = await getSessionRestaurantId();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  // Fetch tables with today's reservations (primary + combined so both tables show the same reservation)
  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId },
    orderBy: { sortOrder: "asc" },
    include: {
      reservations: {
        where: {
          date: today,
          status: { notIn: ["CANCELLED"] },
        },
        orderBy: { time: "asc" },
        include: {
          table: { select: { label: true } },
          combinedWithTable: { select: { label: true } },
          guest: { select: { name: true, totalVisits: true, noShowCount: true } },
        },
      },
      reservationsAsCombined: {
        where: {
          date: today,
          status: { notIn: ["CANCELLED"] },
        },
        orderBy: { time: "asc" },
        include: {
          table: { select: { label: true } },
          combinedWithTable: { select: { label: true } },
          guest: { select: { name: true, totalVisits: true, noShowCount: true } },
        },
      },
    },
  });

  const serialized = tables.map((table: (typeof tables)[number]) => {
    const allReservations = [...table.reservations];
    for (const r of table.reservationsAsCombined) {
      if (!allReservations.some((x) => x.id === r.id)) allReservations.push(r);
    }
    allReservations.sort((a, b) => a.time.localeCompare(b.time));
    return {
      id: table.id,
      label: table.label,
      maxCapacity: table.maxCapacity,
      minCapacity: table.minCapacity,
      shape: table.shape as string,
      zone: table.zone,
      isActive: table.isActive,
      isCombinable: table.isCombinable,
      posX: table.posX,
      posY: table.posY,
      width: table.width,
      height: table.height,
      rotation: table.rotation,
      reservations: allReservations.map((r) => {
        const combinedTableLabel =
          r.combinedWithTable && r.table
            ? `${r.table.label} + ${r.combinedWithTable.label}`
            : null;
        return {
          id: r.id,
          time: r.time,
          partySize: r.partySize,
          guestName: r.guestName,
          guestPhone: r.guestPhone,
          notes: r.notes,
          status: r.status,
          source: r.source,
          estimatedDuration: r.estimatedDuration,
          seatedAt: r.seatedAt?.toISOString() || null,
          completedAt: r.completedAt?.toISOString() || null,
          cleaningClearedAt: r.cleaningClearedAt?.toISOString() || null,
          combinedTableLabel,
          guest: r.guest
            ? { name: r.guest.name, totalVisits: r.guest.totalVisits, noShowCount: r.guest.noShowCount }
            : null,
        };
      }),
    };
  });

  // Today's active waitlist (WAITING + NOTIFIED) for count and seating suggestions
  const [waitlistCount, waitlistEntries] = await Promise.all([
    prisma.waitlistEntry.count({
      where: {
        restaurantId,
        status: { in: ["WAITING", "NOTIFIED"] },
        createdAt: { gte: today, lte: endOfToday },
      },
    }),
    prisma.waitlistEntry.findMany({
      where: {
        restaurantId,
        status: { in: ["WAITING", "NOTIFIED"] },
        createdAt: { gte: today, lte: endOfToday },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        guestName: true,
        guestPhone: true,
        partySize: true,
        notes: true,
        seatingPref: true,
        estimatedWaitMin: true,
        status: true,
        tableId: true,
        notifiedAt: true,
        seatedAt: true,
        createdAt: true,
      },
    }),
  ]);

  const waitlistEntriesSerialized = waitlistEntries.map((e) => ({
    id: e.id,
    guestName: e.guestName,
    guestPhone: e.guestPhone,
    partySize: e.partySize,
    notes: e.notes,
    seatingPref: e.seatingPref,
    estimatedWaitMin: e.estimatedWaitMin,
    status: e.status,
    tableId: e.tableId,
    tableLabel: null as string | null,
    notifiedAt: e.notifiedAt?.toISOString() ?? null,
    seatedAt: e.seatedAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
  }));

  const suggestedSeatings = await getSuggestedSeatingsForRestaurant(restaurantId);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">{t("hostDashboard")}</h1>
      <HostDashboard
        tables={serialized}
        restaurantId={restaurantId}
        waitlistCount={waitlistCount}
        waitlistEntries={waitlistEntriesSerialized}
        suggestedSeatings={suggestedSeatings}
      />
    </div>
  );
}
