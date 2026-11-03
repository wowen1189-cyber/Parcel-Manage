import Link from "next/link";
import { Card, CardHeader, Notice, Pill } from "@/components/ui";
import { twilioConfigured } from "@/lib/integrations/twilio/client";
import { isAdmin, requireCompany } from "@/lib/session";
import { prettyPhone } from "@/lib/sms";
import { companyTextMode } from "@/lib/sms-send";
import { TextingForm } from "./form";

export const metadata = { title: "Texting" };

export default async function TextingSettingsPage() {
  const { company, membership } = await requireCompany();
  const canEdit = isAdmin(membership);
  const platform = twilioConfigured();
  const mode = companyTextMode(company);
  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader
          title="Texting"
          description="Two-way texts with tenants and vendors, job texts to vendors and emergency alerts. Texts go only to people who agreed themselves; replying STOP turns them off."
          action={mode.live ? <Pill tone="success">Real texts on</Pill> : <Pill tone="warn">Practice mode</Pill>}
        />
        {!mode.live && (
          <div className="px-5 pt-4">
            <Notice tone="info">Practice mode: {mode.reason} Texts are saved on each record so you can see how they&apos;ll look, but none are sent.</Notice>
          </div>
        )}
        {!canEdit && (
          <div className="px-5 pt-4">
            <Notice>Only an admin can change texting.</Notice>
          </div>
        )}
        <TextingForm from={company.sms_from_number ? prettyPhone(company.sms_from_number) : ""} alert={company.sms_alert_number ? prettyPhone(company.sms_alert_number) : ""} live={company.sms_live} canGoLive={platform && Boolean(company.sms_from_number)} canEdit={canEdit} />
      </Card>
      <Card>
        <CardHeader title="Twilio setup" description="For whoever sets up the number in Twilio." />
        <div className="space-y-2 px-5 py-4 text-[13px]">
          <p>Parcel Manage&apos;s Twilio account: {platform ? <Pill tone="success">Connected</Pill> : <Pill>Not connected</Pill>}</p>
          <p>
            On the number in Twilio (Phone numbers › Manage › Active numbers), under Messaging, set &quot;A message comes in&quot; to Webhook, HTTP POST:
            <code className="mt-1 block break-all rounded bg-surface-muted px-2 py-1">https://parcelmanage.com/api/sms/inbound</code>
          </p>
          <p>
            Texting terms for the carrier registration:{" "}
            <Link href="/texting" className="font-semibold text-accent underline">
              {company.subdomain ? `${company.subdomain}.parcelmanage.com/texting` : "parcelmanage.com/texting"}
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
