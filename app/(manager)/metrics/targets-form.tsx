"use client";

import { useActionState } from "react";
import { Button, Notice } from "@/components/ui";
import type { MetricDef } from "@/lib/metrics-defs";
import { saveTargets, type TargetState } from "./actions";

const empty: TargetState = {};

export function TargetsForm({ metrics }: { metrics: (MetricDef & { alert: boolean })[] }) {
  const [state, action, pending] = useActionState(saveTargets, empty);
  const shown = (m: MetricDef) => (m.unit === "percent" ? +(m.target * 100).toFixed(2) : m.unit === "money" ? m.target / 100 : m.target);
  const unit = (m: MetricDef) => (m.unit === "percent" ? "%" : m.unit === "money" ? "$" : m.unit === "count" ? "" : m.unit);
  return (
    <form action={action} className="space-y-3">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <div className="grid gap-2 sm:grid-cols-2">
        {metrics.map((m) => (
          <div key={m.key} className="flex items-center gap-3 text-[14px]">
            <label htmlFor={`t_${m.key}`} className="min-w-0 flex-1">
              {m.label} <span className="text-subtle">({m.better === "higher" ? "at least" : "at most"})</span>
            </label>
            <input id={`t_${m.key}`} name={`t_${m.key}`} defaultValue={shown(m)} inputMode="decimal" className="min-h-11 w-24 rounded-[var(--radius-control)] border border-line-strong px-2 text-right" />
            <span className="w-8 text-subtle">{unit(m)}</span>
            <label className="flex items-center gap-1 text-[12px]">
              <input type="checkbox" name={`a_${m.key}`} defaultChecked={m.alert} className="size-4" /> Alert
            </label>
          </div>
        ))}
      </div>
      <Button type="submit" small disabled={pending}>
        {pending ? "Saving…" : "Save targets"}
      </Button>
    </form>
  );
}
