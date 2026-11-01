import { Notice } from "@/components/ui";
import { ROOT_DOMAIN } from "@/lib/env";
import { isAdmin, requireCompany } from "@/lib/session";
import { CompanyProfileForm } from "./forms";

export const metadata = { title: "Settings" };

export default async function CompanySettingsPage() {
  const { company, membership } = await requireCompany();
  const canEdit = isAdmin(membership);
  return (
    <div className="max-w-3xl space-y-4">
      {!canEdit && <Notice tone="info">Only admins can change company settings.</Notice>}
      <CompanyProfileForm
        company={company}
        canEdit={canEdit}
        webAddress={company.subdomain ? `${company.subdomain}.${ROOT_DOMAIN}` : "Not set"}
      />
    </div>
  );
}
