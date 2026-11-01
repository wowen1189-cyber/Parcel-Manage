import { AppShell } from "@/components/shell";
import { navHref, orderedNav, type NavPrefs } from "@/lib/nav";
import { requireCompany } from "@/lib/session";
import { signOut } from "../(auth)/actions";
import { saveNavOrder } from "./preferences";

export default async function ManagerLayout({ children }: LayoutProps<"/">) {
  const { user, supabase, company, membership } = await requireCompany();
  const { data: profile } = await supabase.from("profile").select("full_name, email, preferences").eq("id", user.id).single();
  const prefs = (profile?.preferences ?? {}) as { nav?: NavPrefs };
  const navGroups = orderedNav(prefs.nav).map((g) => ({
    id: g.id,
    label: g.label,
    entries: g.entries.map((e) => ({ slug: e.slug, label: e.label, href: navHref(e) })),
  }));

  return (
    <AppShell
      companyName={company.name}
      userName={profile?.full_name || profile?.email || user.email || "You"}
      userTitle={membership.title}
      signOutAction={signOut}
      navGroups={navGroups}
      saveNav={saveNavOrder}
    >
      {children}
    </AppShell>
  );
}
