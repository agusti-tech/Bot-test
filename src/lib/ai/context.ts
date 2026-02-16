import { prisma } from "@/lib/prisma";
import { RestaurantContext } from "./types";

interface CacheEntry {
  data: RestaurantContext;
  expiry: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

export async function loadRestaurantContext(
  restaurantId: string
): Promise<RestaurantContext | null> {
  const cached = cache.get(restaurantId);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      address: true,
      phone: true,
      email: true,
      openingHours: true,
    },
  });

  if (!restaurant) return null;

  const context: RestaurantContext = {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name as { en: string; de: string },
    description: restaurant.description as { en: string; de: string },
    address: restaurant.address,
    phone: restaurant.phone,
    email: restaurant.email,
    openingHours: restaurant.openingHours as Record<
      string,
      { open: string; close: string } | null
    >,
  };

  cache.set(restaurantId, { data: context, expiry: Date.now() + CACHE_TTL_MS });
  return context;
}
