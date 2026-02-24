"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { UserPlus, Bell, Armchair, LogOut, XCircle } from "lucide-react";
import {
  addToWaitlist,
  notifyWaitlistEntry,
  seatWaitlistEntry,
  markWaitlistLeft,
  markWaitlistCancelled,
  setWaitlistEstimatedWait,
} from "@/app/[locale]/admin/(dashboard)/actions";
import { toast } from "sonner";

export interface WaitlistEntryRow {
  id: string;
  guestName: string;
  guestPhone: string | null;
  partySize: number;
  notes: string | null;
  seatingPref: string | null;
  estimatedWaitMin: number | null;
  status: string;
  tableId: string | null;
  tableLabel: string | null;
  notifiedAt: string | null;
  seatedAt: string | null;
  createdAt: string;
}

interface TableOption {
  id: string;
  label: string;
  maxCapacity: number;
}

interface WaitlistManagerProps {
  entries: WaitlistEntryRow[];
  tables: TableOption[];
}

const STATUS_COLORS: Record<string, string> = {
  WAITING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  NOTIFIED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  SEATED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  LEFT: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WaitlistManager({ entries, tables }: WaitlistManagerProps) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editingWaitId, setEditingWaitId] = useState<string | null>(null);
  const [editingWaitValue, setEditingWaitValue] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState("");
  const [estimatedWaitMin, setEstimatedWaitMin] = useState<number | "">("");
  const [seatingPref, setSeatingPref] = useState("");

  const activeEntries = entries.filter((e) => e.status === "WAITING" || e.status === "NOTIFIED");
  const recentEntries = entries.filter(
    (e) => e.status === "SEATED" || e.status === "LEFT" || e.status === "CANCELLED"
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) {
      toast.error(t("guestNameRequired") || "Guest name is required");
      return;
    }
    startTransition(async () => {
      try {
        await addToWaitlist({
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim() || undefined,
          partySize,
          notes: notes.trim() || undefined,
          estimatedWaitMin: estimatedWaitMin === "" ? undefined : Number(estimatedWaitMin),
          seatingPref: seatingPref.trim() || undefined,
        });
        toast.success(t("addedToWaitlist") || "Added to waitlist");
        setGuestName("");
        setGuestPhone("");
        setPartySize(2);
        setNotes("");
        setEstimatedWaitMin("");
        setSeatingPref("");
        router.refresh();
      } catch {
        toast.error(t("error"));
      }
    });
  }

  async function handleAction(
    entryId: string,
    action: () => Promise<{ success: boolean }>
  ) {
    setLoadingId(entryId);
    try {
      await action();
      toast.success(t("saved"));
      router.refresh();
    } catch {
      toast.error(t("error"));
    } finally {
      setLoadingId(null);
    }
  }

  async function handleSeat(entryId: string, tableId: string | null) {
    setLoadingId(entryId);
    try {
      await seatWaitlistEntry(entryId, tableId ?? undefined);
      toast.success(t("saved"));
      router.refresh();
    } catch {
      toast.error(t("error"));
    } finally {
      setLoadingId(null);
    }
  }

  function startEditingWait(entry: WaitlistEntryRow) {
    setEditingWaitId(entry.id);
    setEditingWaitValue(entry.estimatedWaitMin != null ? String(entry.estimatedWaitMin) : "");
  }

  async function saveEstimatedWait(entryId: string) {
    const raw = editingWaitValue.trim();
    const minutes = raw === "" ? null : parseInt(editingWaitValue, 10);
    setEditingWaitId(null);
    setEditingWaitValue("");
    if (minutes !== null && (isNaN(minutes) || minutes < 0)) return;
    try {
      await setWaitlistEstimatedWait(entryId, minutes);
      toast.success(t("saved"));
      router.refresh();
    } catch {
      toast.error(t("error"));
    }
  }

  return (
    <div className="space-y-6">
      {/* Add to waitlist */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-4">
            <div className="space-y-2 min-w-[140px]">
              <Label htmlFor="waitlist-guestName">{t("guestName")}</Label>
              <Input
                id="waitlist-guestName"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder={t("guestName")}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2 min-w-[120px]">
              <Label htmlFor="waitlist-phone">{t("guestPhone")}</Label>
              <Input
                id="waitlist-phone"
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder={t("guestPhone")}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2 w-24">
              <Label htmlFor="waitlist-partySize">{t("partySize")}</Label>
              <Input
                id="waitlist-partySize"
                type="number"
                min={1}
                max={20}
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value) || 1)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2 w-24">
              <Label htmlFor="waitlist-waitMin">{t("estimatedWait")}</Label>
              <Input
                id="waitlist-waitMin"
                type="number"
                min={0}
                placeholder="—"
                value={estimatedWaitMin === "" ? "" : estimatedWaitMin}
                onChange={(e) =>
                  setEstimatedWaitMin(e.target.value === "" ? "" : Number(e.target.value))
                }
                disabled={isPending}
              />
            </div>
            <div className="space-y-2 min-w-[120px]">
              <Label htmlFor="waitlist-notes">{t("notes")}</Label>
              <Input
                id="waitlist-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("notes")}
                disabled={isPending}
              />
            </div>
            <Button type="submit" disabled={isPending}>
              <UserPlus className="h-4 w-4 mr-2" />
              {t("addToWaitlist")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Active queue */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">{t("waitlistQueue")}</h2>
          {activeEntries.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">{t("noWaitlistEntries")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("guestName")}</TableHead>
                  <TableHead>{t("guestPhone")}</TableHead>
                  <TableHead>{t("partySize")}</TableHead>
                  <TableHead>{t("estimatedWait")}</TableHead>
                  <TableHead>{t("addedAt")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.guestName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.guestPhone || "—"}
                    </TableCell>
                    <TableCell>{entry.partySize}</TableCell>
                    <TableCell>
                      {editingWaitId === entry.id ? (
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-20"
                          value={editingWaitValue}
                          onChange={(e) => setEditingWaitValue(e.target.value)}
                          onBlur={() => saveEstimatedWait(entry.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEstimatedWait(entry.id);
                            if (e.key === "Escape") {
                              setEditingWaitId(null);
                              setEditingWaitValue("");
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditingWait(entry)}
                          className="text-left hover:bg-muted rounded px-1 -mx-1 min-w-[3rem]"
                        >
                          {entry.estimatedWaitMin != null
                            ? `${entry.estimatedWaitMin} min`
                            : "—"}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTime(entry.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[entry.status] || ""}>
                        {t(`waitlistStatus${entry.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {entry.status === "WAITING" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={loadingId === entry.id}
                            onClick={() =>
                              handleAction(entry.id, () => notifyWaitlistEntry(entry.id))
                            }
                          >
                            <Bell className="h-3.5 w-3.5 mr-1" />
                            {t("notify")}
                          </Button>
                        )}
                        {(entry.status === "WAITING" || entry.status === "NOTIFIED") && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={loadingId === entry.id}
                              >
                                <Armchair className="h-3.5 w-3.5 mr-1" />
                                {t("seat")}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleSeat(entry.id, null)}
                              >
                                {t("noTable")}
                              </DropdownMenuItem>
                              {tables.length === 0 ? (
                                <DropdownMenuItem disabled>
                                  {t("noTablesAvailable")}
                                </DropdownMenuItem>
                              ) : (
                                tables.map((tbl) => (
                                  <DropdownMenuItem
                                    key={tbl.id}
                                    onClick={() => handleSeat(entry.id, tbl.id)}
                                  >
                                    {tbl.label} (max {tbl.maxCapacity})
                                  </DropdownMenuItem>
                                ))
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {(entry.status === "WAITING" || entry.status === "NOTIFIED") && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={loadingId === entry.id}
                              onClick={() =>
                                handleAction(entry.id, () => markWaitlistLeft(entry.id))
                              }
                            >
                              <LogOut className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={loadingId === entry.id}
                              onClick={() =>
                                handleAction(entry.id, () =>
                                  markWaitlistCancelled(entry.id)
                                )
                              }
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent (today's seated / left / cancelled) */}
      {recentEntries.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4">{t("waitlistRecent")}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("guestName")}</TableHead>
                  <TableHead>{t("partySize")}</TableHead>
                  <TableHead>{t("table")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.guestName}</TableCell>
                    <TableCell>{entry.partySize}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.tableLabel || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[entry.status] || ""}>
                        {t(`waitlistStatus${entry.status}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
