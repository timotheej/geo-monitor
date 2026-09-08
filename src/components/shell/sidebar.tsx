"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquareText,
  PlayCircle,
  ScanSearch,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/actions";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/prompts", label: "Prompts", icon: MessageSquareText },
  { href: "/runs", label: "Runs", icon: PlayCircle },
  { href: "/inspect", label: "Inspecter", icon: ScanSearch },
  { href: "/settings", label: "Paramètres", icon: Settings2 },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r bg-sidebar md:block">
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <span className="grid size-6 place-items-center rounded-md bg-signal text-signal-foreground">
            <span className="block size-2 rounded-full bg-current" />
          </span>
          <span className="text-sm font-medium">GEO Monitor</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2 pt-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", active ? "text-signal" : "")} />
                {label}
              </Link>
            );
          })}
        </nav>
        <form action={logout} className="px-2 pb-3">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
          >
            Se déconnecter
          </Button>
        </form>
      </div>
    </aside>
  );
}
