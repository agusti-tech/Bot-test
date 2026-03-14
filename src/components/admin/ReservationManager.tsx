"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDays, Plus, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { updateReservationStatus, createReservation, updateReservation, autoAssignTables } from "@/app/[locale]/admin/(dashboard)/actions";
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
  tableId: string | null;
  combinedWithTableId: string | null;
  tableLabel: string | null;
  tableZone: string | null;
  seatingPreference: string | null;
  /** Table ids that are free for this reservation's date/time (no overlap). */
  availableTableIds?: string[];
}

const TABLE_PREFERENCE_OPTIONS: { value: string; labelKey: string }[] = [
  { value: "any", labelKey: "tablePreferenceAny" },
  { value: "regular", labelKey: "tablePreferenceRegular" },
  { value: "patio", labelKey: "tablePreferencePatio" },
  { value: "bar", labelKey: "tablePreferenceBar" },
  { value: "booth", labelKey: "tablePreferenceBooth" },
  { value: "window", labelKey: "tablePreferenceWindow" },
];

interface TableOption {
  id: string;
  label: string;
  maxCapacity: number;
  isCombinable: boolean;
  zone: string | null;
}

/** Single table option for dropdown (fits party size and is available). */
interface SingleTableOption {
  type: "single";
  value: string;
  label: string;
  capacity: number;
}

/** Combined table option (two combinable tables, same zone). */
interface CombinedTableOption {
  type: "combined";
  value: string; // "primaryId|combinedId"
  label: string;
  capacity: number;
}

type AssignTableOption = SingleTableOption | CombinedTableOption;

function getAssignTableOptions(
  tables: TableOption[],
  partySize: number,
  availableTableIds: string[] | undefined
): AssignTableOption[] {
  const availableSet = new Set(availableTableIds ?? tables.map((t) => t.id));
  const options: AssignTableOption[] = [];

  // Single tables: fit party size and are available
  const single = tables
    .filter((t) => t.maxCapacity >= partySize && availableSet.has(t.id))
    .sort((a, b) => a.maxCapacity - b.maxCapacity);
  single.forEach((t) => {
    options.push({
      type: "single",
      value: t.id,
      label: `${t.label} (${t.maxCapacity})`,
      capacity: t.maxCapacity,
    });
  });

  // Combined pairs: same zone, both combinable, both available, combined capacity >= partySize
  // Add both "id1|id2" and "id2|id1" so edit form can show current assignment either way
  const combinable = tables.filter((t) => t.isCombinable && availableSet.has(t.id));
  for (let i = 0; i < combinable.length; i++) {
    for (let j = i + 1; j < combinable.length; j++) {
      const t1 = combinable[i];
      const t2 = combinable[j];
      if (t1.zone !== t2.zone) continue;
      const combinedCapacity = t1.maxCapacity + t2.maxCapacity;
      if (combinedCapacity < partySize) continue;
      const label = `${t1.label} + ${t2.label} (${combinedCapacity})`;
      options.push({ type: "combined", value: `${t1.id}|${t2.id}`, label, capacity: combinedCapacity });
      options.push({ type: "combined", value: `${t2.id}|${t1.id}`, label, capacity: combinedCapacity });
    }
  }

  return options;
}

interface ReservationManagerProps {
  reservations: Reservation[];
  tables: TableOption[];
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

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export default function ReservationManager({
  reservations,
  tables,
}: ReservationManagerProps) {
  const t = useTranslations("admin");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState(todayISO());
  const [addTime, setAddTime] = useState("19:00");
  const [addGuestName, setAddGuestName] = useState("");
  const [addGuestPhone, setAddGuestPhone] = useState("");
  const [addPartySize, setAddPartySize] = useState(2);
  const [addTableId, setAddTableId] = useState<string>("");
  const [addSeatingPreference, setAddSeatingPreference] = useState<string>("");
  const [addNotes, setAddNotes] = useState("");

  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editGuestName, setEditGuestName] = useState("");
  const [editGuestPhone, setEditGuestPhone] = useState("");
  const [editPartySize, setEditPartySize] = useState(2);
  const [editTableId, setEditTableId] = useState<string>("");
  const [editNotes, setEditNotes] = useState("");
  const [editSeatingPreference, setEditSeatingPreference] = useState<string>("");
  const [autoAssigning, setAutoAssigning] = useState(false);

  const currentDate = searchParams.get("date") || "";
  const unassignedReservations = reservations.filter((r) => !r.tableId && r.status !== "CANCELLED");
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

