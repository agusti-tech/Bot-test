import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getLocalizedValue, formatPrice } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = await getTranslations("restaurant");
  const tMenu = await getTranslations("menu");
  const tDays = await getTranslations("days");

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug, isActive: true },
    include: {
      categories: {
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            where: { isAvailable: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  if (!restaurant) {
    notFound();
  }

  const openingHours = restaurant.openingHours as Record<
    string,
    { open: string; close: string } | null
  >;

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Restaurant Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          {getLocalizedValue(restaurant.name, locale)}
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl mb-6">
          {getLocalizedValue(restaurant.description, locale)}
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Contact Info */}
          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
                <span>{restaurant.address}</span>
              </div>
              {restaurant.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground shrink-0" />
                  <a
                    href={`tel:${restaurant.phone}`}
                    className="hover:underline"
                  >
                    {restaurant.phone}
                  </a>
                </div>
              )}
              {restaurant.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
                  <a
                    href={`mailto:${restaurant.email}`}
                    className="hover:underline"
                  >
                    {restaurant.email}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Opening Hours */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">{t("openingHours")}</h3>
              </div>
              <div className="space-y-1 text-sm">
                {DAYS.map((day) => {
                  const hours = openingHours[day];
                  return (
                    <div
                      key={day}
                      className="flex justify-between"
                    >
                      <span className="text-muted-foreground">
                        {tDays(day)}
                      </span>
                      <span>
                        {hours
                          ? `${hours.open} – ${hours.close}`
                          : t("closed")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator className="mb-12" />

      {/* Menu */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-8">
          {t("menuTitle")}
        </h2>

        <div className="space-y-10">
          {restaurant.categories.map((category) => {
            if (category.items.length === 0) return null;
            return (
              <section key={category.id} className="space-y-4">
                <h3 className="text-2xl font-semibold border-b pb-2">
                  {getLocalizedValue(category.name, locale)}
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {category.items.map((item) => (
                    <Card key={item.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 space-y-1">
                            <h4 className="font-medium">
                              {getLocalizedValue(item.name, locale)}
                            </h4>
                            {item.description && (
                              <p className="text-sm text-muted-foreground">
                                {getLocalizedValue(item.description, locale)}
                              </p>
                            )}
                            {item.dietaryTags.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {item.dietaryTags.map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {tMenu(
                                      `dietary.${tag}` as Parameters<
                                        typeof tMenu
                                      >[0]
                                    )}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-right font-semibold whitespace-nowrap">
                            {formatPrice(item.price)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
