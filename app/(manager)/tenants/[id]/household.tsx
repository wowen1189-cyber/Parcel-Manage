import type { ReactNode } from "react";
import { Card, CardHeader, Pill } from "@/components/ui";
import { date, money } from "@/lib/format";
import { deleteHouseholdItem } from "../actions";
import { HouseholdItemForm, type HouseholdTable } from "../forms";

type Item = Record<string, string | number | boolean | null> & { id: string };
type Person = { id: string; name: string };

// Renters insurance, vehicles, pets and emergency contacts on a lease: each can be added, edited or removed.
export function HouseholdCard({
  leaseId,
  people,
  insurance,
  vehicles,
  pets,
  emergency,
  commercial,
  canEdit,
}: {
  leaseId: string;
  people: Person[];
  insurance: Item[];
  vehicles: Item[];
  pets: Item[];
  emergency: Item[];
  commercial: boolean;
  canEdit: boolean;
}) {
  const nameOf = (id: unknown) => people.find((p) => p.id === id)?.name ?? "";
  const common = { leaseId, people, canEdit };

  return (
    <Card>
      <CardHeader title="Household and insurance" description="Everything here can be changed. Tenants will update it from their portal too." />
      <div className="divide-y divide-line">
        <Group
          title="Renters insurance"
          table="renters_insurance"
          items={insurance}
          empty={commercial ? "Not tracked for commercial leases" : "None on file"}
          warnEmpty={!commercial}
          addLabel="Add a policy"
          render={(p) => (
            <>
              <span className="font-semibold">{String(p.carrier)}</span>
              {p.policy_number && <span className="text-subtle"> · #{String(p.policy_number)}</span>}{" "}
              <Pill tone={p.status === "active" ? "success" : "danger"}>{p.status === "active" ? `Until ${date(p.expires_on as string)}` : `Expired ${date(p.expires_on as string)}`}</Pill>
              <span className="block text-[13px] text-subtle">
                {[nameOf(p.tenant_contact_id), p.liability_cents != null && `${money(Number(p.liability_cents))} liability`, p.company_is_interested_party && "we're interested party"].filter(Boolean).join(" · ")}
              </span>
            </>
          )}
          {...common}
        />
        <Group
          title="Vehicles"
          table="vehicle"
          items={vehicles}
          empty="None on file"
          addLabel="Add a vehicle"
          render={(v) => (
            <>
              <span className="font-semibold">{[v.color, v.make_model].filter(Boolean).join(" ") || "Vehicle"}</span>
              {v.tag_number && <span> · Plate {String(v.tag_number)}{v.tag_state ? ` (${String(v.tag_state)})` : ""}</span>}
              <span className="block text-[13px] text-subtle">{[nameOf(v.tenant_contact_id), v.parking_permit_number && `Permit ${String(v.parking_permit_number)}`].filter(Boolean).join(" · ")}</span>
            </>
          )}
          {...common}
        />
        <Group
          title="Pets"
          table="pet"
          items={pets}
          empty="None on file"
          addLabel="Add a pet"
          render={(p) => (
            <>
              <span className="font-semibold">{p.name ? `${String(p.name)} (${String(p.kind)})` : String(p.kind)}</span>
              {p.weight_lbs != null && <span className="text-subtle"> · {Number(p.weight_lbs)} lbs</span>} {p.is_assistance_animal && <Pill tone="info">Assistance animal</Pill>}
              {p.notes && <span className="block text-[13px] text-subtle">{String(p.notes)}</span>}
            </>
          )}
          {...common}
        />
        <Group
          title="Emergency contacts"
          table="emergency_contact"
          items={emergency}
          empty="None on file"
          addLabel="Add an emergency contact"
          render={(e) => (
            <>
              <span className="font-semibold">{String(e.name)}</span>
              {e.relationship && <span className="text-subtle"> ({String(e.relationship)})</span>} · {String(e.phone)}
              <span className="block text-[13px] text-subtle">For {nameOf(e.tenant_contact_id)}</span>
            </>
          )}
          {...common}
        />
      </div>
    </Card>
  );
}

function Group({
  title,
  table,
  items,
  empty,
  warnEmpty,
  addLabel,
  render,
  leaseId,
  people,
  canEdit,
}: {
  title: string;
  table: HouseholdTable;
  items: Item[];
  empty: string;
  warnEmpty?: boolean;
  addLabel: string;
  render: (item: Item) => ReactNode;
  leaseId: string;
  people: Person[];
  canEdit: boolean;
}) {
  return (
    <section className="px-5 py-4 text-sm">
      <h3 className="text-[13px] font-semibold text-muted">{title}</h3>
      {items.length === 0 && <p className={`mt-1 ${warnEmpty ? "font-semibold text-warn" : "text-subtle"}`}>{empty}</p>}
      <ul className="mt-1 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <div>{render(item)}</div>
            {canEdit && (
              <details className="mt-1">
                <summary className="cursor-pointer text-[13px] font-semibold text-accent">Edit</summary>
                <div className="mt-2 rounded-[var(--radius-control)] border border-line p-3">
                  <HouseholdItemForm table={table} leaseId={leaseId} people={people} item={item} canEdit={canEdit} />
                  <form action={deleteHouseholdItem} className="mt-2 border-t border-line pt-2">
                    <input type="hidden" name="table" value={table} />
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="lease_id" value={leaseId} />
                    <button type="submit" className="min-h-9 text-[13px] font-semibold text-danger hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              </details>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[13px] font-semibold text-accent">+ {addLabel}</summary>
          <div className="mt-2 rounded-[var(--radius-control)] border border-line p-3">
            <HouseholdItemForm table={table} leaseId={leaseId} people={people} canEdit={canEdit} />
          </div>
        </details>
      )}
    </section>
  );
}
