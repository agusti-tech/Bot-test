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

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { restaurant: { select: { name: true, slug: true } } },
  });

  if (!reservation) return errorResponse("Reservation not found", 404);
  return jsonResponse(reservation);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateApiKey(request)) return unauthorizedResponse();
  const { id } = await params;

  try {
    const body = await request.json();

    const reservation = await prisma.reservation.update({
      where: { id },
      data: {
        ...(body.date && { date: new Date(body.date) }),
        ...(body.time && { time: body.time }),
        ...(body.partySize !== undefined && { partySize: body.partySize }),
        ...(body.guestName && { guestName: body.guestName }),
        ...(body.guestEmail !== undefined && {
          guestEmail: body.guestEmail,
        }),
        ...(body.guestPhone && { guestPhone: body.guestPhone }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.status && { status: body.status }),
      },
    });

    return jsonResponse(reservation);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update reservation";
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
    await prisma.reservation.delete({ where: { id } });
    return jsonResponse({ deleted: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete reservation";
    return errorResponse(message);
  }
}
