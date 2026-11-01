import { Card, CardHeader } from "@/components/ui";
import { readAutomationSettings } from "@/lib/automation-rules";
import { isAdmin, requireCompany } from "@/lib/session";
import { AutomationsForm, RunNow } from "./forms";

export const metadata = { title: "Automations" };

export default async function AutomationsPage() {
  const { company, membership } = await requireCompany();
  const s = readAutomationSettings(company.settings);
  return (
    <Card className="max-w-[760px]">
      <CardHeader title="Automations" description="Run every morning. Routine reminders go out on their own; anything with legal weight lands in To do for a person." action={s.enabled && isAdmin(membership) ? <RunNow /> : undefined} />
      <div className="px-5 py-4">
        <AutomationsForm s={s} canEdit={isAdmin(membership)} />
      </div>
    </Card>
  );
}
