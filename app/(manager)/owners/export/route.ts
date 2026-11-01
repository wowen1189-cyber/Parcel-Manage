import type { NextRequest } from "next/server";
import { csvMoney, csvResponse } from "@/lib/csv";
import { describeFee, readCompanyFee } from "@/lib/management-fees";
import { listOwners } from "@/lib/owners";
import { requireCompany } from "@/lib/session";

export async function GET(request: NextRequest) {
  const { supabase, company } = await requireCompany();
  const owners = await listOwners(supabase, company.id, readCompanyFee(company.settings), request.nextUrl.searchParams.get("q") ?? "");
  // One row per property, so each owner's properties sit together under the owner.
  return csvResponse(
    "owners.csv",
    ["Owner", "Type", "Email", "Phone", "Property", "Address", "Partners", "Units", "Monthly rent", "Fee terms", "Fee from", "Est. monthly fee"],
    owners.flatMap((o) =>
      (o.properties.length ? o.properties : [null]).map((p) => [
        o.name, o.type, o.email, o.phone, p?.name ?? "", p?.address ?? "", p?.partners ?? "", p?.units ?? 0, csvMoney(p?.rentCents ?? 0),
        describeFee(p?.fee ?? o.fee), p ? (p.feeSource === "property" ? "Property" : p.feeSource === "owner" ? "Owner agreement" : "Company default") : "", csvMoney(p?.estFeeCents ?? 0),
      ]),
    ),
  );
}
