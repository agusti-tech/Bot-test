import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      AUTH_SECRET_SET: !!process.env.AUTH_SECRET,
      AUTH_URL: process.env.AUTH_URL || "(not set - using auto-detect)",
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST || "(not set)",
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      NODE_ENV: process.env.NODE_ENV,
    },
    headers: {
      host: request.headers.get("host"),
      "x-forwarded-host": request.headers.get("x-forwarded-host"),
      "x-forwarded-proto": request.headers.get("x-forwarded-proto"),
      "x-forwarded-for": request.headers.get("x-forwarded-for"),
    },
  };

  try {
    const userCount = await prisma.user.count();
    const users = await prisma.user.findMany({
      select: { email: true, role: true, name: true },
    });
    checks.database = {
      connected: true,
      userCount,
      users: users.map((u) => ({ email: u.email, role: u.role, name: u.name })),
    };
  } catch (e) {
    checks.database = {
      connected: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  try {
    const tableCount = await prisma.restaurant.count();
    checks.restaurants = { count: tableCount };
  } catch (e) {
    checks.restaurants = {
      error: e instanceof Error ? e.message : String(e),
    };
  }

  return NextResponse.json(checks, { status: 200 });
}
