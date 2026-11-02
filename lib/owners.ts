import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { contactName, oneLineAddress } from "@/lib/format";
import { effectiveFee, monthlyFee, type FeeSource, type ManagementFee } from "@/lib/management-fees";

// Owners (entity rows): the LLC or person on title. Every property belongs to exactly one owner,
// so an owner's properties are always listed together. Shared by the owner list, owner page and export.

type Db = SupabaseClient<Database>;

/** Placeholder owner the AppFolio import used for properties whose LLC wasn't known yet. */
export const UNASSIGNED_OWNER = "Owner LLC not set yet";

export type OwnerProperty = {
  id: string;
  name: string;
  address: string;
  units: number;
  occupied: number;
  rentCents: number;
  fee: ManagementFee;
  feeSource: FeeSource;
  // Estimate: this month's fee if every current tenant pays in full.
  estFeeCents: number;
  partners: string;
};

const PROPERTY_FIELDS =
  "id, name, address_line1, address_line2, city, state, postal_code, management_fee, unit(status, lease(rent_cents, status)), property_owner(ownership_pct, contact(first_name, last_name, business_name))";

type PropertyRow = {
  id: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  management_fee: unknown;
  unit: { status: string; lease: { rent_cents: number; status: string }[] }[];
  property_owner: { ownership_pct: number; contact: { first_name: string | null; last_name: string | null; business_name: string | null } | null }[];
};

export function summarizeProperty(p: PropertyRow, ownerFee: unknown, companyFee: ManagementFee): OwnerProperty {
  const units = p.unit ?? [];
  const occupied = units.filter((u) => u.status === "occupied" || u.status === "notice").length;
  const rentCents = units.reduce((s, u) => s + (u.lease ?? []).filter((l) => l.status === "active" || l.status === "notice").reduce((a, l) => a + l.rent_cents, 0), 0);
  const { fee, source } = effectiveFee(p.management_fee, ownerFee, companyFee);
  return {
    id: p.id,
    name: p.name,
    address: oneLineAddress(p),
    units: units.length,
    occupied,
    rentCents,
    fee,
    feeSource: source,
    estFeeCents: monthlyFee(fee, rentCents, occupied),
    partners: p.property_owner.map((o) => `${contactName(o.contact)} ${Number(o.ownership_pct)}%`).join(" · "),
  };
}

export async function listOwners(supabase: Db, companyId: string, companyFee: ManagementFee, q = "") {
  const { data, error } = await supabase
    .from("entity")
    .select(`id, name, entity_type, email, phone, management_fee, books_mode, property(${PROPERTY_FIELDS})`)
    .eq("company_id", companyId)
    // The management company's own books (Fee billing) aren't an owner.
    .eq("is_manager", false)
    .order("name");
  if (error) throw error;
  const needle = q.trim().toLowerCase();
  return (data ?? [])
    .map((e) => {
      const properties = (e.property as unknown as PropertyRow[]).map((p) => summarizeProperty(p, e.management_fee, companyFee)).sort((a, b) => a.name.localeCompare(b.name));
      const agreement = effectiveFee(null, e.management_fee, companyFee);
      return {
        id: e.id,
        name: e.name,
        type: e.entity_type,
        email: e.email,
        phone: e.phone,
        booksMode: e.books_mode,
        unassigned: e.name === UNASSIGNED_OWNER,
        fee: agreement.fee,
        hasOwnFee: agreement.source === "owner",
        properties,
        units: properties.reduce((s, p) => s + p.units, 0),
        occupied: properties.reduce((s, p) => s + p.occupied, 0),
        rentCents: properties.reduce((s, p) => s + p.rentCents, 0),
        estFeeCents: properties.reduce((s, p) => s + p.estFeeCents, 0),
      };
    })
    .filter((o) => !needle || `${o.name} ${o.email ?? ""} ${o.properties.map((p) => `${p.name} ${p.address} ${p.partners}`).join(" ")}`.toLowerCase().includes(needle));
}

export async function getOwner(supabase: Db, companyId: string, id: string, companyFee: ManagementFee) {
  const { data } = await supabase
    .from("entity")
    .select(`*, property(${PROPERTY_FIELDS})`)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!data) return null;
  const properties = (data.property as unknown as PropertyRow[]).map((p) => summarizeProperty(p, data.management_fee, companyFee)).sort((a, b) => a.name.localeCompare(b.name));
  return { ...data, properties };
}
