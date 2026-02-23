"use server";

import { signIn } from "../../../../../auth";
import { AuthError } from "next-auth";

export async function authenticate(
  locale: string,
  _prevState: string | undefined,
  formData: FormData
) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: `/${locale}/admin`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "CredentialsSignin";
    }
    throw error;
  }
}
