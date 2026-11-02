// Document templates (leases, addenda, disclosures) as structured content, so the app can fill them in
// from a lease, show signature / initial / date areas, and point out clauses changed for Florida law.
//
// Text may contain merge fields written {{field_name}} (see TemplateField) and **bold** spans.
// Nothing else is markup: no HTML.

export type Party = "tenants" | "guarantors" | "landlord" | "agent" | "owner";

export type Block =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  /** Statutory text that must appear word for word (e.g. the 83.49(2)(d) deposit disclosure). Printed in capitals as given. */
  | { kind: "statutory"; text: string; cite: string }
  | { kind: "table"; head: string[]; rows: string[][] }
  /**
   * Check-one (or check-any) boxes. `setBy: "landlord"` means the office fills it in when preparing the lease
   * (from a setting or per lease); `setBy: "tenant"` means the tenant marks it while signing (e.g. the
   * liquidated damages choice). `field` names the merge field / setting that pre-selects an option.
   */
  | { kind: "choice"; id: string; prompt?: string; options: { id: string; text: string }[]; multiple?: boolean; setBy: "landlord" | "tenant"; field?: string }
  /** A blank the office fills in per lease (e.g. "List documents"). */
  | { kind: "blank"; id: string; label: string; lines?: number }
  /** Initials from each party listed (default: tenants). */
  | { kind: "initials"; parties?: Party[]; label?: string }
  /** Signature + printed name + date for each party listed. */
  | { kind: "signatures"; parties: Party[]; label?: string };

/** Why a clause differs from SIM REI's AppFolio lease. Shown to staff in review mode, never printed for tenants. */
export type Change = {
  /** Finding id from docs/reference/lease-review-2026-11.md, e.g. "F12". */
  finding: string;
  /** Statute section, e.g. "Fla. Stat. 83.53(2)". */
  cite: string;
  /** One or two plain sentences: what changed and why. */
  summary: string;
  /** Short quote of the old wording. */
  before?: string;
  severity: "must" | "attorney" | "disclosure" | "cleanup";
};

/** When a section or clause applies. All listed conditions must hold. */
export type Condition =
  | "single_family"
  | "multi_unit"
  | "has_pets"
  | "pre_1978"
  | "deposit_alternative_offered"
  | "repair_deductible"
  | "tenant_lawn_care"
  | "has_guarantor"
  | "email_notices"
  /** Property setting: the resident handles pest control (otherwise the landlord does, 83.51(2)(a)). */
  | "resident_pest_control"
  | "landlord_pest_control"
  /** Property setting: the home has an irrigation system. */
  | "irrigation"
  /** The lease runs longer than 12 months. */
  | "long_term"
  /** Management agreement: powers the owner grants, and whether the term renews on its own. */
  | "pma_leasing"
  | "pma_evictions"
  | "pma_contractors"
  | "pma_disbursements"
  | "pma_auto_renew";

export type Clause = { id: string; number?: string; title?: string; blocks: Block[]; changes?: Change[]; when?: Condition[] };

export type Section = {
  id: string;
  number?: string;
  title: string;
  clauses: Clause[];
  when?: Condition[];
  /** Ends with tenant initials, like the AppFolio lease. */
  initials?: boolean;
  /** A separate document that needs its own signatures (e.g. the 83.595 addendum, the 83.505 e-mail addendum). */
  standalone?: boolean;
};

export type TemplateField = {
  label: string;
  /** Where the value comes from when a lease is filled in. */
  source: "lease" | "unit" | "property" | "company" | "setting" | "computed";
  /** Shown in previews and as the default for settings. Use SIM REI's current value where it's a setting. */
  example: string;
  /** If true, the statute fixes this value; it is not a setting the company can change. */
  fixedByLaw?: string;
};

export type DocumentTemplate = {
  id: string;
  title: string;
  version: string;
  /** e.g. "Residential (Fla. Stat. ch. 83 Part II)" */
  appliesTo: string;
  sections: Section[];
  fields: Record<string, TemplateField>;
};

/** Names printed under signature and initial lines, per party. */
export type PartyNames = Partial<Record<Party, string[]>>;
