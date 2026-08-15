import LogForm from "@/components/LogForm";
import PageHeader from "@/components/PageHeader";
import { nowStamp } from "@/lib/date";
import { getTargets } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const targets = await getTargets();

  return (
    <>
      <PageHeader title="Log a reading" subtitle="Record everything from one sitting at once" />
      <LogForm targets={targets} defaultStamp={nowStamp()} />
    </>
  );
}
