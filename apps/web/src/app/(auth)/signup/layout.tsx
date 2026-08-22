import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create a Momentum account — a task and habit tracker that computes a daily 0.0–10.0 rating from logged tasks.",
  alternates: { canonical: "/signup" }
};

export default function SignupLayout({ children }: { children: ReactNode }) {
  return children;
}
