"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Stage, Layer, Rect, Circle, Text, Group } from "react-konva";
import type Konva from "konva";
import { STATUS_COLORS, type TableStatus } from "@/lib/table-status";
import type { DashboardTable } from "./HostDashboard";
import {
  VIEWPORT_WIDTH,
  VIEWPORT_HEIGHT,
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
} from "./floorPlanConstants";

interface LiveTableInfo {
  table: DashboardTable;
  status: TableStatus;
  currentReservation: {
    guestName: string;
    partySize: number;
    combinedTableLabel?: string | null;
  } | null;
}

interface FloorPlanLiveProps {
  tableStatuses: LiveTableInfo[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Optional: for available tables, show suggested waitlist party (e.g. "Maria (4)") */
  tableSuggestion?: Record<string, { guestName: string; partySize: number }>;
}

const GRID_SIZE = 50;
const MIN_SCALE = 0.2;
const MAX_SCALE = 3;
const ZOOM_FACTOR = 1.15;
const FIT_PADDING = 60;

export default function FloorPlanLive({
  tableStatuses,
  selectedId,
  onSelect,
  tableSuggestion,
}: FloorPlanLiveProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const stagePosRef = useRef(stagePos);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, pos: { x: 0, y: 0 } });
  const hasFittedInitialRef = useRef(false);

  stagePosRef.current = stagePos;

  useEffect(() => {
    if (hasFittedInitialRef.current || tableStatuses.length === 0) return;
    const tables = tableStatuses.map((ts) => ts.table);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of tables) {
      const halfW = t.width / 2;
      const halfH = (t.height ?? t.width) / 2;
      minX = Math.min(minX, t.posX - halfW);
      minY = Math.min(minY, t.posY - halfH);
      maxX = Math.max(maxX, t.posX + halfW);
      maxY = Math.max(maxY, t.posY + halfH);
    }
    if (minX === Infinity) return;
    const contentW = maxX - minX + FIT_PADDING * 2;
    const contentH = maxY - minY + FIT_PADDING * 2;
    const fitScale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, Math.min(VIEWPORT_WIDTH / contentW, VIEWPORT_HEIGHT / contentH))
    );
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setStagePos({
      x: VIEWPORT_WIDTH / 2 - centerX * fitScale,
      y: VIEWPORT_HEIGHT / 2 - centerY * fitScale,
    });
    setScale(fitScale);
    hasFittedInitialRef.current = true;
  }, [tableStatuses]);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const container = stage.container();
      const rect = container.getBoundingClientRect();
      const pointer = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      const pos = stagePosRef.current;
      const direction = e.deltaY > 0 ? -1 : 1;
      const scaleFactor = direction > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * scaleFactor));
      const contentX = (pointer.x - pos.x) / scale;
      const contentY = (pointer.y - pos.y) / scale;
      setStagePos({
        x: pointer.x - contentX * newScale,
        y: pointer.y - contentY * newScale,
      });
      setScale(newScale);
    },
    [scale]
  );

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (e.target !== e.target.getStage()) return;
      if (isPanningRef.current) return;
      onSelect(null);
    },
    [onSelect]
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const container = stage.container();
    const preventWheel = (ev: WheelEvent) => ev.preventDefault();
    container.addEventListener("wheel", preventWheel, { passive: false });
    return () => container.removeEventListener("wheel", preventWheel);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const container = stage.container();

    const onMove = (e: MouseEvent) => {
      const start = panStartRef.current;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!isPanningRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        isPanningRef.current = true;
        setIsPanning(true);
      }
      if (isPanningRef.current) {
        setStagePos({ x: start.pos.x + dx, y: start.pos.y + dy });
      }
    };

    const onUp = () => {
      isPanningRef.current = false;
      setIsPanning(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    const onDown = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const target = stage.getIntersection({ x, y }) as Konva.Node | null;
      if (target?.getClassName?.() === "Group") return;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        pos: { ...stagePosRef.current },
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    container.addEventListener("mousedown", onDown);
    return () => {
      container.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div className="relative" onWheel={handleWheel} style={{ touchAction: "none" }}>
      <Stage
        ref={stageRef}
        width={VIEWPORT_WIDTH}
        height={VIEWPORT_HEIGHT}
        position={stagePos}
        scaleX={scale}
        scaleY={scale}
        onClick={handleStageClick}
        onTap={handleStageClick}
        style={{
          background: "#f8fafc",
          borderRadius: "8px",
          cursor: isPanning ? "grabbing" : "grab",
        }}
      >
      {/* Grid Layer – spans virtual space */}
      <Layer>
        {Array.from({ length: Math.ceil(VIRTUAL_WIDTH / GRID_SIZE) + 1 }).map(
          (_, i) => (
            <Rect
              key={`vg-${i}`}
              x={i * GRID_SIZE}
              y={0}
              width={1}
              height={VIRTUAL_HEIGHT}
              fill="#e2e8f0"
              listening={false}
            />
          )
        )}
        {Array.from({ length: Math.ceil(VIRTUAL_HEIGHT / GRID_SIZE) + 1 }).map(
          (_, i) => (
            <Rect
              key={`hg-${i}`}
              x={0}
              y={i * GRID_SIZE}
              width={VIRTUAL_WIDTH}
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
          const suggestion = status === "available" && tableSuggestion?.[table.id];

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

              {/* Label: show combined table label (e.g. "T3 + T4") when this table is part of a combined reservation */}
              <Text
                text={currentReservation?.combinedTableLabel ?? table.label}
                fontSize={currentReservation?.combinedTableLabel ? 11 : 14}
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
              {status !== "occupied" && !suggestion && (
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

              {/* Suggested waitlist party on available table */}
              {suggestion && (
                <>
                  <Text
                    text={suggestion.guestName.split(" ")[0]}
                    fontSize={10}
                    fill="#7c3aed"
                    align="center"
                    width={table.width}
                    offsetX={table.width / 2}
                    y={4}
                    listening={false}
                  />
                  <Text
                    text={`${suggestion.partySize}p`}
                    fontSize={9}
                    fill="#64748b"
                    align="center"
                    width={table.width}
                    offsetX={table.width / 2}
                    y={16}
                    listening={false}
                  />
                </>
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
    </div>
  );
}
