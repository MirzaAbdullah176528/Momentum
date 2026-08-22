import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://momentum-by-abdullah-hassan.vercel.app"),
  title: {
    default: "Momentum",
    template: "%s | Momentum"
  },
  description:
    "A task and habit tracker that computes a daily 0.0–10.0 rating from logged tasks.",
  applicationName: "Momentum",
  authors: [{ name: "Momentum" }],
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }]
  },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Momentum",
    title: "Momentum",
    description:
      "A task and habit tracker that computes a daily 0.0–10.0 rating from logged tasks."
  },
  twitter: {
    card: "summary",
    title: "Momentum",
    description:
      "A task and habit tracker that computes a daily 0.0–10.0 rating from logged tasks."
  }
};

export const viewport: Viewport = {
  themeColor: "#050610",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark"
};

export default function RootLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased">
        <AuthProvider>
          <div className="bg-orbs" aria-hidden="true">
            <div className="bg-orb bg-orb-1" />
            <div className="bg-orb bg-orb-2" />
            <div className="bg-orb bg-orb-3" />
          </div>
          <div className="relative z-10">{children}</div>
          <Script id="pause-orbs-when-hidden" strategy="afterInteractive">
            {`document.addEventListener("visibilitychange",function(){var o=document.querySelector(".bg-orbs");if(o)o.classList.toggle("bg-orbs-paused",document.hidden)})`}
          </Script>
        </AuthProvider>
      </body>
    </html>
  );
}
