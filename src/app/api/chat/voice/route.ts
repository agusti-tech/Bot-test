import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiKey, unauthorizedResponse } from "@/lib/api-auth";
import { processMessage } from "@/lib/ai/agent";

const voiceRequestSchema = z.object({
  restaurantId: z.string().min(1),
  sessionId: z.string().min(1),
  transcript: z.string().min(1).max(2000),
  locale: z.enum(["en", "de"]),
});

export async function POST(request: NextRequest) {
  // Voice endpoint is called by n8n — requires API key
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    const body = await request.json();
    const parsed = voiceRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten(), success: false },
        { status: 400 }
      );
    }

    const { restaurantId, sessionId, transcript, locale } = parsed.data;

    const result = await processMessage({
      restaurantId,
      sessionId,
      message: transcript,
      locale,
      source: "voice",
    });

    // Voice responses include an endConversation hint
    const endPhrases = [
      "goodbye",
      "auf wiedersehen",
      "tschüss",
      "bye",
      "have a good",
      "einen schönen",
    ];
    const endConversation = endPhrases.some((phrase) =>
      result.reply.toLowerCase().includes(phrase)
    );

    return NextResponse.json({
      data: {
        reply: result.reply,
        reservation: result.reservation,
        endConversation,
      },
      success: true,
    });
  } catch (error: unknown) {
    console.error("Voice chat API error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    );
  }
}
