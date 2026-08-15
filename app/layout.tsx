import type { Metadata, Viewport } from "next";

import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Post-op care",
  description: "Daily vitals and medicine tracker for recovery at home.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Care", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto w-full max-w-2xl px-4 pt-5">{children}</main>
        <Nav />
      </body>
    </html>
  );
}
