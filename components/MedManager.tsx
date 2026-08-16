"use client";

import { useState, useTransition } from "react";

import MedForm from "@/components/MedForm";
import { deleteMed, toggleMedActive } from "@/lib/actions";
import { longDay, timeLabel, todayStr } from "@/lib/date";
import type { Med } from "@/lib/db";

export default function MedManager({ meds }: { meds: Med[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const today = todayStr();

  const live = meds.filter((m) => m.active && (!m.end_date || m.end_date >= today));
  const finished = meds.filter((m) => !m.active || (m.end_date && m.end_date < today));

  return (
    <div className="space-y-4">
      {adding ? (
        <MedForm onDone={() => setAdding(false)} />
      ) : (
        <button onClick={() => setAdding(true)} className="btn-primary w-full">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Add a medicine
        </button>
      )}

      {live.length > 0 && (
        <section>
          <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
            On the daily list
          </h2>
          <ul className="space-y-2">
            {live.map((med) =>
              editing === med.id ? (
                <li key={med.id}>
                  <MedForm med={med} onDone={() => setEditing(null)} />
                </li>
              ) : (
                <MedRow key={med.id} med={med} onEdit={() => setEditing(med.id)} />
              ),
            )}
          </ul>
        </section>
      )}

      {finished.length > 0 && (
        <section>
          <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Stopped or finished
          </h2>
          <ul className="space-y-2">
            {finished.map((med) =>
              editing === med.id ? (
                <li key={med.id}>
                  <MedForm med={med} onDone={() => setEditing(null)} />
                </li>
              ) : (
                <MedRow key={med.id} med={med} onEdit={() => setEditing(med.id)} muted />
              ),
            )}
          </ul>
        </section>
      )}

      {meds.length === 0 && !adding && (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm
                      text-slate-500 dark:border-slate-700">
          No medicines yet. Add each dose time from the prescription — the daily checklist builds
          itself from this list.
        </p>
      )}
    </div>
  );
}

function MedRow({ med, onEdit, muted }: { med: Med; onEdit: () => void; muted?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const today = todayStr();
  const ended = med.end_date && med.end_date < today;

  return (
    <li className={`card p-3 ${muted ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {med.name}
            {med.dose && <span className="ml-1.5 text-sm font-normal text-slate-500">{med.dose}</span>}
            {med.sos && (
              <span className="ml-1.5 rounded-full border border-slate-300 px-1.5 py-0.5 text-[10px]
                               font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700">
                SOS
              </span>
            )}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            {med.sos ? "As needed" : timeLabel(med.slot_time)} · {med.slot_label}
            {med.notes && ` · ${med.notes}`}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {longDay(med.start_date)} →{" "}
            {med.end_date ? longDay(med.end_date) : "ongoing"}
            {!med.active && " · stopped"}
            {med.active && ended && " · course finished"}
          </p>
        </div>
        <button onClick={onEdit} className="btn-ghost px-3 py-2 text-sm">
          Edit
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          onClick={() => startTransition(() => toggleMedActive(med.id, !med.active))}
          disabled={pending}
          className="btn-ghost px-3 py-2 text-sm"
        >
          {med.active ? "Stop" : "Resume"}
        </button>
        {confirming ? (
          <>
            <button
              onClick={() => startTransition(() => deleteMed(med.id))}
              disabled={pending}
              className="btn-danger px-3 py-2 text-sm"
            >
              Delete it and its history
            </button>
            <button onClick={() => setConfirming(false)} className="btn-ghost px-3 py-2 text-sm">
              Keep
            </button>
          </>
        ) : (
          <button onClick={() => setConfirming(true)} className="btn-ghost px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
            Delete
          </button>
        )}
        {confirming && (
          <p className="w-full text-xs text-slate-500">
            Stopping keeps the past record and only removes it from future days. Deleting erases
            every dose ever marked for it.
          </p>
        )}
      </div>
    </li>
  );
}
