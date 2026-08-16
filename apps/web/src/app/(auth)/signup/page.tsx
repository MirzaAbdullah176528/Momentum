"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await authClient.signUp.email({
        name,
        username,
        email,
        password
      });
      if (result.error) {
        setError(result.error.message ?? "Could not create account.");
      } else {
        // Hard-navigate (full page load) instead of client-side router.push.
        // The shared <AuthProvider> fetches the session once on mount; a
        // client-side navigation does not remount it, and better-auth's client
        // getSession() returns a stale null right after signUp (it cached the
        // pre-login null), so router.push("/dashboard") bounces back to /login.
        // A full reload remounts AuthProvider, which re-fetches the now-valid
        // session — the same as manually entering the dashboard URL, which
        // works.
        window.location.assign("/dashboard");
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
          <h1 className="text-2xl font-bold text-liquid-text">Create account</h1>
          <p className="text-sm text-liquid-text-muted">
            Start tracking your daily momentum
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            autoComplete="name"
            autoFocus
          />
          <Input
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="3–30 chars, letters/numbers/_-"
            required
            autoComplete="username"
            hint="Used for the leaderboard — visible to other users."
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 10 chars, with upper/lower/digit/symbol"
            required
            autoComplete="new-password"
            hint="At least 10 characters with uppercase, lowercase, a digit, and a symbol."
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
                Creating account…
              </>
            ) : (
              "Sign up"
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-liquid-text-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-liquid-accent hover:underline focus-ring rounded"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
