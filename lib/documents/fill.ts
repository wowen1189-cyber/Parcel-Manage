// Fills a document template from one lease: tenants, unit, dates, rent and deposit come from the lease;
// fees and policies come from the template's settings (SIM REI's values until company lease settings exist);
// anything still undecided (deposit bank, owning LLC not set) is left blank so the document shows it highlighted.

import type { BusinessRules } from "@/lib/business-rules";
import { contactName, date, money, oneLineAddress, type NamedContact } from "@/lib/format";
import type { Condition, DocumentTemplate, PartyNames } from "./types";

export type LeaseForDocument = {
  start_date: string;
  end_date: string | null;
  term_months: number | null;
  rent_cents: number;
  deposit_cents: number;
  unitLabel: string;
  unitKind: string;
  property: {
    name: string;
    property_type: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    year_built: number | null;
    entityName: string | null;
  };
  people: { role: string; is_primary: boolean; contact: NamedContact & { email: string | null } }[];
  pets: { kind: string; name: string | null; is_assistance_animal: boolean }[];
  recurring: { description: string; amount_cents: number }[];
};

export type CompanyForDocument = { name: string; legal_name: string | null; address: string | null; office_phone: string | null };

const NOT_SET = "Owner LLC not set yet";

export function fillLease(template: DocumentTemplate, l: LeaseForDocument, company: CompanyForDocument, rules: BusinessRules) {
  const values: Record<string, string> = {};
  // Settings and company-wide values start from the template's SIM REI defaults.
  for (const [key, field] of Object.entries(template.fields)) {
    if (field.source === "setting" || field.fixedByLaw) values[key] = field.example;
  }

  const tenants = l.people.filter((p) => p.role === "tenant").sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const guarantors = l.people.filter((p) => p.role === "guarantor");
  const occupants = l.people.filter((p) => p.role === "occupant");
  const months = l.term_months ?? (l.end_date ? monthsBetween(l.start_date, l.end_date) : null);
  const pets = l.pets.filter((p) => !p.is_assistance_animal);
  const unitAddress =
    l.unitLabel === "Home"
      ? oneLineAddress(l.property)
      : oneLineAddress({ ...l.property, address_line2: [l.property.address_line2, `Unit ${l.unitLabel}`].filter(Boolean).join(", ") });
  const increase = rules.lease.longTermYearlyIncreasePercent;

  Object.assign(values, {
    landlord_name: l.property.entityName && l.property.entityName !== NOT_SET ? l.property.entityName : "",
    agent_name: company.legal_name ?? company.name,
    agent_address: company.address ?? "",
    property_name: l.property.name,
    unit_address: unitAddress,
    tenant_names: tenants.map((t) => contactName(t.contact)).join(", "),
    other_occupants: occupants.map((t) => contactName(t.contact)).join(", ") || "None",
    lease_start_date: date(l.start_date),
    lease_end_date: l.end_date ? date(l.end_date) : "",
    lease_term_months: months ? String(months) : "",
    monthly_rent: money(l.rent_cents),
    monthly_charges: [`Rent ${money(l.rent_cents)}`, ...l.recurring.map((c) => `${c.description} ${money(c.amount_cents)}`)].join("; "),
    security_deposit: money(l.deposit_cents),
    reduced_deposit: money(Math.round(l.deposit_cents * 0.25)),
    ld_amount: money(l.rent_cents * 2),
    end_of_term_ld_amount: money(l.rent_cents),
    pet_information: pets.map((p) => (p.name ? `${p.name} (${p.kind})` : p.kind)).join(", ") || "None",
    tenant_notice_email: tenants[0]?.contact.email ?? "",
    long_term_increase_percent: String(increase),
    year_two_rent: money(Math.round((l.rent_cents * (100 + increase)) / 100)),
  });
  // Values the template has but this lease can't know yet stay blank (shown highlighted).
  for (const key of Object.keys(template.fields)) values[key] ??= "";

  const conditions = new Set<Condition>();
  const single = l.property.property_type === "single_family";
  conditions.add(single ? "single_family" : "multi_unit");
  // SIM REI: every single-family home carries the $150 repair deductible (owner decision, Nov 1, 2026).
  if (single) {
    conditions.add("tenant_lawn_care");
    conditions.add("repair_deductible");
    values.repair_deductible_applies = "responsible";
  }
  if (pets.length) conditions.add("has_pets");
  if (l.property.year_built != null && l.property.year_built < 1978) conditions.add("pre_1978");
  if (guarantors.length) conditions.add("has_guarantor");
  if (months != null && months > 12) conditions.add("long_term");
  // SIM REI offers these today; they become company settings with the lease settings screen.
  conditions.add("llip_offered");
  conditions.add("deposit_alternative_offered");
  conditions.add("email_notices");

  const parties: PartyNames = {
    tenants: tenants.map((t) => contactName(t.contact)),
    guarantors: guarantors.map((t) => contactName(t.contact)),
    agent: [company.legal_name ?? company.name],
    landlord: [values.landlord_name],
  };
  return { values, conditions, parties, yearBuiltUnknown: l.property.year_built == null };
}

function monthsBetween(start: string, end: string) {
  const [a, b] = [new Date(start), new Date(end)];
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
}
