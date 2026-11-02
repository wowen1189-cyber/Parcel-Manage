import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { contactName, todayIn } from "@/lib/format";
import { defaultRooms, INSPECTION_KIND, readRooms, type InspectionKind } from "@/lib/inspections";
import { requireCompany } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROOMS } from "@/lib/triage";
import { InspectionEditor } from "./editor";

export const metadata = { title: "Inspection" };

export default async function InspectionPage({ params }: PageProps<"/tenants/[id]/inspection/[kind]">) {
  const { id, kind } = await params;
  if (!(kind in INSPECTION_KIND)) notFound();
  const { supabase, company, membership } = await requireCompany();
  const { data: l } = await supabase
    .from("lease")
    .select("id, start_date, unit(label, beds, baths, property(name)), lease_tenant(role, is_primary, contact(kind, first_name, last_name, business_name))")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!l) notFound();
  const { data: existing } = await supabase.from("inspection").select("inspected_on, rooms, notes").eq("lease_id", l.id).eq("kind", kind).maybeSingle();
  // A new move-out inspection starts from the move-in rooms, so the two line up room by room.
  const { data: moveIn } = !existing && kind === "move_out" ? await supabase.from("inspection").select("rooms").eq("lease_id", l.id).eq("kind", "move_in").maybeSingle() : { data: null };
  const rooms = existing
    ? readRooms(existing.rooms)
    : moveIn
      ? readRooms(moveIn.rooms).map((r) => ({ ...r, condition: "good" as const, notes: "", photos: [] }))
      : defaultRooms(ROOMS.filter((r) => r !== "Whole home"), l.unit.beds, l.unit.baths);
  const paths = rooms.flatMap((r) => r.photos);
  const signed = paths.length ? (await createAdminClient().storage.from("documents").createSignedUrls(paths, 3600)).data ?? [] : [];
  const photoUrls: Record<string, string> = Object.fromEntries(signed.flatMap((s) => (s.signedUrl && s.path ? [[s.path, s.signedUrl]] : [])));
  const name = contactName([...l.lease_tenant].filter((t) => t.role === "tenant").sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0]?.contact) || "Tenant";
  const canEdit = ["admin", "property_manager", "leasing_agent", "maintenance", "accountant"].includes(membership.role);
  const title = INSPECTION_KIND[kind as InspectionKind];

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href={kind === "move_out" ? `/tenants/${l.id}/move-out` : `/tenants/${l.id}`} className="font-semibold text-accent hover:underline">
          ← {kind === "move_out" ? "Move-out and deposit" : name}
        </Link>
      </p>
      <PageHeader title={title} subtitle={`${name} · ${l.unit.property.name}${l.unit.label !== "Home" ? ` ${l.unit.label}` : ""}`} />
      <Card className="mb-6 p-5 text-[14px] text-muted">
        {kind === "move_in"
          ? "Record each room's condition before the tenant moves in, with photos. At move-out, the same rooms are compared to tell damage from normal wear and tear."
          : "Record each room at move-out. Rooms that are worse than at move-in become suggested deductions on the move-out page. Normal wear and tear can't be deducted (Fla. Stat. 83.49(3))."}
      </Card>
      <InspectionEditor leaseId={l.id} kind={kind} inspectedOn={existing?.inspected_on ?? (kind === "move_in" ? l.start_date : todayIn(company.time_zone))} rooms={rooms} notes={existing?.notes ?? ""} photoUrls={photoUrls} canEdit={canEdit} />
    </>
  );
}
