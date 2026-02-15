import { auth } from "@/../auth";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import MenuManager from "@/components/admin/MenuManager";

export default async function MenuPage() {
  const session = await auth();
  const t = await getTranslations("admin");

  const role = (session?.user as unknown as Record<string, unknown>)?.role as string;
  const restaurantId = (session?.user as unknown as Record<string, unknown>)
    ?.restaurantId as string | null;

  let restaurant;
  if (role === "SUPER_ADMIN") {
    restaurant = await prisma.restaurant.findFirst({
      include: {
        categories: {
          orderBy: { sortOrder: "asc" },
          include: {
            items: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });
  } else if (restaurantId) {
    restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        categories: {
          orderBy: { sortOrder: "asc" },
          include: {
            items: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });
  }

  if (!restaurant) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-4">{t("menuManagement")}</h1>
        <p className="text-muted-foreground">No restaurant found.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">{t("menuManagement")}</h1>
      <MenuManager
        categories={JSON.parse(JSON.stringify(restaurant.categories))}
      />
    </div>
  );
}
