// Recurring maintenance dates (lib/recurring-maintenance.ts), kept pure for tests.
export const MAINTENANCE_FREQUENCY = { monthly: "Monthly", quarterly: "Every 3 months", twice_yearly: "Twice a year", yearly: "Yearly" } as const;
const MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, twice_yearly: 6, yearly: 12 };

/** The same day of the month, `frequency` later; the 31st becomes the month's last day. */
export function nextMaintenanceDate(current: string, frequency: string): string {
  const [y, m, d] = current.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + (MONTHS[frequency] ?? 3), 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.toISOString().slice(0, 7)}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
