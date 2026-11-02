import type { Metadata } from "next";
import { fontClasses } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = { title: "Sunpath for staff", robots: { index: false } };

export default function StaffRootLayout({ children }: LayoutProps<"/staff">) {
  return (
    <html lang="en" className={fontClasses}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
