"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Props {
  isAdmin: boolean;
}

export function StaffNav({ isAdmin }: Props) {
  const pathname = usePathname();
  const links = [
    { href: "/staff/leads", label: "Leads" },
    { href: "/staff/projects", label: "Projects" },
    { href: "/staff/messages", label: "Messages" },
    ...(isAdmin ? [{ href: "/staff/admin", label: "Rules" }] : []),
  ];
  return (
    <nav aria-label="Main" className="flex items-center gap-5 text-sm">
      {links.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn("py-1 underline-offset-8 hover:text-foreground", active ? "font-medium text-foreground underline decoration-primary decoration-2" : "text-muted-foreground")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
