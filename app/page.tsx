import Link from "next/link";

import DoseList, { type DoseItem } from "@/components/DoseList";
import VitalCard from "@/components/VitalCard";
import { daysBetween, isValidDay, longDay, nowTime, todayStr } from "@/lib/date";
import {
  doseState,
  dosesOn,
  getProfile,
  getTargets,
  latestReadings,
  scheduledFor,
  unmarkedRecently,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const today = todayStr();
  const timeNow = nowTime();

  const [profile, targets, latest, meds, doses, unmarked] = await Promise.all([
    getProfile(),
    getTargets(),
    latestReadings(),
    scheduledFor(today),
    dosesOn(today),
    unmarkedRecently(3, todayStr()),
  ]);

  const items: DoseItem[] = meds.map((med) => {
    const dose = doses[med.id];
    return {
      medId: med.id,
      name: med.name,
      dose: med.dose,
      slotLabel: med.slot_label,
      slotTime: med.slot_time,
      notes: med.notes,
      status: doseState(med, dose, today, today, timeNow),
      markedAt: dose?.marked_at ?? null,
      note: dose?.note ?? null,
    };
  });

  const outstanding = items.filter((i) => i.status === "due" || i.status === "pending");
  const takenCount = items.filter((i) => i.status === "taken").length;
  const postOpDay =
    isValidDay(profile.surgeryDate) && daysBetween(profile.surgeryDate, today) >= 0
      ? daysBetween(profile.surgeryDate, today)
      : null;

  return (
    <>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {longDay(today)}
            {postOpDay !== null && ` · day ${postOpDay} after surgery`}
          </p>
        </div>
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200
                     bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <VitalCard kind="bp" reading={latest.bp} targets={targets} />
        <VitalCard kind="sugar" reading={latest.sugar} targets={targets} />
        <VitalCard kind="spo2" reading={latest.spo2} targets={targets} />
      </section>

      <Link href="/log" className="btn-primary mt-3 w-full">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        Log a reading
      </Link>

      <section className="mt-7">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">Medicines today</h2>
          <Link href="/meds" className="text-sm font-medium text-teal-600 dark:text-teal-400">
            Full checklist
          </Link>
        </div>

        {items.length > 0 && (
          <p className="mb-3 text-sm text-slate-500">
            <span className="font-semibold text-slate-700 tnum dark:text-slate-300">
              {takenCount} of {items.length}
            </span>{" "}
            marked taken
            {outstanding.length === 0 && takenCount === items.length && " — all done for today"}
          </p>
        )}

        <DoseList
          items={outstanding.length ? outstanding : items}
          day={today}
          compact
        />
      </section>

      {unmarked > 0 && (
        <Link
          href={`/meds?d=${todayStr()}`}
          className="card mt-5 flex items-center gap-3 border-amber-200 bg-amber-50 p-4
                     dark:border-amber-900 dark:bg-amber-950/40"
        >
          <span className="text-2xl" aria-hidden>
            ⚠️
          </span>
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <strong className="tnum">{unmarked} dose{unmarked === 1 ? "" : "s"}</strong> from the
            last few days were never marked. Open the checklist and switch the date to fill them in.
          </p>
        </Link>
      )}
    </>
  );
}
