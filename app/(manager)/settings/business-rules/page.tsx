import { Notice } from "@/components/ui";
import { readBusinessRules } from "@/lib/business-rules";
import { displayValue, RULE_SECTIONS } from "@/lib/business-rules-form";
import { isAdmin, requireCompany } from "@/lib/session";
import { BusinessRulesForm } from "../forms";

export const metadata = { title: "Business rules" };

export default async function BusinessRulesPage() {
  const { company, membership } = await requireCompany();
  const rules = readBusinessRules(company.settings);
  const values: Record<string, string | boolean> = {};
  for (const section of RULE_SECTIONS) for (const field of section.fields) values[field.path] = displayValue(field, rules);
  const canEdit = isAdmin(membership);

  return (
    <div className="max-w-4xl space-y-4">
      <Notice tone="info">
        These rules drive screening, fees, maintenance priority and notices across the app. Changes apply to new activity from
        now on. Rules set by Florida law, like 24 hours&apos; notice before a repair visit, can&apos;t be lowered.
      </Notice>
      {!canEdit && <Notice tone="info">Only admins can change business rules.</Notice>}
      <BusinessRulesForm values={values} canEdit={canEdit} />
    </div>
  );
}
