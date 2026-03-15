import { getTranslations } from "next-intl/server";
import { getAnalyticsMetrics } from "@/app/[locale]/admin/(dashboard)/actions";
import MetricsDashboard from "@/components/admin/MetricsDashboard";

export default async function AnalyticsPage() {
  const t = await getTranslations("admin");
  const metrics = await getAnalyticsMetrics();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("analytics")}</h1>
      <MetricsDashboard metrics={metrics} />
    </div>
  );
}
