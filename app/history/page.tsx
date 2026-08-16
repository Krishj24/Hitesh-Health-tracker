import Link from "next/link";

import PageHeader from "@/components/PageHeader";
import ReadingList from "@/components/ReadingList";
import { addDays, shortDay, todayStr } from "@/lib/date";
import type { Kind, Reading } from "@/lib/db";
import { adherence, getTargets, readingsSince } from "@/lib/queries";
import { describe, KIND_COLOR, KIND_LABEL, type Targets } from "@/lib/ranges";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90];
const KINDS: (Kind | "all")[] = ["all", "bp", "sugar", "spo2"];

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; range?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab === "meds" ? "meds" : "readings";
  const range = RANGES.includes(Number(params.range)) ? Number(params.range) : 7;
  const kind = (KINDS.includes(params.kind as Kind) ? params.kind : "all") as Kind | "all";

  const today = todayStr();
  const from = addDays(today, -(range - 1));

  const [targets, readings, med] = await Promise.all([
    getTargets(),
    readingsSince(from, kind === "all" ? undefined : kind),
    adherence(range, today),
  ]);

  return (
    <>
      <PageHeader
        title="History"
        subtitle={`${shortDay(from)} — ${shortDay(today)}`}
        action={
          <Link href="/api/export" className="btn-ghost px-3 py-2 text-sm" prefetch={false}>
            Export
          </Link>
        }
      />

      <div className="mb-4 flex gap-2">
        <Tab href={`/history?tab=readings&range=${range}`} active={tab === "readings"}>
          Readings
        </Tab>
        <Tab href={`/history?tab=meds&range=${range}`} active={tab === "meds"}>
          Medicines
        </Tab>
      </div>

      <div className="mb-4 flex gap-2">
        {RANGES.map((r) => (
          <Chip key={r} href={`/history?tab=${tab}&range=${r}&kind=${kind}`} active={range === r}>
            {r} days
          </Chip>
        ))}
      </div>

      {tab === "readings" ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <Chip
                key={k}
                href={`/history?tab=readings&range=${range}&kind=${k}`}
                active={kind === k}
                activeClass={k === "all" ? undefined : `${KIND_COLOR[k].dot} text-white`}
              >
                {k !== "all" && (
                  <span className={`h-2 w-2 rounded-full ${KIND_COLOR[k].dot}`} aria-hidden />
                )}
                {k === "all" ? "Everything" : KIND_LABEL[k]}
              </Chip>
            ))}
          </div>

          <Averages readings={readings} targets={targets} />
          <ReadingList
            readings={readings}
            targets={targets}
            today={today}
          />
        </>
      ) : (
        <Adherence data={med} />
      )}
    </>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition ${
        active
          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
          : "border border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      }`}
    >
      {children}
    </Link>
  );
}

function Chip({
  href,
  active,
  activeClass,
  children,
}: {
  href: string;
  active: boolean;
  activeClass?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active
          ? (activeClass ?? "bg-teal-600 text-white")
          : "border border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      }`}
    >
      {children}
    </Link>
  );
}

function Averages({ readings, targets }: { readings: Reading[]; targets: Targets }) {
  const bp = readings.filter((r) => r.kind === "bp");
  const spo2 = readings.filter((r) => r.kind === "spo2");
  const flagged = readings.filter((r) => describe(r, targets).level !== "ok").length;

  const stats: { label: string; value: string; sub: string; kind: Kind }[] = [];
  if (bp.length) {
    stats.push({
      label: "Average BP",
      value: `${avg(bp.map((r) => r.v1))}/${avg(bp.map((r) => r.v2))}`,
      sub: `${bp.length} reading${bp.length === 1 ? "" : "s"}`,
      kind: "bp",
    });
  }
  for (const tag of ["fasting", "post-meal", "random"]) {
    const rows = readings.filter((r) => r.kind === "sugar" && r.tag === tag);
    if (rows.length) {
      stats.push({
        label: `Sugar · ${tag}`,
        value: `${avg(rows.map((r) => r.v1))}`,
        sub: `mg/dL · ${rows.length} reading${rows.length === 1 ? "" : "s"}`,
        kind: "sugar",
      });
    }
  }
  if (spo2.length) {
    stats.push({
      label: "Average SpO₂",
      value: `${avg(spo2.map((r) => r.v1))}%`,
      sub: `lowest ${Math.min(...spo2.map((r) => r.v1 ?? 100))}%`,
      kind: "spo2",
    });
  }
  if (!stats.length) return null;

  return (
    <section className="mb-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className={`card border-l-4 p-3 ${KIND_COLOR[s.kind].borderL}`}>
            <p className={`text-xs font-medium ${KIND_COLOR[s.kind].text}`}>{s.label}</p>
            <p className="mt-1 text-2xl font-bold tnum">{s.value}</p>
            <p className="text-xs text-slate-400">{s.sub}</p>
          </div>
        ))}
      </div>
      {flagged > 0 && (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
          {flagged} of {readings.length} readings fell outside your target bands.
        </p>
      )}
    </section>
  );
}

function avg(values: (number | null)[]): number {
  const nums = values.filter((v): v is number => v != null);
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
}

function Adherence({ data }: { data: Awaited<ReturnType<typeof adherence>> }) {
  if (!data.totalScheduled) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm
                    text-slate-500 dark:border-slate-700">
        No medicines were scheduled in this period.
      </p>
    );
  }
  const pct = Math.round((data.totalTaken / data.totalScheduled) * 100);

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <p className="text-sm text-slate-500">Doses marked taken</p>
        <p className="mt-1 text-3xl font-bold tnum">
          {pct}%
          <span className="ml-2 text-base font-normal text-slate-500">
            {data.totalTaken} of {data.totalScheduled}
          </span>
        </p>
      </div>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Per medicine
        </h3>
        <ul className="space-y-2">
          {data.perMed.map((m) => {
            const p = Math.round((m.taken / m.scheduled) * 100);
            return (
              <li key={m.id} className="card p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-semibold">{m.name}</p>
                  <p className="shrink-0 text-sm font-semibold tnum">{p}%</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full ${
                      p >= 90 ? "bg-emerald-500" : p >= 60 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                    style={{ width: `${p}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500 tnum">
                  {m.taken} of {m.scheduled} doses
                  {m.unmarked > 0 && ` · ${m.unmarked} never marked`}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Day by day
        </h3>
        <ul className="card divide-y divide-slate-100 dark:divide-slate-800">
          {[...data.days].reverse().map((d) => {
            const p = Math.round((d.taken / d.scheduled) * 100);
            return (
              <li key={d.day} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <span className="w-16 shrink-0 text-slate-500">{shortDay(d.day)}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <span
                    className={`block h-full rounded-full ${
                      p >= 90 ? "bg-emerald-500" : p >= 60 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                    style={{ width: `${p}%` }}
                  />
                </span>
                <span className="w-12 shrink-0 text-right tnum text-slate-500">
                  {d.taken}/{d.scheduled}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
