import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requireCompany } from "@/lib/session";
import { NewVendorForm } from "../forms";

export const metadata = { title: "New vendor" };

export default async function NewVendorPage() {
  await requireCompany();
  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/vendors" className="font-semibold text-accent hover:underline">
          ← Vendors
        </Link>
      </p>
      <PageHeader title="New vendor" subtitle="Who they are, what they do, and how to reach and pay them." />
      <div className="max-w-3xl">
        <NewVendorForm />
      </div>
    </>
  );
}
