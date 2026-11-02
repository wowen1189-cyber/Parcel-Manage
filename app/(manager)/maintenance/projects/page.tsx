import Link from "next/link";
import { Card, CardHeader, EmptyState, PageHeader, Pill } from "@/components/ui";
import { Table, Tbody, Td, Th, Thead } from "@/components/table";
import { date, money } from "@/lib/format";
import { PROJECT_STATUS, projectTotals } from "@/lib/projects";
import { requireCompany } from "@/lib/session";
import { NewProjectForm } from "./forms";

export const metadata = { title: "Projects & purchase orders" };

export default async function ProjectsPage() {
  const { supabase, company, membership } = await requireCompany();
  const [{ data: projects }, { data: properties }] = await Promise.all([
    supabase
      .from("project")
      .select("id, name, status, budget_cents, target_on, property(name), unit(label), purchase_order(id, amount_cents, status), bill(amount_cents, status, purchase_order_id)")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false }),
    supabase.from("property").select("id, name, unit(id, label)").eq("company_id", company.id).order("name"),
  ]);
  const canEdit = ["admin", "property_manager", "maintenance", "accountant"].includes(membership.role);
  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/maintenance" className="font-semibold text-accent hover:underline">
          ← Maintenance
        </Link>
      </p>
      <PageHeader title="Projects & purchase orders" subtitle="Renovations and unit turns with a budget. Purchase orders commit spending with a vendor once approved; bills tied to them count as spent." />
      <div className="space-y-6">
        <Card className="overflow-hidden">
          {projects?.length ? (
            <Table minWidth={820}>
              <Thead>
                <Th>Project</Th>
                <Th>Status</Th>
                <Th right>Budget</Th>
                <Th right>Spent</Th>
                <Th right>Committed</Th>
                <Th right>Left</Th>
              </Thead>
              <Tbody>
                {projects.map((p) => {
                  const t = projectTotals(p.budget_cents, p.purchase_order, p.bill);
                  return (
                    <tr key={p.id}>
                      <Td>
                        <Link href={`/maintenance/projects/${p.id}`} className="font-semibold text-accent hover:underline">
                          {p.name}
                        </Link>
                        <p className="text-[13px] text-subtle">
                          {p.property.name}
                          {p.unit ? ` · ${p.unit.label}` : ""}
                          {p.target_on ? ` · finish by ${date(p.target_on)}` : ""}
                        </p>
                      </Td>
                      <Td>
                        <Pill tone={p.status === "active" ? "info" : p.status === "done" ? "success" : "neutral"}>{PROJECT_STATUS[p.status as keyof typeof PROJECT_STATUS]}</Pill>
                      </Td>
                      <Td right>{money(p.budget_cents)}</Td>
                      <Td right>{money(t.spent)}</Td>
                      <Td right>{money(t.committed)}</Td>
                      <Td right className={t.over ? "font-semibold text-danger" : ""}>
                        {money(t.left)}
                      </Td>
                    </tr>
                  );
                })}
              </Tbody>
            </Table>
          ) : (
            <EmptyState title="No projects yet">Add a renovation or unit turn below to track its budget and purchase orders.</EmptyState>
          )}
        </Card>
        {canEdit && (
          <Card>
            <CardHeader title="Add a project" />
            <NewProjectForm properties={(properties ?? []).map((p) => ({ id: p.id, name: p.name, units: p.unit.map((u) => ({ id: u.id, label: u.label })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })) }))} />
          </Card>
        )}
      </div>
    </>
  );
}
