"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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

export async function updateRestaurant(formData: FormData) {
  const restaurantId = await getSessionRestaurantId();

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
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
      openingHours: JSON.parse(formData.get("openingHours") as string),
    },
  });

  revalidatePath("/");
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

  // Verify the reservation belongs to this restaurant
  const reservation = await prisma.reservation.findFirst({
    where: { id, restaurantId },
  });
  if (!reservation) throw new Error("Reservation not found");

  await prisma.reservation.update({
    where: { id },
    data: { status: status as "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW" },
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
