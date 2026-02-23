"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
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
import { getTableStatus, STATUS_COLORS } from "@/lib/table-status";
import { createWalkIn } from "@/app/[locale]/admin/actions";
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
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Find available tables that fit the party size
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
          })),
        };
        const status = getTableStatus(tableWithDates, now);
        return status.status === "available";
      })
      .sort((a, b) => a.maxCapacity - b.maxCapacity); // Best-fit: smallest first
  }, [tables, partySize]);

  const suggestedTable = availableTables[0] || null;

  function resetForm() {
    setGuestName("");
    setGuestPhone("");
    setPartySize(2);
    setSelectedTableId("");
  }

  async function handleSubmit() {
    const tableId = selectedTableId || suggestedTable?.id;
    if (!tableId || !guestName.trim()) return;

    setSubmitting(true);
    try {
      await createWalkIn({
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim() || undefined,
        partySize,
        tableId,
      });
      resetForm();
      onOpenChange(false);
    } catch {
      // Error handling via revalidation
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
            <Label htmlFor="walkin-party">{t("partySize")}</Label>
            <Select
              value={partySize.toString()}
              onValueChange={(v) => {
                setPartySize(parseInt(v, 10));
                setSelectedTableId(""); // Reset table selection when party size changes
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

          <div className="grid gap-2">
            <Label>{t("selectTable")}</Label>
            {availableTables.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noTablesAvailable")}
              </p>
            ) : (
              <Select
                value={selectedTableId || suggestedTable?.id || ""}
                onValueChange={setSelectedTableId}
              >
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
                        {table.id === suggestedTable?.id && (
                          <Badge variant="secondary" className="ml-1 text-xs">
                            {t("suggestedTable")}
                          </Badge>
                        )}
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
              (!selectedTableId && !suggestedTable)
            }
          >
            {t("seat")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
