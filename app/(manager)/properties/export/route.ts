import type { NextRequest } from "next/server";
import { csvMoney, csvResponse } from "@/lib/csv";
import { listProperties } from "@/lib/portfolio";
import { requireCompany } from "@/lib/session";

export async function GET(request: NextRequest) {
  const { supabase, company } = await requireCompany();
  const p = request.nextUrl.searchParams;
  const rows = await listProperties(supabase, company.id, { q: p.get("q") ?? "", type: p.get("type") ?? "", entity: p.get("entity") ?? "" });
  return csvResponse(
    "properties.csv",
    ["Property", "Address", "Type", "Owning LLC", "Owners", "Units", "Occupied", "Monthly rent"],
    rows.map((r) => [r.name, r.address, r.type, r.entityName, r.owners, r.units, r.occupied, csvMoney(r.rentCents)]),
  );
}
