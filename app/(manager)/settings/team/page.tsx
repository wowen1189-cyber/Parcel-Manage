import { Button, Card, CardHeader, EmptyState, Pill } from "@/components/ui";
import { isAdmin, requireCompany } from "@/lib/session";
import { revokeInvitation } from "../actions";
import { InviteForm, MemberRow } from "../forms";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const { supabase, company, membership } = await requireCompany();
  const canEdit = isAdmin(membership);
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("membership")
      .select("id, role, title, status, profile(full_name, email)")
      .eq("company_id", company.id)
      .order("created_at"),
    canEdit
      ? supabase
          .from("invitation")
          .select("id, email, role, title, expires_at")
          .eq("company_id", company.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; email: string; role: string; title: string | null; expires_at: string }[] }),
  ]);

  return (
    <div className="max-w-4xl space-y-4">
      <Card>
        <CardHeader title="Team members" description="Titles appear on letters, emails and signatures." />
        <div className="divide-y divide-line">
          {(members ?? []).map((m) => (
            <MemberRow
              key={m.id}
              canEdit={canEdit}
              member={{
                id: m.id,
                name: m.profile?.full_name || m.profile?.email || "Team member",
                email: m.profile?.email ?? "",
                role: m.role,
                title: m.title,
              }}
            />
          ))}
        </div>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader title="Invite a teammate" description="They get an email link that works for 7 days." />
          <InviteForm />
          <div className="border-t border-line">
            {!invites?.length ? (
              <EmptyState title="No pending invites" />
            ) : (
              <ul className="divide-y divide-line">
                {invites.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="font-semibold">{inv.email}</p>
                      <p className="text-[13px] text-subtle">
                        {inv.title ? `${inv.title} · ` : ""}Expires {new Date(inv.expires_at).toLocaleDateString("en-US", { timeZone: company.time_zone })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Pill tone="warn">Pending</Pill>
                      <form action={revokeInvitation}>
                        <input type="hidden" name="id" value={inv.id} />
                        <Button type="submit" variant="ghost" small>
                          Cancel invite
                        </Button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
