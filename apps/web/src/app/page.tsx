"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      router.replace(session ? "/dashboard" : "/login");
    }
  }, [session, loading, router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <Loader2
        className="w-8 h-8 text-liquid-accent animate-spin"
        aria-label="Loading"
      />
    </main>
  );
}
