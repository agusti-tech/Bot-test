"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Clock, CheckCircle, MapPin, UserPlus, RefreshCw } from "lucide-react";
import { getTableStatus, STATUS_COLORS, type TableStatus } from "@/lib/table-status";
import dynamic from "next/dynamic";
import TableDetailPanel from "./TableDetailPanel";
import WalkInDialog from "./WalkInDialog";
import TimelineView from "./TimelineView";

const FloorPlanLive = dynamic(() => import("./FloorPlanLive"), {
  ssr: false,
  loading: () => <div className="w-full h-[500px] bg-muted animate-pulse rounded-lg" />,
});

// Re-parse dates from serialized data
interface SerializedReservation {
  id: string;
  time: string;
  partySize: number;
  guestName: string;
  guestPhone: string;
  notes: string | null;
  status: string;
  source: string;
  estimatedDuration: number;
  seatedAt: string | null;
  completedAt: string | null;
}

export interface DashboardTable {
  id: string;
  label: string;
  maxCapacity: number;
  minCapacity: number;
  shape: string;
  zone: string | null;
  isActive: boolean;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation: number;
  reservations: SerializedReservation[];
}

interface HostDashboardProps {
  tables: DashboardTable[];
  restaurantId: string;
}

export default function HostDashboard({ tables, restaurantId }: HostDashboardProps) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 30000);
    return () => clearInterval(interval);
  }, [router]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1000);
  }, [router]);

  // Compute table statuses
  const now = new Date();
  const tableStatuses = tables.map((table) => {
    // Convert serialized dates back
    const tableWithDates = {
      ...table,
      reservations: table.reservations.map((r) => ({
        ...r,
        seatedAt: r.seatedAt ? new Date(r.seatedAt) : null,
        completedAt: r.completedAt ? new Date(r.completedAt) : null,
      })),
    };
    return {
      table,
      statusInfo: getTableStatus(tableWithDates, now),
    };
  });

  // Summary stats
  const activeTables = tableStatuses.filter((ts) => ts.table.isActive);
  const totalCovers = tables.reduce(
    (sum, t) => sum + t.reservations.filter((r) => r.status !== "CANCELLED" && r.status !== "NO_SHOW").reduce((s, r) => s + r.partySize, 0),
    0
  );
  const seatedNow = tableStatuses.filter((ts) => ts.statusInfo.status === "occupied").length;
  const upcomingCount = tableStatuses.reduce(
    (sum, ts) => sum + ts.statusInfo.upcomingReservations.length,
    0
  );
  const availableCount = tableStatuses.filter(
    (ts) => ts.statusInfo.status === "available"
  ).length;

  const selectedTable = selectedTableId
    ? tableStatuses.find((ts) => ts.table.id === selectedTableId)
    : null;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <div className="text-2xl font-bold">{totalCovers}</div>
              <div className="text-xs text-muted-foreground">{t("totalCovers")}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-red-500" />
            <div>
              <div className="text-2xl font-bold">{seatedNow}</div>
              <div className="text-xs text-muted-foreground">{t("seatedNow")}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-500" />
            <div>
              <div className="text-2xl font-bold">{upcomingCount}</div>
              <div className="text-xs text-muted-foreground">{t("upcomingReservations")}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <MapPin className="h-8 w-8 text-green-500" />
            <div>
              <div className="text-2xl font-bold">{availableCount}/{activeTables.length}</div>
              <div className="text-xs text-muted-foreground">{t("availableTables")}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["available", "reserved", "occupied", "cleaning", "blocked"] as TableStatus[]).map(
            (status) => (
              <Badge key={status} variant="outline" className="gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[status] }}
                />
                {t(`status${status.charAt(0).toUpperCase() + status.slice(1)}` as Parameters<typeof t>[0])}
              </Badge>
            )
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? t("refreshing") : "Refresh"}
          </Button>
          <Button size="sm" onClick={() => setWalkInOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            {t("walkIn")}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Tabs defaultValue="floorplan">
            <TabsList>
              <TabsTrigger value="floorplan">{t("floorPlanView")}</TabsTrigger>
              <TabsTrigger value="timeline">{t("timelineView")}</TabsTrigger>
            </TabsList>
            <TabsContent value="floorplan">
              <Card>
                <CardContent className="p-2">
                  <FloorPlanLive
                    tableStatuses={tableStatuses.map((ts) => ({
                      table: ts.table,
                      status: ts.statusInfo.status,
                      currentReservation: ts.statusInfo.currentReservation
                        ? {
                            guestName: ts.statusInfo.currentReservation.guestName,
                            partySize: ts.statusInfo.currentReservation.partySize,
                          }
                        : null,
                    }))}
                    selectedId={selectedTableId}
                    onSelect={setSelectedTableId}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="timeline">
              <Card>
                <CardContent className="p-4">
                  <TimelineView tables={tables} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Detail panel */}
        {selectedTable && (
          <TableDetailPanel
            table={selectedTable.table}
            statusInfo={selectedTable.statusInfo}
            onClose={() => setSelectedTableId(null)}
          />
        )}
      </div>

      {/* Walk-in dialog */}
      <WalkInDialog
        open={walkInOpen}
        onOpenChange={setWalkInOpen}
        tables={tables}
        restaurantId={restaurantId}
      />
    </div>
  );
}
