// Metrics (docs/04-reports-and-metrics.md › Metrics page): definitions, default targets and status.

export type MetricUnit = "percent" | "days" | "hours" | "money" | "count";
export type MetricDef = { key: string; group: string; label: string; unit: MetricUnit; better: "higher" | "lower"; target: number; explain: string };

export const METRICS: MetricDef[] = [
  { key: "occupancy", group: "Occupancy and leasing", label: "Physical occupancy", unit: "percent", better: "higher", target: 0.95, explain: "Leased units ÷ all units." },
  { key: "lead_to_lease", group: "Occupancy and leasing", label: "Lead-to-lease conversion", unit: "percent", better: "higher", target: 0.1, explain: "Signed leases ÷ new guest cards, last 12 months." },
  { key: "loss_to_lease", group: "Occupancy and leasing", label: "Rent below market", unit: "percent", better: "lower", target: 0.03, explain: "(Market rent − lease rent) ÷ market rent, leased units with a market rent." },
  { key: "delinquency", group: "Rent and collections", label: "Delinquency", unit: "percent", better: "lower", target: 0.02, explain: "Open balances of current tenants ÷ monthly scheduled rent." },
  { key: "autopay", group: "Rent and collections", label: "Autopay adoption", unit: "percent", better: "higher", target: 0.75, explain: "Current leases with autopay on ÷ current leases." },
  { key: "days_to_complete", group: "Maintenance", label: "Average days to complete", unit: "days", better: "lower", target: 3, explain: "Request to completion, work orders finished in the last 12 months." },
  { key: "emergency_response", group: "Maintenance", label: "Emergency response time", unit: "hours", better: "lower", target: 4, explain: "Request to technician on site, emergencies in the last 12 months." },
  { key: "open_work_orders", group: "Maintenance", label: "Open work orders", unit: "count", better: "lower", target: 5, explain: "Not completed or canceled." },
  { key: "self_fixed", group: "Maintenance", label: "Fixed by tenant self-check", unit: "percent", better: "higher", target: 0.15, explain: "Requests closed by 'That fixed it' ÷ requests started, last 12 months." },
  { key: "operating_cash", group: "Financial", label: "Cash in operating accounts", unit: "money", better: "higher", target: 5_000_000, explain: "Operating cash across every owner's books." },
  { key: "insurance_on_file", group: "Residents and compliance", label: "Renters insurance on file", unit: "percent", better: "higher", target: 1, explain: "Current leases with an unexpired policy ÷ current leases." },
  { key: "emergency_contact", group: "Residents and compliance", label: "Emergency contact on file", unit: "percent", better: "higher", target: 1, explain: "Tenants with at least one emergency contact ÷ tenants." },
  { key: "sms_opt_in", group: "Residents and compliance", label: "Opted in to texts", unit: "percent", better: "higher", target: 0.8, explain: "Tenants who opted in to texts ÷ tenants." },
  { key: "portal_adoption", group: "Residents and compliance", label: "Portal adoption", unit: "percent", better: "higher", target: 0.9, explain: "Tenants who have signed in to the portal ÷ tenants." },
];

export type MetricStatus = "on" | "watch" | "off" | "none";

/** On target, watch (within 10% of the target), or off target. */
export function metricStatus(value: number | null, target: number, better: "higher" | "lower"): MetricStatus {
  if (value === null || !Number.isFinite(value)) return "none";
  if (better === "higher") return value >= target ? "on" : value >= target * 0.9 ? "watch" : "off";
  return value <= target ? "on" : value <= target * 1.1 || (target === 0 && value === 0) ? "watch" : "off";
}

export function formatMetric(value: number | null, unit: MetricUnit): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (unit === "percent") return `${(value * 100).toFixed(value < 0.1 && value > 0 ? 1 : 0)}%`;
  if (unit === "days") return `${value.toFixed(1)} days`;
  if (unit === "hours") return `${value.toFixed(1)} hrs`;
  if (unit === "money") return `$${Math.round(value / 100).toLocaleString("en-US")}`;
  return String(Math.round(value));
}
