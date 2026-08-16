"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { saveReading, type Result } from "@/lib/actions";
import {
  flagBp,
  flagSpo2,
  flagSugar,
  KIND_COLOR,
  LEVEL_STYLE,
  SUGAR_TAGS,
  type Level,
  type Targets,
} from "@/lib/ranges";

export default function LogForm({
  targets,
  defaultStamp,
}: {
  targets: Targets;
  defaultStamp: string; // 'YYYY-MM-DD HH:MM'
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<Result | null, FormData>(saveReading, null);

  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [sugar, setSugar] = useState("");
  const [tag, setTag] = useState("fasting");
  const [spo2, setSpo2] = useState("");

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setSys("");
      setDia("");
      setSugar("");
      setSpo2("");
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [state, router]);

  const bpHint =
    sys && dia ? flagBp(Number(sys), Number(dia), targets) : null;
  const sugarHint = sugar ? flagSugar(Number(sugar), tag, targets) : null;
  const spo2Hint = spo2 ? flagSpo2(Number(spo2), targets) : null;

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {state && (
        <p
          role="status"
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            state.ok
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
          }`}
        >
          {state.message}
          {state.ok && (
            <Link href="/" className="ml-2 underline">
              Back to today
            </Link>
          )}
        </p>
      )}

      <div className="card p-4">
        <label className="label" htmlFor="taken_at">
          When was it taken?
        </label>
        <input
          id="taken_at"
          type="datetime-local"
          name="taken_at"
          className="field"
          defaultValue={defaultStamp.replace(" ", "T")}
          required
        />
      </div>

      <Section title="Blood pressure" hint={bpHint} kind="bp">
        <div className="grid grid-cols-3 gap-3">
          <Num
            label="Upper"
            name="sys"
            value={sys}
            onChange={setSys}
            placeholder="120"
            min={60}
            max={280}
          />
          <Num
            label="Lower"
            name="dia"
            value={dia}
            onChange={setDia}
            placeholder="80"
            min={30}
            max={200}
          />
          <Num label="Pulse" name="pulse" placeholder="72" min={25} max={230} />
        </div>
      </Section>

      <Section title="Blood sugar" hint={sugarHint} kind="sugar">
        <div className="grid grid-cols-3 gap-3">
          <Num
            label="mg/dL"
            name="sugar"
            value={sugar}
            onChange={setSugar}
            placeholder="110"
            min={20}
            max={700}
          />
          <div className="col-span-2">
            <span className="label">Reading type</span>
            <div className="grid grid-cols-3 gap-2">
              {SUGAR_TAGS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTag(t.value)}
                  className={`rounded-xl border px-1 py-3 text-sm font-medium transition ${
                    tag === t.value
                      ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300"
                      : "border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <input type="hidden" name="sugar_tag" value={tag} />
          </div>
        </div>
      </Section>

      <Section title="Oxygen (SpO₂)" hint={spo2Hint} kind="spo2">
        <div className="grid grid-cols-3 gap-3">
          <Num
            label="SpO₂ %"
            name="spo2"
            value={spo2}
            onChange={setSpo2}
            placeholder="97"
            min={50}
            max={100}
          />
          <Num label="Pulse" name="spo2_pulse" placeholder="72" min={25} max={230} />
        </div>
      </Section>

      <div className="card p-4">
        <label className="label" htmlFor="remarks">
          Remarks <span className="font-normal text-slate-400">optional</span>
        </label>
        <textarea
          id="remarks"
          name="remarks"
          rows={2}
          className="field resize-none"
          placeholder="Felt dizzy after standing up, taken before breakfast…"
        />
        <p className="mt-1.5 text-xs text-slate-500">Saved against every reading in this entry.</p>
      </div>

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Saving…" : "Save reading"}
      </button>
      <p className="pb-2 text-center text-xs text-slate-500">
        Fill in only what you measured — blank sections are skipped.
      </p>
    </form>
  );
}

function Section({
  title,
  hint,
  kind,
  children,
}: {
  title: string;
  hint: [Level, string] | null;
  kind: "bp" | "sugar" | "spo2";
  children: React.ReactNode;
}) {
  const c = KIND_COLOR[kind];
  return (
    <section className={`card border-l-4 p-4 ${c.border}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className={`font-bold ${c.text}`}>{title}</h2>
        {hint && (
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${LEVEL_STYLE[hint[0]]}`}
          >
            {hint[1]}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Num({
  label,
  name,
  value,
  onChange,
  placeholder,
  min,
  max,
}: {
  label: string;
  name: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        inputMode="decimal"
        step="any"
        min={min}
        max={max}
        placeholder={placeholder}
        className="field text-center text-lg font-semibold tnum"
        {...(onChange ? { value, onChange: (e) => onChange(e.target.value) } : {})}
      />
    </div>
  );
}
