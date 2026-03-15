"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CalendarDays,
  Users,
  Clock,
  List,
  Phone,
  Bot,
  UserPlus,
  Globe,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateAverageDiningOverride } from "@/app/[locale]/admin/(dashboard)/actions";
import { toast } from "sonner";

type PeriodMetrics = {
  reservations: number;
  byStatus: { completed: number; noShow: number; cancelled: number; pending: number };
  bySource: { phone: number; ai: number; walkIn: number; web: number };
  covers: number;
  avgPartySize: number;
};

type Metrics = {
  today: PeriodMetrics;
  week: PeriodMetrics;
  month: PeriodMetrics;
  averageDiningFromHistory: number | null;
  averageDiningOverride: number | null;
  diningDurationSampleSize: number;
  totalGuests: number;
  totalVisits: number;
  totalNoShows: number;
  noShowRate: number;
  waitlistToday: number;
  waitlistNotified: number;
  avgWaitMinutes: number | null;
};

export default function MetricsDashboard({ metrics }: { metrics: Metrics }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const [overrideMinutes, setOverrideMinutes] = useState<string>(
    metrics.averageDiningOverride != null ? String(metrics.averageDiningOverride) : ""
  );
  const [savingOverride, setSavingOverride] = useState(false);

  useEffect(() => {
    setOverrideMinutes(metrics.averageDiningOverride != null ? String(metrics.averageDiningOverride) : "");
  }, [metrics.averageDiningOverride]);

  const m = metrics[period];

  async function handleSaveOverride() {
    const val = overrideMinutes.trim() === "" ? null : parseInt(overrideMinutes, 10);
    if (val !== null && (isNaN(val) || val < 1)) {
      toast.error(t("analyticsInvalidDuration"));
      return;
    }
    setSavingOverride(true);
    try {
      await updateAverageDiningOverride(val);
      toast.success(t("saved"));
      router.refresh();
    } catch {
      toast.error(t("error"));
    } finally {
      setSavingOverride(false);
    }
  }

  return (
    <div className="space-y-6">
      <Tabs value={period} onValueChange={(v) => setPeriod(v as "today" | "week" | "month")}>
        <TabsList>
          <TabsTrigger value="today">{t("analyticsToday")}</TabsTrigger>
          <TabsTrigger value="week">{t("analyticsWeek")}</TabsTrigger>
          <TabsTrigger value="month">{t("analyticsMonth")}</TabsTrigger>
        </TabsList>

        <TabsContent value={period} className="space-y-6 mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t("analyticsReservations")}</CardTitle>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{m.reservations}</div>
                <p className="text-xs text-muted-foreground">
                  {t("completed")}: {m.byStatus.completed} · {t("noShow")}: {m.byStatus.noShow} · {t("cancelled")}: {m.byStatus.cancelled}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t("analyticsCovers")}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{m.covers}</div>
                <p className="text-xs text-muted-foreground">
                  {t("analyticsAvgPartySize")}: {m.avgPartySize}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t("analyticsBySource")}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3" /> {t("sourcePhone")}: {m.bySource.phone}
                </div>
                <div className="flex items-center gap-2">
                  <Bot className="h-3 w-3" /> {t("sourceAI")}: {m.bySource.ai}
                </div>
                <div className="flex items-center gap-2">
                  <UserPlus className="h-3 w-3" /> {t("sourceWalkIn")}: {m.bySource.walkIn}
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-3 w-3" /> {t("sourceWeb")}: {m.bySource.web}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t("analyticsAvgDiningDuration")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("analyticsAvgDiningDescription")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-baseline gap-4">
            {metrics.averageDiningFromHistory != null ? (
              <p className="text-sm">
                {t("analyticsFromHistory")}: <strong>{metrics.averageDiningFromHistory} min</strong>
                {metrics.diningDurationSampleSize > 0 && (
                  <span className="text-muted-foreground ml-1">
                    ({t("analyticsBasedOn", { count: metrics.diningDurationSampleSize })})
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("analyticsNoHistoryYet")}</p>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="override-duration">{t("analyticsOverrideMinutes")}</Label>
              <Input
                id="override-duration"
                type="number"
                min={1}
                placeholder={metrics.averageDiningFromHistory != null ? String(metrics.averageDiningFromHistory) : "90"}
                value={overrideMinutes}
                onChange={(e) => setOverrideMinutes(e.target.value)}
                className="w-28"
              />
            </div>
            <Button onClick={handleSaveOverride} disabled={savingOverride}>
              <Save className="h-4 w-4 mr-1" />
              {savingOverride ? "..." : t("saveChanges")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("analyticsOverrideHint")}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("guests")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalGuests}</div>
            <p className="text-xs text-muted-foreground">
              {t("analyticsTotalVisits")}: {metrics.totalVisits} · {t("analyticsNoShowRate")}: {metrics.noShowRate}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("waitlist")} ({t("analyticsToday")})</CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.waitlistToday}</div>
            <p className="text-xs text-muted-foreground">
              {t("analyticsNotified")}: {metrics.waitlistNotified}
              {metrics.avgWaitMinutes != null && ` · ${t("analyticsAvgWait")}: ${metrics.avgWaitMinutes} min`}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
