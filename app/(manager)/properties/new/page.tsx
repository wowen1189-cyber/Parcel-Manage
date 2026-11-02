import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requireCompany } from "@/lib/session";
import { NewPropertyForm } from "../forms";

export const metadata = { title: "New property" };

export default async function NewPropertyPage() {
  const { supabase, company } = await requireCompany();
  const { data: entities } = await supabase.from("entity").select("id, name").eq("company_id", company.id).eq("is_manager", false).order("name");
  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/properties" className="font-semibold text-accent hover:underline">
          ← Properties
        </Link>
      </p>
      <PageHeader title="New property" subtitle="Add a building or home. Ownership splits and units come next." />
      <div className="max-w-3xl">
        <NewPropertyForm entities={(entities ?? []).filter((e) => e.name !== "Owner LLC not set yet")} />
      </div>
    </>
  );
}
