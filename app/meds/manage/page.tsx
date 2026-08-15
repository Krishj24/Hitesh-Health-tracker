import MedManager from "@/components/MedManager";
import PageHeader from "@/components/PageHeader";
import { allMeds } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ManageMedsPage() {
  const meds = await allMeds();

  return (
    <>
      <PageHeader
        title="Medicine list"
        subtitle="Changes here apply to today onward"
        back={{ href: "/meds", label: "Checklist" }}
      />
      <MedManager meds={meds} />
    </>
  );
}
