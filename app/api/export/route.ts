import { todayStr } from "@/lib/date";
import { ensureSchema, sql, type Dose, type Med, type Reading } from "@/lib/db";
import { doseState, getTargets } from "@/lib/queries";
import { describe, KIND_LABEL } from "@/lib/ranges";

export const dynamic = "force-dynamic";

/** One CSV with both the readings and the dose log, ready for Excel or printing. */
export async function GET() {
  await ensureSchema();
  const targets = await getTargets();
  const today = todayStr();

  const readings = (await sql`SELECT * FROM readings ORDER BY taken_at`) as Reading[];
  const meds = (await sql`SELECT * FROM meds ORDER BY slot_time, name`) as Med[];
  const doses = (await sql`SELECT * FROM doses`) as Dose[];
  const byKey = new Map(doses.map((d) => [`${d.med_id}|${d.dose_date}`, d]));

  const lines: string[] = [];

  lines.push("READINGS");
  lines.push(row(["date", "time", "type", "value", "second value", "pulse", "tag", "status", "remarks"]));
  for (const r of readings) {
    const d = describe(r, targets);
    lines.push(
      row([
        r.taken_at.slice(0, 10),
        r.taken_at.slice(11, 16),
        KIND_LABEL[r.kind],
        r.v1,
        r.kind === "bp" ? r.v2 : "",
        r.kind === "bp" ? r.v3 : r.kind === "spo2" ? r.v2 : "",
        r.tag ?? "",
        d.note,
        r.remarks ?? "",
      ]),
    );
  }

  lines.push("");
  lines.push("MEDICINE DOSES");
  lines.push(row(["date", "time", "medicine", "dose", "status", "marked at", "note"]));

  const dates = [...new Set(doses.map((d) => d.dose_date))];
  for (const m of meds) {
    if (m.start_date) dates.push(m.start_date);
  }
  const days = spanOf(dates, today);
  for (const day of days) {
    for (const m of meds) {
      const due =
        m.active && m.start_date <= day && (!m.end_date || m.end_date >= day);
      const dose = byKey.get(`${m.id}|${day}`);
      if (!due && !dose) continue;
      lines.push(
        row([
          day,
          m.slot_time,
          m.name,
          m.dose ?? "",
          dose ? dose.status : doseState(m, undefined, day, today, "23:59"),
          dose?.marked_at ?? "",
          dose?.note ?? "",
        ]),
      );
    }
  }

  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="post-op-care-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function row(cells: (string | number | null)[]): string {
  return cells
    .map((cell) => {
      const text = cell == null ? "" : String(cell);
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    })
    .join(",");
}

function spanOf(dates: string[], today: string): string[] {
  if (!dates.length) return [];
  const start = dates.reduce((a, b) => (b < a ? b : a));
  const end = [...dates, today].reduce((a, b) => (b > a ? b : a));
  const out: string[] = [];
  for (let d = start; d <= end; d = next(d)) out.push(d);
  return out;
}

function next(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}