  async function handleAddReservation(e: React.FormEvent) {
    e.preventDefault();
    if (!addGuestName.trim()) {
      toast.error(t("guestNameRequired") || "Guest name is required");
      return;
    }
    startTransition(async () => {
      try {
        const [primaryId, combinedId] = addTableId.includes("|") ? addTableId.split("|") : [addTableId, null];
        const result = await createReservation({
          date: addDate,
          time: addTime,
          guestName: addGuestName.trim(),
          guestPhone: addGuestPhone.trim() || undefined,
          partySize: addPartySize,
          tableId: primaryId || undefined,
          combinedWithTableId: combinedId || undefined,
          seatingPreference: (addSeatingPreference === "any" ? "" : addSeatingPreference).trim() || undefined,
          notes: addNotes.trim() || undefined,
        });
        if (result && typeof result === "object" && result.success === false && result.error === "GUEST_NO_SHOW_BLOCKED") {
          toast.error(t("guestNoShowBlocked", { count: result.noShowCount ?? 0 }));
          return;
        }
        if (result && typeof result === "object" && result.success && "noShowWarning" in result && result.noShowWarning) {
          toast.warning(t("guestNoShowWarning", { count: ("noShowCount" in result ? result.noShowCount : 0) ?? 0 }));
        } else {
          toast.success(t("saved"));
        }
        setAddOpen(false);
        setAddGuestName("");
        setAddGuestPhone("");
        setAddPartySize(2);
        setAddTableId("");
        setAddNotes("");
        setAddDate(todayISO());
        setAddTime("19:00");
        router.refresh();
      } catch {
        toast.error(t("error"));
      }
    });
  }

  function openEdit(reservation: Reservation) {
    setEditingReservation(reservation);
    setEditDate(reservation.date.split("T")[0]);
    setEditTime(reservation.time);
    setEditGuestName(reservation.guestName);
    setEditGuestPhone(reservation.guestPhone || "");
    setEditPartySize(reservation.partySize);
    setEditTableId(
      reservation.combinedWithTableId
        ? `${reservation.tableId}|${reservation.combinedWithTableId}`
        : reservation.tableId || ""
    );
    setEditSeatingPreference(reservation.seatingPreference || "");
    setEditNotes(reservation.notes || "");
  }

  async function handleEditReservation(e: React.FormEvent) {
    e.preventDefault();
    if (!editingReservation || !editGuestName.trim()) return;
    const [primaryId, combinedId] = editTableId.includes("|") ? editTableId.split("|") : [editTableId, null];
    startTransition(async () => {
      try {
        await updateReservation(editingReservation.id, {
          date: editDate,
          time: editTime,
          guestName: editGuestName.trim(),
          guestPhone: editGuestPhone.trim() || undefined,
          partySize: editPartySize,
          tableId: primaryId || null,
          combinedWithTableId: combinedId || null,
          seatingPreference: (editSeatingPreference === "any" ? "" : editSeatingPreference).trim() || null,
          notes: editNotes.trim() || null,
        });
        toast.success(t("saved"));
        setEditingReservation(null);
        router.refresh();
      } catch {
        toast.error(t("error"));
      }
    });
  }

  async function handleAssignTable(reservationId: string, value: string) {
    try {
      const [primaryId, combinedId] = value.includes("|") ? value.split("|") : [value, null];
      await updateReservation(reservationId, {
        tableId: primaryId || null,
        combinedWithTableId: combinedId || null,
      });
      toast.success(t("saved"));
      router.refresh();
    } catch {
      toast.error(t("error"));
    }
  }

