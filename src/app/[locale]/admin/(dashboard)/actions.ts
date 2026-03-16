"use server";

import { auth } from "@/../auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendWaitlistTableReady } from "@/lib/notifications";
import { findBestTable } from "@/lib/table-assignment";
import { findOrCreateGuest, incrementGuestTotalVisits, incrementGuestNoShowCount } from "@/lib/guest";
import { estimateWaitMinutes } from "@/lib/waitlist";
import { checkAndDeductTokens, TOKEN_COSTS } from "@/lib/tokens";

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
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const role = (session.user as unknown as Record<string, unknown>).role as string;
  const isSuperAdmin = role === "SUPER_ADMIN";

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

  const current = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { settings: true },
  });
  const settings = (current?.settings ?? null) as Record<string, unknown> | null;
  const nextSettings: Record<string, unknown> = { ...(settings ?? {}) };

  if (formData.get("noShowPolicySection") === "1") {
    const thresholdRaw = formData.get("noShowBlockThreshold");
    const threshold = Math.max(1, Number(thresholdRaw ?? settings?.noShowBlockThreshold ?? 2));
    const noShowBlockEnabled = formData.get("noShowBlockEnabled") === "1";
    nextSettings.noShowBlockThreshold = threshold;
    nextSettings.noShowBlockEnabled = noShowBlockEnabled;
  }

  // Only SUPER_ADMIN can change site tier (assign tier per paid plan).
  let siteTierRaw: string | null = null;
  if (isSuperAdmin) {
    const raw = formData.get("siteTier");
    if (raw === "basic" || raw === "editorial" || raw === "premium") {
      nextSettings.siteTier = raw;
      siteTierRaw = raw;
    }
  }
  // Owners: tier is unchanged (nextSettings already has current from ...settings).

  data.settings = nextSettings as Prisma.InputJsonValue;

  const previousTier = (settings?.siteTier as string) || "basic";
  const tierSwitch =
    isSuperAdmin &&
    (siteTierRaw === "editorial" || siteTierRaw === "premium") &&
    previousTier === "basic";
  const tokenCost =
    TOKEN_COSTS.website_update + (tierSwitch ? TOKEN_COSTS.tier_switch : 0);
  const tokenResult = await checkAndDeductTokens(
    restaurantId,
    tokenCost,
    "website_update",
    tierSwitch ? { tierSwitch: true, newTier: siteTierRaw ?? undefined } : undefined
  );
  if (!tokenResult.ok) {
    throw new Error(tokenResult.error);
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
  const restaurantId = await getSessionRestaurantId();

  const categoryId = formData.get("categoryId") as string;

  const tokenResult = await checkAndDeductTokens(
    restaurantId,
    TOKEN_COSTS.menu_item_create,
    "menu_item_create"
  );
  if (!tokenResult.ok) {
    throw new Error(tokenResult.error);
  }

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
  const restaurantId = await getSessionRestaurantId();

  const item = await prisma.menuItem.findUnique({
    where: { id },
    select: { categoryId: true },
  });
  if (!item) throw new Error("Menu item not found");
  const category = await prisma.menuCategory.findUnique({
    where: { id: item.categoryId },
    select: { restaurantId: true },
  });
  if (!category || category.restaurantId !== restaurantId) {
    throw new Error("Unauthorized");
  }

  const tokenResult = await checkAndDeductTokens(
    restaurantId,
    TOKEN_COSTS.menu_item_update,
    "menu_item_update",
    { menuItemId: id }
  );
  if (!tokenResult.ok) {
    throw new Error(tokenResult.error);
  }

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

/** Generate menu item description using AI. Deducts tokens; returns generated text for en/de. */
export async function generateMenuItemDescription(formData: FormData): Promise<{
  success: boolean;
  description_en?: string;
  description_de?: string;
  error?: string;
}> {
  const restaurantId = await getSessionRestaurantId();
  const categoryId = formData.get("categoryId") as string;
  const nameEn = (formData.get("name_en") as string) || "";
  const nameDe = (formData.get("name_de") as string) || "";

  const category = await prisma.menuCategory.findUnique({
    where: { id: categoryId },
    select: { name: true, restaurantId: true },
  });
  if (!category || category.restaurantId !== restaurantId) {
    return { success: false, error: "Unauthorized" };
  }

  const tokenResult = await checkAndDeductTokens(
    restaurantId,
    TOKEN_COSTS.ai_description,
    "ai_description",
    { categoryId }
  );
  if (!tokenResult.ok) {
    return { success: false, error: tokenResult.error };
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic();
    const categoryNameEn =
      typeof category.name === "object" && category.name && "en" in category.name
        ? (category.name as { en: string }).en
        : "";
    const categoryNameDe =
      typeof category.name === "object" && category.name && "de" in category.name
        ? (category.name as { de: string }).de
        : "";

    const prompt = `You are a restaurant menu copywriter. Generate a short, appetizing description for this menu item. Output exactly two lines: first line is the English description (max 15 words), second line is the German description (max 15 words). No labels, no numbering. Only the two lines.
Item name (EN): ${nameEn}
Item name (DE): ${nameDe}
Category: ${categoryNameEn} / ${categoryNameDe}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { text: string }).text)
        .join("") || "";
    const lines = text.trim().split("\n").map((s) => s.trim()).filter(Boolean);
    const description_en = lines[0] ?? "";
    const description_de = lines[1] ?? lines[0] ?? "";

    return {
      success: true,
      description_en,
      description_de,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Generation failed";
    return { success: false, error: message };
  }
}

/** Generate menu item image. Deducts tokens; returns image URL or error. Image generation API not configured by default. */
export async function generateMenuItemImage(formData: FormData): Promise<{
  success: boolean;
  imageUrl?: string;
  error?: string;
}> {
  const restaurantId = await getSessionRestaurantId();
  const categoryId = formData.get("categoryId") as string;
  const nameEn = (formData.get("name_en") as string) || "";
  const descriptionEn = (formData.get("description_en") as string) || "";

  const category = await prisma.menuCategory.findUnique({
    where: { id: categoryId },
    select: { restaurantId: true },
  });
  if (!category || category.restaurantId !== restaurantId) {
    return { success: false, error: "Unauthorized" };
  }

  const tokenResult = await checkAndDeductTokens(
    restaurantId,
    TOKEN_COSTS.ai_image,
    "ai_image",
    { categoryId }
  );
  if (!tokenResult.ok) {
    return { success: false, error: tokenResult.error };
  }

  // Image generation not implemented: would call DALL·E, Replicate, or similar.
  // Return a clear message so the UI can show it.
  return {
    success: false,
    error: "Image generation is not configured. Contact support to enable.",
  };
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

  const effectiveGuestName = (data.guestName !== undefined ? data.guestName.trim() : reservation.guestName) || "";
  const effectiveGuestPhone = (data.guestPhone !== undefined ? (data.guestPhone ?? "").trim() : (reservation.guestPhone ?? "").trim()) || "";
  const effectiveSeating = data.seatingPreference !== undefined ? data.seatingPreference?.trim() || null : reservation.seatingPreference?.trim() || null;
  if (effectiveGuestPhone) {
    const guest = await findOrCreateGuest({
      restaurantId,
      name: effectiveGuestName,
      phone: effectiveGuestPhone,
      email: null,
      seatingPreference: effectiveSeating,
    });
    (update as Record<string, unknown>).guestId = guest?.id ?? null;
  } else {
    (update as Record<string, unknown>).guestId = null;
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

export async function getGuests(search?: string, page = 1, pageSize = 50) {
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
  const [guests, totalCount] = await Promise.all([
    prisma.guest.findMany({
      where,
      orderBy: [{ lastVisitAt: "desc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
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
    }),
    prisma.guest.count({ where }),
  ]);
  return { guests, totalCount };
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

// ── Analytics ─────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function nextDay(d: Date): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + 1);
  return out;
}

async function periodMetrics(
  restaurantId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<{
  reservations: number;
  byStatus: { completed: number; noShow: number; cancelled: number; pending: number };
  bySource: { phone: number; ai: number; walkIn: number; web: number };
  covers: number;
  avgPartySize: number;
}> {
  const where = { restaurantId, date: { gte: dateFrom, lt: dateTo } };
  const [byStatusRows, bySourceRows, completedAgg] = await Promise.all([
    prisma.reservation.groupBy({
      by: ["status"],
      where,
      _count: { id: true },
    }),
    prisma.reservation.groupBy({
      by: ["source"],
      where,
      _count: { id: true },
    }),
    prisma.reservation.aggregate({
      where: { ...where, status: "COMPLETED" },
      _count: { id: true },
      _sum: { partySize: true },
    }),
  ]);
  const byStatus = {
    completed: byStatusRows.find((r) => r.status === "COMPLETED")?._count.id ?? 0,
    noShow: byStatusRows.find((r) => r.status === "NO_SHOW")?._count.id ?? 0,
    cancelled: byStatusRows.find((r) => r.status === "CANCELLED")?._count.id ?? 0,
    pending:
      (byStatusRows.find((r) => r.status === "PENDING")?._count.id ?? 0) +
      (byStatusRows.find((r) => r.status === "CONFIRMED")?._count.id ?? 0),
  };
  const bySource = {
    phone: bySourceRows.find((r) => r.source === "phone")?._count.id ?? 0,
    ai: bySourceRows.find((r) => r.source === "ai_assistant")?._count.id ?? 0,
    walkIn: bySourceRows.find((r) => r.source === "walk_in")?._count.id ?? 0,
    web: bySourceRows.find((r) => r.source === "web")?._count.id ?? 0,
  };
  const completedCount = completedAgg._count.id;
  const covers = completedAgg._sum.partySize ?? 0;
  const avgPartySize = completedCount > 0 ? covers / completedCount : 0;
  const reservations = byStatusRows.reduce((s, r) => s + r._count.id, 0);
  return {
    reservations,
    byStatus,
    bySource,
    covers,
    avgPartySize: Math.round(avgPartySize * 10) / 10,
  };
}

export async function getAnalyticsMetrics() {
  const restaurantId = await getSessionRestaurantId();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = nextDay(todayStart);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(todayStart);
  monthStart.setMonth(monthStart.getMonth() - 1);

  const [
    restaurant,
    todayMetrics,
    weekMetrics,
    monthMetrics,
    completedWithDuration,
    guestsAgg,
    waitlistTodayRows,
  ] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { settings: true },
    }),
    periodMetrics(restaurantId, todayStart, todayEnd),
    periodMetrics(restaurantId, weekStart, todayEnd),
    periodMetrics(restaurantId, monthStart, todayEnd),
    prisma.reservation.findMany({
      where: {
        restaurantId,
        status: "COMPLETED",
        seatedAt: { not: null },
        completedAt: { not: null },
      },
      select: { seatedAt: true, completedAt: true },
    }),
    prisma.guest.aggregate({
      where: { restaurantId },
      _count: { id: true },
      _sum: { totalVisits: true, noShowCount: true },
    }),
    prisma.waitlistEntry.findMany({
      where: {
        restaurantId,
        createdAt: { gte: todayStart },
      },
      select: { status: true, createdAt: true, notifiedAt: true },
    }),
  ]);

  const settings = (restaurant?.settings ?? null) as Record<string, unknown> | null;
  const averageDiningOverride = settings?.averageDiningDurationMinutes != null
    ? Number(settings.averageDiningDurationMinutes)
    : null;

  const diningDurations = completedWithDuration
    .filter((r) => r.seatedAt && r.completedAt)
    .map((r) => (new Date(r.completedAt!).getTime() - new Date(r.seatedAt!).getTime()) / 60000);
  const averageDiningFromHistory =
    diningDurations.length > 0
      ? Math.round(diningDurations.reduce((a, b) => a + b, 0) / diningDurations.length)
      : null;

  const totalGuests = guestsAgg._count.id;
  const totalVisits = guestsAgg._sum.totalVisits ?? 0;
  const totalNoShows = guestsAgg._sum.noShowCount ?? 0;
  const noShowRate = totalVisits > 0 ? Math.round((totalNoShows / totalVisits) * 100) : 0;

  const waitlistCount = waitlistTodayRows.length;
  const waitlistNotified = waitlistTodayRows.filter((e) => e.status === "NOTIFIED" || e.status === "SEATED").length;
  const waitTimes = waitlistTodayRows
    .filter((e) => e.notifiedAt)
    .map((e) => (new Date(e.notifiedAt!).getTime() - new Date(e.createdAt).getTime()) / 60000);
  const avgWaitMinutes = waitTimes.length ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length) : null;

  return {
    today: todayMetrics,
    week: weekMetrics,
    month: monthMetrics,
    averageDiningFromHistory,
    averageDiningOverride,
    diningDurationSampleSize: diningDurations.length,
    totalGuests,
    totalVisits,
    totalNoShows,
    noShowRate,
    waitlistToday: waitlistCount,
    waitlistNotified,
    avgWaitMinutes,
  };
}

export async function updateAverageDiningOverride(minutes: number | null) {
  const restaurantId = await getSessionRestaurantId();
  const current = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { settings: true },
  });
  const settings = (current?.settings ?? null) as Record<string, unknown> | null;
  const next = { ...(settings ?? {}), averageDiningDurationMinutes: minutes };
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { settings: next },
  });
  revalidatePath("/");
  return { success: true };
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
  const estimatedWaitMin =
    data.estimatedWaitMin != null
      ? data.estimatedWaitMin
      : await estimateWaitMinutes(restaurantId, data.partySize);
  await prisma.waitlistEntry.create({
    data: {
      restaurantId,
      guestName: data.guestName.trim(),
      guestPhone: data.guestPhone?.trim() || null,
      partySize: data.partySize,
      notes: data.notes?.trim() || null,
      estimatedWaitMin: estimatedWaitMin ?? null,
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
