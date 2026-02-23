"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authenticate } from "./actions";

export default function LoginPage() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [errorMessage, formAction, isPending] = useActionState(
    authenticate.bind(null, locale),
    undefined
  );

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <UtensilsCrossed className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl">{t("login")}</CardTitle>
          <CardDescription>{t("welcomeBack")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="admin@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
              />
            </div>
            {errorMessage && (
              <p className="text-sm text-destructive">
                {t("invalidCredentials")}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "..." : t("signIn")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
