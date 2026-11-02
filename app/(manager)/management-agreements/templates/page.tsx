import Link from "next/link";
import { Button, Card, CardHeader, PageHeader, Pill } from "@/components/ui";
import { defaultTemplateId } from "@/lib/agreement-templates";
import { date } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { createTemplate, setDefaultTemplate } from "./actions";
import { UploadTemplate } from "./upload";

export const metadata = { title: "Agreement templates" };

// The management agreements a company can send: Parcel Manage's Florida agreement and its own templates
// (uploaded or copied and edited). One is the default for new agreements; each draft can pick another.
export default async function AgreementTemplatesPage() {
  const { supabase, company, membership } = await requireCompany();
  const canEdit = ["admin", "property_manager"].includes(membership.role);
  const isAdmin = membership.role === "admin";
  const { data: templates } = await supabase.from("agreement_template").select("id, name, source_name, updated_at").eq("company_id", company.id).order("name");
  const preferred = defaultTemplateId(company.settings);
  const current = (templates ?? []).some((t) => t.id === preferred) ? preferred : null;
  const rows = [{ id: "", name: "Parcel Manage's Florida agreement", note: "Built for Florida law; fills in your terms and fees", href: "/management-agreements/template" }, ...(templates ?? []).map((t) => ({ id: t.id, name: t.name, note: `${t.source_name ? `From ${t.source_name} · ` : ""}Edited ${date(t.updated_at.slice(0, 10))}`, href: `/management-agreements/templates/${t.id}` }))];

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/management-agreements" className="font-semibold text-accent hover:underline">
          ← Management agreements
        </Link>
      </p>
      <PageHeader title="Agreement templates" subtitle="Use Parcel Manage's Florida agreement, upload your own, or copy ours and change the wording. Every template fills in the owner, properties, fees and your terms, and is signed online." />
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardHeader title="Templates" description="New agreements start with the default. You can pick a different one on any draft." />
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id || "builtin"} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <Link href={r.href} className="font-semibold text-accent hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-[13px] text-subtle">{r.note}</p>
                </div>
                {(r.id || null) === current ? (
                  <Pill tone="success">Default</Pill>
                ) : isAdmin ? (
                  <form action={setDefaultTemplate}>
                    <input type="hidden" name="id" value={r.id} />
                    <Button type="submit" small variant="ghost">
                      Make default
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        {canEdit && (
          <Card>
            <CardHeader title="Add a template" description="Your file becomes editable text, split into parts at its headings. Then you swap the blanks (____) for fill-in fields like the owner's name and your fees." />
            <div className="flex flex-wrap items-start gap-3 p-5">
              <UploadTemplate />
              <form action={createTemplate}>
                <input type="hidden" name="from" value="builtin" />
                <Button type="submit" variant="secondary">
                  Copy the Florida agreement to edit
                </Button>
              </form>
              <form action={createTemplate}>
                <input type="hidden" name="from" value="blank" />
                <Button type="submit" variant="ghost">
                  Start blank
                </Button>
              </form>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
