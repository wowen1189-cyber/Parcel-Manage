import Link from "next/link";
import { buttonClass, Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { exportLink, ListFilters, param } from "@/components/list-filters";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { money, PROPERTY_TYPE_LABEL } from "@/lib/format";
import { listProperties } from "@/lib/portfolio";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Properties" };

export default async function PropertiesPage({ searchParams }: PageProps<"/properties">) {
  const { supabase, company } = await requireCompany();
  const params = await searchParams;
  const filters = { q: param(params, "q"), type: param(params, "type"), entity: param(params, "entity") };
  const [properties, { data: entities }] = await Promise.all([
    listProperties(supabase, company.id, filters),
    supabase.from("entity").select("id, name").eq("company_id", company.id).order("name"),
  ]);
  const totals = properties.reduce((t, p) => ({ units: t.units + p.units, occupied: t.occupied + p.occupied, rent: t.rent + p.rentCents }), { units: 0, occupied: 0, rent: 0 });

  return (
    <>
      <PageHeader
        title="Properties"
        subtitle="Buildings, units and who owns them."
        action={
          <Link href="/properties/new" className={buttonClass("primary", true)}>
            + New property
          </Link>
        }
      />
      <Card className="overflow-hidden">
        <ListFilters
          action="/properties"
          search={filters.q}
          searchPlaceholder="Search by name, address or owner"
          selects={[
            { name: "type", label: "Type", value: filters.type, options: Object.entries(PROPERTY_TYPE_LABEL) },
            { name: "entity", label: "Owning LLC", value: filters.entity, options: (entities ?? []).map((e) => [e.id, e.name]) },
          ]}
          exportHref={exportLink("/properties/export", filters)}
          count={properties.length}
          noun={["property", "properties"]}
        />
        {!properties.length ? (
          <EmptyState title="No properties match">Try a different search or clear the filters.</EmptyState>
        ) : (
          <Table>
            <Thead>
              <Th>Property</Th>
              <Th>Type</Th>
              <Th>Owning LLC</Th>
              <Th right>Units</Th>
              <Th right>Occupied</Th>
              <Th right>Monthly rent</Th>
            </Thead>
            <Tbody>
              {properties.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <RowLink href={`/properties/${p.id}`} sub={p.address}>
                      {p.name}
                    </RowLink>
                  </Td>
                  <Td>
                    <Pill tone={p.propertyType === "commercial" ? "info" : "neutral"}>{p.type}</Pill>
                  </Td>
                  <Td>
                    {p.entityName === "Owner LLC not set yet" ? <Pill tone="warn">Not set</Pill> : p.entityName}
                    {p.owners && <p className="text-[13px] text-subtle">{p.owners}</p>}
                  </Td>
                  <Td right>{p.units}</Td>
                  <Td right>{p.occupied}</Td>
                  <Td right>{money(p.rentCents)}</Td>
                </tr>
              ))}
              <tr className="bg-surface-muted font-semibold">
                <Td>Total</Td>
                <Td />
                <Td />
                <Td right>{totals.units}</Td>
                <Td right>{totals.occupied}</Td>
                <Td right>{money(totals.rent)}</Td>
              </tr>
            </Tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
