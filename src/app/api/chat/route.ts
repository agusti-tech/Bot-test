import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processMessage } from "@/lib/ai/agent";
import { isRateLimited } from "@/lib/rate-limit";

const chatRequestSchema = z.object({
  restaurantId: z.string().min(1),
  sessionId: z.string().min(1),
  message: z.string().min(1).max(2000),
  locale: z.enum(["en", "de"]),
});

export async function POST(request: NextRequest) {
  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment.", success: false },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten(), success: false },
        { status: 400 }
      );
    }

    const { restaurantId, sessionId, message, locale } = parsed.data;

    const result = await processMessage({
      restaurantId,
      sessionId,
      message,
      locale,
      source: "chat_widget",
    });

    return NextResponse.json({ data: result, success: true });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    );
  }
}
