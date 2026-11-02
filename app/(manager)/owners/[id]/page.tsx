import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, EmptyState, Notice, PageHeader, Pill, StatTile } from "@/components/ui";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { date, money } from "@/lib/format";
import { AGREEMENT_STATUS } from "@/lib/management-agreement";
import { describeFee, effectiveFee, FEE_SOURCE_LABEL, readCompanyFee } from "@/lib/management-fees";
import { getOwner, UNASSIGNED_OWNER } from "@/lib/owners";
import { stripeConfigured } from "@/lib/integrations/stripe/client";
import { isAdmin, requireCompany } from "@/lib/session";
import { connectOwnerStripe, refreshOwnerStripe } from "../stripe-actions";
import { createAgreement } from "../../management-agreements/actions";
import { DeleteOwnerForm, FeeForm, MovePropertiesForm, OwnerForm } from "../forms";

export async function generateMetadata({ params }: PageProps<"/owners/[id]">) {
  const { id } = await params;
  const { supabase, company } = await requireCompany();
  const { data } = await supabase.from("entity").select("name").eq("id", id).eq("company_id", company.id).maybeSingle();
  return { title: data?.name ?? "Owner" };
}

export default async function OwnerPage({ params, searchParams }: PageProps<"/owners/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, company, membership } = await requireCompany();
  const companyFee = readCompanyFee(company.settings);
  if (sp.stripe && isAdmin(membership)) await refreshOwnerStripe(id);
  const [owner, { data: others }, { data: agreements }, { data: pay }] = await Promise.all([
    getOwner(supabase, company.id, id, companyFee),
    supabase.from("property").select("id, name, entity(id, name)").eq("company_id", company.id).neq("entity_id", id).order("name"),
    supabase.from("management_agreement").select("id, status, start_date, end_date").eq("company_id", company.id).eq("entity_id", id).order("created_at", { ascending: false }),
    supabase.from("entity").select("stripe_account_id, stripe_charges_enabled").eq("id", id).eq("company_id", company.id).maybeSingle(),
  ]);
  if (!owner) notFound();

  const canEdit = ["admin", "property_manager"].includes(membership.role);
  const unassigned = owner.name === UNASSIGNED_OWNER;
  const agreement = effectiveFee(null, owner.management_fee, companyFee);
  const props = owner.properties;
  const units = props.reduce((s, p) => s + p.units, 0);
  const occupied = props.reduce((s, p) => s + p.occupied, 0);
  const rent = props.reduce((s, p) => s + p.rentCents, 0);
  const fee = props.reduce((s, p) => s + p.estFeeCents, 0);
  const candidates = (others ?? [])
    .map((p) => ({ id: p.id, name: p.name, ownerName: p.entity?.name ?? "", unassigned: p.entity?.name === UNASSIGNED_OWNER }))
    .sort((a, b) => Number(b.unassigned) - Number(a.unassigned) || a.name.localeCompare(b.name));

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/owners" className="font-semibold text-accent hover:underline">
          ← Owners
        </Link>
      </p>
      <PageHeader
        title={owner.name}
        subtitle={[owner.entity_type, owner.email, owner.phone].filter(Boolean).join(" · ") || undefined}
        action={unassigned ? <Pill tone="warn">Needs sorting</Pill> : agreement.source === "owner" ? <Pill tone="success">Own agreement</Pill> : <Pill>Company default fee</Pill>}
      />
      {sp.added && (
        <div className="mb-4">
          <Notice tone="success">Owner added. Now put their properties under them below and set the management fee.</Notice>
        </div>
      )}
      {unassigned && (
        <div className="mb-4">
          <Notice tone="warn">
            These properties were imported without their owning LLC. Open the right owner (or{" "}
            <Link href="/owners/new" className="font-semibold underline">
              add one
            </Link>
            ) and use &ldquo;Put properties under this owner&rdquo; there.
          </Notice>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Properties" value={props.length} note={`${units} units`} />
        <StatTile label="Occupancy" value={units ? `${Math.round((occupied / units) * 100)}%` : "—"} note={`${occupied} of ${units} units`} />
        <StatTile label="Monthly rent" value={money(rent)} note="Current leases" />
        <StatTile label="Est. monthly fee" value={money(fee)} note={unassigned ? "Owner not set" : describeFee(agreement.fee)} />
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Properties" description="Everything this owner owns. Each property's partners and the fee that applies to it." />
        {!props.length ? (
          <EmptyState title="No properties yet">{canEdit && !unassigned ? "Check them below to put them under this owner." : undefined}</EmptyState>
        ) : (
          <Table minWidth={860}>
            <Thead>
              <Th>Property</Th>
              <Th>Partners</Th>
              <Th right>Units</Th>
              <Th right>Monthly rent</Th>
              <Th>Fee</Th>
              <Th right>Est. monthly fee</Th>
            </Thead>
            <Tbody>
              {props.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <RowLink href={`/properties/${p.id}`} sub={p.address}>
                      {p.name}
                    </RowLink>
                  </Td>
                  <Td className="text-[13px]">{p.partners || <span className="text-subtle">—</span>}</Td>
                  <Td right>
                    {p.occupied}/{p.units}
                  </Td>
                  <Td right>{money(p.rentCents)}</Td>
                  <Td className="text-[13px]">
                    <p>{describeFee(p.fee)}</p>
                    <p className="text-subtle">{FEE_SOURCE_LABEL[p.feeSource]}</p>
                  </Td>
                  <Td right className="font-semibold">
                    {money(p.estFeeCents)}
                  </Td>
                </tr>
              ))}
              <tr className="bg-surface-muted font-semibold">
                <Td>Total</Td>
                <Td />
                <Td right>
                  {occupied}/{units}
                </Td>
                <Td right>{money(rent)}</Td>
                <Td />
                <Td right>{money(fee)}</Td>
              </tr>
            </Tbody>
          </Table>
        )}
        {canEdit && !unassigned && candidates.length > 0 && (
          <details className="border-t border-line px-5 py-4" open={!props.length}>
            <summary className="cursor-pointer text-[13px] font-semibold text-accent">+ Put properties under this owner</summary>
            <div className="mt-3">
              <MovePropertiesForm ownerId={owner.id} candidates={candidates} />
            </div>
          </details>
        )}
      </Card>

      {!unassigned && (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
          <span>
            <span className="font-semibold">Statements and distributions</span>
            <span className="block text-[13px] text-subtle">Close a month: post fees from rent collected, send the statement, record payouts.</span>
          </span>
          <Link href={`/owners/${owner.id}/statements`} className="min-h-11 rounded-[var(--radius-control)] bg-accent px-4 py-2.5 text-sm font-semibold text-white">
            Open statements
          </Link>
        </Card>
      )}
      {!unassigned && (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
          {(() => {
            const current = agreements?.find((x) => x.status === "signed") ?? agreements?.find((x) => x.status !== "ended");
            return (
              <>
                <span>
                  <span className="font-semibold">Signed management agreement</span>{" "}
                  {current ? <Pill tone={AGREEMENT_STATUS[current.status].tone}>{AGREEMENT_STATUS[current.status].label}</Pill> : <Pill tone="warn">None</Pill>}
                  <span className="block text-[13px] text-subtle">{current ? `${date(current.start_date)} – ${date(current.end_date)}` : "Prepare it from this owner's fees and send it for e-signature."}</span>
                </span>
                {current ? (
                  <Link href={`/management-agreements/${current.id}`} className="min-h-11 rounded-[var(--radius-control)] border border-line-strong px-4 py-2.5 text-sm font-semibold">
                    Open agreement
                  </Link>
                ) : canEdit ? (
                  <form action={createAgreement}>
                    <input type="hidden" name="entity_id" value={owner.id} />
                    <button type="submit" className="min-h-11 rounded-[var(--radius-control)] bg-accent px-4 py-2.5 text-sm font-semibold text-white">
                      Start agreement
                    </button>
                  </form>
                ) : null}
              </>
            );
          })()}
        </Card>
      )}
      {!unassigned && (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
          <span>
            <span className="font-semibold">Rent paid to this owner&apos;s bank</span>{" "}
            {pay?.stripe_charges_enabled ? <Pill tone="success">On</Pill> : pay?.stripe_account_id ? <Pill tone="warn">Stripe sign-up not finished</Pill> : <Pill>Off</Pill>}
            <span className="block max-w-xl text-[13px] text-subtle">
              {pay?.stripe_charges_enabled
                ? "Tenants' online payments for this owner's properties go straight to this owner's bank through Stripe."
                : pay?.stripe_account_id
                  ? "Online payments for this owner's properties are paused until Stripe approves the sign-up."
                  : "Off: online payments go to your company's Stripe account. Turn it on for owners whose rent you don't hold yourself, like your own LLCs. Managing for someone else? Keep their rent in your trust account instead (Fla. Stat. 475.25(1)(k))."}
            </span>
          </span>
          {typeof sp.stripe_error === "string" && <p className="w-full text-[13px] font-medium text-danger">Stripe couldn&apos;t start the sign-up: {sp.stripe_error}</p>}
          {isAdmin(membership) && stripeConfigured() && !pay?.stripe_charges_enabled && (
            <form action={connectOwnerStripe}>
              <input type="hidden" name="entity_id" value={owner.id} />
              <button type="submit" className="min-h-11 rounded-[var(--radius-control)] bg-accent px-4 py-2.5 text-sm font-semibold text-white">
                {pay?.stripe_account_id ? "Finish Stripe sign-up" : "Set up with Stripe"}
              </button>
            </form>
          )}
        </Card>
      )}
      {!unassigned && (
        <Card className="mt-6">
          <CardHeader title="Fees" description="The management, leasing and renewal fees you charge this owner. Every property they own uses them unless that property has its own." />
          <FeeForm scope="owner" targetId={owner.id} fee={agreement.fee} custom={agreement.source === "owner"} inheritLabel={`Use the company default (${describeFee(companyFee)})`} canEdit={canEdit} />
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader title="Owner details" description="Name on the deed and where statements go." />
        <OwnerForm canEdit={canEdit} owner={{ id: owner.id, name: owner.name, entity_type: owner.entity_type, email: owner.email, phone: owner.phone, mailing_address: owner.mailing_address, notes: owner.notes }} />
        {canEdit && !props.length && (
          <div className="border-t border-line px-5 py-4">
            <DeleteOwnerForm ownerId={owner.id} />
          </div>
        )}
      </Card>
    </>
  );
}
