"use client";

import { useState, useCallback } from "react";
import { Stage, Layer, Rect, Circle, Text, Group } from "react-konva";
import type Konva from "konva";
import { ZoomIn, ZoomOut, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type TableData } from "./FloorPlanEditor";
import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT, VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from "./floorPlanConstants";

interface FloorPlanCanvasProps {
  tables: TableData[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}

const GRID_SIZE = 50;
const MIN_SCALE = 0.2;
const MAX_SCALE = 3;
const ZOOM_FACTOR = 1.2;
const PAN_STEP = 40;

// Zone color mapping
function getZoneColor(zone: string | null): string {
  const colors: Record<string, string> = {
    "Main Dining": "#3b82f6",
    "Patio": "#22c55e",
    "Bar": "#f59e0b",
    "Private Room": "#8b5cf6",
  };
  return zone ? colors[zone] || "#6b7280" : "#6b7280";
}

function snapToGrid(val: number): number {
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}

export default function FloorPlanCanvas({
  tables,
  selectedId,
  onSelect,
  onDragEnd,
}: FloorPlanCanvasProps) {
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_SCALE, s * ZOOM_FACTOR));
  }, []);
  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(MIN_SCALE, s / ZOOM_FACTOR));
  }, []);
  const pan = useCallback((dx: number, dy: number) => {
    setStagePos((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);
  const resetView = useCallback(() => {
    setStagePos({ x: 0, y: 0 });
    setScale(1);
  }, []);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (e.target !== e.target.getStage()) return;
      onSelect(null);
    },
    [onSelect]
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" variant="outline" size="icon" onClick={zoomIn} title="Zoom in" aria-label="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={zoomOut} title="Zoom out" aria-label="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="mx-1 text-muted-foreground">|</span>
        <Button type="button" variant="outline" size="icon" onClick={() => pan(0, -PAN_STEP)} title="Move up" aria-label="Move canvas up">
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={() => pan(0, PAN_STEP)} title="Move down" aria-label="Move canvas down">
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={() => pan(-PAN_STEP, 0)} title="Move left" aria-label="Move canvas left">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={() => pan(PAN_STEP, 0)} title="Move right" aria-label="Move canvas right">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={resetView} title="Reset view" aria-label="Reset zoom and position">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
      <Stage
        width={VIEWPORT_WIDTH}
        height={VIEWPORT_HEIGHT}
        position={stagePos}
        scaleX={scale}
        scaleY={scale}
        onClick={handleStageClick}
        onTap={handleStageClick}
        style={{ background: "#f8fafc", borderRadius: "8px" }}
      >
        {/* Grid Layer – spans virtual space */}
        <Layer>
          {Array.from({ length: Math.ceil(VIRTUAL_WIDTH / GRID_SIZE) + 1 }).map((_, i) => (
            <Rect
              key={`vg-${i}`}
              x={i * GRID_SIZE}
              y={0}
              width={1}
              height={VIRTUAL_HEIGHT}
              fill="#e2e8f0"
              listening={false}
            />
          ))}
          {Array.from({ length: Math.ceil(VIRTUAL_HEIGHT / GRID_SIZE) + 1 }).map((_, i) => (
            <Rect
              key={`hg-${i}`}
              x={0}
              y={i * GRID_SIZE}
              width={VIRTUAL_WIDTH}
              height={1}
              fill="#e2e8f0"
              listening={false}
            />
          ))}
        </Layer>

        {/* Tables Layer */}
        <Layer>
          {tables.filter((t) => t.isActive).map((table) => {
            const isSelected = table.id === selectedId;
            const color = getZoneColor(table.zone);

            const halfW = table.width / 2;
            const halfH = table.height / 2;
            const minX = halfW;
            const maxX = VIRTUAL_WIDTH - halfW;
            const minY = halfH;
            const maxY = VIRTUAL_HEIGHT - halfH;

            return (
              <Group
                key={table.id}
                x={table.posX}
                y={table.posY}
                rotation={table.rotation}
                draggable
                dragBoundFunc={(pos) => ({
                  x: Math.max(minX, Math.min(maxX, pos.x)),
                  y: Math.max(minY, Math.min(maxY, pos.y)),
                })}
                onClick={() => onSelect(table.id)}
                onTap={() => onSelect(table.id)}
                onDragEnd={(e) => {
                  const node = e.target;
                  let x = snapToGrid(node.x());
                  let y = snapToGrid(node.y());
                  x = Math.max(minX, Math.min(maxX, x));
                  y = Math.max(minY, Math.min(maxY, y));
                  node.position({ x, y });
                  onDragEnd(table.id, x, y);
                }}
              >
                {/* Table shape */}
                {table.shape === "ROUND" ? (
                  <Circle
                    radius={table.width / 2}
                    fill={color}
                    opacity={0.3}
                    stroke={isSelected ? "#000" : color}
                    strokeWidth={isSelected ? 3 : 2}
                  />
                ) : (
                  <Rect
                    width={table.width}
                    height={table.height}
                    fill={color}
                    opacity={0.3}
                    stroke={isSelected ? "#000" : color}
                    strokeWidth={isSelected ? 3 : 2}
                    cornerRadius={table.shape === "BOOTH" ? 12 : 4}
                    offsetX={table.width / 2}
                    offsetY={table.height / 2}
                  />
                )}

                {/* Label */}
                <Text
                  text={table.label}
                  fontSize={14}
                  fontStyle="bold"
                  fill="#1e293b"
                  align="center"
                  verticalAlign="middle"
                  width={table.width}
                  height={20}
                  offsetX={table.width / 2}
                  offsetY={10}
                  listening={false}
                />

                {/* Capacity */}
                <Text
                  text={`${table.maxCapacity}`}
                  fontSize={11}
                  fill="#64748b"
                  align="center"
                  width={table.width}
                  offsetX={table.width / 2}
                  y={8}
                  listening={false}
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
