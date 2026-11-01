// Reads AppFolio exports (rent roll, vendor directory) into plain records Parcel Manage can store.
// No database access here: scripts/import-appfolio.mts and the Import data screen do the writing.

// ---------- CSV ----------
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function records(text: string): Record<string, string>[] {
  const [header, ...rest] = parseCsv(text.replace(/^﻿/, ""));
  return rest.map((cells) => Object.fromEntries(header.map((h, i) => [h.trim(), (cells[i] ?? "").trim()])));
}

// ---------- values ----------
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** "1,380.50" → 138050, "-10.50" → -1050, "" → null */
export function cents(value: string): number | null {
  const v = value.replace(/[$,\s]/g, "");
  if (!v || v === "--") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** "05/01/2026" → "2026-05-01" */
export function isoDate(value: string): string | null {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

/** "2/1.00" → { beds: 2, baths: 1 }; "--/--" → nulls */
export function bedsBaths(value: string): { beds: number | null; baths: number | null } {
  const [b, ba] = value.split("/");
  const num = (s?: string) => (s && /^\d+(\.\d+)?$/.test(s) ? Number(s) : null);
  return { beds: num(b), baths: num(ba) };
}

export function wholeNumber(value: string): number | null {
  const v = value.replace(/,/g, "");
  return /^\d+$/.test(v) ? Number(v) : null;
}

export type PersonName = { first_name: string | null; last_name: string | null };

/** "Brian A. Collins" → first "Brian A.", last "Collins". "Gaff, Elaine" → first "Elaine", last "Gaff". */
export function personName(value: string): PersonName {
  const v = clean(value);
  if (!v) return { first_name: null, last_name: null };
  if (v.includes(",")) {
    const [last, first] = v.split(",").map(clean);
    return { first_name: first || null, last_name: last || null };
  }
  const parts = v.split(" ");
  if (parts.length === 1) return { first_name: parts[0], last_name: null };
  return { first_name: parts.slice(0, -1).join(" "), last_name: parts[parts.length - 1] };
}

// Cities seen in SIM REI's exports. Multi-word names must be listed so "Mt. Dora" isn't read as street "… Mt." + city "Dora".
const MULTI_WORD_CITIES = ["Mt. Dora", "Mt Dora", "Mount Dora", "City of Industry", "Carol Stream", "Winter Park", "Winter Garden", "Lady Lake", "Fruitland Park", "Grand Island", "Mount Plover"];

export type Address = { address_line1: string | null; address_line2: string | null; city: string | null; state: string | null; postal_code: string | null };

/** "117 South 12th St. Leesburg, FL 34748" → line1 "117 South 12th St.", city "Leesburg", state "FL", zip "34748" */
export function address(value: string): Address {
  const v = clean(value);
  const empty: Address = { address_line1: null, address_line2: null, city: null, state: null, postal_code: null };
  const m = v.match(/^(.*),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (!m) return v ? { ...empty, address_line1: v } : empty;
  const before = m[1];
  const multi = MULTI_WORD_CITIES.find((c) => before.toLowerCase().endsWith(` ${c.toLowerCase()}`));
  const city = multi ?? before.split(" ").pop()!;
  const street = before.slice(0, before.length - city.length).trim();
  return { address_line1: street || null, address_line2: null, city: before.slice(before.length - city.length), state: m[2], postal_code: m[3] };
}

// ---------- AppFolio tags ----------
export type LateFeeTerms = { late_fee_grace_days: number; late_fee_flat_cents: number | null; late_fee_pct: number | null };

/** "Late after 3rd day | $75" → 3 days, $75. "Late after 5th day | 10%" → 5 days, 10%. */
export function lateFeeTerms(tag: string): LateFeeTerms | null {
  const m = tag.match(/late after (\d+)\w* day\s*\|\s*(\$?)([\d.,]+)\s*(%?)/i);
  if (!m) return null;
  const amount = Number(m[3].replace(/,/g, ""));
  return m[4] === "%"
    ? { late_fee_grace_days: Number(m[1]), late_fee_flat_cents: null, late_fee_pct: amount }
    : { late_fee_grace_days: Number(m[1]), late_fee_flat_cents: Math.round(amount * 100), late_fee_pct: null };
}

export type SortedTags = { lateFee: LateFeeTerms | null; accessNotes: string[]; leaseNotes: string[]; contactTags: string[] };

/** Splits AppFolio "Tenant Tags" into late-fee terms, door codes (staff only), lease notes and tenant tags. */
export function sortTenantTags(value: string): SortedTags {
  const out: SortedTags = { lateFee: null, accessNotes: [], leaseNotes: [], contactTags: [] };
  // Tags are comma-separated, but "Parking Permit #0023 - #0029 (7)" and similar contain no commas, so a plain split is safe.
  for (const raw of value.split(",").map(clean).filter(Boolean)) {
    const fee = lateFeeTerms(raw);
    if (fee) out.lateFee = fee;
    else if (/^lease expires/i.test(raw)) continue; // stale copy of the lease end date
    else if (/key code/i.test(raw)) out.accessNotes.push(`Key code ${raw.replace(/key code/i, "").trim()}`);
    else if (/inspection photos/i.test(raw)) out.contactTags.push(raw);
    else out.leaseNotes.push(raw);
  }
  return out;
}

// ---------- rent roll ----------
export type RentRollProperty = {
  name: string;
  property_type: "single_family" | "multi_family" | "commercial";
  kind: "residential" | "commercial";
  address: Address;
  units: RentRollUnit[];
};

export type RentRollUnit = {
  label: string;
  kind: "residential" | "commercial";
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  market_rent_cents: number | null;
  status: "occupied" | "vacant" | "notice";
  amenities: string[];
  access_notes: string[];
  lease: RentRollLease | null;
};

export type RentRollLease = {
  tenant: string;
  tenantIsBusiness: boolean;
  additionalTenants: string[];
  contactTags: string[];
  rent_cents: number;
  deposit_cents: number;
  deposit_pending_cents: number;
  start_date: string;
  end_date: string | null;
  month_to_month: boolean;
  move_in_on: string | null;
  move_out_on: string | null;
  status: "active" | "notice";
  other_monthly_charges_cents: number | null;
  past_due_cents: number | null;
  nsf_count: number;
  late_count: number;
  next_rent_increase_on: string | null;
  next_rent_cents: number | null;
  lateFee: LateFeeTerms | null;
  notes: string[];
};

const PROPERTY_TYPE: Record<string, RentRollProperty["property_type"]> = {
  "Single-Family": "single_family",
  "Multi-Family": "multi_family",
  Commercial: "commercial",
};

const BUSINESS_WORDS = /\b(llc|inc|corp|company|co\.|mortgage|solutions|salon|studio|bar|cycles|art|school ?house|management|boutique)\b/i;

export function readRentRoll(text: string): RentRollProperty[] {
  const byName = new Map<string, RentRollProperty>();
  for (const r of records(text)) {
    // Group headers ("-> …"), subtotals ("4 Units") and blank lines have no Property column.
    if (!r["Property"] || !r["Status"]) continue;
    const kind = r["Property Type"] === "Commercial" ? "commercial" : "residential";
    const name = r["Property Name"] || r["Property Street Address 1"];
    let property = byName.get(name);
    if (!property) {
      const addr = address(r["Property Address"]);
      property = {
        name,
        property_type: PROPERTY_TYPE[r["Property Type"]] ?? "multi_family",
        kind,
        address: { ...addr, address_line1: r["Property Street Address 1"] || addr.address_line1, address_line2: r["Property Street Address 2"] || null },
        units: [],
      };
      byName.set(name, property);
    }

    const tags = sortTenantTags(r["Tenant Tags"]);
    const { beds, baths } = bedsBaths(r["BD/BA"]);
    const status = r["Status"].startsWith("Vacant") ? "vacant" : r["Status"].startsWith("Notice") ? "notice" : "occupied";
    const amenities = r["Amenities"] ? r["Amenities"].split(",").map(clean).filter(Boolean) : [];

    let lease: RentRollLease | null = null;
    if (r["Tenant"] && status !== "vacant") {
      const start = isoDate(r["Lease From"]) ?? isoDate(r["Move-in"]);
      const end = isoDate(r["Lease To"]);
      const monthToMonth = r["Lease Expires Month"] === "Month-To-Month";
      const notes = [...tags.leaseNotes];
      if (monthToMonth && end) notes.push(`Month-to-month since the lease ended ${r["Lease To"]}.`);
      const nsf = Number(r["NSF Count"] || 0);
      const late = Number(r["Late Count"] || 0);
      if (nsf || late) notes.push(`AppFolio history: ${late} late payment${late === 1 ? "" : "s"}, ${nsf} NSF.`);
      lease = {
        tenant: clean(r["Tenant"]),
        tenantIsBusiness: kind === "commercial" || BUSINESS_WORDS.test(r["Tenant"]),
        additionalTenants: r["Additional Tenants"] ? r["Additional Tenants"].split(",").map(clean).filter(Boolean) : [],
        contactTags: tags.contactTags,
        rent_cents: cents(r["Rent"]) ?? 0,
        deposit_cents: cents(r["Deposit"]) ?? 0,
        deposit_pending_cents: cents(r["Deposit Authorized"]) ?? 0,
        start_date: start ?? "2000-01-01",
        end_date: monthToMonth ? null : end,
        month_to_month: monthToMonth,
        move_in_on: isoDate(r["Move-in"]),
        move_out_on: isoDate(r["Move-out"]),
        status: status === "notice" ? "notice" : "active",
        other_monthly_charges_cents: cents(r["Monthly Charges"]),
        past_due_cents: cents(r["Past Due"]),
        nsf_count: nsf,
        late_count: late,
        next_rent_increase_on: isoDate(r["Next Rent Increase Date"]),
        next_rent_cents: cents(r["Next Rent Increase Amount"]),
        lateFee: tags.lateFee,
        notes,
      };
    }

    property.units.push({
      label: r["Unit"] || "Home",
      kind,
      beds: kind === "commercial" ? null : beds,
      baths: kind === "commercial" ? null : baths,
      sqft: wholeNumber(r["Sqft"]),
      market_rent_cents: cents(r["Market Rent"]),
      status,
      amenities,
      access_notes: tags.accessNotes,
      lease,
    });
  }
  return [...byName.values()];
}

// ---------- vendor directory ----------
export type VendorTrade =
  | "Plumbing" | "Electrical" | "HVAC" | "Appliance repair" | "Fire & life safety" | "Elevator" | "Pest control"
  | "Landscaping" | "Cleaning" | "Flooring & tile" | "General contractor" | "Handyman" | "Security systems"
  | "Legal" | "Bookkeeping" | "Marketing & media" | "Insurance financing" | "Utility" | "Supplies" | "Government" | "Other";

// On-site trades need a W-9 and insurance on file before they can be sent to a unit.
export const ON_SITE_TRADES: VendorTrade[] = [
  "Plumbing", "Electrical", "HVAC", "Appliance repair", "Fire & life safety", "Elevator", "Pest control",
  "Landscaping", "Cleaning", "Flooring & tile", "General contractor", "Handyman", "Security systems",
];

const TRADE_RULES: [RegExp, VendorTrade][] = [
  [/plumb/i, "Plumbing"], [/electric/i, "Electrical"], [/duct|mechanical|hvac|\bair\b/i, "HVAC"],
  [/appliance/i, "Appliance repair"], [/fire/i, "Fire & life safety"], [/elevator/i, "Elevator"],
  [/massey|pest|termite/i, "Pest control"], [/lawn|landscap/i, "Landscaping"],
  [/clean|janitor|grime/i, "Cleaning"], [/tile|floor/i, "Flooring & tile"], [/building co|construction/i, "General contractor"],
  [/property solutions|handyman/i, "Handyman"], [/aztek|reolink|security|camera/i, "Security systems"],
  [/law firm|legal|attorney/i, "Legal"], [/bookkeep|accounting|cpa/i, "Bookkeeping"], [/creative|media|photo/i, "Marketing & media"],
  [/financial services|ibex/i, "Insurance financing"], [/duke|comcast|waste management|energy|water/i, "Utility"],
  [/city of/i, "Government"], [/hardware|lowe|amazon|home depot/i, "Supplies"],
];

export function guessTrade(name: string): VendorTrade {
  return TRADE_RULES.find(([re]) => re.test(name))?.[1] ?? "Other";
}

export type Phones = { phone: string | null; mobile: string | null; extra: string[] };

/** "Office: (352) 728-1440, Fax: (352) 728-8332" → phone (352) 728-1440, extra ["Fax (352) 728-8332"] */
export function phones(value: string): Phones {
  const out: Phones = { phone: null, mobile: null, extra: [] };
  for (const part of value.split(",").map(clean).filter(Boolean)) {
    const [label, ...rest] = part.split(":");
    const number = clean(rest.join(":")) || clean(label);
    const kind = rest.length ? label.toLowerCase() : "phone";
    if (kind === "mobile" && !out.mobile) out.mobile = number;
    else if ((kind === "phone" || kind === "office") && !out.phone) out.phone = number;
    else out.extra.push(`${rest.length ? label : "Phone"} ${number}`);
  }
  return out;
}

export type DirectoryVendor = {
  kind: "person" | "business";
  business_name: string | null;
  first_name: string | null;
  last_name: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address: Address;
  trade: VendorTrade;
  payment_method: "ach" | "check" | "mailed_check" | null;
  is_1099: boolean;
  workers_comp_expires_on: string | null;
  coi_expires_on: string | null;
  epa_cert_expires_on: string | null;
  auto_insurance_expires_on: string | null;
  license_expires_on: string | null;
  contract_expires_on: string | null;
  last_paid_on: string | null;
  notes: string[];
};

const PAYMENT: Record<string, DirectoryVendor["payment_method"]> = { eCheck: "ach", Check: "check", CheckSend: "mailed_check" };

export function readVendorDirectory(text: string): DirectoryVendor[] {
  return records(text)
    .filter((r) => r["Company Name"] || r["Name"])
    .map((r) => {
      const isBusiness = Boolean(r["Company Name"]);
      const person = personName(r["Name"]);
      const p = phones(r["Phone Numbers"]);
      const rawAddress = r["Address"];
      const fixedAddress = rawAddress.replace(/\bStq\b/, "St"); // typo in AppFolio: "432 N Eustis Stq"
      const notes = [...p.extra];
      if (fixedAddress !== rawAddress) notes.push(`Address corrected on import (was "${rawAddress}").`);
      if (r["Tags"]) notes.push(`Tags: ${r["Tags"]}`);
      const contactPerson = isBusiness && r["Name"] ? [person.first_name, person.last_name].filter(Boolean).join(" ") : null;
      return {
        kind: isBusiness ? "business" : "person",
        business_name: isBusiness ? clean(r["Company Name"]) : null,
        first_name: isBusiness ? null : person.first_name,
        last_name: isBusiness ? null : person.last_name,
        contactPerson,
        email: r["Email"] || null,
        phone: p.phone,
        mobile: p.mobile,
        address: address(fixedAddress),
        trade: guessTrade(r["Company Name"] || r["Name"]),
        payment_method: PAYMENT[r["Payment Type"]] ?? null,
        is_1099: r["Send 1099?"] === "Yes",
        workers_comp_expires_on: isoDate(r["Worker's Comp. Expiration"]),
        coi_expires_on: isoDate(r["Liability Insurance Expiration"]),
        epa_cert_expires_on: isoDate(r["EPA Certification Expiration"]),
        auto_insurance_expires_on: isoDate(r["Auto Insurance Expiration"]),
        license_expires_on: isoDate(r["State License Expiration"]),
        contract_expires_on: isoDate(r["Contract Expiration"]),
        last_paid_on: isoDate(r["Last Payment Date"]),
        notes,
      } satisfies DirectoryVendor;
    });
}
