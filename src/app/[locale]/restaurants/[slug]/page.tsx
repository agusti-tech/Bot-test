import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import BasicRestaurantTemplate from "@/components/restaurant/templates/BasicRestaurantTemplate";
import EditorialRestaurantTemplate from "@/components/restaurant/templates/EditorialRestaurantTemplate";
import PremiumRestaurantTemplate from "@/components/restaurant/templates/PremiumRestaurantTemplate";

const VALID_SITE_TIERS = ["basic", "editorial", "premium"] as const;
type SiteTier = (typeof VALID_SITE_TIERS)[number];

function isSiteTier(value: unknown): value is SiteTier {
  return typeof value === "string" && VALID_SITE_TIERS.includes(value as SiteTier);
}

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();

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

  const siteTierRaw = (restaurant.settings as Record<string, unknown>)?.siteTier;
  const siteTier: SiteTier = isSiteTier(siteTierRaw) ? siteTierRaw : "basic";

  const props = { restaurant, locale, openingHours };

  if (siteTier === "editorial") {
    return <EditorialRestaurantTemplate {...props} />;
  }
  if (siteTier === "premium") {
    return <PremiumRestaurantTemplate {...props} />;
  }
  return <BasicRestaurantTemplate {...props} />;
}
