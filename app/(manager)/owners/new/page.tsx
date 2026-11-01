import Link from "next/link";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { requireCompany } from "@/lib/session";
import { OwnerForm } from "../forms";

export const metadata = { title: "New owner" };

export default async function NewOwnerPage() {
  const { membership } = await requireCompany();
  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/owners" className="font-semibold text-accent hover:underline">
          ← Owners
        </Link>
      </p>
      <PageHeader title="New owner" subtitle="The LLC or person on the deed. Next you'll put their properties under them and set the management fee." />
      <Card>
        <CardHeader title="Owner details" />
        <OwnerForm canEdit={["admin", "property_manager"].includes(membership.role)} />
      </Card>
    </>
  );
}
