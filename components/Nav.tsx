"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import ThemeToggle from "@/components/ThemeToggle";

const TABS = [
  { href: "/", label: "Today", icon: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" },
  { href: "/meds", label: "Medicines", icon: "M8.5 15.5 15.5 8.5M6.4 17.6a4.5 4.5 0 0 1 0-6.4l4.8-4.8a4.5 4.5 0 0 1 6.4 6.4l-4.8 4.8a4.5 4.5 0 0 1-6.4 0Z" },
  { href: "/log", label: "Log", icon: "M12 5v14M5 12h14" },
  { href: "/history", label: "History", icon: "M4 17l5-6 4 4 6.5-8" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95
                 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const isLog = tab.href === "/log";
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition ${
                active
                  ? "text-teal-600 dark:text-teal-400"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300"
              }`}
            >
              <span
                className={
                  isLog
                    ? "flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm"
                    : "flex h-8 w-8 items-center justify-center"
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={isLog ? 2.5 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d={tab.icon} />
                </svg>
              </span>
              {tab.label}
            </Link>
          );
        })}
        <div className="flex items-center border-l border-slate-200 pl-2 dark:border-slate-800">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
