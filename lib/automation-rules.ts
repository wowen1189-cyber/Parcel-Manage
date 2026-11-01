import { z } from "zod";

// When each automation fires. Pure date rules; lib/automations.ts does the work. Dates are YYYY-MM-DD in the
// company's time zone.

export const automationSettingsSchema = z.object({
  // Off until the company turns it on (Settings › Automations), so nothing reaches tenants before cutover.
  enabled: z.coerce.boolean(),
  rentReminders: z.coerce.boolean(),
  rentReminderDaysBefore: z.coerce.number().int().min(1).max(10),
  lateNoticeTasks: z.coerce.boolean(),
  renewalTasks: z.coerce.boolean(),
  insuranceReminders: z.coerce.boolean(),
  insuranceReminderDays: z.coerce.number().int().min(7).max(60),
  visitReminders: z.coerce.boolean(),
});
export type AutomationSettings = z.infer<typeof automationSettingsSchema>;
export const DEFAULT_AUTOMATIONS: AutomationSettings = {
  enabled: false,
  rentReminders: true,
  rentReminderDaysBefore: 3,
  lateNoticeTasks: true,
  renewalTasks: true,
  insuranceReminders: true,
  insuranceReminderDays: 30,
  visitReminders: true,
};
export function readAutomationSettings(settings: unknown): AutomationSettings {
  const stored = settings && typeof settings === "object" && "automations" in settings ? (settings as { automations: unknown }).automations : {};
  const parsed = automationSettingsSchema.safeParse({ ...DEFAULT_AUTOMATIONS, ...(stored && typeof stored === "object" ? stored : {}) });
  return parsed.success ? parsed.data : DEFAULT_AUTOMATIONS;
}

const DAY = 86_400_000;
const t = (d: string) => Date.parse(`${d}T12:00:00Z`);
export const addDays = (d: string, n: number) => new Date(t(d) + n * DAY).toISOString().slice(0, 10);
export const daysFrom = (from: string, to: string) => Math.round((t(to) - t(from)) / DAY);

/** The next rent due date on or after today. */
export function nextDueDate(today: string, dueDay: number): string {
  const [y, m, d] = today.split("-").map(Number);
  const due = (yy: number, mm: number) => new Date(Date.UTC(yy, mm - 1, dueDay, 12)).toISOString().slice(0, 10);
  return d <= dueDay ? due(y, m) : due(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1);
}

/** Rent reminder goes out exactly N days before the due date. Returns that due date, or null. */
export function rentReminderFor(today: string, dueDay: number, daysBefore: number): string | null {
  const due = nextDueDate(today, dueDay);
  return daysFrom(today, due) === daysBefore ? due : null;
}

/** From the late-fee day on, unpaid rent this month gets a 3-day notice task (Fla. Stat. 83.56(3)), drafted only. */
export function pastDueMonth(today: string, lateFeeDay: number): string | null {
  return Number(today.slice(8, 10)) >= lateFeeDay ? today.slice(0, 7) : null;
}

/**
 * Fla. Stat. 83.575(2): for liquidated damages to apply, the landlord's written pre-notice must go out
 * within 15 days before the tenant's notice period starts (notice period = noticeDays before the lease end).
 */
export function preNoticeWindow(leaseEnd: string, noticeDays: number, preDays = 15) {
  const periodStarts = addDays(leaseEnd, -noticeDays);
  return { opens: addDays(periodStarts, -preDays), lastDay: addDays(periodStarts, -1), periodStarts };
}
export function inPreNoticeWindow(today: string, leaseEnd: string, noticeDays: number, preDays = 15) {
  const w = preNoticeWindow(leaseEnd, noticeDays, preDays);
  return today >= w.opens && today <= w.lastDay;
}

/** Decide on renewal once the lease is within the company's renewal-offer lead time. */
export function renewalDecisionDue(today: string, leaseEnd: string, offerDays: number) {
  const left = daysFrom(today, leaseEnd);
  return left > 0 && left <= offerDays;
}

export function expiringWithin(today: string, expires: string | null, days: number) {
  if (!expires) return false;
  const left = daysFrom(today, expires);
  return left >= 0 && left <= days;
}
