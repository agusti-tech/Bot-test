import { auth } from "@/../auth";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getTokenBalance } from "@/lib/tokens";
import RestaurantForm from "@/components/admin/RestaurantForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  const tokenBalance = await getTokenBalance(restaurant.id);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{t("editRestaurant")}</h1>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{t("tokensBalance")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("tokensAllowance")}: {tokenBalance.allowanceMonthly}
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{tokenBalance.balance}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {t("tokensContactSupport")}
          </p>
        </CardContent>
      </Card>

      <RestaurantForm
        restaurant={JSON.parse(JSON.stringify(restaurant))}
        canChangeTier={role === "SUPER_ADMIN"}
      />
    </div>
  );
}
