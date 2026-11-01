import { Pill } from "@/components/ui";
import type { Compliance } from "@/lib/vendors";

export function PaperworkPill({ compliance }: { compliance: Compliance }) {
  const { status, issues, canDispatch } = compliance;
  if (status === "not_required") return <Pill>Not needed</Pill>;
  if (status === "ok") return <Pill tone="success">Complete</Pill>;
  return (
    <>
      <Pill tone={status === "expiring" ? "warn" : canDispatch ? "warn" : "danger"}>
        {status === "expiring" ? "Ending soon" : canDispatch ? "Allowed anyway" : "Can't dispatch"}
      </Pill>
      <p className="mt-1 text-[13px] text-subtle">{issues.join(" · ")}</p>
    </>
  );
}
