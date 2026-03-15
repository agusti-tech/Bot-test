import type { Restaurant, MenuCategory, MenuItem } from "@prisma/client";

export type OpeningHoursMap = Record<
  string,
  { open: string; close: string } | null
>;

export type RestaurantWithMenu = Restaurant & {
  categories: (MenuCategory & {
    items: MenuItem[];
  })[];
};

export interface RestaurantPageProps {
  restaurant: RestaurantWithMenu;
  locale: string;
  openingHours: OpeningHoursMap;
}
