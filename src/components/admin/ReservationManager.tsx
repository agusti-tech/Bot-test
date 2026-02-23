"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateReservationStatus } from "@/app/[locale]/admin/actions";
import { toast } from "sonner";

interface Reservation {
  id: string;
  date: string; // ISO string
  time: string;
  partySize: number;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string;
  notes: string | null;
  status: string;
  source: string;
  createdAt: string;
  tableLabel: string | null;
  tableZone: string | null;
}

interface ReservationManagerProps {
  reservations: Reservation[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  CONFIRMED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  COMPLETED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  NO_SHOW: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

const SOURCE_COLORS: Record<string, string> = {
  web: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  phone: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  ai_assistant: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  walk_in: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
};

// Valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "NO_SHOW", "CANCELLED"],
  CANCELLED: [],
  COMPLETED: [],
  NO_SHOW: [],
};

export default function ReservationManager({
  reservations,
}: ReservationManagerProps) {
  const t = useTranslations("admin");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const currentDate = searchParams.get("date") || "";
  const currentStatus = searchParams.get("status") || "all";

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  }

  async function handleStatusUpdate(id: string, newStatus: string) {
    setUpdatingId(id);
    try {
      const result = await updateReservationStatus(id, newStatus);
      if (result.success) {
        toast.success(t("saved"));
        startTransition(() => {
          router.refresh();
        });
      }
    } catch {
      toast.error(t("error") || "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function getSourceLabel(source: string) {
    switch (source) {
      case "web":
        return t("sourceWeb");
      case "phone":
        return t("sourcePhone");
      case "ai_assistant":
        return t("sourceAI");
      case "walk_in":
        return t("sourceWalkIn");
      default:
        return source;
    }
  }

  function getStatusLabel(status: string) {
    const map: Record<string, string> = {
      PENDING: t("pending"),
      CONFIRMED: t("confirmed"),
      CANCELLED: t("cancelled"),
      COMPLETED: t("completed"),
      NO_SHOW: t("noShow"),
    };
    return map[status] || status;
  }

  // Stats
  const today = new Date().toISOString().split("T")[0];
  const todayCount = reservations.filter(
    (r) => r.date.split("T")[0] === today
  ).length;
  const pendingCount = reservations.filter(
    (r) => r.status === "PENDING"
  ).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{reservations.length}</div>
            <div className="text-sm text-muted-foreground">
              {t("reservations")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{todayCount}</div>
            <div className="text-sm text-muted-foreground">
              {t("todayReservations")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{pendingCount}</div>
            <div className="text-sm text-muted-foreground">
              {t("pendingReservations")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          type="date"
          value={currentDate}
          onChange={(e) => updateFilter("date", e.target.value)}
          className="sm:w-48"
          aria-label={t("filterByDate")}
        />
        <Select
          value={currentStatus}
          onValueChange={(val) => updateFilter("status", val)}
        >
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder={t("filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="PENDING">{t("pending")}</SelectItem>
            <SelectItem value="CONFIRMED">{t("confirmed")}</SelectItem>
            <SelectItem value="CANCELLED">{t("cancelled")}</SelectItem>
            <SelectItem value="COMPLETED">{t("completed")}</SelectItem>
            <SelectItem value="NO_SHOW">{t("noShow")}</SelectItem>
          </SelectContent>
        </Select>
        {(currentDate || currentStatus !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("?")}
            className="self-start"
          >
            {t("clearFilters")}
          </Button>
        )}
      </div>

      {/* Table */}
      {reservations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CalendarDays className="h-16 w-16 mb-4" />
            <p className="text-lg">{t("noReservations")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("time")}</TableHead>
                  <TableHead>{t("guestName")}</TableHead>
                  <TableHead>{t("partySize")}</TableHead>
                  <TableHead>{t("guestPhone")}</TableHead>
                  <TableHead>{t("table")}</TableHead>
                  <TableHead>{t("source")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((reservation) => {
                  const transitions =
                    STATUS_TRANSITIONS[reservation.status] || [];
                  return (
                    <TableRow key={reservation.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(reservation.date)}
                      </TableCell>
                      <TableCell>{reservation.time}</TableCell>
                      <TableCell>
                        <div>{reservation.guestName}</div>
                        {reservation.notes && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {reservation.notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{reservation.partySize}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {reservation.guestPhone}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {reservation.tableLabel ? (
                          <span className="font-medium">{reservation.tableLabel}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t("unassigned")}</span>
                        )}
                        {reservation.tableZone && (
                          <div className="text-xs text-muted-foreground">{reservation.tableZone}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={SOURCE_COLORS[reservation.source] || ""}
                        >
                          {getSourceLabel(reservation.source)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={STATUS_COLORS[reservation.status] || ""}
                        >
                          {getStatusLabel(reservation.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {transitions.length > 0 ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={
                                  isPending || updatingId === reservation.id
                                }
                              >
                                {updatingId === reservation.id
                                  ? "..."
                                  : t("actions")}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {transitions.map((status) => (
                                <DropdownMenuItem
                                  key={status}
                                  onClick={() =>
                                    handleStatusUpdate(reservation.id, status)
                                  }
                                >
                                  {getStatusLabel(status)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
