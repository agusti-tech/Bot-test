import createIntlMiddleware from "next-intl/middleware";
import { auth } from "./auth";
import { routing } from "./i18n/routing";
import { NextResponse } from "next/server";

const intlMiddleware = createIntlMiddleware(routing);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Skip API routes
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Extract locale from path
  const pathParts = pathname.split("/");
  const locale = pathParts[1];
  const isValidLocale = routing.locales.includes(locale as "en" | "de");

  // Protect admin routes (except login)
  if (isValidLocale && pathParts[2] === "admin" && pathParts[3] !== "login") {
    if (!req.auth) {
      const loginUrl = new URL(`/${locale}/admin/login`, req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect logged-in users away from login page
  if (
    isValidLocale &&
    pathParts[2] === "admin" &&
    pathParts[3] === "login" &&
    req.auth
  ) {
    const dashboardUrl = new URL(`/${locale}/admin`, req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
