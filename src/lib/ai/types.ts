import Anthropic from "@anthropic-ai/sdk";

export type Locale = "en" | "de";
export type ChatSource = "chat_widget" | "voice";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RestaurantContext {
  id: string;
  slug: string;
  name: { en: string; de: string };
  description: { en: string; de: string };
  address: string;
  phone: string | null;
  email: string | null;
  openingHours: Record<string, { open: string; close: string } | null>;
}

export interface ProcessMessageParams {
  restaurantId: string;
  sessionId: string;
  message: string;
  locale: Locale;
  source: ChatSource;
}

export interface ReservationInfo {
  id: string;
  date: string;
  time: string;
  partySize: number;
  guestName: string;
  status: string;
}

export interface AgentResponse {
  reply: string;
  reservation?: ReservationInfo;
}

export type ToolHandler = (
  input: Record<string, unknown>,
  context: { restaurantId: string; locale: Locale }
) => Promise<unknown>;

export type AnthropicTool = Anthropic.Messages.Tool;
