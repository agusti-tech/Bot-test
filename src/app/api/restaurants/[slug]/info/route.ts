import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug, isActive: true },
    select: { id: true, slug: true, name: true },
  });

  if (!restaurant) {
    return NextResponse.json(
      { error: "Restaurant not found", success: false },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
    },
    success: true,
  });
}
