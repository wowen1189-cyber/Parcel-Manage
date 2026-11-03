import { DocumentShare } from "@/components/document-share";
import { EmptyState } from "@/components/ui";
import { documentLinks, DOCUMENT_TYPE_LABEL, type DocRow } from "@/lib/document-files";
import { date } from "@/lib/format";

// A list of documents: open link, type and date; for the office, switches for who else can see each one.
export async function DocumentList({ docs, share, showTenant = true, empty }: { docs: DocRow[]; share?: boolean; showTenant?: boolean; empty: string }) {
  if (!docs.length) return <EmptyState title="No documents yet">{empty}</EmptyState>;
  const links = await documentLinks(docs);
  return (
    <ul className="divide-y divide-line">
      {docs.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-5 py-2.5 text-[13px]">
          <span className="min-w-0">
            {links.get(d.storage_path) ? (
              <a href={links.get(d.storage_path)} target="_blank" rel="noreferrer" className="break-words font-semibold text-accent hover:underline">
                {d.file_name}
              </a>
            ) : (
              <span className="break-words">{d.file_name}</span>
            )}
            <span className="block text-subtle">
              {DOCUMENT_TYPE_LABEL[d.category] ?? "Other"} · {date(d.created_at.slice(0, 10))}
            </span>
          </span>
          {share && <DocumentShare id={d.id} tenant={!d.office_only} owner={d.shared_with_owner} showTenant={showTenant && Boolean(d.lease_id)} />}
        </li>
      ))}
    </ul>
  );
}
