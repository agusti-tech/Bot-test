import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  validateApiKey,
  unauthorizedResponse,
  jsonResponse,
  errorResponse,
} from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  const restaurantId = request.nextUrl.searchParams.get("restaurantId");
  const categoryId = request.nextUrl.searchParams.get("categoryId");
  const available = request.nextUrl.searchParams.get("available");

  const where: Record<string, unknown> = {};
  if (categoryId) where.categoryId = categoryId;
  if (restaurantId) where.category = { restaurantId };
  if (available === "true") where.isAvailable = true;
  if (available === "false") where.isAvailable = false;

  const items = await prisma.menuItem.findMany({
    where,
    orderBy: { sortOrder: "asc" },
    include: { category: { select: { name: true, restaurantId: true } } },
  });

  return jsonResponse(items, items.length);
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    const body = await request.json();

    const item = await prisma.menuItem.create({
      data: {
        name: body.name,
        description: body.description || null,
        price: body.price,
        imageUrl: body.imageUrl || null,
        dietaryTags: body.dietaryTags || [],
        isAvailable: body.isAvailable ?? true,
        sortOrder: body.sortOrder ?? 0,
        categoryId: body.categoryId,
      },
    });

    return jsonResponse(item);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create menu item";
    return errorResponse(message);
  }
}
