import { NextRequest, NextResponse } from "next/server";

export function validateApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  return token === process.env.API_KEY;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
}

export function jsonResponse(data: unknown, count?: number) {
  return NextResponse.json({
    data,
    success: true,
    ...(count !== undefined && { count }),
  });
}

export function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ error: message, success: false }, { status });
}
