"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Calendar, BarChart3, Settings, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth";
import type { AuthSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface AppNavProps {
  currentPath: string;
  session: AuthSession;
}

const navItems = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/season", label: "Season", icon: Calendar },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppNav({ currentPath, session }: AppNavProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 px-4 pt-4">
        <nav
          className="liquid-glass max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4"
          aria-label="Main navigation"
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl bg-gradient-to-br from-liquid-accent to-sky-400 shadow-lg shadow-liquid-accent/30"
              aria-hidden="true"
            />
            <span className="font-semibold text-liquid-text hidden sm:inline tracking-tight">
              Momentum
            </span>
          </div>

          <div
            className="flex items-center gap-1"
            role="navigation"
            aria-label="Primary"
          >
            {navItems.map((item) => {
              const active = currentPath.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "focus-ring rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 flex items-center gap-2",
                    active
                      ? "bg-liquid-accent-soft text-liquid-accent"
                      : "text-liquid-text-muted hover:text-liquid-text hover:bg-white/[0.06]"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-liquid-text-muted hidden md:inline">
              {session.user.username}
            </span>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="focus-ring rounded-xl p-2 text-liquid-text-muted hover:text-liquid-text hover:bg-white/[0.06] transition-all duration-200"
              aria-label="Sign out"
            >
              {signingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </nav>
      </header>

      <nav
        className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-4 md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="liquid-glass-strong rounded-2xl px-2 py-2 flex items-center justify-around">
          {navItems.map((item) => {
            const active = currentPath.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "focus-ring rounded-xl flex flex-col items-center gap-1 px-3 py-2 min-w-[44px] min-h-[44px] justify-center text-xs font-medium transition-all duration-200",
                  active
                    ? "text-liquid-accent bg-liquid-accent-soft"
                    : "text-liquid-text-muted"
                )}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
