// Parcel family mark: deep green tile, white initials, gold period (Parcel TM uses "P.", Parcel Manage "PM.").
export function Logo({ companyName }: { companyName?: string | null }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden className="relative grid size-9 place-items-center rounded-[10px] bg-brand text-white">
        <span className="pr-1 text-[13px] font-extrabold tracking-[-0.02em]">PM</span>
        <span className="absolute bottom-[9px] right-[6px] size-[5px] rounded-full bg-gold" />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-extrabold tracking-[-0.01em]">
          Parcel Manage<span className="text-gold">.</span>
        </span>
        {companyName && <span className="block text-[12px] font-medium text-subtle">{companyName}</span>}
      </span>
    </div>
  );
}
