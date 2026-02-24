/**
 * Notification abstraction: app-only for now, ready for n8n/webhook or other channels later.
 * When you add a channel (e.g. n8n → WhatsApp), set the env var and implement the workflow.
 */

export type WaitlistNotifyPayload = {
  event: "waitlist.table_ready";
  entryId: string;
  restaurantId: string;
  guestName: string;
  guestPhone: string | null;
  partySize: number;
  estimatedWaitMin: number | null;
  /** ISO string */
  createdAt: string;
};

/**
 * Called when host marks a waitlist guest as "notified" (table ready).
 * App-only: no-op when N8N_WAITLIST_NOTIFY_WEBHOOK is unset.
 * Later: set env var and n8n workflow receives this payload (e.g. send WhatsApp).
 */
export async function sendWaitlistTableReady(
  payload: WaitlistNotifyPayload
): Promise<void> {
  const webhookUrl = process.env.N8N_WAITLIST_NOTIFY_WEBHOOK;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error("[notifications] waitlist table_ready webhook failed:", e);
    }
    return;
  }
  // App-only: no external channel configured
}
