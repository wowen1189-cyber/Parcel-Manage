// Work order rules: statuses, priority display, and when a vendor may enter (Fla. Stat. 83.53(2)).

import { FLORIDA_LAW, type BusinessRules } from "@/lib/business-rules";

export const WO_STATUS: Record<string, { label: string; tone: "success" | "warn" | "danger" | "info" | "neutral" }> = {
  new: { label: "New", tone: "info" },
  assigned: { label: "Vendor assigned", tone: "warn" },
  scheduled: { label: "Scheduled", tone: "success" },
  completed: { label: "Completed", tone: "neutral" },
  canceled: { label: "Canceled", tone: "neutral" },
};

export const WO_PRIORITY: Record<string, { label: string; tone: "success" | "warn" | "danger" | "info" | "neutral" }> = {
  emergency: { label: "Emergency", tone: "danger" },
  urgent: { label: "Urgent", tone: "warn" },
  routine: { label: "Routine", tone: "neutral" },
};

export const ENTRY_BASIS_LABEL: Record<string, string> = {
  notice: "24-hour notice given",
  tenant_agreed: "Tenant agreed to this time",
  emergency: "Emergency (no notice needed)",
  vacant: "Unit is vacant",
};

export const NOTICE_METHOD_LABEL: Record<string, string> = {
  posted: "Posted on the door",
  hand_delivered: "Handed to the tenant",
  email_addendum: "Emailed (tenant signed the e-mail notice addendum)",
  mail: "Mailed",
};

// ---------- time zones ----------

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return asUtc - date.getTime();
}

/** "2026-11-05T09:30" in the company's time zone → the real instant. */
export function zonedToDate(local: string, timeZone: string): Date {
  const [d, t] = local.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = (t ?? "00:00").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, day, hh, mm);
  const first = guess - tzOffsetMs(new Date(guess), timeZone);
  return new Date(guess - tzOffsetMs(new Date(first), timeZone));
}

/** An instant → "2026-11-05T09:30" in the company's time zone (for datetime inputs). */
export function dateToZoned(date: Date, timeZone: string): string {
  const shifted = new Date(date.getTime() + tzOffsetMs(date, timeZone));
  return shifted.toISOString().slice(0, 16);
}

export function formatWhen(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ---------- entry rules ----------

export type EntryCheck = { ok: true } | { ok: false; reason: string };

/**
 * Can a vendor be scheduled for [start, end]? Fla. Stat. 83.53(2): for repairs, notice at least 24 hours
 * before entry and entry between 7:30 a.m. and 8:00 p.m. (company settings may be stricter, never looser).
 * No notice or time window applies in an emergency, when the tenant agreed to the time, or in a vacant unit.
 */
export function checkEntryWindow(input: {
  start: Date;
  end: Date;
  basis: "notice" | "tenant_agreed" | "emergency" | "vacant";
  noticeGivenAt: Date | null;
  timeZone: string;
  rules: BusinessRules;
}): EntryCheck {
  const { start, end, basis, noticeGivenAt, timeZone, rules } = input;
  if (end <= start) return { ok: false, reason: "The visit has to end after it starts." };
  if (basis !== "notice") return { ok: true };

  const hours = Math.max(rules.maintenance.entryNoticeHours, FLORIDA_LAW.entryNoticeMinHours);
  if (!noticeGivenAt) return { ok: false, reason: "Record when the 24-hour entry notice was given." };
  if (start.getTime() - noticeGivenAt.getTime() < hours * 3_600_000) {
    return { ok: false, reason: `Florida law requires at least ${hours} hours' notice before entry for repairs (83.53(2)). Pick a later time, or record that the tenant agreed to this time.` };
  }
  const earliest = maxTime(rules.maintenance.entryWindowStart, FLORIDA_LAW.entryWindowEarliest);
  const latest = minTime(rules.maintenance.entryWindowEnd, FLORIDA_LAW.entryWindowLatest);
  const startClock = dateToZoned(start, timeZone).slice(11, 16);
  const endClock = dateToZoned(end, timeZone).slice(11, 16);
  if (dateToZoned(start, timeZone).slice(0, 10) !== dateToZoned(end, timeZone).slice(0, 10)) return { ok: false, reason: "Keep the visit within one day." };
  if (startClock < earliest || endClock > latest) {
    return { ok: false, reason: `Repair entry must be between ${clock(earliest)} and ${clock(latest)} (Fla. Stat. 83.53(2)), unless the tenant agrees to another time.` };
  }
  return { ok: true };
}

const maxTime = (a: string, b: string) => (a > b ? a : b);
const minTime = (a: string, b: string) => (a < b ? a : b);
function clock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "a.m." : "p.m."}`;
}

/** Earliest allowed start for a repair visit if notice is given now. */
export function earliestNoticeEntry(now: Date, rules: BusinessRules): Date {
  return new Date(now.getTime() + Math.max(rules.maintenance.entryNoticeHours, FLORIDA_LAW.entryNoticeMinHours) * 3_600_000);
}
