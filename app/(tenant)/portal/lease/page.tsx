import { Card, CardHeader, Pill } from "@/components/ui";
import { contactName, date, money } from "@/lib/format";
import { requireTenant } from "@/lib/portal";
import { removeHousehold } from "../actions";
import { EmergencyContactForm, InsuranceForm, NoticeForm, VehicleForm } from "./forms";

export const metadata = { title: "My lease" };

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export default async function MyLeasePage() {
  const { supabase, company, lease, me } = await requireTenant();
  const [{ data: vehicles }, { data: contacts }, { data: insurance }, { data: pets }] = await Promise.all([
    supabase.from("vehicle").select("id, make_model, color, tag_number, tag_state").eq("lease_id", lease.id),
    supabase.from("emergency_contact").select("id, name, relationship, phone").eq("tenant_contact_id", me.id),
    supabase.from("renters_insurance").select("id, carrier, policy_number, expires_on, status").eq("lease_id", lease.id).order("expires_on", { ascending: false }),
    supabase.from("pet").select("id, kind, name, is_assistance_animal").eq("lease_id", lease.id),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const commercial = lease.unit.kind === "commercial";
  const people = lease.lease_tenant.filter((t) => t.role !== "occupant");

  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-extrabold">My lease</h1>
      <Card className="p-5 text-[15px]">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[13px] font-semibold text-subtle">Lease</dt>
            <dd>
              {date(lease.start_date)} to {lease.end_date ? date(lease.end_date) : "month to month"}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] font-semibold text-subtle">Rent</dt>
            <dd>{money(lease.rent_cents)} a month, due on the 1st</dd>
          </div>
          <div>
            <dt className="text-[13px] font-semibold text-subtle">Security deposit</dt>
            <dd>{money(lease.deposit_cents)}</dd>
          </div>
          <div>
            <dt className="text-[13px] font-semibold text-subtle">On the lease</dt>
            <dd>{people.map((p) => contactName(p.contact)).join(", ")}</dd>
          </div>
          {pets?.length ? (
            <div>
              <dt className="text-[13px] font-semibold text-subtle">Pets</dt>
              <dd>{pets.map((p) => `${p.name ?? p.kind}${p.is_assistance_animal ? " (assistance animal)" : ""}`).join(", ")}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      {!commercial && (
        <Card>
          <CardHeader title="Renters insurance" description="Required by your lease." />
          <div className="space-y-4 px-5 py-4">
            {insurance?.map((p) => (
              <p key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
                <span>
                  {p.carrier} · {p.policy_number} · ends {date(p.expires_on)}
                </span>
                <Pill tone={p.status === "active" ? "success" : p.status === "in_review" ? "info" : "warn"}>{p.status === "in_review" ? "Being reviewed" : p.status === "active" ? "Accepted" : p.status}</Pill>
              </p>
            ))}
            <details open={!insurance?.length}>
              <summary className="cursor-pointer text-[14px] font-semibold text-accent">{insurance?.length ? "Upload a new policy" : "Upload your policy"}</summary>
              <div className="mt-3">
                <InsuranceForm holder={company.name} />
              </div>
            </details>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Vehicles" description="So we know which cars belong here." />
        <div className="space-y-3 px-5 py-4">
          {vehicles?.map((v) => (
            <form key={v.id} action={removeHousehold} className="flex items-center justify-between gap-2 text-[14px]">
              <span>
                {v.make_model}
                {v.color ? `, ${v.color}` : ""} {v.tag_number ? `· ${v.tag_state ?? ""} ${v.tag_number}` : ""}
              </span>
              <input type="hidden" name="id" value={v.id} />
              <input type="hidden" name="kind" value="vehicle" />
              <button className="min-h-10 px-2 text-[13px] font-semibold text-danger">Remove</button>
            </form>
          ))}
          <details>
            <summary className="cursor-pointer text-[14px] font-semibold text-accent">+ Add a vehicle</summary>
            <div className="mt-3">
              <VehicleForm />
            </div>
          </details>
        </div>
      </Card>

      <Card>
        <CardHeader title="Emergency contacts" description="Who we call if we can't reach you in an emergency." />
        <div className="space-y-3 px-5 py-4">
          {contacts?.map((c) => (
            <form key={c.id} action={removeHousehold} className="flex items-center justify-between gap-2 text-[14px]">
              <span>
                {c.name}
                {c.relationship ? ` (${c.relationship})` : ""} · {c.phone}
              </span>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="kind" value="emergency" />
              <button className="min-h-10 px-2 text-[13px] font-semibold text-danger">Remove</button>
            </form>
          ))}
          <details>
            <summary className="cursor-pointer text-[14px] font-semibold text-accent">+ Add a contact</summary>
            <div className="mt-3">
              <EmergencyContactForm />
            </div>
          </details>
        </div>
      </Card>

      {lease.status === "active" && (
        <Card>
          <CardHeader title="Moving out?" />
          <div className="px-5 py-4">
            <details>
              <summary className="cursor-pointer text-[14px] font-semibold text-accent">Give notice to vacate</summary>
              <div className="mt-3">
                <NoticeForm
                  minDate={addDays(today, 1)}
                  noticeText={`Your lease says how much notice to give${lease.end_date ? ` before it ends on ${date(lease.end_date)}` : ""}. The office will confirm your move-out date in writing.`}
                />
              </div>
            </details>
          </div>
        </Card>
      )}
    </div>
  );
}
