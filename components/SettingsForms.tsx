"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";

import { resetTargets, saveProfile, saveTargets, type Result } from "@/lib/actions";
import { TARGET_FIELDS, type Targets } from "@/lib/ranges";

export function ProfileForm({ name, surgeryDate }: { name: string; surgeryDate: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<Result | null, FormData>(saveProfile, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="card space-y-4 p-4">
      <div>
        <label className="label" htmlFor="patient_name">
          Name shown at the top
        </label>
        <input id="patient_name" name="patient_name" className="field" defaultValue={name} />
      </div>
      <div>
        <label className="label" htmlFor="surgery_date">
          Surgery date <span className="font-normal text-slate-400">optional</span>
        </label>
        <input
          id="surgery_date"
          type="date"
          name="surgery_date"
          className="field"
          defaultValue={surgeryDate}
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Used to show &ldquo;day 12 after surgery&rdquo; on the home screen.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        {state?.ok && <span className="text-sm text-emerald-600">{state.message}</span>}
      </div>
    </form>
  );
}

export function TargetsForm({ targets }: { targets: Targets }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<Result | null, FormData>(saveTargets, null);
  const [resetting, startReset] = useTransition();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <div className="card p-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
      >
        <span>
          <span className="block font-semibold">Target ranges</span>
          <span className="block text-sm text-slate-500">
            What counts as out of range for these readings
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <form action={action} className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            These are general reference bands, not medical advice. If the doctor gave different
            numbers, put those in — every colour and warning in the app follows what is set here.
          </p>
          {TARGET_FIELDS.map((field) => (
            <div key={field.key} className="flex items-center gap-3">
              <label htmlFor={field.key} className="flex-1 text-sm">
                {field.label}
              </label>
              <input
                id={field.key}
                name={field.key}
                type="number"
                inputMode="numeric"
                step="any"
                defaultValue={targets[field.key]}
                className="field w-24 text-center tnum"
              />
              <span className="w-12 shrink-0 text-xs text-slate-400">{field.unit}</span>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button className="btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save targets"}
            </button>
            <button
              type="button"
              onClick={() => startReset(async () => {
                await resetTargets();
                router.refresh();
              })}
              className="btn-ghost"
              disabled={resetting}
            >
              Reset to defaults
            </button>
            {state?.ok && <span className="text-sm text-emerald-600">{state.message}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
