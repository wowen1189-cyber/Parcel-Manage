import { Card, CardHeader, EmptyState, Notice, Pill } from "@/components/ui";
import { Table, Tbody, Td, Th, Thead } from "@/components/table";
import { API_SCOPES, type ApiScope } from "@/lib/api/scopes";
import { ROOT_DOMAIN } from "@/lib/env";
import { date } from "@/lib/format";
import { isAdmin, requireCompany } from "@/lib/session";
import { revokeApiKey } from "./actions";
import { NewKeyForm } from "./forms";

export const metadata = { title: "API" };

export default async function ApiSettingsPage() {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership)) return <Notice>Only admins can manage API keys.</Notice>;
  const { data: keys } = await supabase.from("api_key").select("id, name, prefix, scopes, created_at, last_used_at, revoked_at").eq("company_id", company.id).order("created_at", { ascending: false });
  const base = `https://${ROOT_DOMAIN}`;
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader title="API keys" description="For other software (Zapier, a bookkeeping tool, your own scripts) and AI tools to read your data or create work orders. Each key sees only this company." />
        {keys?.length ? (
          <Table minWidth={720}>
            <Thead>
              <Th>Name</Th>
              <Th>Key</Th>
              <Th>May</Th>
              <Th>Last used</Th>
              <Th />
            </Thead>
            <Tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <Td className="font-semibold">{k.name}</Td>
                  <Td className="font-mono text-[13px]">{k.prefix}…</Td>
                  <Td className="text-[13px]">{k.scopes.map((s) => (s === "read" ? "Read" : API_SCOPES[s as ApiScope] ?? s)).join(", ")}</Td>
                  <Td className="text-[13px]">{k.revoked_at ? <Pill>Revoked {date(k.revoked_at.slice(0, 10))}</Pill> : k.last_used_at ? date(k.last_used_at.slice(0, 10)) : "Never"}</Td>
                  <Td right>
                    {!k.revoked_at && (
                      <form action={revokeApiKey}>
                        <input type="hidden" name="id" value={k.id} />
                        <button className="min-h-10 text-[13px] font-semibold text-danger">Revoke</button>
                      </form>
                    )}
                  </Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <EmptyState title="No API keys yet" />
        )}
      </Card>
      <Card>
        <CardHeader title="Make a key" description="Give each tool its own key, so you can revoke one without breaking the others." />
        <NewKeyForm />
      </Card>
      <Card>
        <CardHeader title="How to connect" />
        <div className="space-y-4 px-5 py-4 text-sm">
          <div>
            <p className="font-semibold">REST API</p>
            <p className="text-muted">Send the key as a header: Authorization: Bearer pm_… (120 requests a minute per key). Money is in cents.</p>
            <ul className="mt-2 space-y-1 font-mono text-[13px]">
              {["properties", "units", "leases", "owners", "vendors", "work-orders"].map((r) => (
                <li key={r}>
                  GET {base}/api/v1/{r}?limit=50&amp;offset=0
                </li>
              ))}
              <li>POST {base}/api/v1/work-orders {"{"}&quot;property_id&quot;, &quot;title&quot;, &quot;details&quot;, &quot;priority&quot;{"}"}</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">AI tools (MCP)</p>
            <p className="text-muted">
              In Claude or another AI tool that supports MCP, add a remote server at <span className="font-mono">{base}/api/mcp</span> with the header Authorization: Bearer pm_…. It can list properties, units, leases, owners, vendors and work orders, and create work orders if the key allows it.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
