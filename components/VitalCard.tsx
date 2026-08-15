import Link from "next/link";

import { since } from "@/lib/date";
import type { Reading } from "@/lib/db";
import { describe, KIND_LABEL, LEVEL_DOT, type Targets } from "@/lib/ranges";

export default function VitalCard({
  kind,
  reading,
  targets,
}: {
  kind: "bp" | "sugar" | "spo2";
  reading: Reading | undefined;
  targets: Targets;
}) {
  if (!reading) {
    return (
      <Link href="/log" className="card flex flex-col justify-between p-4">
        <p className="text-sm font-medium text-slate-500">{KIND_LABEL[kind]}</p>
        <p className="mt-2 text-sm text-slate-400">Not recorded yet — tap to add</p>
      </Link>
    );
  }

  const d = describe(reading, targets);

  return (
    <Link href={`/history?kind=${kind}`} className="card flex flex-col justify-between p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{KIND_LABEL[kind]}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${LEVEL_DOT[d.level]}`} aria-hidden />
      </div>
      <p className="mt-1.5 text-3xl font-bold tracking-tight tnum">{d.value}</p>
      <p className="text-xs text-slate-500">{d.unit}</p>
      <p className="mt-2 flex items-center justify-between text-xs">
        <span className="font-medium capitalize text-slate-600 dark:text-slate-400">{d.note}</span>
        <span className="text-slate-400">{since(reading.taken_at)}</span>
      </p>
    </Link>
  );
}
