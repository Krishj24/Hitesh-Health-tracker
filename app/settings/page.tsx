import Link from "next/link";

import PageHeader from "@/components/PageHeader";
import { ProfileForm, TargetsForm } from "@/components/SettingsForms";
import { TZ } from "@/lib/date";
import { getProfile, getTargets } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [profile, targets] = await Promise.all([getProfile(), getTargets()]);

  return (
    <>
      <PageHeader title="Settings" back={{ href: "/", label: "Today" }} />

      <div className="space-y-4">
        <ProfileForm name={profile.name} surgeryDate={profile.surgeryDate} />
        <TargetsForm targets={targets} />

        <div className="card space-y-3 p-4 text-sm">
          <p className="font-semibold">Your data</p>
          <p className="text-slate-500">
            Everything is stored in the Postgres database attached to this deployment, so every
            phone, tablet and computer that opens this link sees the same records.
          </p>
          <p className="text-slate-500">
            Times are recorded in <strong>{TZ}</strong>. Change it by setting the{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">
              NEXT_PUBLIC_APP_TZ
            </code>{" "}
            environment variable in Vercel.
          </p>
          <Link href="/api/export" prefetch={false} className="btn-ghost w-full">
            Download everything as CSV
          </Link>
        </div>

        <div className="card p-4 text-sm">
          <p className="font-semibold">A note on the colours</p>
          <p className="mt-1 text-slate-500">
            Green, amber and red here are a prompt to look closer, never a diagnosis. This app
            records what happened; it does not decide what to do about it. If a reading looks
            wrong — or something feels wrong regardless of the numbers — call the doctor.
          </p>
        </div>
      </div>
    </>
  );
}
