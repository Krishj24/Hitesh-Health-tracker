"use client";

import { useState, useTransition } from "react";

import { deleteReading } from "@/lib/actions";
import { clock, longDay, prettyDay } from "@/lib/date";
import type { Reading } from "@/lib/db";
import { describe, KIND_SHORT, LEVEL_DOT, type Targets } from "@/lib/ranges";

export default function ReadingList({
  readings,
  targets,
  today,
}: {
  readings: Reading[];
  targets: Targets;
  today: string;
}) {
  if (!readings.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm
                    text-slate-500 dark:border-slate-700">
        Nothing recorded in this period.
      </p>
    );
  }

  const byDay = new Map<string, Reading[]>();
  for (const r of readings) {
    const day = r.taken_at.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), r]);
  }

  return (
    <div className="space-y-5">
      {[...byDay.entries()].map(([day, rows]) => (
        <section key={day}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {prettyDay(day, today)}
            <span className="ml-2 font-normal normal-case tracking-normal">{longDay(day)}</span>
          </h3>
          <ul className="space-y-2">
            {rows.map((r) => (
              <ReadingRow key={r.id} reading={r} targets={targets} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ReadingRow({ reading, targets }: { reading: Reading; targets: Targets }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const d = describe(reading, targets);

  return (
    <li className="card p-3">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${LEVEL_DOT[d.level]}`} aria-hidden />
        <div className="w-14 shrink-0 text-xs font-semibold text-slate-500">
          {KIND_SHORT[reading.kind]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold tnum">
            {d.value} <span className="text-xs font-normal text-slate-500">{d.unit}</span>
          </p>
          <p className="truncate text-xs text-slate-500">
            {clock(reading.taken_at)} · <span className="capitalize">{d.note}</span>
            {reading.remarks && ` · ${reading.remarks}`}
          </p>
        </div>
        {confirming ? (
          <div className="flex shrink-0 gap-1.5">
            <button
              onClick={() => startTransition(() => deleteReading(reading.id))}
              disabled={pending}
              className="btn-danger px-2.5 py-1.5 text-xs"
            >
              Delete
            </button>
            <button onClick={() => setConfirming(false)} className="btn-ghost px-2.5 py-1.5 text-xs">
              Keep
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            aria-label="Delete this reading"
            className="shrink-0 rounded-lg p-2 text-slate-300 hover:text-rose-500 dark:text-slate-600"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </li>
  );
}
