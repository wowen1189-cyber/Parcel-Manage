import Link from "next/link";
import { buttonClass, PageHeader } from "@/components/ui";
import { SettingsTabs } from "./tabs";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <>
      <PageHeader
        title="Settings & team"
        subtitle="Your company profile, business rules and team."
        action={
          <Link href="/set-password?next=/settings" className={buttonClass("secondary", true)}>
            Change my password
          </Link>
        }
      />
      <SettingsTabs />
      {children}
    </>
  );
}
