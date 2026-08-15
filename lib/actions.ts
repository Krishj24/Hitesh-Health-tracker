"use server";

import { revalidatePath } from "next/cache";

import { addDays, nowStamp, todayStr } from "./date";
import { ensureSchema, sql } from "./db";
import { DEFAULT_TARGETS } from "./ranges";

function refresh() {
  revalidatePath("/", "layout");
}

function clean(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? null : text;
}

function num(value: FormDataEntryValue | null): number | null {
  const text = clean(value);
  if (text === null) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export type Result = { ok: boolean; message: string };

// --- readings ---------------------------------------------------------------

export async function saveReading(_prev: Result | null, form: FormData): Promise<Result> {
  await ensureSchema();

  // datetime-local sends '2026-08-15T21:30'; we store '2026-08-15 21:30'.
  const takenAt = (clean(form.get("taken_at")) ?? nowStamp()).replace("T", " ").slice(0, 16);
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(takenAt)) {
    return { ok: false, message: "That date and time could not be read." };
  }
  const remarks = clean(form.get("remarks"));

  const sys = num(form.get("sys"));
  const dia = num(form.get("dia"));
  const pulse = num(form.get("pulse"));
  const sugar = num(form.get("sugar"));
  const tag = clean(form.get("sugar_tag")) ?? "random";
  const spo2 = num(form.get("spo2"));
  const spo2Pulse = num(form.get("spo2_pulse"));

  if (sys !== null && dia === null) return { ok: false, message: "Enter the lower BP number too." };
  if (dia !== null && sys === null) return { ok: false, message: "Enter the upper BP number too." };
  if (sys === null && sugar === null && spo2 === null) {
    return { ok: false, message: "Nothing to save — fill in at least one reading." };
  }

  const saved: string[] = [];
  if (sys !== null && dia !== null) {
    await sql`
      INSERT INTO readings (kind, taken_at, v1, v2, v3, remarks)
      VALUES ('bp', ${takenAt}, ${sys}, ${dia}, ${pulse}, ${remarks})`;
    saved.push(`BP ${Math.round(sys)}/${Math.round(dia)}`);
  }
  if (sugar !== null) {
    await sql`
      INSERT INTO readings (kind, taken_at, v1, tag, remarks)
      VALUES ('sugar', ${takenAt}, ${sugar}, ${tag}, ${remarks})`;
    saved.push(`sugar ${Math.round(sugar)}`);
  }
  if (spo2 !== null) {
    await sql`
      INSERT INTO readings (kind, taken_at, v1, v2, remarks)
      VALUES ('spo2', ${takenAt}, ${spo2}, ${spo2Pulse}, ${remarks})`;
    saved.push(`SpO₂ ${Math.round(spo2)}%`);
  }

  refresh();
  return { ok: true, message: `Saved ${saved.join(", ")}.` };
}

export async function deleteReading(id: number) {
  await ensureSchema();
  await sql`DELETE FROM readings WHERE id = ${id}`;
  refresh();
}

// --- doses ------------------------------------------------------------------

export async function markDose(medId: number, day: string, status: "taken" | "skipped" | null) {
  await ensureSchema();
  if (status === null) {
    await sql`DELETE FROM doses WHERE med_id = ${medId} AND dose_date = ${day}`;
  } else {
    await sql`
      INSERT INTO doses (med_id, dose_date, status, marked_at)
      VALUES (${medId}, ${day}, ${status}, ${nowStamp()})
      ON CONFLICT (med_id, dose_date) DO UPDATE
        SET status = EXCLUDED.status, marked_at = EXCLUDED.marked_at`;
  }
  refresh();
}

export async function markAll(day: string) {
  await ensureSchema();
  await sql`
    INSERT INTO doses (med_id, dose_date, status, marked_at)
    SELECT id, ${day}, 'taken', ${nowStamp()} FROM meds
    WHERE active = true AND start_date <= ${day}
      AND (end_date IS NULL OR end_date >= ${day})
    ON CONFLICT (med_id, dose_date) DO UPDATE
      SET status = 'taken', marked_at = EXCLUDED.marked_at`;
  refresh();
}

