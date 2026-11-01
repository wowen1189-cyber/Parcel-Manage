// Per-property lease settings: the checkboxes and blanks the office fills on SIM REI's lease, set once per
// property so every lease there fills in the same way (property.lease_settings).
//
// Florida (ch. 83, Part II):
// - 83.51(1): the landlord's repair and code duties "may be altered or modified in writing" only for a
//   single-family home or duplex, so the resident repair deductible is only allowed there.
// - 83.51(2)(a): in other buildings the landlord provides extermination, locks and keys, common areas,
//   garbage removal, heat and water "unless otherwise agreed in writing"; the lease can assign pest
//   control to the resident, so it's a setting with the statute's default.

import { z } from "zod";

export const leaseSettingsSchema = z.object({
  repairDeductible: z.enum(["resident", "none"]),
  lawnCare: z.enum(["resident", "landlord"]),
  irrigation: z.boolean(),
  pestControl: z.enum(["resident", "landlord"]),
  utilitiesIncluded: z.string().trim().max(200),
  keys: z.string().trim().max(200),
  electricProvider: z.string().trim().max(120),
  waterSewerTrash: z.string().trim().max(160),
  depositBankName: z.string().trim().max(120),
  depositBankAddress: z.string().trim().max(200),
  depositAccountType: z.enum(["", "non_interest", "interest", "surety_bond"]),
  depositInterest: z.enum(["", "not_entitled", "entitled"]),
  floodKnowledge: z.enum(["", "has", "has_no"]),
  floodClaim: z.enum(["", "has", "has_not"]),
  floodAssistance: z.enum(["", "has", "has_not"]),
  leadKnown: z.enum(["", "known", "no_knowledge"]),
  leadKnownDescription: z.string().trim().max(500),
  leadRecords: z.enum(["", "provided", "none"]),
  leadRecordsList: z.string().trim().max(500),
  // Commercial leases: Exhibit A legal description of the land (from the deed or property appraiser).
  legalDescription: z.string().trim().max(1000),
});
export type LeaseSettings = z.infer<typeof leaseSettingsSchema>;

/** Small enough for the lease to shift repair duties to the tenant (83.51(1)). */
export function allowsRepairDeductible(propertyType: string | null, unitCount: number): boolean {
  return propertyType === "single_family" || (propertyType !== "commercial" && unitCount <= 2);
}

/** Defaults by property type; SIM REI's old lease put lawn, pest and the $150 deductible on house residents. */
export function defaultLeaseSettings(propertyType: string | null, unitCount: number): LeaseSettings {
  const house = propertyType === "single_family";
  return {
    repairDeductible: house ? "resident" : "none",
    lawnCare: house ? "resident" : "landlord",
    irrigation: false,
    pestControl: allowsRepairDeductible(propertyType, unitCount) ? "resident" : "landlord",
    utilitiesIncluded: house ? "None" : "",
    keys: "Front door",
    electricProvider: "Duke Energy",
    waterSewerTrash: "",
    depositBankName: "",
    depositBankAddress: "",
    depositAccountType: "",
    depositInterest: "",
    floodKnowledge: "",
    floodClaim: "",
    floodAssistance: "",
    leadKnown: "",
    leadKnownDescription: "",
    leadRecords: "",
    leadRecordsList: "",
    legalDescription: "",
  };
}

export function readLeaseSettings(stored: unknown, propertyType: string | null, unitCount: number): LeaseSettings {
  const base = defaultLeaseSettings(propertyType, unitCount);
  const merged = { ...base, ...(stored && typeof stored === "object" ? (stored as Partial<LeaseSettings>) : {}) };
  const parsed = leaseSettingsSchema.safeParse(merged);
  const settings = parsed.success ? parsed.data : base;
  // Never let a saved setting put a repair deductible on a building the statute doesn't allow.
  if (!allowsRepairDeductible(propertyType, unitCount)) settings.repairDeductible = "none";
  return settings;
}

/** Settings that are still blank (shown as warnings, since they print as blanks on the lease). */
export function missingLeaseSettings(s: LeaseSettings, pre1978: boolean, mode: "residential" | "commercial" | "mixed" = "residential"): string[] {
  const missing: string[] = [];
  if (mode !== "residential" && !s.legalDescription) missing.push("legal description");
  if (mode === "commercial") {
    if (!s.depositBankName || !s.depositBankAddress) missing.push("where deposits are held");
    return missing;
  }
  if (!s.depositBankName || !s.depositBankAddress || !s.depositAccountType || !s.depositInterest) missing.push("where deposits are held");
  if (!s.floodKnowledge || !s.floodClaim || !s.floodAssistance) missing.push("flood disclosure answers");
  if (pre1978 && (!s.leadKnown || !s.leadRecords)) missing.push("lead paint answers");
  if (!s.utilitiesIncluded) missing.push("utilities included");
  return missing;
}
