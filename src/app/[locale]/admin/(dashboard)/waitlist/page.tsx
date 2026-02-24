import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { getTableStatus } from "@/lib/table-status";
import WaitlistManager from "@/components/admin/WaitlistManager";

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

export default async function WaitlistPage() {
  const t = await getTranslations("admin");
  const restaurantId = await getSessionRestaurantId();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [rawEntries, tablesWithReservations] = await Promise.all([
    prisma.waitlistEntry.findMany({
      where: {
        restaurantId,
        createdAt: { gte: todayStart, lt: todayEnd },
        status: { in: ["WAITING", "NOTIFIED", "SEATED", "LEFT", "CANCELLED"] },
      },
      orderBy: { createdAt: "asc" },
      include: { table: { select: { id: true, label: true } } },
    }),
    prisma.restaurantTable.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: "asc" },
      include: {
        reservations: {
          where: {
            date: today,
            status: { notIn: ["CANCELLED"] },
          },
          orderBy: { time: "asc" },
        },
      },
    }),
  ]);

  const statusOrder: Record<string, number> = { WAITING: 0, NOTIFIED: 1, SEATED: 2, LEFT: 3, CANCELLED: 4 };
  const entries = rawEntries.sort(
    (a, b) =>
      statusOrder[a.status] - statusOrder[b.status] ||
      a.createdAt.getTime() - b.createdAt.getTime()
  );

  const serializedEntries = entries.map((e) => ({
    id: e.id,
    guestName: e.guestName,
    guestPhone: e.guestPhone,
    partySize: e.partySize,
    notes: e.notes,
    seatingPref: e.seatingPref,
    estimatedWaitMin: e.estimatedWaitMin,
    status: e.status,
    tableId: e.tableId,
    tableLabel: e.table?.label ?? null,
    notifiedAt: e.notifiedAt?.toISOString() ?? null,
    seatedAt: e.seatedAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
  }));

  const now = new Date();
  const availableTables = tablesWithReservations
    .filter((table) => {
      const tableForStatus = {
        id: table.id,
        label: table.label,
        maxCapacity: table.maxCapacity,
        minCapacity: table.minCapacity,
        shape: table.shape,
        zone: table.zone,
        isActive: table.isActive,
        posX: table.posX,
        posY: table.posY,
        width: table.width,
        height: table.height,
        rotation: table.rotation,
        reservations: table.reservations.map((r) => ({
          id: r.id,
          time: r.time,
          partySize: r.partySize,
          guestName: r.guestName,
          guestPhone: r.guestPhone,
          notes: r.notes,
          status: r.status,
          source: r.source,
          estimatedDuration: r.estimatedDuration,
          seatedAt: r.seatedAt,
          completedAt: r.completedAt,
          cleaningClearedAt: r.cleaningClearedAt ?? null,
        })),
      };
      const statusInfo = getTableStatus(tableForStatus, now);
      return statusInfo.status === "available";
    })
    .map((t) => ({ id: t.id, label: t.label, maxCapacity: t.maxCapacity }));

  const serializedTables = availableTables;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">{t("waitlist")}</h1>
      <WaitlistManager entries={serializedEntries} tables={serializedTables} />
    </div>
  );
}
