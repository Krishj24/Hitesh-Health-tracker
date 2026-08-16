import Link from "next/link";

import DateNav from "@/components/DateNav";
import DoseList, { type DoseItem } from "@/components/DoseList";
import PageHeader from "@/components/PageHeader";
import { isValidDay, nowTime, todayStr } from "@/lib/date";
import { doseState, dosesOn, scheduledFor } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function MedsPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const today = todayStr();
  const day = isValidDay(d) ? d : today;
  const timeNow = nowTime();

  const [meds, doses] = await Promise.all([scheduledFor(day), dosesOn(day)]);

  const items: DoseItem[] = meds.map((med) => {
    const dose = doses[med.id];
    return {
      medId: med.id,
      name: med.name,
      dose: med.dose,
      slotLabel: med.slot_label,
      slotTime: med.slot_time,
      notes: med.notes,
      status: doseState(med, dose, day, today, timeNow),
      markedAt: dose?.marked_at ?? null,
      note: dose?.note ?? null,
      isSos: med.sos,
    };
  });

  const hasDolo = meds.some((m) => m.name.toLowerCase().includes("dolo"));
  const hasUltracet = meds.some((m) => m.name.toLowerCase().includes("ultracet"));

  return (
    <>
      <PageHeader
        title="Medicines"
        subtitle="Tap a medicine to mark it taken"
        action={
          <Link href="/meds/manage" className="btn-ghost px-3 py-2 text-sm">
            Edit list
          </Link>
        }
      />

      <DateNav day={day} today={today} basePath="/meds" />

      {hasDolo && hasUltracet && (
        <p className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900
                      dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Dolo already covers pain. Ultracet also contains Paracetamol — don&apos;t take both
          without the doctor&apos;s advice, to avoid overdose.
        </p>
      )}

      <DoseList items={items} day={day} />

      {items.length === 0 && (
        <Link href="/meds/manage" className="btn-primary mt-4 w-full">
          Add a medicine
        </Link>
      )}
    </>
  );
}
