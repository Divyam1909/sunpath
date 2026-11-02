import { auth } from "@/auth";
import type { AppRole } from "@/auth.config";

export class AuthError extends Error {
  constructor(public status: 401 | 403) {
    super(status === 401 ? "Sign in required" : "Not allowed");
  }
}

export async function requireRole(...roles: AppRole[]) {
  const session = await auth();
  if (!session?.user) throw new AuthError(401);
  if (!roles.includes(session.user.role)) throw new AuthError(403);
  return session.user;
}

export const requireStaff = () => requireRole("SALES", "ADMIN");
export const requireAdmin = () => requireRole("ADMIN");
export const requireHomeowner = () => requireRole("HOMEOWNER");
