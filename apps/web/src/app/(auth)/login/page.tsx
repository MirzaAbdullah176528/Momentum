"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await authClient.signIn.email({
        email,
        password
      });
      if (result.error) {
        setError(result.error.message ?? "Invalid email or password.");
      } else {
        // Refresh the shared session state BEFORE navigating so the (app)
        // layout's auth guard sees an active session instead of the stale
        // null it had at initial page load (AuthProvider doesn't remount on
        // client-side navigation, so without this the dashboard bounces back
        // to /login within a second).
        await refresh();
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm liquid-glass-strong p-8 space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold text-liquid-text">Welcome back</h1>
          <p className="text-sm text-liquid-text-muted">
            Sign in to your Momentum account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            autoFocus
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
            required
            autoComplete="current-password"
          />

          {error && (
            <p
              role="alert"
              className="text-sm text-liquid-danger bg-liquid-danger/10 border border-liquid-danger/20 rounded-lg px-3 py-2"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-liquid-text-muted">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-liquid-accent hover:underline focus-ring rounded"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
