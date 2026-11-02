import type { NextAuthConfig } from "next-auth";

export type AppRole = "HOMEOWNER" | "SALES" | "ADMIN";

declare module "next-auth" {
  interface User {
    role?: AppRole;
  }
  interface Session {
    user: { id: string; name: string; role: AppRole };
  }
}

// Prisma-free config, shared with the proxy.
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/en/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role as AppRole;
      return session;
    },
  },
} satisfies NextAuthConfig;
