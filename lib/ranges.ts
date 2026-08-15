import type { Reading } from "./db";

/**
 * Reference bands used to colour a reading. General guidance only -- editable
 * in Settings so the doctor's own targets win.
 */
export const DEFAULT_TARGETS = {
  bp_sys_high: 140,
  bp_sys_low: 90,
  bp_dia_high: 90,
  bp_dia_low: 60,
  sugar_fasting_high: 130,
  sugar_fasting_low: 70,
  sugar_post_high: 180,
  sugar_post_low: 70,
  spo2_low: 94,
  spo2_alert: 90,
  pulse_high: 100,
  pulse_low: 50,
};

export type Targets = typeof DEFAULT_TARGETS;
export type TargetKey = keyof Targets;

export const TARGET_FIELDS: { key: TargetKey; label: string; unit: string }[] = [
  { key: "bp_sys_high", label: "BP upper — flag at or above", unit: "mmHg" },
  { key: "bp_sys_low", label: "BP upper — flag below", unit: "mmHg" },
  { key: "bp_dia_high", label: "BP lower — flag at or above", unit: "mmHg" },
  { key: "bp_dia_low", label: "BP lower — flag below", unit: "mmHg" },
  { key: "sugar_fasting_high", label: "Fasting sugar — flag at or above", unit: "mg/dL" },
  { key: "sugar_fasting_low", label: "Fasting sugar — flag below", unit: "mg/dL" },
  { key: "sugar_post_high", label: "Post-meal sugar — flag at or above", unit: "mg/dL" },
  { key: "sugar_post_low", label: "Post-meal sugar — flag below", unit: "mg/dL" },
  { key: "spo2_low", label: "SpO₂ — flag below", unit: "%" },
  { key: "spo2_alert", label: "SpO₂ — alert below", unit: "%" },
  { key: "pulse_high", label: "Pulse — flag at or above", unit: "bpm" },
  { key: "pulse_low", label: "Pulse — flag below", unit: "bpm" },
];

export type Level = "ok" | "watch" | "alert";

export const KIND_LABEL = {
  bp: "Blood pressure",
  sugar: "Blood sugar",
  spo2: "Oxygen",
} as const;

export const KIND_SHORT = { bp: "BP", sugar: "Sugar", spo2: "SpO₂" } as const;

export const SUGAR_TAGS = [
  { value: "fasting", label: "Fasting" },
  { value: "post-meal", label: "Post-meal" },
  { value: "random", label: "Random" },
];

function worst(...levels: Level[]): Level {
  const rank = { ok: 0, watch: 1, alert: 2 };
  return levels.reduce((a, b) => (rank[b] > rank[a] ? b : a), "ok" as Level);
}

export function flagBp(sys: number, dia: number, t: Targets): [Level, string] {
  if (sys >= t.bp_sys_high + 40 || dia >= t.bp_dia_high + 30) return ["alert", "very high"];
  if (sys < t.bp_sys_low - 10 || dia < t.bp_dia_low - 10) return ["alert", "very low"];
  if (sys >= t.bp_sys_high || dia >= t.bp_dia_high) return ["watch", "above target"];
  if (sys < t.bp_sys_low || dia < t.bp_dia_low) return ["watch", "below target"];
  return ["ok", "in range"];
}

export function flagSugar(value: number, tag: string | null, t: Targets): [Level, string] {
  const high = tag === "fasting" ? t.sugar_fasting_high : t.sugar_post_high;
  const low = tag === "fasting" ? t.sugar_fasting_low : t.sugar_post_low;
  if (value < 70) return ["alert", "very low"];
  if (value >= 300) return ["alert", "very high"];
  if (value >= high) return ["watch", "above target"];
  if (value < low) return ["watch", "below target"];
  return ["ok", "in range"];
}

export function flagSpo2(value: number, t: Targets): [Level, string] {
  if (value < t.spo2_alert) return ["alert", "low oxygen"];
  if (value < t.spo2_low) return ["watch", "below target"];
  return ["ok", "in range"];
}

export function flagPulse(value: number | null, t: Targets): [Level, string] {
  if (value == null) return ["ok", ""];
  if (value >= t.pulse_high + 20 || value < t.pulse_low - 10) return ["alert", "pulse off"];
  if (value >= t.pulse_high || value < t.pulse_low) return ["watch", "pulse off"];
  return ["ok", ""];
}

export type Described = { value: string; unit: string; level: Level; note: string };

export function describe(r: Reading, t: Targets): Described {
  if (r.kind === "bp") {
    const [level, note] = flagBp(r.v1 ?? 0, r.v2 ?? 0, t);
    const [plevel, pnote] = flagPulse(r.v3, t);
    return {
      value: `${Math.round(r.v1 ?? 0)}/${Math.round(r.v2 ?? 0)}`,
      unit: "mmHg" + (r.v3 ? ` · pulse ${Math.round(r.v3)}` : ""),
      level: worst(level, plevel),
      note: pnote ? `${note}, ${pnote}` : note,
    };
  }
  if (r.kind === "sugar") {
    const [level, note] = flagSugar(r.v1 ?? 0, r.tag, t);
    return {
      value: `${Math.round(r.v1 ?? 0)}`,
      unit: `mg/dL · ${r.tag ?? "random"}`,
      level,
      note,
    };
  }
  const [level, note] = flagSpo2(r.v1 ?? 0, t);
  return {
    value: `${Math.round(r.v1 ?? 0)}%`,
    unit: r.v2 ? `pulse ${Math.round(r.v2)}` : "SpO₂",
    level,
    note,
  };
}

export const LEVEL_STYLE: Record<Level, string> = {
  ok: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900",
  watch:
    "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900",
  alert:
    "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900",
};

export const LEVEL_DOT: Record<Level, string> = {
  ok: "bg-emerald-500",
  watch: "bg-amber-500",
  alert: "bg-rose-500",
};
