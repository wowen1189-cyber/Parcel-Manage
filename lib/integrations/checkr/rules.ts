// Checkr Tenant screening (docs/reference/checkr-tenant-api-v1.yaml), the parts kept pure for tests: the
// webhook signature check, the order request, and turning a report into Parcel Manage's screening result.
// A report only fills in the facts; the company's written criteria make a suggestion and a person decides
// (CLAUDE.md rule 4). "consider" means a person reviews it, never an automatic decline. Applicant details are
// never logged: only Checkr's ids (ord_…, rp_…, evt_…).

import { createHmac, timingSafeEqual } from "node:crypto";
import type { ScreeningResult } from "@/lib/screening";

export const CHECKR_API_VERSION = "2026-04-29";
export const CHECKR_PACKAGES = ["starter", "essential", "complete"] as const;
export type CheckrPackage = (typeof CHECKR_PACKAGES)[number];

/** Tenant-Signature: "t=<unix ts>,v1=<hex HMAC-SHA256 of `${t}.${raw body}`>", within `toleranceSec` of now. */
export function verifyTenantSignature(raw: string, header: string | null, secret: string | undefined, now = Date.now(), toleranceSec = 300): boolean {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.trim().split("=") as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1 || !/^[0-9a-f]+$/i.test(v1) || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${raw}`).digest();
  const got = Buffer.from(v1, "hex");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

type Address = { street: string; unit?: string | null; city: string; state: string; zipcode: string };

/**
 * The order: the applicant (name and e-mail only; Checkr collects date of birth and SSN from the applicant
 * directly), the rental address, and the company the report is for. Parcel Manage orders on behalf of each
 * property company, so the company is named as the original requester. The ordering account pays (no payer).
 */
export function orderBody(input: { pkg: CheckrPackage; applicant: { first_name: string; last_name: string; email: string }; property: Address & { name?: string | null }; company: { id: string; name: string; email?: string | null } }) {
  return {
    order: {
      package: input.pkg,
      applicant: { first_name: input.applicant.first_name, last_name: input.applicant.last_name, email: input.applicant.email },
      property: { name: input.property.name ?? null, street: input.property.street, ...(input.property.unit ? { unit: input.property.unit } : {}), city: input.property.city, state: input.property.state, zipcode: input.property.zipcode },
      original_requester: { external_id: input.company.id, type: "business", name: input.company.name, ...(input.company.email ? { email: input.company.email } : {}) },
    },
  };
}

type Product = { status?: "clear" | "consider" | null } | null | undefined;
export type CheckrReport = {
  id: string;
  credit_report?: (Product & { credit_score?: number | null; credit_file_status?: string | null; collections?: { records?: { classification?: string | null; balance_cents?: number | null }[] } | null }) | null;
  eviction_history?: (Product & { records?: { file_date?: string | null; judgment_date?: string | null; judgment_amount_cents?: number | null }[] }) | null;
  criminal_history?: (Product & { records?: unknown[] }) | null;
  sex_offender_registry?: Product;
  global_watchlist?: Product;
};

const yearsBetween = (from: string, to: string) => Math.max(0, (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / (365.25 * 86_400_000));

/**
 * The facts Parcel Manage's criteria use, from a report, plus what a person should look at. Collections from a
 * landlord count as money owed to a landlord; utility, phone/cable and car collections as utility or car
 * problems; any criminal, sex offender or watchlist result marked "consider" as records to review.
 */
export function reportToScreening(report: CheckrReport, today: string): { result: ScreeningResult; notes: string[] } {
  const notes: string[] = [];
  const collections = report.credit_report?.collections?.records ?? [];
  const evictions = report.eviction_history?.records ?? [];
  const latest = evictions.map((e) => e.judgment_date ?? e.file_date).filter((d): d is string => Boolean(d)).sort().at(-1) ?? null;
  const unpaidJudgment = evictions.some((e) => (e.judgment_amount_cents ?? 0) > 0);
  if (report.credit_report && report.credit_report.credit_score == null) notes.push("No credit score on file (thin or unavailable file): no minimum score is required.");
  if (evictions.length && !latest) notes.push("Eviction records have no dates: read the report.");
  if (unpaidJudgment) notes.push("An eviction judgment shows money owed: check whether it was paid.");
  const flagged = (["criminal_history", "sex_offender_registry", "global_watchlist"] as const).filter((k) => report[k]?.status === "consider");
  if (flagged.length) notes.push(`Marked "consider" (review the report before deciding): ${flagged.map((k) => k.replace(/_/g, " ")).join(", ")}.`);
  return {
    result: {
      creditScore: report.credit_report?.credit_score ?? null,
      evictionYearsAgo: latest ? Math.round(yearsBetween(latest, today) * 10) / 10 : null,
      owesLandlord: unpaidJudgment || collections.some((c) => c.classification === "rental_leasing"),
      utilityOrCarProblems: collections.some((c) => ["utilities", "cable_cellular", "automotive"].includes(c.classification ?? "")),
      criminalRecords: flagged.length > 0 || (report.criminal_history?.records?.length ?? 0) > 0,
    },
    notes,
  };
}

/** Errors worth retrying: server errors, rate limits and network failures. Never 401/402/403/404/422. */
export const retryable = (status: number) => status >= 500 || status === 429;
