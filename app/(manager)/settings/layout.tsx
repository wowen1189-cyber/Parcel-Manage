import { PageHeader } from "@/components/ui";
import { SettingsTabs } from "./tabs";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <>
      <PageHeader title="Settings & team" subtitle="Your company profile, business rules and team." />
      <SettingsTabs />
      {children}
    </>
  );
}
