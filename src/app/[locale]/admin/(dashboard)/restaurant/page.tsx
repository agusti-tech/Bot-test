import { auth } from "@/../auth";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import RestaurantForm from "@/components/admin/RestaurantForm";

export default async function EditRestaurantPage() {
  const session = await auth();
  const t = await getTranslations("admin");

  const role = (session?.user as unknown as Record<string, unknown>)?.role as string;
  const restaurantId = (session?.user as unknown as Record<string, unknown>)
    ?.restaurantId as string | null;

  let restaurant;
  if (role === "SUPER_ADMIN") {
    restaurant = await prisma.restaurant.findFirst();
  } else if (restaurantId) {
    restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
  }

  if (!restaurant) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-4">{t("editRestaurant")}</h1>
        <p className="text-muted-foreground">No restaurant found.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">{t("editRestaurant")}</h1>
      <RestaurantForm restaurant={JSON.parse(JSON.stringify(restaurant))} />
    </div>
  );
}
