"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Armchair } from "lucide-react";
import type { SuggestedSeating } from "@/lib/waitlist";

interface SeatingSuggestionsStripProps {
  suggestions: SuggestedSeating[];
  onSeat: (entryId: string, tableId: string) => Promise<void>;
  loading?: boolean;
}

export default function SeatingSuggestionsStrip({
  suggestions,
  onSeat,
  loading = false,
}: SeatingSuggestionsStripProps) {
  const t = useTranslations("admin");
  const [loadingPair, setLoadingPair] = useState<{ entryId: string; tableId: string } | null>(null);

  async function handleSeat(entryId: string, tableId: string) {
    setLoadingPair({ entryId, tableId });
    try {
      await onSeat(entryId, tableId);
    } finally {
      setLoadingPair(null);
    }
  }

  if (suggestions.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex flex-wrap gap-3 items-center">
          {suggestions.map((s) => {
            const top = s.suggestions[0];
            if (!top) return null;
            const isLoading = loading || loadingPair?.entryId === top.entryId;
            return (
              <div
                key={s.tableId}
                className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
              >
                <Badge variant="outline" className="font-mono">
                  {s.tableLabel}
                </Badge>
                {s.tableZone && (
                  <span className="text-xs text-muted-foreground">{s.tableZone}</span>
                )}
                <span className="text-sm">
                  → {top.guestName}, {top.partySize}p, {top.waitMinutes} {t("minutes")}
                </span>
                <Button
                  size="sm"
                  disabled={isLoading}
                  onClick={() => handleSeat(top.entryId, s.tableId)}
                >
                  <Armchair className="h-3.5 w-3.5 mr-1" />
                  {t("seat")}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
