export function Logo({ companyName }: { companyName?: string | null }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="grid size-9 place-items-center rounded-[10px] bg-accent text-base font-extrabold text-white"
      >
        P
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-extrabold tracking-[-0.01em]">Parcel Manage</span>
        {companyName && <span className="block text-[12px] font-medium text-subtle">{companyName}</span>}
      </span>
    </div>
  );
}
