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

  const reservations = await prisma.reservation.findMany({
    where,
    orderBy: [{ date: "desc" }, { time: "asc" }],
    include: { table: { select: { label: true, zone: true } } },
  });

  // Serialize for the client component
  const serialized = reservations.map((r) => ({
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
    tableLabel: r.table?.label || null,
    tableZone: r.table?.zone || null,
  }));

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">{t("reservations")}</h1>
      <ReservationManager reservations={serialized} />
    </div>
  );
}
