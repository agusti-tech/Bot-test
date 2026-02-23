"use client";

import { Stage, Layer, Rect, Circle, Text, Group } from "react-konva";
import { STATUS_COLORS, type TableStatus } from "@/lib/table-status";
import type { DashboardTable } from "./HostDashboard";

interface LiveTableInfo {
  table: DashboardTable;
  status: TableStatus;
  currentReservation: { guestName: string; partySize: number } | null;
}

interface FloorPlanLiveProps {
  tableStatuses: LiveTableInfo[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const CANVAS_WIDTH = 750;
const CANVAS_HEIGHT = 500;
const GRID_SIZE = 20;

export default function FloorPlanLive({
  tableStatuses,
  selectedId,
  onSelect,
}: FloorPlanLiveProps) {
  return (
    <Stage
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      onClick={(e) => {
        if (e.target === e.target.getStage()) {
          onSelect(null);
        }
      }}
      style={{ background: "#f8fafc", borderRadius: "8px" }}
    >
      {/* Grid Layer */}
      <Layer>
        {Array.from({ length: Math.ceil(CANVAS_WIDTH / GRID_SIZE) + 1 }).map(
          (_, i) => (
            <Rect
              key={`vg-${i}`}
              x={i * GRID_SIZE}
              y={0}
              width={1}
              height={CANVAS_HEIGHT}
              fill="#e2e8f0"
              listening={false}
            />
          )
        )}
        {Array.from({ length: Math.ceil(CANVAS_HEIGHT / GRID_SIZE) + 1 }).map(
          (_, i) => (
            <Rect
              key={`hg-${i}`}
              x={0}
              y={i * GRID_SIZE}
              width={CANVAS_WIDTH}
              height={1}
              fill="#e2e8f0"
              listening={false}
            />
          )
        )}
      </Layer>

      {/* Tables Layer */}
      <Layer>
        {tableStatuses.map(({ table, status, currentReservation }) => {
          const isSelected = table.id === selectedId;
          const color = STATUS_COLORS[status];
          const fillOpacity = status === "available" ? 0.25 : 0.5;

          return (
            <Group
              key={table.id}
              x={table.posX}
              y={table.posY}
              rotation={table.rotation}
              onClick={() => onSelect(table.id)}
              onTap={() => onSelect(table.id)}
            >
              {/* Table shape */}
              {table.shape === "ROUND" ? (
                <Circle
                  radius={table.width / 2}
                  fill={color}
                  opacity={fillOpacity}
                  stroke={isSelected ? "#000" : color}
                  strokeWidth={isSelected ? 3 : 2}
                />
              ) : (
                <Rect
                  width={table.width}
                  height={table.height}
                  fill={color}
                  opacity={fillOpacity}
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
                height={16}
                offsetX={table.width / 2}
                offsetY={status === "occupied" ? 18 : 8}
                listening={false}
              />

              {/* Capacity when not occupied */}
              {status !== "occupied" && (
                <Text
                  text={`${table.maxCapacity}`}
                  fontSize={11}
                  fill="#64748b"
                  align="center"
                  width={table.width}
                  offsetX={table.width / 2}
                  y={6}
                  listening={false}
                />
              )}

              {/* Guest name when occupied */}
              {status === "occupied" && currentReservation && (
                <>
                  <Text
                    text={currentReservation.guestName.split(" ")[0]}
                    fontSize={11}
                    fill="#1e293b"
                    align="center"
                    width={table.width}
                    offsetX={table.width / 2}
                    y={-4}
                    listening={false}
                  />
                  <Text
                    text={`${currentReservation.partySize}p`}
                    fontSize={10}
                    fill="#64748b"
                    align="center"
                    width={table.width}
                    offsetX={table.width / 2}
                    y={8}
                    listening={false}
                  />
                </>
              )}

              {/* Status indicator dot */}
              <Circle
                x={table.width / 2 - 4}
                y={-(table.height || table.width) / 2 + 4}
                radius={5}
                fill={color}
                stroke="#fff"
                strokeWidth={1.5}
                listening={false}
              />
            </Group>
          );
        })}
      </Layer>
    </Stage>
  );
}
