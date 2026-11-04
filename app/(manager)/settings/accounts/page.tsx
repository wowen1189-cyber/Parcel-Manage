import { Card, CardHeader, Notice, Pill } from "@/components/ui";
import { loadAccounts, TYPE_LABEL, type Account, type AccountType } from "@/lib/accounts";
import { requireCompany } from "@/lib/session";
import { AccountForm, EditAccount } from "./form";

export const metadata = { title: "Chart of accounts" };

export default async function AccountsSettingsPage() {
  const { supabase, company, membership } = await requireCompany();
  const canEdit = ["admin", "accountant"].includes(membership.role);
  const accounts = await loadAccounts(supabase, company.id);
  const byType = new Map<AccountType, Map<string, Account[]>>();
  for (const a of accounts) {
    const sections = byType.get(a.type) ?? new Map<string, Account[]>();
    sections.set(a.section, [...(sections.get(a.section) ?? []), a]);
    byType.set(a.type, sections);
  }
  return (
    <div className="max-w-4xl space-y-6">
      <Card>
        <CardHeader title="Chart of accounts" description="The accounts every owner's books use. Bills, owner expenses and journal entries choose from this list, and the Schedule E report uses each account's tax line." />
        <div className="space-y-3 px-5 py-4 text-[13px]">
          <p>Numbers can&apos;t change once an account exists, so past entries never move. Rename an account or hide one you don&apos;t use; hidden accounts keep their history.</p>
          {!canEdit && <Notice>Only an admin or accountant can change the chart of accounts.</Notice>}
        </div>
      </Card>
      {canEdit && (
        <Card>
          <CardHeader title="Add an account" />
          <div className="px-5 py-4">
            <AccountForm />
          </div>
        </Card>
      )}
      {[...byType].map(([type, sections]) => (
        <Card key={type}>
          <CardHeader title={TYPE_LABEL[type]} />
          {[...sections].map(([section, list]) => (
            <div key={section} className="border-t border-line first:border-t-0">
              <h3 className="bg-surface-muted px-5 py-2 text-[13px] font-semibold text-ink-2">{section}</h3>
              <ul className="divide-y divide-line">
                {list.map((a) => (
                  <li key={a.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2 text-sm ${a.active ? "" : "text-subtle"}`}>
                    <span className="w-12 shrink-0 font-semibold tabular-nums">{a.number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block">{a.name}</span>
                      {a.tax_line && <span className="block text-[13px] text-subtle">Schedule E {a.tax_line.replace(/^Line /, "line ")}</span>}
                    </span>
                    {a.is_trust && <Pill tone="info">Trust</Pill>}
                    {a.system && <Pill>Built in</Pill>}
                    {!a.active && <Pill tone="warn">Hidden</Pill>}
                    {canEdit && <EditAccount account={a} />}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
