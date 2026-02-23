import { prisma } from "@/lib/prisma";

interface TableCandidate {
  id: string;
  label: string;
  maxCapacity: number;
  minCapacity: number;
  zone: string | null;
  shape: string;
}

/**
 * Find the best available table for a reservation.
 * Algorithm:
 * 1. Get all active tables for the restaurant where maxCapacity >= partySize
 * 2. For each candidate, check if it's free during the time window [time, time + duration]
 *    by looking for overlapping confirmed/pending reservations
 * 3. Sort candidates: prefer smallest table that fits (best-fit), then match seating preference
 * 4. Return the best match or null if fully booked
 */
export async function findBestTable(params: {
  restaurantId: string;
  date: string;          // "YYYY-MM-DD"
  time: string;          // "HH:MM"
  partySize: number;
  durationMinutes?: number;  // default 90
  seatingPreference?: string; // "patio", "window", etc.
}): Promise<TableCandidate | null> {
  const { restaurantId, date, time, partySize, durationMinutes = 90, seatingPreference } = params;

  // 1. Get all active tables that can fit the party
  const tables = await prisma.restaurantTable.findMany({
    where: {
      restaurantId,
      isActive: true,
      maxCapacity: { gte: partySize },
    },
    orderBy: { maxCapacity: "asc" }, // smallest first for best-fit
  });

  if (tables.length === 0) return null;

  // 2. Get all non-cancelled reservations for this date
  const reservations = await prisma.reservation.findMany({
    where: {
      restaurantId,
      date: new Date(date),
      status: { notIn: ["CANCELLED"] },
      tableId: { not: null },
    },
    select: {
      tableId: true,
      time: true,
      estimatedDuration: true,
    },
  });

  // Helper: convert "HH:MM" to minutes since midnight
  function timeToMinutes(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  const requestStart = timeToMinutes(time);
  const requestEnd = requestStart + durationMinutes;

  // 3. For each table, check if it's free during the requested window
  const availableTables = tables.filter((table) => {
    const tableReservations = reservations.filter((r) => r.tableId === table.id);

    // Check for time overlap with any existing reservation
    return !tableReservations.some((r) => {
      const resStart = timeToMinutes(r.time);
      const resEnd = resStart + (r.estimatedDuration || 90);
      // Overlap: if request starts before reservation ends AND request ends after reservation starts
      return requestStart < resEnd && requestEnd > resStart;
    });
  });

  if (availableTables.length === 0) return null;

  // 4. Sort: prefer seating preference match, then smallest capacity (already sorted)
  if (seatingPreference) {
    const prefLower = seatingPreference.toLowerCase();
    availableTables.sort((a, b) => {
      const aMatch = a.zone?.toLowerCase().includes(prefLower) ? 0 : 1;
      const bMatch = b.zone?.toLowerCase().includes(prefLower) ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return a.maxCapacity - b.maxCapacity;
    });
  }

  const best = availableTables[0];
  return {
    id: best.id,
    label: best.label,
    maxCapacity: best.maxCapacity,
    minCapacity: best.minCapacity,
    zone: best.zone,
    shape: best.shape,
  };
}
