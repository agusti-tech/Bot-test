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

  const categories = await prisma.menuCategory.findMany({
    where: restaurantId ? { restaurantId } : {},
    orderBy: { sortOrder: "asc" },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return jsonResponse(categories, categories.length);
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    const body = await request.json();

    const category = await prisma.menuCategory.create({
      data: {
        name: body.name,
        sortOrder: body.sortOrder ?? 0,
        restaurantId: body.restaurantId,
      },
    });

    return jsonResponse(category);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create category";
    return errorResponse(message);
  }
}
