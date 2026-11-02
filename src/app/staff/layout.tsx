import type { Metadata } from "next";
import { logoutAction } from "@/app/[locale]/actions";
import { auth } from "@/auth";
import { StaffNav } from "@/components/staff/nav";
import { fontClasses } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = { title: "Sunpath for staff", robots: { index: false } };

export default async function StaffRootLayout({ children }: LayoutProps<"/staff">) {
  const session = await auth();
  return (
    <html lang="en" className={fontClasses}>
      <body className="min-h-dvh">
        <header className="border-b">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-5 py-3 sm:px-6">
            <span className="font-medium tracking-tight">Sunpath</span>
            <div className="order-3 w-full sm:order-2 sm:w-auto sm:flex-1">
              <StaffNav isAdmin={session?.user.role === "ADMIN"} />
            </div>
            <form action={logoutAction} className="order-2 flex items-center gap-3 text-sm sm:order-3">
              <span className="text-muted-foreground">{session?.user.name}</span>
              <button className="underline-offset-4 hover:underline">Sign out</button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
