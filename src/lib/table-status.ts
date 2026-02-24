/**
 * Derives the real-time status of a restaurant table based on its reservations.
 * No separate status column needed — status is computed from reservation data.
 */

export type TableStatus = "available" | "reserved" | "occupied" | "cleaning" | "blocked";

export interface TableWithReservations {
  id: string;
  label: string;
  maxCapacity: number;
  minCapacity: number;
  shape: string;
  zone: string | null;
  isActive: boolean;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation: number;
  reservations: {
    id: string;
    time: string;
    partySize: number;
    guestName: string;
    guestPhone: string;
    notes: string | null;
    status: string;
    source: string;
    estimatedDuration: number;
    seatedAt: Date | null;
    completedAt: Date | null;
    cleaningClearedAt?: Date | null;
    /** When reservation uses two tables combined, e.g. "T3 + T4" */
    combinedTableLabel?: string | null;
    /** Guest profile for badge (first-time, no-show warning) */
    guest?: { name: string; totalVisits: number; noShowCount: number } | null;
  }[];
}

export interface TableStatusInfo {
  status: TableStatus;
  currentReservation: TableWithReservations["reservations"][0] | null;
  upcomingReservations: TableWithReservations["reservations"];
  minutesOccupied: number | null; // how long the current party has been seated
  estimatedFreeAt: string | null; // "HH:MM" when table is expected to be free
}

const CLEANING_BUFFER_MINUTES = 15;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function getTableStatus(
  table: TableWithReservations,
  now: Date = new Date()
): TableStatusInfo {
  if (!table.isActive) {
    return { status: "blocked", currentReservation: null, upcomingReservations: [], minutesOccupied: null, estimatedFreeAt: null };
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Sort reservations by time
  const sorted = [...table.reservations]
    .filter((r) => r.status !== "CANCELLED" && r.status !== "NO_SHOW")
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  // Check for currently seated (occupied)
  const seated = sorted.find(
    (r) => r.seatedAt && !r.completedAt
  );
  if (seated) {
    const seatedMinutes = Math.floor(
      (now.getTime() - new Date(seated.seatedAt!).getTime()) / 60000
    );
    const estimatedEnd = timeToMinutes(seated.time) + seated.estimatedDuration;
    return {
      status: "occupied",
      currentReservation: seated,
      upcomingReservations: sorted.filter((r) => r.id !== seated.id && timeToMinutes(r.time) > nowMinutes),
      minutesOccupied: seatedMinutes,
      estimatedFreeAt: minutesToTime(estimatedEnd),
    };
  }

  // Check for recently completed (cleaning) — skip if host already cleared cleaning
  const recentlyCompleted = sorted.find((r) => {
    if (!r.completedAt) return false;
    if (r.cleaningClearedAt) return false; // host marked table as free
    const completedTime = new Date(r.completedAt).getTime();
    const minutesSinceCompleted = (now.getTime() - completedTime) / 60000;
    return minutesSinceCompleted < CLEANING_BUFFER_MINUTES;
  });
  if (recentlyCompleted) {
    return {
      status: "cleaning",
      currentReservation: recentlyCompleted,
      upcomingReservations: sorted.filter((r) => timeToMinutes(r.time) > nowMinutes && !r.completedAt),
      minutesOccupied: null,
      estimatedFreeAt: null,
    };
  }

  // Check for upcoming reservation within 30 minutes (reserved)
  const upcoming = sorted.filter((r) => {
    const resMinutes = timeToMinutes(r.time);
    return (
      !r.seatedAt &&
      !r.completedAt &&
      resMinutes >= nowMinutes &&
      resMinutes <= nowMinutes + 30 &&
      (r.status === "PENDING" || r.status === "CONFIRMED")
    );
  });
  if (upcoming.length > 0) {
    const allUpcoming = sorted.filter(
      (r) => timeToMinutes(r.time) >= nowMinutes && !r.seatedAt && !r.completedAt
    );
    return {
      status: "reserved",
      currentReservation: upcoming[0],
      upcomingReservations: allUpcoming,
      minutesOccupied: null,
      estimatedFreeAt: null,
    };
  }

  // Otherwise available
  const futureReservations = sorted.filter(
    (r) => timeToMinutes(r.time) > nowMinutes && !r.seatedAt && !r.completedAt
  );
  return {
    status: "available",
    currentReservation: null,
    upcomingReservations: futureReservations,
    minutesOccupied: null,
    estimatedFreeAt: null,
  };
}

export const STATUS_COLORS: Record<TableStatus, string> = {
  available: "#22c55e",  // green
  reserved: "#3b82f6",   // blue
  occupied: "#ef4444",   // red
  cleaning: "#eab308",   // yellow
  blocked: "#6b7280",    // gray
};

export const STATUS_LABELS: Record<TableStatus, { en: string; de: string }> = {
  available: { en: "Available", de: "Verfügbar" },
  reserved: { en: "Reserved", de: "Reserviert" },
  occupied: { en: "Occupied", de: "Besetzt" },
  cleaning: { en: "Cleaning", de: "Reinigung" },
  blocked: { en: "Blocked", de: "Gesperrt" },
};
