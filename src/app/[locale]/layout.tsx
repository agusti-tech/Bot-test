import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/../i18n/routing";
import { Toaster } from "@/components/ui/sonner";
import ConditionalAppShell from "@/components/layout/ConditionalAppShell";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "en" | "de")) {
    notFound();
  }

  let messages;
  try {
    messages = (await import(`@/../messages/${locale}.json`)).default;
  } catch {
    notFound();
  }

  return (
    <html lang={locale}>
      <body className="font-sans antialiased min-h-screen flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ConditionalAppShell>{children}</ConditionalAppShell>
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
