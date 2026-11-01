import Link from "next/link";
import { Card, CardHeader, EmptyState, PageHeader, Pill, buttonClass } from "@/components/ui";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { ROOT_DOMAIN } from "@/lib/env";
import { bedBath, date, money } from "@/lib/format";
import { APPLICATION_STATUS, GUEST_SOURCES, GUEST_STATUS, PIPELINE, unitName } from "@/lib/leasing";
import { requireCompany } from "@/lib/session";
import { companyUrl } from "@/lib/tenant";

export const metadata = { title: "Leasing" };

const TABS = [
  ["vacancies", "Vacancies"],
  ["guests", "Guest cards"],
  ["applicants", "Applicants"],
] as const;

export default async function LeasingPage({ searchParams }: PageProps<"/leasing">) {
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? (sp.tab as string) : "vacancies";
  const { supabase, company } = await requireCompany();
  const [{ data: units }, { data: guests }, { data: apps }] = await Promise.all([
    supabase
      .from("unit")
      .select("id, label, beds, baths, market_rent_cents, status, kind, property(name), listing(id, status, rent_cents, available_on), lease(end_date, move_out_on, status)")
      .eq("company_id", company.id)
      .in("status", ["vacant", "notice", "listed"])
      .order("label"),
    supabase.from("guest_card").select("id, first_name, last_name, email, phone, source, desired_move_in, status, created_at, unit(label, property(name))").eq("company_id", company.id).order("created_at", { ascending: false }).limit(200),
    supabase
      .from("application")
      .select("id, status, kind, decision, submitted_at, created_at, unit(label, property(name)), application_member(first_name, last_name, role, status)")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  const rentals = company.subdomain ? companyUrl(company.subdomain, ROOT_DOMAIN, "/rentals") : null;
  const counts = Object.fromEntries(PIPELINE.map((s) => [s, (apps ?? []).filter((a) => a.status === s).length]));

  return (
    <>
      <PageHeader
        title="Leasing"
        subtitle="Vacant units and their listings, prospects and applications."
        action={
          rentals ? (
            <a href={rentals} target="_blank" rel="noreferrer" className={buttonClass("secondary", true)}>
              View your rentals page
            </a>
          ) : undefined
        }
      />
      <nav aria-label="Leasing" className="mb-5 flex gap-2">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/leasing?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`min-h-11 rounded-full px-4 py-2.5 text-[14px] font-semibold ${tab === k ? "bg-accent text-white" : "border border-line-strong bg-surface hover:bg-surface-sunk"}`}>
            {label}
          </Link>
        ))}
      </nav>

      {tab === "vacancies" && (
        <Card className="overflow-hidden">
          {units?.length ? (
            <Table minWidth={760}>
              <Thead>
                <Th>Unit</Th>
                <Th>Status</Th>
                <Th>Listing</Th>
                <Th>Available</Th>
                <Th right>Asking rent</Th>
              </Thead>
              <Tbody>
                {units.map((u) => {
                  const l = u.listing;
                  const current = u.lease.find((x) => x.status === "notice" || x.status === "active");
                  return (
                    <tr key={u.id}>
                      <Td>
                        <RowLink href={`/leasing/units/${u.id}`} sub={`${bedBath(u.beds, u.baths)}${u.kind === "commercial" ? " · Commercial" : ""}`}>
                          {unitName(u)}
                        </RowLink>
                      </Td>
                      <Td>{u.status === "notice" ? <Pill tone="warn">On notice</Pill> : <Pill tone="danger">Vacant</Pill>}</Td>
                      <Td>{l ? <Pill tone={l.status === "published" ? "success" : "neutral"}>{l.status === "published" ? "Published" : l.status === "closed" ? "Closed" : "Draft"}</Pill> : <span className="text-[13px] text-subtle">Not listed</span>}</Td>
                      <Td className="text-[13px]">{date(l?.available_on ?? current?.move_out_on ?? current?.end_date ?? null, { blank: "Now" })}</Td>
                      <Td right>{money(l?.rent_cents ?? u.market_rent_cents)}</Td>
                    </tr>
                  );
                })}
              </Tbody>
            </Table>
          ) : (
            <EmptyState title="No vacancies">Every unit is occupied. Units on notice show here too.</EmptyState>
          )}
        </Card>
      )}

      {tab === "guests" && (
        <Card className="overflow-hidden">
          <CardHeader
            title="Guest cards"
            description="Everyone who asked about a rental."
            action={
              <Link href="/leasing/guests/new" className={buttonClass("primary", true)}>
                Add guest card
              </Link>
            }
          />
          {guests?.length ? (
            <Table minWidth={760}>
              <Thead>
                <Th>Prospect</Th>
                <Th>Interested in</Th>
                <Th>Source</Th>
                <Th>Move-in</Th>
                <Th>Status</Th>
              </Thead>
              <Tbody>
                {guests.map((g) => (
                  <tr key={g.id}>
                    <Td>
                      <RowLink href={`/leasing/guests/${g.id}`} sub={g.email ?? g.phone ?? ""}>
                        {`${g.first_name} ${g.last_name}`.trim()}
                      </RowLink>
                    </Td>
                    <Td className="text-[13px]">{g.unit ? unitName(g.unit) : "—"}</Td>
                    <Td className="text-[13px]">{GUEST_SOURCES[g.source] ?? g.source}</Td>
                    <Td className="text-[13px]">{date(g.desired_move_in)}</Td>
                    <Td>
                      <Pill tone={g.status === "lost" ? "neutral" : g.status === "applied" ? "success" : "info"}>{GUEST_STATUS[g.status]}</Pill>
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <EmptyState title="No guest cards yet">Inquiries from your rentals page land here automatically.</EmptyState>
          )}
        </Card>
      )}

      {tab === "applicants" && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {PIPELINE.map((s) => (
              <div key={s} className="rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-subtle">{APPLICATION_STATUS[s].label}</p>
                <p className="text-[22px] font-extrabold">{counts[s]}</p>
              </div>
            ))}
          </div>
          <Card className="overflow-hidden">
            {apps?.length ? (
              <Table minWidth={760}>
                <Thead>
                  <Th>Applicants</Th>
                  <Th>Unit</Th>
                  <Th>Submitted</Th>
                  <Th>Status</Th>
                </Thead>
                <Tbody>
                  {apps.map((a) => {
                    const people = a.application_member.filter((m) => m.role !== "guarantor");
                    const waiting = a.application_member.filter((m) => m.status === "invited").length;
                    return (
                      <tr key={a.id}>
                        <Td>
                          <RowLink href={`/leasing/applications/${a.id}`} sub={waiting && a.status !== "invited" ? `${waiting} still to apply` : a.kind === "commercial" ? "Commercial" : undefined}>
                            {people.map((m) => `${m.first_name} ${m.last_name}`.trim()).join(", ") || "Applicant"}
                          </RowLink>
                        </Td>
                        <Td className="text-[13px]">{unitName(a.unit)}</Td>
                        <Td className="text-[13px]">{date(a.submitted_at, { blank: "Not yet" })}</Td>
                        <Td>
                          <Pill tone={APPLICATION_STATUS[a.status].tone}>{APPLICATION_STATUS[a.status].label}</Pill>
                        </Td>
                      </tr>
                    );
                  })}
                </Tbody>
              </Table>
            ) : (
              <EmptyState title="No applications yet">Send an application link from a vacancy or a guest card, or share your rentals page.</EmptyState>
            )}
          </Card>
        </>
      )}
    </>
  );
}
