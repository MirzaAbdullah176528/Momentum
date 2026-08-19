"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AppNav } from "@/components/app/nav";
import { Loader2 } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [session, loading, router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2
          className="w-8 h-8 text-liquid-accent animate-spin"
          aria-label="Loading"
        />
      </main>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-liquid-accent focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>
      <AppNav currentPath={pathname} session={session} />
      <main id="main-content" className="relative z-10 pb-[max(7rem,calc(env(safe-area-inset-bottom)+5.5rem))] md:pb-8">
        {children}
      </main>
    </div>
  );
}
