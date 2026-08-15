import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Resolved lazily, not at import time. Next.js loads route modules while
 * collecting page data at build time -- if this threw at the top level, a
 * missing DATABASE_URL would fail the whole build, before Vercel ever gets
 * to a request where the env var is actually available.
 */
function client(): NeonQueryFunction<false, false> {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING;

  if (!url) {
    throw new Error(
      "No database connection string. In Vercel: Storage -> create a Neon Postgres " +
        "database and connect it to this project (DATABASE_URL is injected for you), " +
        "then redeploy. Locally: put DATABASE_URL=... in .env.local",
    );
  }
  return neon(url);
}

let cached: NeonQueryFunction<false, false> | null = null;

export const sql: NeonQueryFunction<false, false> = ((...args: Parameters<NeonQueryFunction<false, false>>) => {
  cached ??= client();
  return cached(...args);
}) as NeonQueryFunction<false, false>;

/**
 * Creates the tables on first use. Cheap enough to await on every request
 * (CREATE TABLE IF NOT EXISTS), and memoised per serverless instance.
 */
let ready: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!ready) ready = migrate();
  return ready;
}

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS readings (
      id         SERIAL PRIMARY KEY,
      kind       TEXT NOT NULL,
      taken_at   TEXT NOT NULL,
      v1         DOUBLE PRECISION,
      v2         DOUBLE PRECISION,
      v3         DOUBLE PRECISION,
      tag        TEXT,
      remarks    TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS readings_kind_time ON readings (kind, taken_at DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS meds (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      dose       TEXT,
      slot_label TEXT NOT NULL,
      slot_time  TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date   TEXT,
      notes      TEXT,
      active     BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS doses (
      id        SERIAL PRIMARY KEY,
      med_id    INTEGER NOT NULL REFERENCES meds(id) ON DELETE CASCADE,
      dose_date TEXT NOT NULL,
      status    TEXT NOT NULL,
      marked_at TEXT NOT NULL,
      note      TEXT,
      UNIQUE (med_id, dose_date)
    )`;
  await sql`CREATE INDEX IF NOT EXISTS doses_date ON doses (dose_date)`;
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`;
}

export type Kind = "bp" | "sugar" | "spo2";

export type Reading = {
  id: number;
  kind: Kind;
  taken_at: string; // 'YYYY-MM-DD HH:MM' local wall clock
  v1: number | null;
  v2: number | null;
  v3: number | null;
  tag: string | null;
  remarks: string | null;
};

export type Med = {
  id: number;
  name: string;
  dose: string | null;
  slot_label: string;
  slot_time: string; // 'HH:MM'
  start_date: string; // 'YYYY-MM-DD'
  end_date: string | null;
  notes: string | null;
  active: boolean;
};

export type Dose = {
  id: number;
  med_id: number;
  dose_date: string;
  status: "taken" | "skipped";
  marked_at: string;
  note: string | null;
};
