"use client";

import { useRouter } from "next/navigation";

import { addDays, longDay, prettyDay } from "@/lib/date";

export default function DateNav({
  day,
  today,
  basePath,
}: {
  day: string;
  today: string;
  basePath: string;
}) {
  const router = useRouter();
  const go = (target: string) => router.push(`${basePath}?d=${target}`);

  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        onClick={() => go(addDays(day, -1))}
        aria-label="Previous day"
        className="btn-ghost h-11 w-11 px-0"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <label className="relative flex-1">
        <span className="sr-only">Pick a date</span>
        <div
          className="card flex h-11 items-center justify-center px-3 text-center text-sm font-semibold"
          aria-hidden
        >
          {prettyDay(day, today)}
          <span className="ml-2 font-normal text-slate-400">{longDay(day)}</span>
        </div>
        <input
          type="date"
          value={day}
          max={today}
          onChange={(e) => e.target.value && go(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>

      <button
        onClick={() => go(addDays(day, 1))}
        aria-label="Next day"
        disabled={day >= today}
        className="btn-ghost h-11 w-11 px-0"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
