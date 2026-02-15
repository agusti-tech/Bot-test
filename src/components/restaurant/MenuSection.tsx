import { useLocale, useTranslations } from "next-intl";
import { getLocalizedValue } from "@/lib/utils";
import MenuItemCard from "./MenuItemCard";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface MenuSectionProps {
  category: {
    id: string;
    name: any;
    items: Array<{
      id: string;
      name: any;
      description: any;
      price: any;
      dietaryTags: string[];
      isAvailable: boolean;
      imageUrl: string | null;
    }>;
  };
}

export default function MenuSection({ category }: MenuSectionProps) {
  const locale = useLocale();
  const t = useTranslations("menu");

  const availableItems = category.items.filter((item) => item.isAvailable);

  if (availableItems.length === 0) return null;

  return (
    <section className="space-y-4">
      <h3 className="text-2xl font-semibold border-b pb-2">
        {getLocalizedValue(category.name, locale)}
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        {availableItems.map((item) => (
          <MenuItemCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
