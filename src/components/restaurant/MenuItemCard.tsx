import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLocalizedValue, formatPrice } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface MenuItemCardProps {
  item: {
    id: string;
    name: any;
    description: any;
    price: any;
    dietaryTags: string[];
    isAvailable: boolean;
    imageUrl: string | null;
  };
}

export default function MenuItemCard({ item }: MenuItemCardProps) {
  const locale = useLocale();
  const t = useTranslations("menu");

  return (
    <Card className="overflow-hidden">
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
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {t(`dietary.${tag}` as Parameters<typeof t>[0])}
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
  );
}
