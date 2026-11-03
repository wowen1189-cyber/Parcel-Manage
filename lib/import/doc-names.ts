// Readable names for documents brought over from AppFolio (Wesley Owen, Nov 2, 2026): "what it is – who it's
// for – date", e.g. "Signed lease – Sarah Laboy – Apr 26, 2026.pdf" instead of "sarah-e-laboy_04-26-2026.pdf".
// AppFolio's own generated files (e-signed leases, ledgers, letters) are recognized by their name pattern; camera
// and scanner names become "Photo" or "Scan"; anything else is tidied (underscores, stray numbers) but kept.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (y: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${MONTHS[m - 1]} ${d}, ${y}` : "");

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** AppFolio letter templates, by the start of the generated file name. */
const LETTERS: [RegExp, string][] = [
  [/^preview_of_deposit_disposition_refund_/, "Deposit disposition (preview)"],
  [/^deposit_disposition_amount_due_/, "Deposit disposition (amount due)"],
  [/^deposit_disposition_refund_/, "Deposit disposition"],
  [/^renewal_notice_letter_/, "Renewal notice"],
  [/^trash_disposal_policy_/, "Trash disposal policy"],
  [/^elevator_down_/, "Elevator down notice"],
  [/^balance_confirmation_letter/i, "Balance confirmation letter"],
];

export type NamedDoc = { what: string; date: string; ext: string };

/** What a file is and its date, read from its AppFolio name. */
export function describeFile(original: string): NamedDoc {
  const m = original.match(/^(.*?)(?:\.([A-Za-z0-9]{2,5}))?$/)!;
  let base = m[1].trim();
  const ext = (m[2] ?? "").toLowerCase();
  base = base.replace(/\s*\(\d+\)$/, "").replace(/\[\d+\]/g, "").trim(); // "(1)" download copies, "[92]" upload counters

  // AppFolio e-signed lease: "first-m-last_MM-DD-YYYY" (sometimes "lease_" in front).
  let x = base.match(/^(?:lease_)?[a-z0-9]+(?:-[a-z0-9]+)+_(\d{2})-(\d{2})-(\d{4})$/i);
  if (x) return { what: "Signed lease", date: day(+x[3], +x[1], +x[2]), ext };
  // AppFolio tenant ledger export: "tenant_ledger-name-YYYYMMDD".
  x = base.match(/^tenant_ledger-.*-(\d{4})(\d{2})(\d{2})$/i);
  if (x) return { what: "Tenant ledger", date: day(+x[1], +x[2], +x[3]), ext };
  // AppFolio letters: "<template>_<name>_MMDDYY".
  for (const [re, what] of LETTERS) {
    if (re.test(base)) {
      const d = base.match(/_(\d{2})(\d{2})(\d{2})$/);
      return { what, date: d ? day(2000 + +d[3], +d[1], +d[2]) : "", ext };
    }
  }
  // Phone screenshots: "Screenshot_20260311_175501_Chrome", "Screen Shot 2023-04-17 at 1.41.05 PM".
  x = base.match(/^screen ?shot[ _-]?(\d{4})-?(\d{2})-?(\d{2})/i);
  if (x) return { what: "Screenshot", date: day(+x[1], +x[2], +x[3]), ext };
  // Camera, scanner and random names say nothing: call them what they are.
  if (/^(img|dsc|pxl|mvimg|photo|image)[ _-]?\d+$/i.test(base) || /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(base)) return { what: "Photo", date: "", ext };
  // Download links and mail attachments with machine names ("att.OTHAM…", ",DanaInfo=…").
  if (/^att\.|danainfo|[=+]/i.test(base) || (/^[A-Za-z0-9._-]{20,}$/.test(base) && !/[ _-][A-Za-z]{3,}[ _-]/.test(base) && /\d/.test(base) && /[A-Z]/.test(base) && /[a-z]/.test(base)))
    return { what: /^(jpe?g|png|heic|gif|webp)$/.test(ext) ? "Photo" : "Document", date: "", ext };
  if (/^(scan|doc|document)[ _-]?\d*$/i.test(base) || /^\d{8,}$/.test(base)) return { what: /^(jpe?g|png|heic|gif|webp)$/.test(ext) ? "Photo" : "Scan", date: "", ext };

  // Anything else: keep the words, drop the clutter.
  const what = base
    .replace(/(\d{1,2})_(\d{1,2})_(\d{2,4})/g, "$1/$2/$3") // dates written with underscores
    .replace(/_-_/g, " - ")
    .replace(/\s_\s/g, " - ")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { what: sentence(what) || "Document", date: "", ext };
}

/**
 * The name to show: "what – who – date.ext". `who` is the tenant, owner, vendor or unit the file belongs to
 * (left out when the file name already says it, or when the file is the property's own).
 */
export function documentName(original: string, who?: string | null): string {
  const { what, date, ext } = describeFile(original);
  const words = (who ?? "")
    .replace(/\(.*?\)/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
  const named = words.length > 0 && words.some((w) => what.toLowerCase().includes(w));
  // A past or upcoming tenant's file keeps that tag even when the name already says who.
  const tag = named ? (who?.match(/\((past|upcoming) tenant\)/)?.[0] ?? "") : "";
  return [tag ? `${what} ${tag}` : what, who && !named ? who : "", date].filter(Boolean).join(" – ") + (ext ? `.${ext}` : "");
}

/** Number repeats on the same record: "Photo – Sarah Laboy.jpeg", "Photo – Sarah Laboy (2).jpeg". */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const k = n.toLowerCase();
    const c = (seen.get(k) ?? 0) + 1;
    seen.set(k, c);
    if (c === 1) return n;
    const dot = n.lastIndexOf(".");
    return dot > 0 ? `${n.slice(0, dot)} (${c})${n.slice(dot)}` : `${n} (${c})`;
  });
}
