import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type TranslatableField = { en: string; de: string } | null;

export function getLocalizedValue(
  field: TranslatableField | unknown,
  locale: string
): string {
  if (!field || typeof field !== "object") return "";
  const obj = field as Record<string, string>;
  return obj[locale] || obj.en || "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatPrice(price: any): string {
  const num = typeof price === "string" ? parseFloat(price) : Number(price);
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(num);
}
