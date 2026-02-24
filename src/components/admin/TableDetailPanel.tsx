"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Users, Clock, CheckCircle, XCircle, Armchair, CircleCheck } from "lucide-react";
import { STATUS_COLORS, type TableStatusInfo } from "@/lib/table-status";
import { getSuggestedPartiesForTable } from "@/lib/waitlist";
import { seatReservation, completeReservation, markNoShow, clearCleaning } from "@/app/[locale]/admin/(dashboard)/actions";
import type { DashboardTable, WaitlistEntryRow } from "./HostDashboard";
import GuestBadge from "./GuestBadge";
import { toast } from "sonner";

interface TableDetailPanelProps {
  table: DashboardTable;
  statusInfo: TableStatusInfo;
  onClose: () => void;
  restaurantId?: string;
  waitlistEntries?: WaitlistEntryRow[];
  onSeatFromWaitlist?: (entryId: string) => Promise<void>;
}

function waitMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

export default function TableDetailPanel({
  table,
  statusInfo,
  onClose,
  restaurantId = "",
  waitlistEntries = [],
  onSeatFromWaitlist,
}: TableDetailPanelProps) {
  const t = useTranslations("admin");
  const [loading, setLoading] = useState<string | null>(null);

  const suggestedParties =
    statusInfo.status === "available" &&
    restaurantId &&
    waitlistEntries.length > 0
      ? getSuggestedPartiesForTable(
          restaurantId,
          table.id,
          waitlistEntries,
          table.maxCapacity,
          table.minCapacity
        ).slice(0, 5)
      : [];

  async function handleAction(
    action: (id: string) => Promise<{ success: boolean }>,
    reservationId: string
  ) {
    setLoading(reservationId);
    try {
      await action(reservationId);
    } catch {
      // Error handling via revalidation
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className="w-80 shrink-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Armchair className="h-5 w-5" />
            <CardTitle className="text-lg">{table.label}</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[statusInfo.status] }}
            />
            {t(`status${statusInfo.status.charAt(0).toUpperCase() + statusInfo.status.slice(1)}` as Parameters<typeof t>[0])}
          </Badge>
          {table.zone && (
            <Badge variant="secondary">{table.zone}</Badge>
          )}
          <Badge variant="outline">
            <Users className="h-3 w-3 mr-1" />
            {table.minCapacity}-{table.maxCapacity}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current reservation info */}
        {statusInfo.currentReservation && (
          <div className="rounded-lg border p-3 space-y-2">
            <div className="font-medium">
              {statusInfo.currentReservation.guest ? (
                <GuestBadge
                  name={statusInfo.currentReservation.guest.name}
                  totalVisits={statusInfo.currentReservation.guest.totalVisits}
                  noShowCount={statusInfo.currentReservation.guest.noShowCount}
                />
              ) : (
                statusInfo.currentReservation.guestName
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {statusInfo.currentReservation.partySize}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {statusInfo.currentReservation.time}
              </span>
            </div>

            {statusInfo.minutesOccupied !== null && (
              <div className="text-sm text-muted-foreground">
                {t("seatedFor")} {statusInfo.minutesOccupied} {t("minutes")}
              </div>
            )}

            {statusInfo.estimatedFreeAt && (
              <div className="text-sm text-muted-foreground">
                {t("estimatedEnd")}: {statusInfo.estimatedFreeAt}
              </div>
            )}

            {statusInfo.currentReservation.notes && (
              <div className="text-sm text-muted-foreground italic">
                {statusInfo.currentReservation.notes}
              </div>
            )}

            {/* Action buttons based on status */}
            <div className="flex gap-2 pt-1">
              {statusInfo.status === "reserved" && (
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={loading === statusInfo.currentReservation.id}
                  onClick={() =>
                    handleAction(seatReservation, statusInfo.currentReservation!.id)
                  }
                >
                  <Armchair className="h-3.5 w-3.5 mr-1" />
                  {t("seat")}
                </Button>
              )}
              {statusInfo.status === "occupied" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={loading === statusInfo.currentReservation.id}
                  onClick={() =>
                    handleAction(completeReservation, statusInfo.currentReservation!.id)
                  }
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  {t("complete")}
                </Button>
              )}
              {statusInfo.status === "cleaning" && (
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={loading === statusInfo.currentReservation.id}
                  onClick={() =>
                    handleAction(clearCleaning, statusInfo.currentReservation!.id)
                  }
                >
                  <CircleCheck className="h-3.5 w-3.5 mr-1" />
                  {t("makeFree")}
                </Button>
              )}
              {(statusInfo.status === "reserved" ||
                statusInfo.status === "occupied") && (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={loading === statusInfo.currentReservation.id}
                  onClick={() =>
                    handleAction(markNoShow, statusInfo.currentReservation!.id)
                  }
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  {t("noShow")}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* No current reservation */}
        {!statusInfo.currentReservation && statusInfo.status === "available" && suggestedParties.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            {t("statusAvailable")}
          </div>
        )}

        {/* Seat from waitlist (available tables) */}
        {!statusInfo.currentReservation && statusInfo.status === "available" && suggestedParties.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              {t("seatFromWaitlist")}
            </div>
            {suggestedParties.map((entry, idx) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {entry.guestName}
                    {idx === 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {t("suggestedSeating")}
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground">
                    {entry.partySize}p &middot; {t("waitingTime")} {waitMinutes(entry.createdAt)} {t("minutes")}
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={loading === entry.id}
                  onClick={async () => {
                    if (!onSeatFromWaitlist) return;
                    setLoading(entry.id);
                    try {
                      await onSeatFromWaitlist(entry.id);
                      toast.success(t("seatedFromWaitlist") || "Seated from waitlist");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to seat");
                    } finally {
                      setLoading(null);
                    }
                  }}
                >
                  <Armchair className="h-3.5 w-3.5 mr-1" />
                  {t("seat")}
                </Button>
              </div>
            ))}
          </div>
        )}

        {!statusInfo.currentReservation && statusInfo.status === "available" && suggestedParties.length === 0 && waitlistEntries.length > 0 && (
          <div className="text-center py-2 text-xs text-muted-foreground">
            {t("noWaitlistSuggestions")}
          </div>
        )}

        {/* Upcoming reservations */}
        {statusInfo.upcomingReservations.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              {t("nextReservation")}
            </div>
            {statusInfo.upcomingReservations.slice(0, 3).map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {r.guest ? (
                      <GuestBadge
                        name={r.guest.name}
                        totalVisits={r.guest.totalVisits}
                        noShowCount={r.guest.noShowCount}
                      />
                    ) : (
                      r.guestName
                    )}
                  </div>
                  <div className="text-muted-foreground">
                    {r.time} &middot; {r.partySize}p
                  </div>
                </div>
                {!r.seatedAt && r.status !== "CANCELLED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading === r.id}
                    onClick={() => handleAction(seatReservation, r.id)}
                  >
                    {t("seat")}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* No upcoming */}
        {statusInfo.upcomingReservations.length === 0 &&
          !statusInfo.currentReservation && (
            <div className="text-center py-2 text-xs text-muted-foreground">
              {t("noUpcoming")}
            </div>
          )}
      </CardContent>
    </Card>
  );
}
