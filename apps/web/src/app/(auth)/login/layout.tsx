import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Momentum — a task and habit tracker that computes a daily 0.0–10.0 rating from logged tasks.",
  alternates: { canonical: "/login" }
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
