import { notFound } from "next/navigation";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { navItem } from "@/lib/nav";

export async function generateMetadata({ params }: PageProps<"/[section]">) {
  return { title: navItem((await params).section)?.label };
}

// Placeholder for screens that arrive in later phases (docs/08-build-plan.md).
export default async function SectionPlaceholder({ params }: PageProps<"/[section]">) {
  const { section } = await params;
  const item = navItem(section);
  if (!item || item.phase === 0) notFound();

  return (
    <>
      <PageHeader title={item.label} subtitle={item.description} action={<Pill tone="info">Coming in Phase {item.phase}</Pill>} />
      <Card>
        <EmptyState title="Not built yet">
          This screen is part of Phase {item.phase} of the build plan. The menu item is here so you can see where it will live.
        </EmptyState>
      </Card>
    </>
  );
}
