/**
 * Waitlist helper: estimate wait time and suggest parties for a table.
 */

import { prisma } from "@/lib/prisma";
import { getTableStatus } from "@/lib/table-status";

const CLEANING_BUFFER_MINUTES = 15;

/** Minimal shape for waitlist entries used in suggestions (matches WaitlistManager.WaitlistEntryRow). */
export interface WaitlistEntryForSuggestion {
  id: string;
  guestName: string;
  partySize: number;
  createdAt: string;
  status: string;
}

/**
 * Estimate how many minutes until a table that fits the party will be free.
 * Uses today's reservations: table is "free at" max(completedAt ?? time + duration, cleaningClearedAt), or now if already free.
 * Returns minutes from now until the earliest such time among tables with maxCapacity >= partySize, or null if none.
 */
export async function estimateWaitMinutes(
  restaurantId: string,
  partySize: number
): Promise<number | null> {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const tables = await prisma.restaurantTable.findMany({
    where: {
      restaurantId,
      isActive: true,
      maxCapacity: { gte: partySize },
    },
    select: { id: true, maxCapacity: true },
  });

  if (tables.length === 0) return null;

  const reservations = await prisma.reservation.findMany({
    where: {
      restaurantId,
      date: today,
      tableId: { not: null },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    select: {
      tableId: true,
      time: true,
      estimatedDuration: true,
      completedAt: true,
      cleaningClearedAt: true,
      seatedAt: true,
    },
  });

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  function timeToMinutes(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  /** Get the timestamp (Date) when this table is next free. */
  function getTableFreeAt(tableId: string): Date {
    const tableRes = reservations.filter((r) => r.tableId === tableId);
    const sorted = [...tableRes].sort(
      (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)
    );

    // Currently seated (occupied)
    const seated = sorted.find((r) => r.seatedAt && !r.completedAt);
    if (seated) {
      const endMinutes = timeToMinutes(seated.time) + (seated.estimatedDuration ?? 90);
      const freeAt = new Date(today);
      freeAt.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
      return freeAt;
    }

    // Recently completed (cleaning) — free when cleared or after buffer
    const cleaning = sorted.find((r) => r.completedAt && !r.cleaningClearedAt);
    if (cleaning && cleaning.completedAt) {
      const cleared = cleaning.cleaningClearedAt;
      if (cleared) return cleared;
      const bufferEnd = new Date(cleaning.completedAt.getTime() + CLEANING_BUFFER_MINUTES * 60 * 1000);
      return bufferEnd;
    }

    return now;
  }

  let earliestFreeAt: Date | null = null;
  for (const table of tables) {
    const freeAt = getTableFreeAt(table.id);
    if (freeAt <= now) return 0; // already free
    if (!earliestFreeAt || freeAt < earliestFreeAt) earliestFreeAt = freeAt;
  }

  if (!earliestFreeAt) return null;
  const minutes = Math.ceil((earliestFreeAt.getTime() - now.getTime()) / 60000);
  return Math.max(0, minutes);
}

/**
 * Filter and sort waitlist entries that fit a table (WAITING or NOTIFIED, party size in range).
 * Sorted by createdAt ascending (longest waiting first). Caller can take top N.
 */
export function getSuggestedPartiesForTable(
  _restaurantId: string,
  _tableId: string,
  entries: WaitlistEntryForSuggestion[],
  tableMaxCapacity: number,
  tableMinCapacity?: number
): WaitlistEntryForSuggestion[] {
  const filtered = entries.filter((e) => {
    if (e.status !== "WAITING" && e.status !== "NOTIFIED") return false;
    if (e.partySize > tableMaxCapacity) return false;
    if (tableMinCapacity != null && e.partySize < tableMinCapacity) return false;
    return true;
  });
  return [...filtered].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export interface SuggestedSeating {
  tableId: string;
  tableLabel: string;
  tableZone?: string | null;
  suggestions: {
    entryId: string;
    guestName: string;
    partySize: number;
    waitMinutes: number;
  }[];
}

/**
 * For the dashboard: which available tables have suggested parties from the waitlist.
 * Uses same table-status logic to determine "available"; suggests top 1–3 parties per table.
 */
export async function getSuggestedSeatingsForRestaurant(
  restaurantId: string
): Promise<SuggestedSeating[]> {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const [tablesWithRes, waitlistEntries] = await Promise.all([
    prisma.restaurantTable.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        reservations: {
          where: {
            date: today,
            status: { notIn: ["CANCELLED"] },
          },
          orderBy: { time: "asc" },
        },
      },
    }),
    prisma.waitlistEntry.findMany({
      where: {
        restaurantId,
        status: { in: ["WAITING", "NOTIFIED"] },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        guestName: true,
        partySize: true,
        createdAt: true,
        status: true,
      },
    }),
  ]);

  const entriesForSuggestion: WaitlistEntryForSuggestion[] = waitlistEntries.map((e) => ({
    id: e.id,
    guestName: e.guestName,
    partySize: e.partySize,
    createdAt: e.createdAt.toISOString(),
    status: e.status,
  }));

  const result: SuggestedSeating[] = [];

  for (const table of tablesWithRes) {
    const tableWithDates = {
      ...table,
      reservations: table.reservations.map((r) => ({
        id: r.id,
        time: r.time,
        partySize: r.partySize,
        guestName: r.guestName,
        guestPhone: r.guestPhone,
        notes: r.notes,
        status: r.status,
        source: r.source,
        estimatedDuration: r.estimatedDuration,
        seatedAt: r.seatedAt,
        completedAt: r.completedAt,
        cleaningClearedAt: r.cleaningClearedAt ?? undefined,
      })),
    };
    const statusInfo = getTableStatus(tableWithDates, now);
    if (statusInfo.status !== "available") continue;

    const suggested = getSuggestedPartiesForTable(
      restaurantId,
      table.id,
      entriesForSuggestion,
      table.maxCapacity,
      table.minCapacity ?? undefined
    ).slice(0, 3);

    if (suggested.length === 0) continue;

    result.push({
      tableId: table.id,
      tableLabel: table.label,
      tableZone: table.zone,
      suggestions: suggested.map((e) => ({
        entryId: e.id,
        guestName: e.guestName,
        partySize: e.partySize,
        waitMinutes: Math.floor(
          (now.getTime() - new Date(e.createdAt).getTime()) / 60000
        ),
      })),
    });
  }

  return result;
}
