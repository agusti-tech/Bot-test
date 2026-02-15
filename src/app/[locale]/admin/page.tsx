import { auth } from "@/../auth";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Store, UtensilsCrossed, Layers, CalendarDays } from "lucide-react";

export default async function AdminDashboard() {
  const session = await auth();
  const t = await getTranslations("admin");
  const role = (session?.user as unknown as Record<string, unknown>)?.role;
  const restaurantId = (session?.user as unknown as Record<string, unknown>)
    ?.restaurantId as string | null;

  const isSuper = role === "SUPER_ADMIN";
  const where = isSuper ? {} : { restaurantId: restaurantId! };
  const restaurantWhere = isSuper ? {} : { id: restaurantId! };

  const [restaurantCount, categoryCount, itemCount, reservationCount] =
    await Promise.all([
      prisma.restaurant.count({ where: restaurantWhere }),
      prisma.menuCategory.count({ where }),
      prisma.menuItem.count({
        where: { category: where },
      }),
      prisma.reservation.count({
        where: { ...where, status: "PENDING" },
      }),
    ]);

  const stats = [
    {
      label: t("totalRestaurants"),
      value: restaurantCount,
      icon: Store,
    },
    {
      label: t("totalCategories"),
      value: categoryCount,
      icon: Layers,
    },
    {
      label: t("totalMenuItems"),
      value: itemCount,
      icon: UtensilsCrossed,
    },
    {
      label: t("pendingReservations"),
      value: reservationCount,
      icon: CalendarDays,
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">{t("dashboard")}</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
