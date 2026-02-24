"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendWaitlistTableReady } from "@/lib/notifications";
import { findBestTable } from "@/lib/table-assignment";
import { findOrCreateGuest, incrementGuestTotalVisits, incrementGuestNoShowCount } from "@/lib/guest";

async function getSessionRestaurantId(): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const role = (session.user as unknown as Record<string, unknown>).role as string;
  const restaurantId = (session.user as unknown as Record<string, unknown>)
    .restaurantId as string | null;

  if (role === "SUPER_ADMIN") {
    // For super admins, get the first restaurant (or accept restaurantId from params)
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) throw new Error("No restaurant found");
    return restaurant.id;
  }

  if (!restaurantId) throw new Error("No restaurant assigned");
  return restaurantId;
}

/** No-show policy from restaurant.settings. Default: threshold 2, block disabled. */
async function getNoShowPolicy(restaurantId: string): Promise<{
  threshold: number;
  blockEnabled: boolean;
}> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { settings: true },
  });
  const settings = (restaurant?.settings ?? null) as Record<string, unknown> | null;
  const threshold = Math.max(1, Number(settings?.noShowBlockThreshold ?? 2));
  const blockEnabled = Boolean(settings?.noShowBlockEnabled ?? false);
  return { threshold, blockEnabled };
}

const DEFAULT_DURATION_MINUTES = 90;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Returns true if the table already has a reservation overlapping the given slot (same date). */
async function tableHasOverlap(
  tableId: string,
  date: Date,
  time: string,
  durationMinutes: number,
  excludeReservationId?: string
): Promise<boolean> {
  const start = timeToMinutes(time);
  const end = start + durationMinutes;
  const existing = await prisma.reservation.findMany({
    where: {
      date,
      id: excludeReservationId ? { not: excludeReservationId } : undefined,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      OR: [{ tableId }, { combinedWithTableId: tableId }],
    },
    select: { time: true, estimatedDuration: true },
  });
  return existing.some((r) => {
    const rStart = timeToMinutes(r.time);
    const rEnd = rStart + (r.estimatedDuration ?? DEFAULT_DURATION_MINUTES);
    return start < rEnd && end > rStart;
  });
}

function parseOpeningHours(raw: FormDataEntryValue | null): Record<string, { open: string; close: string } | null> | null {
  if (raw == null || typeof raw !== "string" || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed !== null && typeof parsed === "object" && "monday" in parsed) {
      return parsed as Record<string, { open: string; close: string } | null>;
    }
  } catch {
    // invalid JSON
  }
  return null;
}

export async function updateRestaurant(formData: FormData) {
  const restaurantId = await getSessionRestaurantId();

  const openingHours = parseOpeningHours(formData.get("openingHours"));
  const data: Parameters<typeof prisma.restaurant.update>[0]["data"] = {
    name: {
      en: formData.get("name_en") as string,
      de: formData.get("name_de") as string,
    },
    description: {
      en: formData.get("description_en") as string,
      de: formData.get("description_de") as string,
    },
    address: formData.get("address") as string,
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
  };
  if (openingHours !== null) {
    data.openingHours = openingHours;
  }

  if (formData.get("noShowPolicySection") === "1") {
    const current = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { settings: true },
    });
    const settings = (current?.settings ?? null) as Record<string, unknown> | null;
    const thresholdRaw = formData.get("noShowBlockThreshold");
    const threshold = Math.max(1, Number(thresholdRaw ?? settings?.noShowBlockThreshold ?? 2));
    const noShowBlockEnabled = formData.get("noShowBlockEnabled") === "1";
    data.settings = {
      ...(settings ?? {}),
      noShowBlockThreshold: threshold,
      noShowBlockEnabled,
    };
  }

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data,
  });

  revalidatePath("/");
  revalidatePath("/admin/restaurant");
  return { success: true };
}

