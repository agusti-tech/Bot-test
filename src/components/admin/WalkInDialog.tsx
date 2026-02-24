"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getTableStatus } from "@/lib/table-status";
import { createWalkIn, getSuggestedTableForWalkIn } from "@/app/[locale]/admin/(dashboard)/actions";
import type { DashboardTable } from "./HostDashboard";

interface WalkInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tables: DashboardTable[];
  restaurantId: string;
}

export default function WalkInDialog({
  open,
  onOpenChange,
  tables,
  restaurantId,
}: WalkInDialogProps) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [selectedTableValue, setSelectedTableValue] = useState<string>("");
  const [seatingPreference, setSeatingPreference] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [serverSuggestion, setServerSuggestion] = useState<{
    tableId: string;
    combinedWithTableId: string | null;
    label: string;
    zone: string | null;
  } | null>(null);

  // Find available tables (single) that fit the party size right now
  const availableTables = useMemo(() => {
    const now = new Date();
    return tables
      .filter((table) => {
        if (!table.isActive) return false;
        if (table.maxCapacity < partySize) return false;
        const tableWithDates = {
          ...table,
          reservations: table.reservations.map((r) => ({
            ...r,
            seatedAt: r.seatedAt ? new Date(r.seatedAt) : null,
            completedAt: r.completedAt ? new Date(r.completedAt) : null,
            cleaningClearedAt: r.cleaningClearedAt ? new Date(r.cleaningClearedAt) : null,
          })),
        };
        const status = getTableStatus(tableWithDates, now);
        return status.status === "available";
      })
      .sort((a, b) => a.maxCapacity - b.maxCapacity);
  }, [tables, partySize]);

  const availableSet = useMemo(() => new Set(availableTables.map((t) => t.id)), [availableTables]);

  // Combined options: same zone, both combinable, both available now, combined capacity >= partySize
  const combinedOptions = useMemo(() => {
    const comb: { value: string; label: string }[] = [];
    const withCombinable = tables.filter((t) => t.isCombinable && availableSet.has(t.id));
    for (let i = 0; i < withCombinable.length; i++) {
      for (let j = i + 1; j < withCombinable.length; j++) {
        const t1 = withCombinable[i];
        const t2 = withCombinable[j];
        if (t1.zone !== t2.zone) continue;
        if (t1.maxCapacity + t2.maxCapacity < partySize) continue;
        const label = `${t1.label} + ${t2.label} (${t1.maxCapacity + t2.maxCapacity})`;
        comb.push({ value: `${t1.id}|${t2.id}`, label });
        comb.push({ value: `${t2.id}|${t1.id}`, label });
      }
    }
    return comb;
  }, [tables, partySize, availableSet]);

  const suggestedFromServer = serverSuggestion;
  const suggestedTable = availableTables[0] || null;
  const suggestedValue =
    selectedTableValue ||
    (suggestedFromServer?.combinedWithTableId
      ? `${suggestedFromServer.tableId}|${suggestedFromServer.combinedWithTableId}`
      : suggestedFromServer?.tableId || (suggestedTable?.id ?? "")) ||
    (combinedOptions[0]?.value ?? "");

  useEffect(() => {
    if (!open || !restaurantId || partySize < 1) {
      setServerSuggestion(null);
      return;
    }
    getSuggestedTableForWalkIn(partySize, seatingPreference || undefined).then(setServerSuggestion);
  }, [open, restaurantId, partySize, seatingPreference]);

  function resetForm() {
    setGuestName("");
    setGuestPhone("");
    setPartySize(2);
    setSelectedTableValue("");
    setSeatingPreference("");
    setServerSuggestion(null);
  }

  async function handleSubmit() {
    const raw = suggestedValue;
    if (!raw || !guestName.trim()) return;
    const [tableId, combinedWithTableId] = raw.includes("|") ? raw.split("|") : [raw, null];
    if (!tableId) return;

    setSubmitting(true);
    try {
      const result = await createWalkIn({
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim() || undefined,
        partySize,
        tableId,
        combinedWithTableId: combinedWithTableId || undefined,
      });
      if (result && typeof result === "object" && result.success === false && result.error === "GUEST_NO_SHOW_BLOCKED") {
        toast.error(t("guestNoShowBlocked", { count: result.noShowCount ?? 0 }));
        setSubmitting(false);
        return;
      }
      if (result && typeof result === "object" && result.success && result.noShowWarning) {
        toast.warning(t("guestNoShowWarning", { count: result.noShowCount ?? 0 }));
      }
      resetForm();
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addWalkIn")}</DialogTitle>
          <DialogDescription>{t("walkInDescription")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="walkin-name">{t("guestName")}</Label>
            <Input
              id="walkin-name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="John Smith"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="walkin-phone">{t("guestPhone")}</Label>
            <Input
              id="walkin-phone"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="+49..."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="walkin-preference">{t("tablePreference")}</Label>
            <Select value={seatingPreference || "any"} onValueChange={(v) => setSeatingPreference(v === "any" ? "" : v)}>
              <SelectTrigger id="walkin-preference">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("tablePreferenceAny")}</SelectItem>
                <SelectItem value="regular">{t("tablePreferenceRegular")}</SelectItem>
                <SelectItem value="patio">{t("tablePreferencePatio")}</SelectItem>
                <SelectItem value="bar">{t("tablePreferenceBar")}</SelectItem>
                <SelectItem value="booth">{t("tablePreferenceBooth")}</SelectItem>
                <SelectItem value="window">{t("tablePreferenceWindow")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="walkin-party">{t("partySize")}</Label>
            <Select
              value={partySize.toString()}
              onValueChange={(v) => {
                setPartySize(parseInt(v, 10));
                setSelectedTableValue(""); // Reset so server suggestion is used
              }}
            >
              <SelectTrigger id="walkin-party">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(suggestedFromServer || suggestedTable || combinedOptions.length > 0) && (
            <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/30 p-3">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                {t("weCanSeatYouAt")}{" "}
                <span className="font-semibold">
                  {suggestedFromServer?.label ?? suggestedTable?.label ?? combinedOptions[0]?.label ?? ""}
                  {suggestedFromServer?.zone || suggestedTable?.zone
                    ? ` (${suggestedFromServer?.zone ?? suggestedTable?.zone ?? ""})`
                    : ""}
                </span>
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                {t("tableForPartySize", { size: partySize })}
              </p>
            </div>
          )}

          <div className="grid gap-2">
            <Label>{t("selectTable")}</Label>
            {availableTables.length === 0 && combinedOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noTablesAvailable")}
              </p>
            ) : (
              <Select value={suggestedValue} onValueChange={setSelectedTableValue}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTables.map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      <span className="flex items-center gap-2">
                        {table.label}
                        {table.zone && (
                          <span className="text-muted-foreground">
                            ({table.zone})
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          — max {table.maxCapacity}
                        </span>
                        {table.id === suggestedTable?.id && !suggestedFromServer?.combinedWithTableId && (
                          <Badge variant="secondary" className="ml-1 text-xs">
                            {t("suggestedTable")}
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                  {combinedOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        {opt.label}
                        {(suggestedFromServer?.combinedWithTableId && opt.value === `${suggestedFromServer.tableId}|${suggestedFromServer.combinedWithTableId}`) ||
                        (suggestedFromServer?.combinedWithTableId && opt.value === `${suggestedFromServer.combinedWithTableId}|${suggestedFromServer.tableId}`) ? (
                          <Badge variant="secondary" className="ml-1 text-xs">
                            {t("suggestedTable")}
                          </Badge>
                        ) : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !guestName.trim() ||
              !suggestedValue
            }
          >
            {t("seat")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
