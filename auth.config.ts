import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/admin/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathParts = nextUrl.pathname.split("/");
      const isAdminRoute = pathParts.length >= 3 && pathParts[2] === "admin";
      const isLoginPage =
        pathParts.length >= 4 &&
        pathParts[2] === "admin" &&
        pathParts[3] === "login";

      if (isAdminRoute && !isLoginPage) {
        return isLoggedIn;
      }

      if (isLoginPage && isLoggedIn) {
        return Response.redirect(new URL(`/${pathParts[1]}/admin`, nextUrl));
      }

      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