export async function createCategory(formData: FormData) {
  const restaurantId = await getSessionRestaurantId();

  const maxOrder = await prisma.menuCategory.findFirst({
    where: { restaurantId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.menuCategory.create({
    data: {
      name: {
        en: formData.get("name_en") as string,
        de: formData.get("name_de") as string,
      },
      sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
      restaurantId,
    },
  });

  revalidatePath("/");
  return { success: true };
}

export async function updateCategory(id: string, formData: FormData) {
  await getSessionRestaurantId();

  await prisma.menuCategory.update({
    where: { id },
    data: {
      name: {
        en: formData.get("name_en") as string,
        de: formData.get("name_de") as string,
      },
    },
  });

  revalidatePath("/");
  return { success: true };
}

export async function deleteCategory(id: string) {
  await getSessionRestaurantId();

  await prisma.menuCategory.delete({ where: { id } });

  revalidatePath("/");
  return { success: true };
}

export async function createMenuItem(formData: FormData) {
  await getSessionRestaurantId();

  const categoryId = formData.get("categoryId") as string;

  const maxOrder = await prisma.menuItem.findFirst({
    where: { categoryId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const dietaryTags = formData.get("dietaryTags") as string;

  await prisma.menuItem.create({
    data: {
      name: {
        en: formData.get("name_en") as string,
        de: formData.get("name_de") as string,
      },
      description: {
        en: (formData.get("description_en") as string) || "",
        de: (formData.get("description_de") as string) || "",
      },
      price: parseFloat(formData.get("price") as string),
      dietaryTags: dietaryTags ? dietaryTags.split(",").filter(Boolean) : [],
      isAvailable: formData.get("isAvailable") === "true",
      sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
      categoryId,
    },
  });

  revalidatePath("/");
  return { success: true };
}

export async function updateMenuItem(id: string, formData: FormData) {
  await getSessionRestaurantId();

  const dietaryTags = formData.get("dietaryTags") as string;

  await prisma.menuItem.update({
    where: { id },
    data: {
      name: {
        en: formData.get("name_en") as string,
        de: formData.get("name_de") as string,
      },
      description: {
        en: (formData.get("description_en") as string) || "",
        de: (formData.get("description_de") as string) || "",
      },
      price: parseFloat(formData.get("price") as string),
      dietaryTags: dietaryTags ? dietaryTags.split(",").filter(Boolean) : [],
      isAvailable: formData.get("isAvailable") === "true",
    },
  });

  revalidatePath("/");
  return { success: true };
}

export async function deleteMenuItem(id: string) {
  await getSessionRestaurantId();

  await prisma.menuItem.delete({ where: { id } });

  revalidatePath("/");
  return { success: true };
}

export async function updateReservationStatus(id: string, status: string) {
  const restaurantId = await getSessionRestaurantId();

  const reservation = await prisma.reservation.findFirst({
    where: { id, restaurantId },
  });
  if (!reservation) throw new Error("Reservation not found");

  if (reservation.guestId) {
    if (status === "COMPLETED") await incrementGuestTotalVisits(reservation.guestId);
    if (status === "NO_SHOW") await incrementGuestNoShowCount(reservation.guestId);
  }

  const data: { status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW"; completedAt?: Date } = {
    status: status as "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW",
  };
  if (status === "COMPLETED") data.completedAt = new Date();

  await prisma.reservation.update({
    where: { id },
    data,
  });

  revalidatePath("/");
  return { success: true };
}

export async function createReservation(data: {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  guestName: string;
  guestPhone?: string;
  partySize: number;
  tableId?: string;
  combinedWithTableId?: string;
  seatingPreference?: string;
  notes?: string;
  status?: "PENDING" | "CONFIRMED";
}) {
  const restaurantId = await getSessionRestaurantId();
  const date = new Date(data.date + "T12:00:00");
  if (data.tableId) {
    const overlap = await tableHasOverlap(
      data.tableId,
      date,
      data.time,
      DEFAULT_DURATION_MINUTES
    );
    if (overlap) throw new Error("Table already booked for this time");
  }
  if (data.combinedWithTableId) {
    const overlap = await tableHasOverlap(
      data.combinedWithTableId,
      date,
      data.time,
      DEFAULT_DURATION_MINUTES
    );
    if (overlap) throw new Error("Combined table already booked for this time");
  }
  const guest = await findOrCreateGuest({
    restaurantId,
    name: data.guestName.trim(),
    phone: (data.guestPhone ?? "").trim() || null,
    email: null,
    seatingPreference: data.seatingPreference?.trim() || null,
  });
  let guestNoShowCount: number | undefined;
  const policy = await getNoShowPolicy(restaurantId);
  if (guest) {
    const guestRow = await prisma.guest.findUnique({
      where: { id: guest.id },
      select: { noShowCount: true },
    });
    guestNoShowCount = guestRow?.noShowCount ?? 0;
    if (policy.blockEnabled && guestNoShowCount >= policy.threshold) {
      return { success: false, error: "GUEST_NO_SHOW_BLOCKED", noShowCount: guestNoShowCount };
    }
  }
  await prisma.reservation.create({
    data: {
      restaurantId,
      date,
      time: data.time,
      guestName: data.guestName.trim(),
      guestPhone: (data.guestPhone ?? "").trim() || "",
      partySize: data.partySize,
      notes: data.notes?.trim() || null,
      tableId: data.tableId || null,
      combinedWithTableId: data.combinedWithTableId || null,
      seatingPreference: data.seatingPreference?.trim() || null,
      status: data.status ?? "PENDING",
      source: "phone",
      guestId: guest?.id ?? null,
    },
  });
  revalidatePath("/");
  const noShowWarning = guestNoShowCount != null && guestNoShowCount >= policy.threshold;
  return {
    success: true,
    ...(noShowWarning && { noShowWarning: true, noShowCount: guestNoShowCount }),
  };
}

export async function updateReservation(
  id: string,
  data: {
    date?: string;
    time?: string;
    guestName?: string;
    guestPhone?: string;
    partySize?: number;
    tableId?: string | null;
    combinedWithTableId?: string | null;
    seatingPreference?: string | null;
    notes?: string | null;
    status?: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  }
) {
  const restaurantId = await getSessionRestaurantId();
  const reservation = await prisma.reservation.findFirst({
    where: { id, restaurantId },
  });
  if (!reservation) throw new Error("Reservation not found");

  const update: Record<string, unknown> = {};
  if (data.date !== undefined) update.date = new Date(data.date + "T12:00:00");
  if (data.time !== undefined) update.time = data.time;
  if (data.guestName !== undefined) update.guestName = data.guestName.trim();
  if (data.guestPhone !== undefined) update.guestPhone = (data.guestPhone ?? "").trim() || "";
  if (data.partySize !== undefined) update.partySize = data.partySize;
  if (data.tableId !== undefined) update.tableId = data.tableId || null;
  if (data.combinedWithTableId !== undefined) update.combinedWithTableId = data.combinedWithTableId || null;
  if (data.seatingPreference !== undefined) update.seatingPreference = data.seatingPreference?.trim() || null;
  if (data.notes !== undefined) update.notes = data.notes?.trim() || null;
  if (data.status !== undefined) {
    if (reservation.guestId) {
      if (data.status === "COMPLETED") await incrementGuestTotalVisits(reservation.guestId);
      if (data.status === "NO_SHOW") await incrementGuestNoShowCount(reservation.guestId);
    }
    update.status = data.status;
    if (data.status === "COMPLETED") (update as Record<string, unknown>).completedAt = new Date();
  }

  if (data.tableId !== undefined && data.tableId) {
    const effectiveDate = (update.date as Date) ?? reservation.date;
    const effectiveTime = (update.time as string) ?? reservation.time;
    const duration = reservation.estimatedDuration ?? DEFAULT_DURATION_MINUTES;
    const overlap = await tableHasOverlap(
      data.tableId,
      effectiveDate,
      effectiveTime,
      duration,
      id
    );
    if (overlap) throw new Error("Table already booked for this time");
  }

  await prisma.reservation.update({
    where: { id },
    data: update,
  });

  revalidatePath("/");
  return { success: true };
}

// ── Guest Actions ─────────────────────────────────────────────────────

export async function updateGuest(
  guestId: string,
  data: {
    name?: string;
    notes?: string | null;
    dietaryRestrictions?: string[];
    tags?: string[];
    seatingPreference?: string | null;
  }
) {
  const restaurantId = await getSessionRestaurantId();
  await prisma.guest.updateMany({
    where: { id: guestId, restaurantId },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
      ...(data.dietaryRestrictions !== undefined && { dietaryRestrictions: data.dietaryRestrictions }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.seatingPreference !== undefined && {
        seatingPreference: data.seatingPreference?.trim() || null,
      }),
    },
  });
  revalidatePath("/");
  return { success: true };
}

export async function getGuests(search?: string) {
  const restaurantId = await getSessionRestaurantId();
  const q = (search ?? "").trim();
  const where = q
    ? {
        restaurantId,
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : { restaurantId };
  const guests = await prisma.guest.findMany({
    where,
    orderBy: [{ lastVisitAt: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      totalVisits: true,
      noShowCount: true,
      lastVisitAt: true,
      seatingPreference: true,
    },
  });
  return guests;
}

export async function getGuestById(guestId: string) {
  const restaurantId = await getSessionRestaurantId();
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, restaurantId },
    include: {
      reservations: {
        orderBy: [{ date: "desc" }, { time: "desc" }],
        take: 50,
        select: {
          id: true,
          date: true,
          time: true,
          partySize: true,
          status: true,
          guestName: true,
        },
      },
    },
  });
  return guest;
}

// ── Table Management Actions ──────────────────────────────────────────

export async function createTable(data: {
  label: string;
  minCapacity: number;
  maxCapacity: number;
  shape: string;
  zone: string;
  isCombinable: boolean;
}) {
  const restaurantId = await getSessionRestaurantId();
  const maxOrder = await prisma.restaurantTable.findFirst({
    where: { restaurantId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.restaurantTable.create({
    data: {
      ...data,
      shape: data.shape as "ROUND" | "SQUARE" | "RECTANGLE" | "BOOTH",
      sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
      restaurantId,
    },
  });

  revalidatePath("/");
  return { success: true };
}

export async function updateTable(
  id: string,
  data: {
    label: string;
    minCapacity: number;
    maxCapacity: number;
    shape: string;
    zone: string;
    isCombinable: boolean;
    isActive: boolean;
  }
) {
  await getSessionRestaurantId();
  await prisma.restaurantTable.update({
    where: { id },
    data: {
      ...data,
      shape: data.shape as "ROUND" | "SQUARE" | "RECTANGLE" | "BOOTH",
    },
  });
  revalidatePath("/");
  return { success: true };
}

export async function deleteTable(id: string) {
  await getSessionRestaurantId();
  await prisma.restaurantTable.delete({ where: { id } });
  revalidatePath("/");
  return { success: true };
}

export async function updateTablePositions(
  tables: {
    id: string;
    posX: number;
    posY: number;
    width: number;
    height: number;
    rotation: number;
  }[]
) {
  await getSessionRestaurantId();
  await Promise.all(
    tables.map((t) =>
      prisma.restaurantTable.update({
        where: { id: t.id },
        data: {
          posX: t.posX,
          posY: t.posY,
          width: t.width,
          height: t.height,
          rotation: t.rotation,
        },
      })
    )
  );
  revalidatePath("/");
  return { success: true };
}

// ── Host Dashboard Actions ──────────────────────────────────────────

export async function seatReservation(reservationId: string) {
  const restaurantId = await getSessionRestaurantId();
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
  });
  if (!reservation) throw new Error("Reservation not found");

  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      seatedAt: new Date(),
      status: "CONFIRMED",
    },
  });

  revalidatePath("/");
  return { success: true };
}

export async function completeReservation(reservationId: string) {
  const restaurantId = await getSessionRestaurantId();
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
  });
  if (!reservation) throw new Error("Reservation not found");

  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      completedAt: new Date(),
      status: "COMPLETED",
    },
  });

  revalidatePath("/");
  return { success: true };
}

