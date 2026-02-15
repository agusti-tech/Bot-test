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

  const category = await prisma.menuCategory.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!category) return errorResponse("Category not found", 404);
  return jsonResponse(category);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateApiKey(request)) return unauthorizedResponse();
  const { id } = await params;

  try {
    const body = await request.json();

    const category = await prisma.menuCategory.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      },
    });

    return jsonResponse(category);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to update category";
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
    await prisma.menuCategory.delete({ where: { id } });
    return jsonResponse({ deleted: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to delete category";
    return errorResponse(message);
  }
}