export async function setDoseNote(medId: number, day: string, note: string) {
  await ensureSchema();
  await sql`
    INSERT INTO doses (med_id, dose_date, status, marked_at, note)
    VALUES (${medId}, ${day}, 'taken', ${nowStamp()}, ${note || null})
    ON CONFLICT (med_id, dose_date) DO UPDATE SET note = EXCLUDED.note`;
  refresh();
}

// --- medicines --------------------------------------------------------------

export async function saveMed(_prev: Result | null, form: FormData): Promise<Result> {
  await ensureSchema();

  const id = num(form.get("id"));
  const name = clean(form.get("name"));
  if (!name) return { ok: false, message: "Give the medicine a name." };

  const dose = clean(form.get("dose"));
  const slotLabel = clean(form.get("slot_label")) ?? "Dose";
  const slotTime = clean(form.get("slot_time")) ?? "08:00";
  if (!/^\d{2}:\d{2}$/.test(slotTime)) return { ok: false, message: "Pick a valid time." };

  const startDate = clean(form.get("start_date")) ?? todayStr();
  const courseDays = num(form.get("course_days"));
  let endDate = clean(form.get("end_date"));
  if (courseDays && courseDays > 0) endDate = addDays(startDate, courseDays - 1);
  const notes = clean(form.get("notes"));

  if (id) {
    await sql`
      UPDATE meds SET name = ${name}, dose = ${dose}, slot_label = ${slotLabel},
        slot_time = ${slotTime}, start_date = ${startDate}, end_date = ${endDate},
        notes = ${notes}
      WHERE id = ${id}`;
    refresh();
    return { ok: true, message: `${name} updated.` };
  }

  await sql`
    INSERT INTO meds (name, dose, slot_label, slot_time, start_date, end_date, notes)
    VALUES (${name}, ${dose}, ${slotLabel}, ${slotTime}, ${startDate}, ${endDate}, ${notes})`;
  refresh();
  return {
    ok: true,
    message: `${name} added at ${slotTime}${endDate ? `, until ${endDate}` : ""}.`,
  };
}

export async function toggleMedActive(id: number, active: boolean) {
  await ensureSchema();
  await sql`UPDATE meds SET active = ${active} WHERE id = ${id}`;
  refresh();
}

export async function deleteMed(id: number) {
  await ensureSchema();
  await sql`DELETE FROM meds WHERE id = ${id}`; // doses cascade
  refresh();
}

// --- settings ---------------------------------------------------------------

export async function saveProfile(_prev: Result | null, form: FormData): Promise<Result> {
  await ensureSchema();
  const name = clean(form.get("patient_name")) ?? "Recovery";
  const surgery = clean(form.get("surgery_date")) ?? "";
  await sql`
    INSERT INTO settings (key, value) VALUES ('patient_name', ${name})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  await sql`
    INSERT INTO settings (key, value) VALUES ('surgery_date', ${surgery})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  refresh();
  return { ok: true, message: "Saved." };
}

export async function saveTargets(_prev: Result | null, form: FormData): Promise<Result> {
  await ensureSchema();
  for (const key of Object.keys(DEFAULT_TARGETS)) {
    const value = num(form.get(key));
    if (value === null) continue;
    await sql`
      INSERT INTO settings (key, value) VALUES (${key}, ${String(value)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
  refresh();
  return { ok: true, message: "Targets updated." };
}

export async function resetTargets(): Promise<Result> {
  await ensureSchema();
  const keys = Object.keys(DEFAULT_TARGETS);
  await sql`DELETE FROM settings WHERE key = ANY(${keys})`;
  refresh();
  return { ok: true, message: "Back to the default bands." };
}
