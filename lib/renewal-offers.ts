// Renewal offers (Wesley Owen, Nov 2, 2026): up to three options for the tenant to choose from in their
// portal, each at the current rent plus an increase the office sets (company default, editable per offer).
// Lease options follow the lease length rules (short-term surcharge under the minimum, yearly increase over
// 12 months). The month-to-month option adds the company's monthly fee and lasts at most a set number of
// months: a month-to-month tenancy only ends with written notice at least 30 days before the end of a monthly
// period (Fla. Stat. 83.57(3)), so the offer records the date that notice is due and the office gets a to-do.
// Nothing here changes the lease: a person applies the tenant's choice.

import { z } from "zod";
import type { BusinessRules } from "./business-rules";

export type TermChoice = { kind: "term"; months: number; start: string; endDate: string; rentCents: number; surchargeCents: number; yearlyIncreasePercent: number | null };
export type MtmChoice = { kind: "mtm"; start: string; rentCents: number; feeCents: number; maxMonths: number; lastDay: string; noticeBy: string };
export type RenewalChoice = TermChoice | MtmChoice;

export const MAX_OPTIONS = 3;

/** The new rent: current rent raised by the increase, to the cent. */
export function increasedRent(currentCents: number, percent: number): number {
  return Math.round((currentCents * (100 + percent)) / 100);
}

export function termChoice(input: { currentRentCents: number; increasePercent: number; start: string; months: number; endDate: string; rules: BusinessRules }): TermChoice {
  const surchargeCents = input.months < input.rules.lease.shortTermUnderMonths ? input.rules.lease.shortTermSurchargeCents : 0;
  return {
    kind: "term",
    months: input.months,
    start: input.start,
    endDate: input.endDate,
    rentCents: increasedRent(input.currentRentCents, input.increasePercent) + surchargeCents,
    surchargeCents,
    yearlyIncreasePercent: input.months > 12 ? input.rules.lease.longTermYearlyIncreasePercent : null,
  };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Month-to-month from `start` for at most `maxMonths` monthly periods. To end it after the last period, written
 * notice must be given at least 30 days before that period ends (Fla. Stat. 83.57(3)).
 */
export function mtmChoice(input: { currentRentCents: number; increasePercent: number; start: string; rules: BusinessRules }): MtmChoice {
  const { mtmFeeCents, mtmMaxMonths } = input.rules.renewal;
  const s = new Date(`${input.start}T00:00:00Z`);
  const last = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + mtmMaxMonths, s.getUTCDate()));
  last.setUTCDate(last.getUTCDate() - 1);
  const notice = new Date(last);
  notice.setUTCDate(notice.getUTCDate() - 30);
  return {
    kind: "mtm",
    start: input.start,
    rentCents: increasedRent(input.currentRentCents, input.increasePercent) + mtmFeeCents,
    feeCents: mtmFeeCents,
    maxMonths: mtmMaxMonths,
    lastDay: iso(last),
    noticeBy: iso(notice),
  };
}

/** The office's choices: 1–3 options, at most one month-to-month, no duplicate lengths. Returns a problem or null. */
export function checkChoices(choices: RenewalChoice[]): string | null {
  if (!choices.length) return "Add at least one option.";
  if (choices.length > MAX_OPTIONS) return `Offer at most ${MAX_OPTIONS} options.`;
  if (choices.filter((c) => c.kind === "mtm").length > 1) return "Only one month-to-month option.";
  const lengths = choices.filter((c): c is TermChoice => c.kind === "term").map((c) => c.months);
  if (new Set(lengths).size !== lengths.length) return "Two options have the same length.";
  return null;
}

export const choiceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("term"), months: z.number().int(), start: z.string(), endDate: z.string(), rentCents: z.number().int(), surchargeCents: z.number().int(), yearlyIncreasePercent: z.number().nullable() }),
  z.object({ kind: z.literal("mtm"), start: z.string(), rentCents: z.number().int(), feeCents: z.number().int(), maxMonths: z.number().int(), lastDay: z.string(), noticeBy: z.string() }),
]);

/** One line describing an option, for e-mails, the portal and to-dos. */
export function describeChoice(c: RenewalChoice, money: (cents: number) => string, date: (iso: string) => string): string {
  if (c.kind === "mtm") return `Month-to-month from ${date(c.start)}, up to ${c.maxMonths} months (through ${date(c.lastDay)}): ${money(c.rentCents)} a month, including the ${money(c.feeCents)} month-to-month fee`;
  return `${c.months}-month lease, ${date(c.start)} to ${date(c.endDate)}: ${money(c.rentCents)} a month${c.surchargeCents ? ` (includes ${money(c.surchargeCents)} short-term)` : ""}${c.yearlyIncreasePercent ? `, then +${c.yearlyIncreasePercent}% each year` : ""}`;
}
