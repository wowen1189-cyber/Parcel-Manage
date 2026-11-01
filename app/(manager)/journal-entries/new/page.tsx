import Link from "next/link";
import { Notice, PageHeader } from "@/components/ui";
import { param } from "@/components/list-filters";
import { todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { EntryForm } from "./entry-form";

export const metadata = { title: "New journal entry" };

export default async function NewJournalEntryPage({ searchParams }: PageProps<"/journal-entries/new">) {
  const { supabase, company, membership } = await requireCompany();
  const sp = await searchParams;
  await supabase.rpc("ensure_chart_of_accounts", { p_company: company.id });
  const [{ data: owners }, { data: accounts }, { data: properties }] = await Promise.all([
    supabase.from("entity").select("id, name").eq("company_id", company.id).order("name"),
    supabase.from("gl_account").select("id, number, name").eq("company_id", company.id).order("number"),
    supabase.from("property").select("id, name, entity_id").eq("company_id", company.id).order("name"),
  ]);
  const canPost = ["admin", "accountant"].includes(membership.role);
  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/journal-entries" className="font-semibold text-accent hover:underline">
          ← Journal entries
        </Link>
      </p>
      <PageHeader title="New journal entry" subtitle="For anything that isn't a tenant charge or payment: owner contributions, corrections, bank fees, loan payments." />
      {!canPost ? (
        <Notice>Only an admin or accountant can post journal entries.</Notice>
      ) : (
        <div className="max-w-5xl">
          <EntryForm owners={owners ?? []} accounts={accounts ?? []} properties={properties ?? []} defaultOwner={param(sp, "owner") || owners?.[0]?.id || ""} today={todayIn(company.time_zone)} />
        </div>
      )}
    </>
  );
}
