import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Properties" };

const KIND_LABEL = { residential: "Residential", commercial: "Commercial", mixed: "Mixed-use" } as const;

export default async function PropertiesPage() {
  const { supabase, company } = await requireCompany();
  const { data: properties } = await supabase
    .from("property")
    .select("id, name, kind, address_line1, city, state, entity(name), unit(status), property_owner(ownership_pct, contact(first_name, last_name, business_name))")
    .eq("company_id", company.id)
    .order("name");

  return (
    <>
      <PageHeader title="Properties" subtitle="Buildings, units and who owns them." />
      <Card className="overflow-hidden">
        {!properties?.length ? (
          <EmptyState title="No properties yet">Adding properties arrives in Phase 1, along with CSV import.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-surface-muted text-[13px] text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Property</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Owning entity</th>
                  <th className="px-5 py-3 font-semibold">Owners</th>
                  <th className="px-5 py-3 text-right font-semibold">Units</th>
                  <th className="px-5 py-3 text-right font-semibold">Occupied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {properties.map((p) => {
                  const units = p.unit ?? [];
                  const occupied = units.filter((u) => u.status === "occupied").length;
                  return (
                    <tr key={p.id}>
                      <td className="px-5 py-3">
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-[13px] text-subtle">{[p.address_line1, p.city, p.state].filter(Boolean).join(", ")}</p>
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={p.kind === "commercial" ? "info" : "neutral"}>{KIND_LABEL[p.kind as keyof typeof KIND_LABEL]}</Pill>
                      </td>
                      <td className="px-5 py-3">{p.entity?.name}</td>
                      <td className="px-5 py-3 text-[13px]">
                        {p.property_owner
                          .map((o) => `${o.contact.business_name ?? `${o.contact.first_name ?? ""} ${o.contact.last_name ?? ""}`.trim()} ${Number(o.ownership_pct)}%`)
                          .join(" · ")}
                      </td>
                      <td className="tabular px-5 py-3 text-right">{units.length}</td>
                      <td className="tabular px-5 py-3 text-right">{occupied}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
