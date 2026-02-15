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

  const item = await prisma.menuItem.findUnique({
    where: { id },
    include: { category: { select: { name: true, restaurantId: true } } },
  });

  if (!item) return errorResponse("Menu item not found", 404);
  return jsonResponse(item);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateApiKey(request)) return unauthorizedResponse();
  const { id } = await params;

  try {
    const body = await request.json();

    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && {
          description: body.description,
        }),
        ...(body.price !== undefined && { price: body.price }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
        ...(body.dietaryTags && { dietaryTags: body.dietaryTags }),
        ...(body.isAvailable !== undefined && {
          isAvailable: body.isAvailable,
        }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        ...(body.categoryId && { categoryId: body.categoryId }),
      },
    });

    return jsonResponse(item);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to update menu item";
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
    await prisma.menuItem.delete({ where: { id } });
    return jsonResponse({ deleted: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to delete menu item";
    return errorResponse(message);
  }
}
