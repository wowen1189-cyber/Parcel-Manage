import Link from "next/link";
import { Card, PageHeader, Pill } from "@/components/ui";
import { REPORTS } from "@/lib/reports";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  await requireCompany();
  const groups = [...new Set(REPORTS.map((r) => r.group))];
  return (
    <>
      <PageHeader title="Reports" subtitle={`${REPORTS.filter((r) => r.run).length} of ${REPORTS.length} reports ready. Each one replaces several AppFolio reports, with filters and CSV export.`} />
      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((g) => (
          <Card key={g} className="p-5">
            <h2 className="mb-3 text-[17px] font-bold">{g}</h2>
            <ul className="space-y-2.5">
              {REPORTS.filter((r) => r.group === g).map((r) => (
                <li key={r.id}>
                  {r.run ? (
                    <Link href={`/reports/${r.id}`} className="font-semibold text-accent hover:underline">
                      {r.title}
                    </Link>
                  ) : (
                    <span className="font-semibold text-muted">
                      {r.title} <Pill>Coming</Pill>
                    </span>
                  )}
                  <p className="text-[12px] text-subtle">Replaces: {r.replaces}</p>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
