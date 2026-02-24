import { prisma } from "@/lib/prisma";

/**
 * Find a guest by restaurant + phone, or create one. Returns null if phone is empty.
 */
export async function findOrCreateGuest(params: {
  restaurantId: string;
  name: string;
  phone: string | null;
  email?: string | null;
  seatingPreference?: string | null;
}): Promise<{ id: string } | null> {
  const phone = (params.phone ?? "").trim();
  if (!phone) return null;

  const existing = await prisma.guest.findUnique({
    where: {
      restaurantId_phone: { restaurantId: params.restaurantId, phone },
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id };

  const guest = await prisma.guest.create({
    data: {
      restaurantId: params.restaurantId,
      name: params.name.trim(),
      phone,
      email: (params.email ?? "").trim() || null,
      seatingPreference: (params.seatingPreference ?? "").trim() || null,
    },
    select: { id: true },
  });
  return { id: guest.id };
}

/**
 * Increment totalVisits and set lastVisitAt when a reservation is completed.
 */
export async function incrementGuestTotalVisits(guestId: string): Promise<void> {
  await prisma.guest.update({
    where: { id: guestId },
    data: {
      totalVisits: { increment: 1 },
      lastVisitAt: new Date(),
    },
  });
}

/**
 * Increment noShowCount when a reservation is marked NO_SHOW.
 */
export async function incrementGuestNoShowCount(guestId: string): Promise<void> {
  await prisma.guest.update({
    where: { id: guestId },
    data: { noShowCount: { increment: 1 } },
  });
}

/**
 * Look up guest by restaurant and phone for AI/context. Returns null if not found or no phone.
 */
export async function findGuestByPhone(
  restaurantId: string,
  phone: string
): Promise<{
  id: string;
  name: string;
  totalVisits: number;
  noShowCount: number;
  seatingPreference: string | null;
  dietaryRestrictions: string[];
  tags: string[];
  lastVisitAt: Date | null;
} | null> {
  const p = (phone ?? "").trim();
  if (!p) return null;
  const guest = await prisma.guest.findUnique({
    where: { restaurantId_phone: { restaurantId, phone: p } },
    select: {
      id: true,
      name: true,
      totalVisits: true,
      noShowCount: true,
      seatingPreference: true,
      dietaryRestrictions: true,
      tags: true,
      lastVisitAt: true,
    },
  });
  return guest;
}
