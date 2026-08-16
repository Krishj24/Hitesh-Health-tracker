import "server-only";

import { addDays, lastNDays, todayStr } from "./date";
import { ensureSchema, sql, type Dose, type Kind, type Med, type Reading } from "./db";
import { DEFAULT_TARGETS, type Targets } from "./ranges";

export async function getSettings(): Promise<Record<string, string>> {
  await ensureSchema();
  const rows = (await sql`SELECT key, value FROM settings`) as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function getTargets(): Promise<Targets> {
  const stored = await getSettings();
  const out = { ...DEFAULT_TARGETS };
  for (const key of Object.keys(DEFAULT_TARGETS) as (keyof Targets)[]) {
    const raw = stored[key];
    if (raw !== undefined && raw !== "" && !Number.isNaN(Number(raw))) out[key] = Number(raw);
  }
  return out;
}

export async function getProfile() {
  const s = await getSettings();
  return {
    name: s.patient_name || "Recovery",
    surgeryDate: s.surgery_date || "",
  };
}

// --- readings ---------------------------------------------------------------

export async function readingsOn(day: string): Promise<Reading[]> {
  await ensureSchema();
  return (await sql`
    SELECT * FROM readings WHERE taken_at LIKE ${day + "%"}
    ORDER BY taken_at DESC, id DESC`) as Reading[];
}

export async function readingsSince(day: string, kind?: Kind): Promise<Reading[]> {
  await ensureSchema();
  if (kind) {
    return (await sql`
      SELECT * FROM readings WHERE taken_at >= ${day} AND kind = ${kind}
      ORDER BY taken_at DESC, id DESC LIMIT 1000`) as Reading[];
  }
  return (await sql`
    SELECT * FROM readings WHERE taken_at >= ${day}
    ORDER BY taken_at DESC, id DESC LIMIT 1000`) as Reading[];
}

export async function latestReadings(): Promise<Partial<Record<Kind, Reading>>> {
  await ensureSchema();
  const rows = (await sql`
    SELECT DISTINCT ON (kind) * FROM readings
    ORDER BY kind, taken_at DESC, id DESC`) as Reading[];
  return Object.fromEntries(rows.map((r) => [r.kind, r]));
}

// --- medicines --------------------------------------------------------------

export async function scheduledFor(day: string): Promise<Med[]> {
  await ensureSchema();
  return (await sql`
    SELECT * FROM meds
    WHERE active = true AND start_date <= ${day}
      AND (end_date IS NULL OR end_date >= ${day})
    ORDER BY slot_time, name`) as Med[];
}

export async function allMeds(): Promise<Med[]> {
  await ensureSchema();
  return (await sql`
    SELECT * FROM meds ORDER BY active DESC, slot_time, name`) as Med[];
}

export async function dosesOn(day: string): Promise<Record<number, Dose>> {
  await ensureSchema();
  const rows = (await sql`SELECT * FROM doses WHERE dose_date = ${day}`) as Dose[];
  return Object.fromEntries(rows.map((d) => [d.med_id, d]));
}

export async function dosesBetween(from: string, to: string): Promise<Dose[]> {
  await ensureSchema();
  return (await sql`
    SELECT * FROM doses WHERE dose_date >= ${from} AND dose_date <= ${to}`) as Dose[];
}

export type DoseStatus = "taken" | "skipped" | "due" | "pending" | "missed" | "upcoming" | "sos";

export function doseState(
  med: Med,
  dose: Dose | undefined,
  day: string,
  today: string,
  timeNow: string,
): DoseStatus {
  if (dose) return dose.status;
  if (med.sos) return "sos";
  if (day < today) return "missed";
  if (day > today) return "upcoming";
  return timeNow >= med.slot_time ? "due" : "pending";
}

/** How many doses were never marked over the past `days` days, excluding today. */
export async function unmarkedRecently(days: number, today: string) {
  const lastDay = addDays(today, -1);
  const [meds, doses] = await Promise.all([
    allMeds(),
    dosesBetween(addDays(today, -days), lastDay),
  ]);
  const marked = new Set(doses.map((d) => `${d.med_id}|${d.dose_date}`));

  let count = 0;
  for (const day of lastNDays(days, lastDay)) {
    for (const m of meds) {
      const due = m.active && !m.sos && m.start_date <= day && (!m.end_date || m.end_date >= day);
      if (due && !marked.has(`${m.id}|${day}`)) count += 1;
    }
  }
  return count;
}

// --- adherence --------------------------------------------------------------

export type Adherence = {
  days: { day: string; taken: number; scheduled: number }[];
  perMed: { id: number; name: string; time: string; taken: number; scheduled: number; unmarked: number }[];
  totalTaken: number;
  totalScheduled: number;
};

export async function adherence(days: number, today = todayStr()): Promise<Adherence> {
  const from = addDays(today, -(days - 1));
  const [meds, doseRows] = await Promise.all([allMeds(), dosesBetween(from, today)]);
  const byKey = new Map(doseRows.map((d) => [`${d.med_id}|${d.dose_date}`, d]));

  const perMed = new Map<number, Adherence["perMed"][number]>();
  const dayRows: Adherence["days"] = [];

  for (const day of lastNDays(days, today)) {
    const due = meds.filter(
      (m) => m.active && !m.sos && m.start_date <= day && (!m.end_date || m.end_date >= day),
    );
    let taken = 0;
    for (const m of due) {
      const stat =
        perMed.get(m.id) ??
        { id: m.id, name: m.name, time: m.slot_time, taken: 0, scheduled: 0, unmarked: 0 };
      stat.scheduled += 1;
      const dose = byKey.get(`${m.id}|${day}`);
      if (dose?.status === "taken") {
        stat.taken += 1;
        taken += 1;
      } else if (!dose && day <= today) {
        stat.unmarked += 1;
      }
      perMed.set(m.id, stat);
    }
    if (due.length) dayRows.push({ day, taken, scheduled: due.length });
  }

  const list = [...perMed.values()].sort((a, b) => a.time.localeCompare(b.time));
  return {
    days: dayRows,
    perMed: list,
    totalTaken: list.reduce((n, s) => n + s.taken, 0),
    totalScheduled: list.reduce((n, s) => n + s.scheduled, 0),
  };
}
