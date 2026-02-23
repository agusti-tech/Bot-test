import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
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

  // Fetch tables with today's reservations
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
      },
    },
  });

  const serialized = tables.map((t) => ({
    id: t.id,
    label: t.label,
    maxCapacity: t.maxCapacity,
    minCapacity: t.minCapacity,
    shape: t.shape as string,
    zone: t.zone,
    isActive: t.isActive,
    posX: t.posX,
    posY: t.posY,
    width: t.width,
    height: t.height,
    rotation: t.rotation,
    reservations: t.reservations.map((r) => ({
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
    })),
  }));

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">{t("hostDashboard")}</h1>
      <HostDashboard tables={serialized} restaurantId={restaurantId} />
    </div>
  );
}
