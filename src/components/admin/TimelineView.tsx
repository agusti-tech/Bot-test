"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { DashboardTable } from "./HostDashboard";

interface TimelineViewProps {
  tables: DashboardTable[];
}

const HOUR_START = 11; // 11:00
const HOUR_END = 23;   // 23:00
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
const HOUR_WIDTH = 80; // pixels per hour
const ROW_HEIGHT = 44;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToX(minutes: number): number {
  return ((minutes - HOUR_START * 60) / 60) * HOUR_WIDTH;
}

const RESERVATION_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#3b82f6",
  COMPLETED: "#22c55e",
  NO_SHOW: "#ef4444",
  CANCELLED: "#9ca3af",
};

export default function TimelineView({ tables }: TimelineViewProps) {
  const t = useTranslations("admin");

  const activeTables = useMemo(
    () => tables.filter((t) => t.isActive).sort((a, b) => a.label.localeCompare(b.label)),
    [tables]
  );

  const totalWidth = HOURS.length * HOUR_WIDTH;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const nowX = minutesToX(nowMinutes);

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: totalWidth + 100 }}>
        {/* Header row with hours */}
        <div className="flex border-b sticky top-0 bg-background z-10">
          <div className="w-24 shrink-0 px-2 py-2 text-xs font-medium text-muted-foreground border-r">
            {t("table")}
          </div>
          <div className="relative flex" style={{ width: totalWidth }}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="text-xs text-muted-foreground py-2 border-r text-center"
                style={{ width: HOUR_WIDTH }}
              >
                {`${hour.toString().padStart(2, "0")}:00`}
              </div>
            ))}
          </div>
        </div>

        {/* Table rows */}
        {activeTables.map((table) => (
          <div key={table.id} className="flex border-b hover:bg-muted/30">
            <div className="w-24 shrink-0 px-2 flex items-center text-sm font-medium border-r">
              <span className="truncate" title={table.zone || undefined}>
                {table.label}
              </span>
            </div>
            <div
              className="relative"
              style={{ width: totalWidth, height: ROW_HEIGHT }}
            >
              {/* Hour grid lines */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute top-0 bottom-0 border-r border-dashed border-muted"
                  style={{ left: (hour - HOUR_START) * HOUR_WIDTH }}
                />
              ))}

              {/* Now indicator */}
              {nowX >= 0 && nowX <= totalWidth && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                  style={{ left: nowX }}
                />
              )}

              {/* Reservation blocks */}
              {table.reservations
                .filter((r) => r.status !== "CANCELLED")
                .map((res) => {
                  const startMins = timeToMinutes(res.time);
                  const endMins = startMins + res.estimatedDuration;
                  const left = minutesToX(startMins);
                  const width = minutesToX(endMins) - left;
                  const color =
                    RESERVATION_COLORS[res.status] || "#6b7280";

                  if (left + width < 0 || left > totalWidth) return null;

                  return (
                    <div
                      key={res.id}
                      className="absolute top-1 rounded-md px-1.5 overflow-hidden text-white text-xs flex items-center cursor-default"
                      style={{
                        left: Math.max(0, left),
                        width: Math.min(width, totalWidth - left),
                        height: ROW_HEIGHT - 8,
                        backgroundColor: color,
                        opacity: res.status === "NO_SHOW" ? 0.5 : 0.85,
                      }}
                      title={`${res.guestName} (${res.partySize}p) — ${res.time} — ${res.status}`}
                    >
                      <span className="truncate">
                        {res.guestName.split(" ")[0]} ({res.partySize})
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}

        {/* Empty state */}
        {activeTables.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {t("noTables")}
          </div>
        )}
      </div>
    </div>
  );
}
