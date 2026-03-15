"use server";

import { signIn } from "../../../../../auth";
import { AuthError } from "next-auth";

export async function authenticate(
  locale: string,
  _prevState: string | undefined,
  formData: FormData
) {
  try {
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "").trim();
    if (!email || !password) {
      return "CredentialsSignin";
    }
    await signIn("credentials", {
      email,
      password,
      redirectTo: `/${locale}/admin`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "CredentialsSignin";
    }
    throw error;
  }
}
