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

/**
 * Runs before paint so the page never flashes the wrong theme. A saved
 * choice in localStorage wins; otherwise it follows the OS setting.
 */
const THEME_INIT = `
(function () {
  try {
    var saved = localStorage.getItem("theme");
    var dark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <main className="mx-auto w-full max-w-2xl px-4 pt-5">{children}</main>
        <Nav />
      </body>
    </html>
  );
}
