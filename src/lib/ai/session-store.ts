import { ConversationMessage } from "./types";

interface Session {
  messages: ConversationMessage[];
  lastAccess: number;
}

const SESSION_TTL_MS = (parseInt(process.env.AI_SESSION_TTL_MINUTES || "30", 10)) * 60 * 1000;

const sessions = new Map<string, Session>();

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, session] of sessions) {
      if (now - session.lastAccess > SESSION_TTL_MS) {
        sessions.delete(key);
      }
    }
    if (sessions.size === 0 && cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  }, 60_000);
}

export function getSession(sessionId: string): ConversationMessage[] {
  const session = sessions.get(sessionId);
  if (!session) return [];
  session.lastAccess = Date.now();
  return session.messages;
}

export function appendMessages(
  sessionId: string,
  userMessage: string,
  assistantMessage: string
) {
  let session = sessions.get(sessionId);
  if (!session) {
    session = { messages: [], lastAccess: Date.now() };
    sessions.set(sessionId, session);
    ensureCleanup();
  }
  session.messages.push(
    { role: "user", content: userMessage },
    { role: "assistant", content: assistantMessage }
  );
  session.lastAccess = Date.now();

  // Keep last 40 messages (20 turns) to avoid token overflow
  if (session.messages.length > 40) {
    session.messages = session.messages.slice(-40);
  }
}
