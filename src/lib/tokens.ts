import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/** Token costs per action (configurable). */
export const TOKEN_COSTS = {
  website_update: 1,
  menu_item_create: 1,
  menu_item_update: 1,
  tier_switch: 5,
  ai_description: 3,
  ai_image: 8,
} as const;

export type TokenActionType =
  | "monthly_grant"
  | "website_update"
  | "menu_item_create"
  | "menu_item_update"
  | "tier_switch"
  | "ai_description"
  | "ai_image";

export interface TokenResult {
  ok: boolean;
  balanceAfter?: number;
  error?: string;
}

/** Ensure a token account exists for the restaurant; create with initial allowance if not. */
export async function ensureTokenAccount(restaurantId: string) {
  let account = await prisma.restaurantTokenAccount.findUnique({
    where: { restaurantId },
  });
  if (!account) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    account = await prisma.restaurantTokenAccount.create({
      data: {
        restaurantId,
        balance: 100,
        allowanceMonthly: 100,
        periodStartsAt: periodStart,
      },
    });
    await prisma.tokenUsageLog.create({
      data: {
        restaurantId,
        quantity: 100,
        actionType: "monthly_grant",
        metadata: { initial: true } as Prisma.InputJsonValue,
      },
    });
  }
  return account;
}

/** If the current period has passed (>= 1 month since periodStartsAt), grant allowance and advance period. */
async function grantPeriodIfNeeded(
  account: { id: string; restaurantId: string; balance: number; allowanceMonthly: number; periodStartsAt: Date }
) {
  const now = Date.now();
  const periodEnd = account.periodStartsAt.getTime() + ONE_MONTH_MS;
  if (now < periodEnd) return account;

  const nextPeriodStart = new Date(periodEnd);
  const updated = await prisma.restaurantTokenAccount.update({
    where: { id: account.id },
    data: {
      balance: { increment: account.allowanceMonthly },
      periodStartsAt: nextPeriodStart,
    },
  });
  await prisma.tokenUsageLog.create({
    data: {
      restaurantId: account.restaurantId,
      quantity: account.allowanceMonthly,
      actionType: "monthly_grant",
      metadata: { periodStart: nextPeriodStart.toISOString() } as Prisma.InputJsonValue,
    },
  });
  return updated;
}

/**
 * Check balance, optionally grant new period, deduct tokens, and log.
 * Returns { ok: true, balanceAfter } on success, or { ok: false, error } when insufficient.
 */
export async function checkAndDeductTokens(
  restaurantId: string,
  amount: number,
  actionType: TokenActionType,
  metadata?: Record<string, unknown>
): Promise<TokenResult> {
  if (amount <= 0) {
    return { ok: true, balanceAfter: undefined };
  }

  const account = await ensureTokenAccount(restaurantId);
  const afterGrant = await grantPeriodIfNeeded(account);

  if (afterGrant.balance < amount) {
    return {
      ok: false,
      error: "Insufficient tokens. Contact support to purchase more.",
    };
  }

  const updated = await prisma.restaurantTokenAccount.update({
    where: { id: afterGrant.id },
    data: { balance: { decrement: amount } },
  });
  await prisma.tokenUsageLog.create({
    data: {
      restaurantId,
      quantity: -amount,
      actionType,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  return { ok: true, balanceAfter: updated.balance };
}

/** Get current balance and allowance for display (creates account if missing). */
export async function getTokenBalance(restaurantId: string): Promise<{
  balance: number;
  allowanceMonthly: number;
  periodStartsAt: Date;
}> {
  const account = await ensureTokenAccount(restaurantId);
  const afterGrant = await grantPeriodIfNeeded(account);
  return {
    balance: afterGrant.balance,
    allowanceMonthly: afterGrant.allowanceMonthly,
    periodStartsAt: afterGrant.periodStartsAt,
  };
}
