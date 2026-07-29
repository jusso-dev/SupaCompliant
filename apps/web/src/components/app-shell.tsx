"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Boxes,
  ChevronDown,
  FileSearch,
  FolderKanban,
  Layers,
  LayoutDashboard,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { demoOrg, demoProject } from "@/lib/demo-data";

const NAV = [
  { href: "/app", label: "Overview", icon: LayoutDashboard },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  { href: "/app/assessments", label: "Assessments", icon: ShieldCheck },
  { href: "/app/findings", label: "Findings", icon: FileSearch },
  { href: "/app/controls", label: "Controls", icon: Boxes },
  { href: "/app/frameworks", label: "Frameworks", icon: Layers },
  { href: "/app/evidence", label: "Evidence", icon: FileSearch },
  { href: "/app/activity", label: "Activity", icon: Activity },
  { href: "/app/team", label: "Team", icon: Users },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
            SC
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">SupaCompliant</div>
            <div className="truncate text-[11px] text-muted-foreground">
              Database assurance
            </div>
          </div>
        </div>

        <div className="space-y-2 border-b border-border p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-xs hover:bg-accent"
          >
            <span className="truncate font-medium">{demoOrg.name}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-xs hover:bg-accent"
          >
            <span className="truncate">{demoProject.name}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 p-2" aria-label="Primary">
          {NAV.map((item) => {
            const active =
              item.href === "/app"
                ? pathname === "/app"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3 text-[11px] leading-snug text-muted-foreground">
          <strong className="font-medium text-foreground">Not affiliated with Supabase.</strong>{" "}
          Independent open-source project — not an official Supabase product.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur">
          <div className="hidden text-sm text-muted-foreground lg:block">
            <span className="text-foreground">{demoOrg.name}</span>
            <span className="mx-1.5">/</span>
            <span>{demoProject.name}</span>
          </div>
          <div className="relative ml-auto w-full max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Global search"
              placeholder="Search controls, findings, reports…"
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none ring-ring focus:ring-2"
            />
          </div>
          <div className="hidden items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            Latest: completed
          </div>
          <button
            type="button"
            className="relative rounded-md p-2 text-muted-foreground hover:bg-accent"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
          </button>
          <Link
            href="/login"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold"
            aria-label="Account"
            title="Account / sign in"
          >
            AC
          </Link>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
