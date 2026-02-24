import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import ReservationManager from "@/components/admin/ReservationManager";

async function getSessionRestaurantId(): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const role = (session.user as unknown as Record<string, unknown>).role as string;
  const restaurantId = (session.user as unknown as Record<string, unknown>)
    .restaurantId as string | null;

  if (role === "SUPER_ADMIN") {
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) throw new Error("No restaurant found");
    return restaurant.id;
  }

  if (!restaurantId) throw new Error("No restaurant assigned");
  return restaurantId;
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string }>;
}) {
  const t = await getTranslations("admin");
  const restaurantId = await getSessionRestaurantId();
  const params = await searchParams;

  const where: Record<string, unknown> = { restaurantId };
  if (params.date) {
    where.date = new Date(params.date);
  }
  if (params.status && params.status !== "all") {
    where.status = params.status;
  }

  const DEFAULT_DURATION = 90;

  function timeToMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }

  function timeOverlap(
    time1: string,
    duration1: number,
    time2: string,
    duration2: number
  ): boolean {
    const start1 = timeToMinutes(time1);
    const end1 = start1 + duration1;
    const start2 = timeToMinutes(time2);
    const end2 = start2 + duration2;
    return start1 < end2 && end1 > start2;
  }

  function dateKey(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  const [reservations, tables] = await Promise.all([
    prisma.reservation.findMany({
      where,
      orderBy: [{ date: "desc" }, { time: "asc" }],
      include: {
        table: { select: { label: true, zone: true } },
        combinedWithTable: { select: { label: true } },
      },
    }),
    prisma.restaurantTable.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, maxCapacity: true, isCombinable: true, zone: true },
    }),
  ]);

  // For each reservation, compute table ids that are free for its date/time slot
  function availableTableIdsFor(
    res: { id: string; date: Date; time: string; estimatedDuration: number; tableId: string | null; combinedWithTableId?: string | null }
  ): string[] {
    const resDateKey = dateKey(res.date);
    const duration = res.estimatedDuration ?? DEFAULT_DURATION;
    return tables
      .filter((t) => {
        const hasConflict = reservations.some(
          (other) =>
            other.id !== res.id &&
            (other.tableId === t.id || other.combinedWithTableId === t.id) &&
            other.status !== "CANCELLED" &&
            other.status !== "NO_SHOW" &&
            dateKey(other.date) === resDateKey &&
            timeOverlap(res.time, duration, other.time, other.estimatedDuration ?? DEFAULT_DURATION)
        );
        return !hasConflict;
      })
      .map((t) => t.id);
  }

  // Serialize for the client component
  const serialized = reservations.map((r) => {
    const availableTableIds = availableTableIdsFor({
      id: r.id,
      date: r.date,
      time: r.time,
      estimatedDuration: r.estimatedDuration ?? DEFAULT_DURATION,
      tableId: r.tableId,
      combinedWithTableId: r.combinedWithTableId,
    });
    const tableLabel = r.combinedWithTable
      ? `${r.table?.label ?? ""} + ${r.combinedWithTable.label}`
      : r.table?.label ?? null;
    return {
      id: r.id,
      date: r.date.toISOString(),
      time: r.time,
      partySize: r.partySize,
      guestName: r.guestName,
      guestEmail: r.guestEmail,
      guestPhone: r.guestPhone,
      notes: r.notes,
      status: r.status,
      source: r.source,
      createdAt: r.createdAt.toISOString(),
      tableId: r.tableId || null,
      combinedWithTableId: r.combinedWithTableId || null,
      tableLabel,
      tableZone: r.table?.zone || null,
      seatingPreference: r.seatingPreference || null,
      estimatedDuration: r.estimatedDuration ?? DEFAULT_DURATION,
      availableTableIds,
    };
  });

  const tablesList = tables.map((t) => ({
    id: t.id,
    label: t.label,
    maxCapacity: t.maxCapacity,
    isCombinable: t.isCombinable,
    zone: t.zone,
  }));

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">{t("reservations")}</h1>
      <ReservationManager reservations={serialized} tables={tablesList} />
    </div>
  );
}
