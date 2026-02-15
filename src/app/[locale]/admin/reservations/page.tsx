import { getTranslations } from "next-intl/server";
import { CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default async function ReservationsPage() {
  const t = await getTranslations("admin");

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">{t("reservations")}</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <CalendarDays className="h-16 w-16 mb-4" />
          <p className="text-lg">{t("reservationsPlaceholder")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
