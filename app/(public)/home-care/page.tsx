import { Logo } from "@/components/logo";
import { DEFAULT_HOME_CARE, type CareSection } from "@/lib/home-care";
import { getPublicCompany } from "@/lib/session";

export const metadata = { title: "Home care guide", description: "Routine upkeep and quick fixes for your home." };

// Public, phone-first guide for tenants (no sign-in, nothing private). Share the link or print a QR code.
// Visitors aren't signed in, so this shows the default guide; the tenant portal will show a company's own version.
export default async function HomeCarePage() {
  const company = await getPublicCompany();
  const guide = DEFAULT_HOME_CARE;
  const phone = company?.office_phone;

  return (
    <main className="mx-auto max-w-[720px] px-4 py-8 sm:py-12">
      <div className="mb-8">
        <Logo companyName={company?.name} />
      </div>

      <h1 className="text-[34px] font-extrabold leading-tight tracking-[-0.015em]">Home care guide</h1>
      <p className="mt-3 text-[17px] leading-relaxed text-muted">{guide.intro}</p>

      <div className="mt-6 rounded-[var(--radius-card)] bg-warn-bg px-5 py-4 text-warn">
        <p className="font-semibold">Something broken or leaking?</p>
        <p className="mt-1 text-sm">
          Submit a maintenance request in your tenant portal{phone ? <> or call {company?.name} at <a href={`tel:${phone.replace(/\D/g, "")}`} className="font-semibold underline">{phone}</a></> : ""}. For fire, a gas smell or
          anyone in danger, leave and call 911 first.
        </p>
      </div>

      <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-2">
        {[{ id: "checklist", title: "Checklist" }, ...guide.sections].map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full border border-line-strong bg-surface px-3.5 py-2 text-[13px] font-semibold hover:bg-surface-sunk">
            {s.title}
          </a>
        ))}
      </nav>

      <section id="checklist" className="mt-10 scroll-mt-6">
        <h2 className="text-xl font-bold">Your upkeep checklist</h2>
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {guide.checklist.map((item) => (
            <li key={item.text} className="flex gap-4 px-5 py-3.5">
              <span className="w-[112px] shrink-0 text-[13px] font-semibold text-accent">{item.every}</span>
              <span className="text-[15px]">
                {item.text}
                {item.appliesTo === "single_family" && <span className="text-subtle"> (houses)</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {guide.sections.map((s) => (
        <Section key={s.id} section={s} />
      ))}

      <footer className="mt-12 border-t border-line pt-6 text-[13px] text-subtle">
        {company?.name ?? "Your property manager"}
        {phone && ` · ${phone}`}. These steps are part of your lease (sections 3.2 and 3.7). When in doubt, ask us before you try a fix.
      </footer>
    </main>
  );
}

function Section({ section: s }: { section: CareSection }) {
  return (
    <section id={s.id} className="mt-10 scroll-mt-6">
      <h2 className="text-xl font-bold">{s.title}</h2>
      {s.why && <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.why}</p>}
      {s.steps && (
        <ol className="mt-4 space-y-3">
          {s.steps.map((step, i) => (
            <li key={step.text} className="flex gap-3.5 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-bold text-white">{i + 1}</span>
              <span className="pt-0.5">
                <span className="block text-[15px]">{step.text}</span>
                {step.tip && <span className="mt-1 block text-[13px] text-subtle">{step.tip}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {(s.doList || s.dontList) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {s.doList && (
            <div className="rounded-[var(--radius-card)] bg-accent-softer px-4 py-3.5">
              <p className="text-[13px] font-bold uppercase tracking-wide text-accent-deep">OK to put in</p>
              <ul className="mt-2 space-y-1.5 text-[15px] text-accent-deep">
                {s.doList.map((x) => (
                  <li key={x}>✓ {x}</li>
                ))}
              </ul>
            </div>
          )}
          {s.dontList && (
            <div className="rounded-[var(--radius-card)] bg-danger-bg px-4 py-3.5">
              <p className="text-[13px] font-bold uppercase tracking-wide text-danger">Never put in</p>
              <ul className="mt-2 space-y-1.5 text-[15px] text-danger">
                {s.dontList.map((x) => (
                  <li key={x}>✕ {x}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {s.cost && <p className="mt-3 text-[13px] font-medium text-muted">{s.cost}</p>}
    </section>
  );
}