export async function markNoShow(reservationId: string) {
  const restaurantId = await getSessionRestaurantId();
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
  });
  if (!reservation) throw new Error("Reservation not found");

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "NO_SHOW" },
  });

  revalidatePath("/");
  return { success: true };
}

export async function clearCleaning(reservationId: string) {
  const restaurantId = await getSessionRestaurantId();
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
  });
  if (!reservation) throw new Error("Reservation not found");

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { cleaningClearedAt: new Date() },
  });

  revalidatePath("/");
  return { success: true };
}

export async function createWalkIn(data: {
  guestName: string;
  guestPhone?: string;
  partySize: number;
  tableId: string;
  combinedWithTableId?: string;
}) {
  const restaurantId = await getSessionRestaurantId();
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  const guest = await findOrCreateGuest({
    restaurantId,
    name: data.guestName.trim(),
    phone: (data.guestPhone ?? "").trim() || null,
    email: null,
  });
  let guestNoShowCount: number | undefined;
  const policy = await getNoShowPolicy(restaurantId);
  if (guest) {
    const guestRow = await prisma.guest.findUnique({
      where: { id: guest.id },
      select: { noShowCount: true },
    });
    guestNoShowCount = guestRow?.noShowCount ?? 0;
    if (policy.blockEnabled && guestNoShowCount >= policy.threshold) {
      return { success: false, error: "GUEST_NO_SHOW_BLOCKED", noShowCount: guestNoShowCount };
    }
  }
  const reservation = await prisma.reservation.create({
    data: {
      restaurantId,
      date: now,
      time,
      partySize: data.partySize,
      guestName: data.guestName,
      guestPhone: data.guestPhone || "",
      source: "walk_in",
      status: "CONFIRMED",
      tableId: data.tableId,
      combinedWithTableId: data.combinedWithTableId || null,
      seatedAt: now,
      guestId: guest?.id ?? null,
    },
  });

  revalidatePath("/");
  const noShowWarning = guestNoShowCount != null && guestNoShowCount >= policy.threshold;
  return {
    success: true,
    reservationId: reservation.id,
    ...(noShowWarning && { noShowWarning: true, noShowCount: guestNoShowCount }),
  };
}

