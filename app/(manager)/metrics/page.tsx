import { Card, CardHeader, Notice, PageHeader, Pill } from "@/components/ui";
import { todayIn } from "@/lib/format";
import { computeMetrics } from "@/lib/metrics";
import { METRICS, formatMetric, metricStatus } from "@/lib/metrics-defs";
import { isAdmin, requireCompany } from "@/lib/session";
import { TargetsForm } from "./targets-form";

export const metadata = { title: "Metrics" };

const TONE = { on: "success", watch: "warn", off: "danger", none: "neutral" } as const;
const LABEL = { on: "On target", watch: "Watch", off: "Off target", none: "No data yet" } as const;

export default async function MetricsPage() {
  const { supabase, company, membership } = await requireCompany();
  const today = todayIn(company.time_zone);
  const [values, { data: targets }, { data: snaps }] = await Promise.all([
    computeMetrics(supabase, company.id, today),
    supabase.from("metric_target").select("metric_key, target, alert").eq("company_id", company.id),
    supabase.from("metric_snapshot").select("metric_key, on_date, value").eq("company_id", company.id).eq("scope_key", "portfolio").gte("on_date", `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`).order("on_date"),
  ]);
  const metrics = METRICS.map((m) => {
    const t = targets?.find((x) => x.metric_key === m.key);
    const target = t ? Number(t.target) : m.target;
    const value = values[m.key];
    // One point per month: the last snapshot in each month.
    const byMonth = new Map<string, number>();
    for (const s of snaps ?? []) if (s.metric_key === m.key) byMonth.set(s.on_date.slice(0, 7), Number(s.value));
    return { ...m, target, alert: t?.alert ?? true, value, status: metricStatus(value, target, m.better), trend: [...byMonth.entries()].slice(-12) };
  });
  const red = metrics.filter((m) => m.status === "off" && m.alert);
  const groups = [...new Set(metrics.map((m) => m.group))];
  return (
    <>
      <PageHeader title="Metrics" subtitle="Live from your records, against your targets. Trends build up from daily snapshots." />
      {red.length > 0 && (
        <div className="mb-5">
          <Notice tone="danger">Off target: {red.map((m) => m.label).join(", ")}.</Notice>
        </div>
      )}
      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g}>
            <h2 className="mb-3 text-[17px] font-bold">{g}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {metrics
                .filter((m) => m.group === g)
                .map((m) => {
                  const max = Math.max(...m.trend.map(([, v]) => v), m.target, 0.0001);
                  return (
                    <Card key={m.key} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[14px] font-semibold">{m.label}</p>
                        <Pill tone={TONE[m.status]}>{LABEL[m.status]}</Pill>
                      </div>
                      <p className="mt-1 text-[28px] font-extrabold">{formatMetric(m.value, m.unit)}</p>
                      <p className="text-[12px] text-subtle">
                        Target {m.better === "higher" ? "≥" : "≤"} {formatMetric(m.target, m.unit)}
                      </p>
                      {m.trend.length > 1 && (
                        <div className="mt-3 flex h-10 items-end gap-1" aria-label={`${m.label}, last ${m.trend.length} months`}>
                          {m.trend.map(([month, v]) => (
                            <div key={month} title={`${month}: ${formatMetric(v, m.unit)}`} className="flex-1 rounded-t bg-accent/60" style={{ height: `${Math.max(4, (v / max) * 100)}%` }} />
                          ))}
                        </div>
                      )}
                      <p className="mt-2 text-[12px] text-muted">{m.explain}</p>
                    </Card>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
      {isAdmin(membership) && (
        <Card className="mt-8">
          <CardHeader title="Edit targets and alerts" description="Percents as whole numbers (95 = 95%), money in dollars." />
          <div className="px-5 py-4">
            <TargetsForm metrics={metrics.map((m) => ({ ...m }))} />
          </div>
        </Card>
      )}
    </>
  );
}
