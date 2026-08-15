"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { saveMed, type Result } from "@/lib/actions";
import { daysBetween, todayStr } from "@/lib/date";
import type { Med } from "@/lib/db";

const SLOTS = [
  { label: "Morning", time: "08:00" },
  { label: "Afternoon", time: "14:00" },
  { label: "Evening", time: "18:00" },
  { label: "Night", time: "21:00" },
];

export default function MedForm({ med, onDone }: { med?: Med; onDone?: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<Result | null, FormData>(saveMed, null);

  const [slotLabel, setSlotLabel] = useState(med?.slot_label ?? "Morning");
  const [slotTime, setSlotTime] = useState(med?.slot_time ?? "08:00");
  const [ongoing, setOngoing] = useState(!med?.end_date);

  const startDate = med?.start_date ?? todayStr();
  const courseDays =
    med?.end_date && med.start_date ? daysBetween(med.start_date, med.end_date) + 1 : "";

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onDone?.();
    }
  }, [state, router, onDone]);

  return (
    <form action={action} className="card space-y-4 p-4">
      {med && <input type="hidden" name="id" value={med.id} />}

      <div>
        <label className="label" htmlFor="name">
          Medicine name
        </label>
        <input
          id="name"
          name="name"
          className="field"
          defaultValue={med?.name}
          placeholder="Pantoprazole"
          required
          autoFocus={!med}
        />
      </div>

      <div>
        <label className="label" htmlFor="dose">
          Dose <span className="font-normal text-slate-400">optional</span>
        </label>
        <input
          id="dose"
          name="dose"
          className="field"
          defaultValue={med?.dose ?? ""}
          placeholder="1 tablet, or 500 mg"
        />
      </div>

      <div>
        <span className="label">When is it taken?</span>
        <div className="mb-2 grid grid-cols-4 gap-2">
          {SLOTS.map((slot) => (
            <button
              key={slot.label}
              type="button"
              onClick={() => {
                setSlotLabel(slot.label);
                setSlotTime(slot.time);
              }}
              className={`rounded-xl border px-2 py-2.5 text-sm font-medium transition ${
                slotLabel === slot.label
                  ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300"
                  : "border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            name="slot_label"
            value={slotLabel}
            onChange={(e) => setSlotLabel(e.target.value)}
            className="field"
            aria-label="Slot name"
            placeholder="Slot name"
          />
          <input
            type="time"
            name="slot_time"
            value={slotTime}
            onChange={(e) => setSlotTime(e.target.value)}
            className="field w-36"
            aria-label="Time"
            required
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          One entry per dose time — a twice-a-day tablet is added twice.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="start_date">
            Starts
          </label>
          <input
            id="start_date"
            type="date"
            name="start_date"
            className="field"
            defaultValue={startDate}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="course_days">
            Course length
          </label>
          <input
            id="course_days"
            type="number"
            inputMode="numeric"
            name="course_days"
            min={1}
            max={3650}
            className="field"
            defaultValue={courseDays}
            placeholder="days"
            disabled={ongoing}
            onChange={(e) => setOngoing(e.target.value === "")}
          />
        </div>
      </div>

      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={ongoing}
          onChange={(e) => setOngoing(e.target.checked)}
          className="h-5 w-5 rounded border-slate-300 accent-teal-600"
        />
        Ongoing — no fixed end date
      </label>
      {ongoing && <input type="hidden" name="end_date" value="" />}

      <div>
        <label className="label" htmlFor="notes">
          Notes <span className="font-normal text-slate-400">optional</span>
        </label>
        <input
          id="notes"
          name="notes"
          className="field"
          defaultValue={med?.notes ?? ""}
          placeholder="After food"
        />
      </div>

      {state && !state.ok && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
          {state.message}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={pending}>
          {pending ? "Saving…" : med ? "Save changes" : "Add medicine"}
        </button>
        {onDone && (
          <button type="button" onClick={onDone} className="btn-ghost">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