/** Get suggested table (single or combined) for a walk-in right now. */
export async function getSuggestedTableForWalkIn(partySize: number, seatingPreference?: string) {
  const restaurantId = await getSessionRestaurantId();
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  const table = await findBestTable({
    restaurantId,
    date,
    time,
    partySize,
    seatingPreference: seatingPreference || undefined,
  });
  if (!table) return null;
  const label = table.combinedWithLabel ? `${table.label} + ${table.combinedWithLabel}` : table.label;
  return {
    tableId: table.id,
    combinedWithTableId: table.combinedWithTableId ?? null,
    label,
    zone: table.zone,
  };
}

/** Auto-assign tables to all unassigned reservations (by date+time order). */
export async function autoAssignTables(): Promise<{ assigned: number; failed: number }> {
  const restaurantId = await getSessionRestaurantId();
  const unassigned = await prisma.reservation.findMany({
    where: {
      restaurantId,
      tableId: null,
      status: { notIn: ["CANCELLED"] },
    },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });
  let assigned = 0;
  let failed = 0;
  for (const res of unassigned) {
    const date = res.date.toISOString().slice(0, 10);
    const table = await findBestTable({
      restaurantId,
      date,
      time: res.time,
      partySize: res.partySize,
      durationMinutes: res.estimatedDuration ?? DEFAULT_DURATION_MINUTES,
      seatingPreference: res.seatingPreference ?? undefined,
    });
    if (table) {
      await prisma.reservation.update({
        where: { id: res.id },
        data: {
          tableId: table.id,
          combinedWithTableId: table.combinedWithTableId ?? null,
        },
      });
      assigned++;
    } else {
      failed++;
    }
  }
  revalidatePath("/");
  return { assigned, failed };
}

