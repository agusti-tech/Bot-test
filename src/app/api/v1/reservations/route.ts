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
  const date = request.nextUrl.searchParams.get("date");
  const status = request.nextUrl.searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (restaurantId) where.restaurantId = restaurantId;
  if (date) where.date = new Date(date);
  if (status) where.status = status;

  const reservations = await prisma.reservation.findMany({
    where,
    orderBy: [{ date: "asc" }, { time: "asc" }],
    include: { restaurant: { select: { name: true, slug: true } } },
  });

  return jsonResponse(reservations, reservations.length);
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    const body = await request.json();

    const reservation = await prisma.reservation.create({
      data: {
        restaurantId: body.restaurantId,
        date: new Date(body.date),
        time: body.time,
        partySize: body.partySize,
        guestName: body.guestName,
        guestEmail: body.guestEmail || null,
        guestPhone: body.guestPhone,
        notes: body.notes || null,
        source: body.source || "web",
      },
    });

    return jsonResponse(reservation);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create reservation";
    return errorResponse(message);
  }
}
