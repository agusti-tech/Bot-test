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

  const locale = request.nextUrl.searchParams.get("locale");

  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  return jsonResponse(restaurants, restaurants.length);
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    const body = await request.json();

    const restaurant = await prisma.restaurant.create({
      data: {
        slug: body.slug,
        name: body.name,
        description: body.description,
        address: body.address,
        phone: body.phone || null,
        email: body.email || null,
        openingHours: body.openingHours || {},
        logoUrl: body.logoUrl || null,
        imageUrl: body.imageUrl || null,
        isActive: body.isActive ?? true,
      },
    });

    return jsonResponse(restaurant);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create restaurant";
    return errorResponse(message);
  }
}