// ── Waitlist Actions ─────────────────────────────────────────────────────

export async function addToWaitlist(data: {
  guestName: string;
  guestPhone?: string;
  partySize: number;
  notes?: string;
  estimatedWaitMin?: number;
  seatingPref?: string;
}) {
  const restaurantId = await getSessionRestaurantId();
  await prisma.waitlistEntry.create({
    data: {
      restaurantId,
      guestName: data.guestName.trim(),
      guestPhone: data.guestPhone?.trim() || null,
      partySize: data.partySize,
      notes: data.notes?.trim() || null,
      estimatedWaitMin: data.estimatedWaitMin ?? null,
      seatingPref: data.seatingPref?.trim() || null,
      status: "WAITING",
    },
  });
  revalidatePath("/");
  return { success: true };
}

export async function notifyWaitlistEntry(entryId: string) {
  const restaurantId = await getSessionRestaurantId();
  const entry = await prisma.waitlistEntry.findFirst({
    where: { id: entryId, restaurantId },
  });
  if (!entry) throw new Error("Waitlist entry not found");
  if (entry.status !== "WAITING") throw new Error("Entry is not waiting");

  const now = new Date();
  await prisma.waitlistEntry.update({
    where: { id: entryId },
    data: { status: "NOTIFIED", notifiedAt: now },
  });

  await sendWaitlistTableReady({
    event: "waitlist.table_ready",
    entryId: entry.id,
    restaurantId: entry.restaurantId,
    guestName: entry.guestName,
    guestPhone: entry.guestPhone,
    partySize: entry.partySize,
    estimatedWaitMin: entry.estimatedWaitMin,
    createdAt: entry.createdAt.toISOString(),
  });

  revalidatePath("/");
  return { success: true };
}

