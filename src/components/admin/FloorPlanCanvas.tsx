"use client";

import { Stage, Layer, Rect, Circle, Text, Group } from "react-konva";
import { type TableData } from "./FloorPlanEditor";

interface FloorPlanCanvasProps {
  tables: TableData[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}

const CANVAS_WIDTH = 750;
const CANVAS_HEIGHT = 500;
const GRID_SIZE = 20;

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
  return (
    <Stage
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      onClick={(e) => {
        // Deselect when clicking empty space
        if (e.target === e.target.getStage()) {
          onSelect(null);
        }
      }}
      style={{ background: "#f8fafc", borderRadius: "8px" }}
    >
      {/* Grid Layer */}
      <Layer>
        {Array.from({ length: Math.ceil(CANVAS_WIDTH / GRID_SIZE) + 1 }).map((_, i) => (
          <Rect
            key={`vg-${i}`}
            x={i * GRID_SIZE}
            y={0}
            width={1}
            height={CANVAS_HEIGHT}
            fill="#e2e8f0"
            listening={false}
          />
        ))}
        {Array.from({ length: Math.ceil(CANVAS_HEIGHT / GRID_SIZE) + 1 }).map((_, i) => (
          <Rect
            key={`hg-${i}`}
            x={0}
            y={i * GRID_SIZE}
            width={CANVAS_WIDTH}
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

          return (
            <Group
              key={table.id}
              x={table.posX}
              y={table.posY}
              rotation={table.rotation}
              draggable
              onClick={() => onSelect(table.id)}
              onTap={() => onSelect(table.id)}
              onDragEnd={(e) => {
                const node = e.target;
                const x = snapToGrid(node.x());
                const y = snapToGrid(node.y());
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
  );
}
