import { Button, Card, CardHeader, Notice, Pill } from "@/components/ui";
import { PROVIDERS, type Provider } from "@/lib/ai/models";
import { monthSpendCents } from "@/lib/ai/provider";
import { date, money } from "@/lib/format";
import { isAdmin, requireCompany } from "@/lib/session";
import { disconnectAi } from "./actions";
import { AiForm } from "./form";

export const metadata = { title: "AI" };

const STATUS: Record<string, { label: string; tone: "success" | "warn" | "danger" | "neutral" }> = {
  ok: { label: "Connected", tone: "success" },
  untested: { label: "Not tested", tone: "warn" },
  error: { label: "Test failed", tone: "danger" },
  paused_limit: { label: "Paused: monthly limit reached", tone: "warn" },
};

export default async function AiSettingsPage() {
  const { supabase, company, membership } = await requireCompany();
  const canEdit = isAdmin(membership);
  const { data: conn } = await supabase.from("ai_connection").select("provider, model, base_url, key_hint, monthly_limit_cents, status, tested_at").eq("company_id", company.id).maybeSingle();
  const spent = conn ? await monthSpendCents(company.id) : 0;

  return (
    <div className="max-w-3xl space-y-6">
      <Notice>
        Parcel Manage uses your company&apos;s own AI account, so you control the cost and the data agreement. Without a connection, everything still works; AI only adds
        summaries and suggestions. Your key is stored encrypted and is never shown again.
      </Notice>
      {!canEdit && <Notice>Only admins can change the AI connection.</Notice>}
      <Card>
        <CardHeader
          title="AI connection"
          description={conn ? `${PROVIDERS[conn.provider as Provider]?.label} · ${conn.model}${conn.tested_at ? ` · tested ${date(conn.tested_at.slice(0, 10))}` : ""} · ${money(spent)} of ${money(conn.monthly_limit_cents)} used this month (estimate)` : "Not connected."}
          action={conn ? <Pill tone={STATUS[conn.status]?.tone ?? "neutral"}>{STATUS[conn.status]?.label ?? conn.status}</Pill> : undefined}
        />
        <AiForm current={conn ? { provider: conn.provider as Provider, model: conn.model, base_url: conn.base_url, limit: conn.monthly_limit_cents, keyHint: conn.key_hint } : null} canEdit={canEdit} />
        {conn && canEdit && (
          <form action={disconnectAi} className="border-t border-line px-5 py-4">
            <Button type="submit" small variant="ghost">
              Disconnect AI
            </Button>
          </form>
        )}
      </Card>
      <Card className="p-5 text-[14px] text-muted">
        <p className="font-semibold text-ink">What AI does today</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Writes the technician summary on new repair requests from the triage answers (the rule-based summary is used otherwise).</li>
          <li>Never sends anything or moves money on its own. Anything with legal or money weight waits for a person.</li>
        </ul>
      </Card>
    </div>
  );
}
