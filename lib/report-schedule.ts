// When a scheduled report goes out, and which dates it covers. Pure, so it's tested.

export const FREQUENCIES: Record<string, string> = {
  daily: "Daily",
  weekly_mon: "Weekly on Monday",
  monthly_1: "Monthly on the 1st",
  monthly_5: "Monthly on the 5th",
  monthly_10: "Monthly on the 10th",
  quarterly: "Quarterly (Jan, Apr, Jul, Oct 1)",
};

export function dueOn(frequency: string, today: string): boolean {
  const d = new Date(`${today}T12:00:00Z`);
  const day = d.getUTCDate();
  if (frequency === "daily") return true;
  if (frequency === "weekly_mon") return d.getUTCDay() === 1;
  if (frequency.startsWith("monthly_")) return day === Number(frequency.slice(8));
  if (frequency === "quarterly") return day === 1 && [0, 3, 6, 9].includes(d.getUTCMonth());
  return false;
}

/** The period a send covers: the day, week or month(s) just ended. */
export function periodFor(frequency: string, today: string): { from: string; to: string } {
  const t = Date.parse(`${today}T12:00:00Z`);
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const to = iso(t - 86_400_000);
  if (frequency === "daily") return { from: to, to };
  if (frequency === "weekly_mon") return { from: iso(t - 7 * 86_400_000), to };
  const [y, m] = today.split("-").map(Number);
  const back = frequency === "quarterly" ? 3 : 1;
  const start = new Date(Date.UTC(y, m - 1 - back, 1, 12));
  const end = new Date(Date.UTC(y, m - 1, 0, 12));
  return { from: iso(start.getTime()), to: iso(end.getTime()) };
}
