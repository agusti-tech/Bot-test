import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { MapPin, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getLocalizedValue } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RestaurantCardProps {
  restaurant: {
    slug: string;
    name: any;
    description: any;
    address: string;
    phone: string | null;
  };
}

export default function RestaurantCard({ restaurant }: RestaurantCardProps) {
  const locale = useLocale();
  const t = useTranslations("home");

  return (
    <Card className="flex flex-col hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="text-xl">
          {getLocalizedValue(restaurant.name, locale)}
        </CardTitle>
        <CardDescription className="line-clamp-2">
          {getLocalizedValue(restaurant.description, locale)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>{restaurant.address}</span>
          </div>
        </div>
        <Link href={`/${locale}/restaurants/${restaurant.slug}`}>
          <Button className="w-full">{t("viewMenu")}</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
