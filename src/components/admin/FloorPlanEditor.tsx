"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Save, RotateCcw } from "lucide-react";
import { updateTablePositions } from "@/app/[locale]/admin/(dashboard)/actions";
import { toast } from "sonner";

const FloorPlanCanvas = dynamic(
  () => import("./FloorPlanCanvas"),
  { ssr: false, loading: () => <div className="w-full h-[500px] bg-muted animate-pulse rounded-lg" /> }
);

export interface TableData {
  id: string;
  label: string;
  minCapacity: number;
  maxCapacity: number;
  shape: string;
  zone: string | null;
  isActive: boolean;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation: number;
}

interface FloorPlanEditorProps {
  tables: TableData[];
}

export default function FloorPlanEditor({ tables: initialTables }: FloorPlanEditorProps) {
  const t = useTranslations("admin");
  const [tables, setTables] = useState<TableData[]>(initialTables);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleDragEnd = (id: string, x: number, y: number) => {
    setTables((prev) =>
      prev.map((t) => (t.id === id ? { ...t, posX: x, posY: y } : t))
    );
    setHasChanges(true);
  };

  const handleRotate = (id: string) => {
    setTables((prev) =>
      prev.map((t) => (t.id === id ? { ...t, rotation: (t.rotation + 45) % 360 } : t))
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateTablePositions(
        tables.map((t) => ({
          id: t.id,
          posX: t.posX,
          posY: t.posY,
          width: t.width,
          height: t.height,
          rotation: t.rotation,
        }))
      );
      setHasChanges(false);
      toast.success(t("saved"));
    } catch {
      toast.error(t("error"));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setTables(initialTables);
    setHasChanges(false);
    setSelectedId(null);
  };

  const selectedTable = tables.find((t) => t.id === selectedId);

  // Get unique zones for the legend
  const zones = [...new Set(tables.map((t) => t.zone).filter(Boolean))] as string[];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {zones.map((zone) => (
            <Badge key={zone} variant="outline">
              <span
                className="inline-block w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: getZoneColor(zone) }}
              />
              {zone}
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {t("resetChanges")}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "..." : t("saveChanges")}
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Canvas */}
        <Card className="flex-1">
          <CardContent className="p-2">
            <FloorPlanCanvas
              tables={tables}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDragEnd={handleDragEnd}
            />
          </CardContent>
        </Card>

        {/* Selected table info */}
        {selectedTable && (
          <Card className="w-64">
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-lg">{selectedTable.label}</h3>
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">{t("capacity")}:</span> {selectedTable.minCapacity}-{selectedTable.maxCapacity}</p>
                <p><span className="text-muted-foreground">{t("shape")}:</span> {selectedTable.shape}</p>
                {selectedTable.zone && <p><span className="text-muted-foreground">{t("zone")}:</span> {selectedTable.zone}</p>}
                <p><span className="text-muted-foreground">{t("rotation")}:</span> {selectedTable.rotation}&deg;</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleRotate(selectedTable.id)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {t("rotate")} 45&deg;
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Zone color mapping
function getZoneColor(zone: string): string {
  const colors: Record<string, string> = {
    "Main Dining": "#3b82f6",
    "Patio": "#22c55e",
    "Bar": "#f59e0b",
    "Private Room": "#8b5cf6",
  };
  return colors[zone] || "#6b7280";
}