export async function seatWaitlistEntry(entryId: string, tableId?: string) {
  const restaurantId = await getSessionRestaurantId();
  const entry = await prisma.waitlistEntry.findFirst({
    where: { id: entryId, restaurantId },
  });
  if (!entry) throw new Error("Waitlist entry not found");

  const now = new Date();
  await prisma.waitlistEntry.update({
    where: { id: entryId },
    data: { status: "SEATED", tableId: tableId || null, seatedAt: now },
  });

  // When seated at a table, create a reservation so the host dashboard shows the table as occupied
  if (tableId) {
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    await prisma.reservation.create({
      data: {
        restaurantId,
        date: now,
        time,
        partySize: entry.partySize,
        guestName: entry.guestName,
        guestPhone: entry.guestPhone || "",
        source: "walk_in",
        status: "CONFIRMED",
        tableId,
        seatedAt: now,
      },
    });
  }

  revalidatePath("/");
  return { success: true };
}

/** Seat a waitlist entry at a specific table. Entry must be WAITING or NOTIFIED. Creates reservation and updates entry. */
export async function seatWaitlistEntryAtTable(entryId: string, tableId: string) {
  const restaurantId = await getSessionRestaurantId();

  const [entry, table] = await Promise.all([
    prisma.waitlistEntry.findFirst({ where: { id: entryId, restaurantId } }),
    prisma.restaurantTable.findFirst({ where: { id: tableId, restaurantId } }),
  ]);

  if (!entry) throw new Error("Waitlist entry not found");
  if (!table) throw new Error("Table not found");
  if (entry.status !== "WAITING" && entry.status !== "NOTIFIED") {
    throw new Error("Entry must be waiting or notified to seat");
  }
  if (entry.partySize > table.maxCapacity || entry.partySize < table.minCapacity) {
    throw new Error("Party size does not fit table capacity");
  }

  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  await prisma.reservation.create({
    data: {
      restaurantId,
      date: now,
      time,
      partySize: entry.partySize,
      guestName: entry.guestName,
      guestPhone: entry.guestPhone || "",
      source: "walk_in",
      status: "CONFIRMED",
      tableId,
      seatedAt: now,
    },
  });

  await prisma.waitlistEntry.update({
    where: { id: entryId },
    data: { status: "SEATED", tableId, seatedAt: now },
  });

  revalidatePath("/");
  return { success: true };
}

export async function markWaitlistLeft(entryId: string) {
  const restaurantId = await getSessionRestaurantId();
  await prisma.waitlistEntry.updateMany({
    where: { id: entryId, restaurantId },
    data: { status: "LEFT" },
  });
  revalidatePath("/");
  return { success: true };
}

export async function markWaitlistCancelled(entryId: string) {
  const restaurantId = await getSessionRestaurantId();
  await prisma.waitlistEntry.updateMany({
    where: { id: entryId, restaurantId },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/");
  return { success: true };
}

export async function setWaitlistEstimatedWait(entryId: string, minutes: number | null) {
  const restaurantId = await getSessionRestaurantId();
  await prisma.waitlistEntry.updateMany({
    where: { id: entryId, restaurantId },
    data: { estimatedWaitMin: minutes },
  });
  revalidatePath("/");
  return { success: true };
}
