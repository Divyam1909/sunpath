import NextAuth from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { routing } from "@/i18n/routing";

const { auth } = NextAuth(authConfig);
const intl = createIntlMiddleware(routing);

// Role gate for pages. Every server action and route handler repeats these checks via server/guards.ts.
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const role = req.auth?.user?.role;
  const toLogin = () => {
    const url = new URL("/en/login", req.nextUrl);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  };

  if (pathname.startsWith("/staff")) {
    if (!role) return toLogin();
    if (role === "HOMEOWNER") return NextResponse.redirect(new URL("/en/my", req.nextUrl));
    if (pathname.startsWith("/staff/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/staff/leads", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (/^\/(en|mr|hi)\/my(\/|$)/.test(pathname) && !role) return toLogin();

  return intl(req);
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|samples|.*\\..*).*)"],
};
