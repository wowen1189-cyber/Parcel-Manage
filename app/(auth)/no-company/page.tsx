export const metadata = { title: "Not found" };

export default function NoCompanyPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-extrabold tracking-[-0.015em]">No company at this address</h1>
      <p className="text-muted">Check the web address for typos. It looks like yourcompany.parcelmanage.com.</p>
    </div>
  );
}