  async function handleAutoAssignTables() {
    if (unassignedReservations.length === 0) return;
    setAutoAssigning(true);
    try {
      const { assigned, failed } = await autoAssignTables();
      if (assigned > 0) toast.success(t("autoAssignSuccess", { count: assigned }));
      if (failed > 0) toast.warning(t("autoAssignPartial", { count: failed }));
      if (assigned === 0 && failed > 0) toast.error(t("autoAssignNone"));
      router.refresh();
    } catch {
      toast.error(t("error"));
    } finally {
      setAutoAssigning(false);
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

      {/* Unassigned reservations */}
      {unassignedReservations.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold">{t("reservationsWithoutTable")}</h2>
                <p className="text-sm text-muted-foreground mt-1">{t("reservationsWithoutTableDescription")}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoAssignTables}
                disabled={autoAssigning}
              >
                {autoAssigning ? "..." : (t("autoAssignTables") ?? "Auto-assign tables")}
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("time")}</TableHead>
                  <TableHead>{t("guestName")}</TableHead>
                  <TableHead>{t("partySize")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("assignTable")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unassignedReservations.map((res) => (
                  <TableRow key={res.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(res.date)}</TableCell>
                    <TableCell>{res.time}</TableCell>
                    <TableCell className="font-medium">{res.guestName}</TableCell>
                    <TableCell>{res.partySize}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[res.status] || ""}>
                        {getStatusLabel(res.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Select
                          value=""
                          onValueChange={(value) => handleAssignTable(res.id, value)}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder={t("assignTable")} />
                          </SelectTrigger>
                          <SelectContent>
                            {(() => {
                              const opts = getAssignTableOptions(tables, res.partySize, res.availableTableIds);
                              if (opts.length === 0) {
                                return (
                                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                    {t("noTablesAvailableForThisTime")}
                                  </div>
                                );
                              }
                              return opts.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ));
                            })()}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={() => openEdit(res)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add reservation + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <Button onClick={() => setAddOpen(true)} disabled={isPending}>
          <Plus className="h-4 w-4 mr-2" />
          {t("addReservation")}
        </Button>
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
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(reservation)}
                            disabled={isPending}
                            title={t("editReservation")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
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
                            <span className="text-xs text-muted-foreground w-14">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Add reservation dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("addReservation")}</DialogTitle>
            <DialogDescription>{t("addReservationDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddReservation} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-date">{t("date")}</Label>
                <Input
                  id="add-date"
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  required
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-time">{t("time")}</Label>
                <Input
                  id="add-time"
                  type="time"
                  value={addTime}
                  onChange={(e) => setAddTime(e.target.value)}
                  required
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-guestName">{t("guestName")}</Label>
              <Input
                id="add-guestName"
                value={addGuestName}
                onChange={(e) => setAddGuestName(e.target.value)}
                placeholder={t("guestName")}
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-guestPhone">{t("guestPhone")}</Label>
              <Input
                id="add-guestPhone"
                type="tel"
                value={addGuestPhone}
                onChange={(e) => setAddGuestPhone(e.target.value)}
                placeholder={t("guestPhone")}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-partySize">{t("partySize")}</Label>
              <Input
                id="add-partySize"
                type="number"
                min={1}
                max={20}
                value={addPartySize}
                onChange={(e) => setAddPartySize(Number(e.target.value) || 1)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-seatingPreference">{t("tablePreference")}</Label>
                <Select value={addSeatingPreference || "any"} onValueChange={(v) => setAddSeatingPreference(v)} disabled={isPending}>
                <SelectTrigger id="add-seatingPreference">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TABLE_PREFERENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(opt.labelKey as Parameters<typeof t>[0])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-table">{t("table")}</Label>
              <Select value={addTableId || "none"} onValueChange={(v) => setAddTableId(v === "none" ? "" : v)} disabled={isPending}>
                <SelectTrigger id="add-table">
                  <SelectValue placeholder={t("unassigned")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("unassigned")}</SelectItem>
                  {getAssignTableOptions(tables, addPartySize, undefined).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-notes">{t("notes")}</Label>
              <Input
                id="add-notes"
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                placeholder={t("notes")}
                disabled={isPending}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={isPending}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "..." : t("addReservation")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit reservation dialog */}
      <Dialog open={!!editingReservation} onOpenChange={(open) => !open && setEditingReservation(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editReservation")}</DialogTitle>
            <DialogDescription>{t("editReservationDescription")}</DialogDescription>
          </DialogHeader>
          {editingReservation && (
            <form onSubmit={handleEditReservation} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-date">{t("date")}</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-time">{t("time")}</Label>
                  <Input
                    id="edit-time"
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    required
                    disabled={isPending}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-guestName">{t("guestName")}</Label>
                <Input
                  id="edit-guestName"
                  value={editGuestName}
                  onChange={(e) => setEditGuestName(e.target.value)}
                  required
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-guestPhone">{t("guestPhone")}</Label>
                <Input
                  id="edit-guestPhone"
                  type="tel"
                  value={editGuestPhone}
                  onChange={(e) => setEditGuestPhone(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-partySize">{t("partySize")}</Label>
                <Input
                  id="edit-partySize"
                  type="number"
                  min={1}
                  max={20}
                  value={editPartySize}
                  onChange={(e) => setEditPartySize(Number(e.target.value) || 1)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-seatingPreference">{t("tablePreference")}</Label>
                <Select value={editSeatingPreference || "any"} onValueChange={(v) => setEditSeatingPreference(v)} disabled={isPending}>
                  <SelectTrigger id="edit-seatingPreference">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TABLE_PREFERENCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {t(opt.labelKey as Parameters<typeof t>[0])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-table">{t("table")}</Label>
                <Select value={editTableId || "none"} onValueChange={(v) => setEditTableId(v === "none" ? "" : v)} disabled={isPending}>
                  <SelectTrigger id="edit-table">
                    <SelectValue placeholder={t("unassigned")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("unassigned")}</SelectItem>
                    {getAssignTableOptions(tables, editPartySize, editingReservation.availableTableIds).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">{t("notes")}</Label>
                <Input
                  id="edit-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingReservation(null)} disabled={isPending}>
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "..." : t("saveChanges")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
