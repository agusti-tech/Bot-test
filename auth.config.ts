import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  callbacks: {
    // Only populate the auth object — all redirect logic lives in middleware.ts
    authorized() {
      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
