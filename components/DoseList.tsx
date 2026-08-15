"use client";

import { useOptimistic, useState, useTransition } from "react";

import { markAll, markDose } from "@/lib/actions";
import type { DoseStatus } from "@/lib/queries";
import { clock, timeLabel } from "@/lib/date";

export type DoseItem = {
  medId: number;
  name: string;
  dose: string | null;
  slotLabel: string;
  slotTime: string;
  notes: string | null;
  status: DoseStatus;
  markedAt: string | null;
  note: string | null;
};

const STATUS_TEXT: Record<DoseStatus, string> = {
  taken: "Taken",
  skipped: "Skipped",
  due: "Due now",
  pending: "Later today",
  missed: "Not marked",
  upcoming: "Upcoming",
};

const STATUS_STYLE: Record<DoseStatus, string> = {
  taken: "text-emerald-600 dark:text-emerald-400",
  skipped: "text-slate-500",
  due: "text-amber-600 dark:text-amber-400",
  pending: "text-slate-500",
  missed: "text-rose-600 dark:text-rose-400",
  upcoming: "text-slate-400",
};

export default function DoseList({
  items,
  day,
  compact = false,
}: {
  items: DoseItem[];
  day: string;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    items,
    (state: DoseItem[], update: { medId: number | "all"; status: DoseStatus }) =>
      state.map((item) =>
        update.medId === "all" || item.medId === update.medId
          ? { ...item, status: update.status }
          : item,
      ),
  );
  const [openRow, setOpenRow] = useState<number | null>(null);

  const done = optimistic.filter((i) => i.status === "taken").length;
  const total = optimistic.length;

  function toggle(item: DoseItem) {
    const next: DoseStatus =
      item.status === "taken" ? (day < todayGuess() ? "missed" : "pending") : "taken";
    startTransition(async () => {
      setOptimistic({ medId: item.medId, status: next });
      await markDose(item.medId, day, item.status === "taken" ? null : "taken");
    });
  }

  function setStatus(item: DoseItem, status: "skipped" | null) {
    startTransition(async () => {
      setOptimistic({ medId: item.medId, status: status ?? "pending" });
      await markDose(item.medId, day, status);
    });
    setOpenRow(null);
  }

  function takeAll() {
    startTransition(async () => {
      setOptimistic({ medId: "all", status: "taken" });
      await markAll(day);
    });
  }

  if (!total) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm
                    text-slate-500 dark:border-slate-700">
        No medicines scheduled for this day.
      </p>
    );
  }

  let lastSlot = "";

  return (
    <div className={pending ? "opacity-90 transition-opacity" : "transition-opacity"}>
      {!compact && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <Progress done={done} total={total} />
          {done < total && (
            <button onClick={takeAll} className="btn-ghost px-3 py-2 text-sm">
              Mark all taken
            </button>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {optimistic.map((item) => {
          const showSlot = !compact && item.slotLabel + item.slotTime !== lastSlot;
          lastSlot = item.slotLabel + item.slotTime;
          const taken = item.status === "taken";
          const skipped = item.status === "skipped";

          return (
            <li key={item.medId}>
              {showSlot && (
                <p className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {timeLabel(item.slotTime)} · {item.slotLabel}
                </p>
              )}
              <div
                className={`card flex items-center gap-3 p-3 ${
                  item.status === "missed" ? "border-rose-200 dark:border-rose-900/60" : ""
                }`}
              >
                <button
                  onClick={() => toggle(item)}
                  aria-pressed={taken}
                  aria-label={`${taken ? "Unmark" : "Mark"} ${item.name} as taken`}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2
                              transition active:scale-95 ${
                                taken
                                  ? "border-emerald-500 bg-emerald-500 text-white"
                                  : skipped
                                    ? "border-slate-300 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800"
                                    : "border-slate-300 bg-white text-transparent dark:border-slate-600 dark:bg-slate-800"
                              }`}
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path
                      d={skipped ? "M6 12h12" : "M5 13l4 4L19 7"}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <button onClick={() => toggle(item)} className="min-w-0 flex-1 text-left">
                  <p
                    className={`truncate font-semibold ${
                      taken || skipped ? "text-slate-400 line-through dark:text-slate-500" : ""
                    }`}
                  >
                    {item.name}
                    {item.dose && (
                      <span className="ml-1.5 text-sm font-normal text-slate-500">{item.dose}</span>
                    )}
                  </p>
                  <p className="truncate text-xs">
                    <span className={STATUS_STYLE[item.status]}>{STATUS_TEXT[item.status]}</span>
                    {taken && item.markedAt && (
                      <span className="text-slate-400"> at {clock(item.markedAt)}</span>
                    )}
                    {compact && <span className="text-slate-400"> · {timeLabel(item.slotTime)}</span>}
                    {item.notes && <span className="text-slate-400"> · {item.notes}</span>}
                  </p>
                </button>

                <button
                  onClick={() => setOpenRow(openRow === item.medId ? null : item.medId)}
                  aria-label={`More options for ${item.name}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400
                             hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <circle cx="12" cy="5" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="12" cy="19" r="1.6" />
                  </svg>
                </button>
              </div>

              {openRow === item.medId && (
                <div className="mt-1.5 flex gap-2 px-2">
                  <button onClick={() => setStatus(item, "skipped")} className="btn-ghost px-3 py-2 text-sm">
                    Mark skipped
                  </button>
                  <button onClick={() => setStatus(item, null)} className="btn-ghost px-3 py-2 text-sm">
                    Clear mark
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex-1">
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-semibold tnum">
          {done} of {total} taken
        </span>
        <span className="text-slate-500 tnum">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-teal-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Only used to pick a sensible optimistic label before the server responds. */
function todayGuess() {
  return new Date().toLocaleDateString("en-CA");
}
