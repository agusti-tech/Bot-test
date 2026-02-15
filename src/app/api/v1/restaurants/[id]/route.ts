import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  validateApiKey,
  unauthorizedResponse,
  jsonResponse,
  errorResponse,
} from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateApiKey(request)) return unauthorizedResponse();
  const { id } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      categories: {
        orderBy: { sortOrder: "asc" },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!restaurant) return errorResponse("Restaurant not found", 404);
  return jsonResponse(restaurant);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateApiKey(request)) return unauthorizedResponse();
  const { id } = await params;

  try {
    const body = await request.json();

    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: {
        ...(body.slug && { slug: body.slug }),
        ...(body.name && { name: body.name }),
        ...(body.description && { description: body.description }),
        ...(body.address && { address: body.address }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.openingHours && { openingHours: body.openingHours }),
        ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    return jsonResponse(restaurant);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to update restaurant";
    return errorResponse(message);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateApiKey(request)) return unauthorizedResponse();
  const { id } = await params;

  try {
    await prisma.restaurant.delete({ where: { id } });
    return jsonResponse({ deleted: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to delete restaurant";
    return errorResponse(message);
  }
}
