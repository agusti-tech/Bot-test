import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import TableManager from "@/components/admin/TableManager";

async function getSessionRestaurantId(): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const role = (session.user as unknown as Record<string, unknown>)
    .role as string;
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

export default async function TablesPage() {
  const t = await getTranslations("admin");
  const restaurantId = await getSessionRestaurantId();

  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId },
    orderBy: { sortOrder: "asc" },
  });

  const serialized = tables.map((t) => ({
    id: t.id,
    label: t.label,
    minCapacity: t.minCapacity,
    maxCapacity: t.maxCapacity,
    shape: t.shape,
    zone: t.zone,
    isActive: t.isActive,
    isCombinable: t.isCombinable,
    posX: t.posX,
    posY: t.posY,
    width: t.width,
    height: t.height,
    rotation: t.rotation,
    sortOrder: t.sortOrder,
  }));

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">{t("tables")}</h1>
      <TableManager tables={serialized} />
    </div>
  );
}
