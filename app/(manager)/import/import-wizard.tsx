"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Card, CardHeader, Field, Input, Notice, Select } from "@/components/ui";
import { Table, Tbody, Td, Th, Thead } from "@/components/table";
import { guessMapping, IMPORT_KINDS, kindInfo, normalize, readSheet, type ImportKind, type Mapping, type Normalized, type Sheet } from "@/lib/import/generic";
import type { ImportResult } from "@/lib/import/save";
import { matchColumnsWithAi, runImport } from "./actions";

const dollars = (c: number | null) => (c == null ? "" : `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);

export function ImportWizard({ hasAi, defaultAsOf }: { hasAi: boolean; defaultAsOf: string }) {
  const [kind, setKind] = useState<ImportKind>("rent_roll");
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [mapping, setMapping] = useState<Mapping>({});
  const [asOf, setAsOf] = useState(defaultAsOf);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [check, setCheck] = useState<ImportResult | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();
  const info = kindInfo(kind);

  const sheet: Sheet | null = useMemo(() => (text ? readSheet(text, kind) : null), [text, kind]);
  const data: Normalized | null = useMemo(() => (sheet ? normalize(kind, sheet, mapping) : null), [sheet, kind, mapping]);
  const missing = info.fields.filter((f) => f.required && mapping[f.key] == null);

  const reset = () => {
    setCheck(null);
    setDone(null);
    setError("");
  };
  const load = (k: ImportKind, t: string) => {
    reset();
    setNote("");
    if (!t) return setMapping({});
    const s = readSheet(t, k);
    const m = guessMapping(k, s.headers);
    setMapping(m);
    const matched = Object.values(m).filter((v) => v != null).length;
    setNote(`Read ${s.rows.length} rows. Matched ${matched} of ${s.headers.length} columns by their headings; check the matches below.`);
  };

  async function pickFile(file: File | undefined) {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setError("Save the report as CSV first (in Excel: File › Save As › CSV).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("That file is over 5 MB. Split it into smaller files.");
      return;
    }
    const t = await file.text();
    setFileName(file.name);
    setText(t);
    load(kind, t);
  }

  const payload = () => ({ kind, headers: sheet!.headers, rows: sheet!.rows, headerRow: sheet!.headerRow });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="1. Choose the file" />
        <div className="space-y-4 px-5 py-4">
          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold text-ink-2">What&apos;s in the file?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {IMPORT_KINDS.map((k) => (
                <label key={k.kind} className={`flex min-h-11 cursor-pointer gap-3 rounded-[var(--radius-control)] border px-4 py-3 ${kind === k.kind ? "border-accent bg-accent-softer" : "border-line"}`}>
                  <input
                    type="radio"
                    name="kind"
                    value={k.kind}
                    checked={kind === k.kind}
                    onChange={() => {
                      setKind(k.kind);
                      load(k.kind, text);
                    }}
                    className="mt-1 size-[18px] accent-[var(--color-accent)]"
                  />
                  <span>
                    <span className="block text-sm font-semibold">{k.label}</span>
                    <span className="block text-[13px] text-muted">{k.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-end gap-4">
            <Field label="CSV file" hint={fileName ? `Loaded: ${fileName}` : "Exported from your old software, or your own spreadsheet saved as CSV."}>
              <input type="file" accept=".csv,text/csv,.txt" onChange={(e) => pickFile(e.target.files?.[0])} className="block min-h-11 text-sm file:mr-3 file:min-h-11 file:rounded-[var(--radius-control)] file:border file:border-line-strong file:bg-surface file:px-3 file:font-semibold" />
            </Field>
            {kind === "rent_roll" && (
              <Field label="Export date (cutover)" hint="Balances and deposits are as of this date.">
                <Input type="date" value={asOf} onChange={(e) => (setAsOf(e.target.value), reset())} className="w-48" />
              </Field>
            )}
          </div>
          {note && <Notice>{note}</Notice>}
          {error && <Notice tone="danger">{error}</Notice>}
        </div>
      </Card>

      {sheet && (
        <Card>
          <CardHeader
            title="2. Match the columns"
            description="Pick the column in your file for each item. Leave “Not in file” for anything your file doesn't have."
            action={
              hasAi ? (
                <Button
                  small
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await matchColumnsWithAi(payload());
                      if (r.error) return setError(r.error);
                      // Keep what the headings already matched; the AI fills the gaps.
                      setMapping((m) => {
                        const next = { ...m };
                        const used = new Set(Object.values(m).filter((v) => v != null));
                        for (const [k, v] of Object.entries(r.mapping ?? {})) {
                          if (next[k] != null || v == null || used.has(v)) continue;
                          next[k] = v;
                          used.add(v);
                        }
                        return next;
                      });
                      setNote("The AI matched what it could from the headings and the kind of values in each column (no tenant details were sent). Check the matches.");
                      reset();
                    })
                  }
                >
                  {pending ? "Matching…" : "Match the rest with AI"}
                </Button>
              ) : undefined
            }
          />
          <Table minWidth={620}>
            <Thead>
              <Th>Parcel Manage</Th>
              <Th>Column in your file</Th>
              <Th>First value</Th>
            </Thead>
            <Tbody>
              {info.fields.map((f) => {
                const col = mapping[f.key];
                const sample = col == null ? "" : sheet.rows.find((r) => (r[col] ?? "").trim())?.[col] ?? "";
                return (
                  <tr key={f.key}>
                    <Td>
                      <label htmlFor={`map-${f.key}`} className="font-semibold">
                        {f.label}
                        {f.required && <span className="text-danger"> *</span>}
                      </label>
                      {f.hint && <span className="block text-[13px] text-subtle">{f.hint}</span>}
                    </Td>
                    <Td>
                      <Select
                        id={`map-${f.key}`}
                        value={col == null ? "" : String(col)}
                        onChange={(e) => {
                          setMapping((m) => ({ ...m, [f.key]: e.target.value === "" ? null : Number(e.target.value) }));
                          reset();
                        }}
                      >
                        <option value="">Not in file</option>
                        {sheet.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h}
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td className="max-w-56 truncate text-muted">{sample}</Td>
                  </tr>
                );
              })}
            </Tbody>
          </Table>
        </Card>
      )}

      {data && (
        <Card>
          <CardHeader title="3. Check and import" description={`${data.records.length} rows to import${data.skipped ? `; ${data.skipped} heading, total or blank rows skipped` : ""}.`} />
          <div className="space-y-4 px-5 py-4">
            {missing.length > 0 && <Notice tone="warn">Pick a column for {missing.map((f) => f.label).join(", ")}.</Notice>}
            <Preview data={data} />
            {data.issues.length > 0 && (
              <div>
                <p className="text-sm font-semibold">
                  {data.issues.length} {data.issues.length === 1 ? "thing" : "things"} to look at (the row numbers are the ones in your spreadsheet)
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[14px] text-muted">
                  {data.issues.slice(0, 25).map((i, n) => (
                    <li key={n}>
                      Row {i.row}: {i.message}
                    </li>
                  ))}
                  {data.issues.length > 25 && <li>and {data.issues.length - 25} more</li>}
                </ul>
              </div>
            )}
            {check && !done && <ResultBox result={check} title="If you import this file" />}
            {done && <ResultBox result={done} title="Imported" tone="success" />}
            {!done && (
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  disabled={pending || missing.length > 0 || !data.records.length}
                  onClick={() =>
                    start(async () => {
                      setError("");
                      const r = await runImport({ ...payload(), mapping, asOf, commit: false });
                      if (r.error) return setError(r.error);
                      setCheck(r.result ?? null);
                    })
                  }
                >
                  {pending && !check ? "Checking…" : "Check against what's already here"}
                </Button>
                {check && (
                  <Button
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        setError("");
                        const r = await runImport({ ...payload(), mapping, asOf, commit: true });
                        if (r.error) return setError(r.error);
                        setDone(r.result ?? null);
                      })
                    }
                  >
                    {pending ? "Importing…" : `Import ${data.records.length} rows`}
                  </Button>
                )}
              </div>
            )}
            {error && <Notice tone="danger">{error}</Notice>}
          </div>
        </Card>
      )}
    </div>
  );
}

function ResultBox({ result, title, tone = "info" }: { result: ImportResult; title: string; tone?: "info" | "success" }) {
  return (
    <Notice tone={tone}>
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 font-normal">
        {[...result.done, ...result.skipped, ...result.problems].map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </Notice>
  );
}

function Preview({ data }: { data: Normalized }) {
  const head = (cols: string[]) => (
    <Thead>
      {cols.map((c) => (
        <Th key={c}>{c}</Th>
      ))}
    </Thead>
  );
  const rows = data.records.slice(0, 8);
  if (!rows.length) return null;
  return (
    <div className="rounded-[var(--radius-control)] border border-line">
      <p className="px-5 pt-3 text-[13px] font-semibold text-muted">First {rows.length} rows as they&apos;ll be saved</p>
      <Table minWidth={720}>
        {data.kind === "rent_roll" && (
          <>
            {head(["Property", "Unit", "Tenant", "Rent", "Deposit", "Balance", "Lease"])}
            <Tbody>
              {data.records.slice(0, 8).map((r) => (
                <tr key={r.row}>
                  <Td>{r.property}</Td>
                  <Td>{r.unit}</Td>
                  <Td>{r.tenant ? (r.tenant.business_name ?? `${r.tenant.first_name ?? ""} ${r.tenant.last_name ?? ""}`) : <span className="text-subtle">Vacant</span>}</Td>
                  <Td right>{dollars(r.rent_cents)}</Td>
                  <Td right>{dollars(r.deposit_cents)}</Td>
                  <Td right>{dollars(r.balance_cents)}</Td>
                  <Td>{[r.start_date ?? r.move_in_on, r.end_date ?? "month-to-month"].filter(Boolean).join(" to ")}</Td>
                </tr>
              ))}
            </Tbody>
          </>
        )}
        {data.kind === "tenants" && (
          <>
            {head(["Tenant", "E-mail", "Phone", "Mobile", "Property / unit"])}
            <Tbody>
              {data.records.slice(0, 8).map((r) => (
                <tr key={r.row}>
                  <Td>{r.name.full}</Td>
                  <Td>{r.email}</Td>
                  <Td>{r.phone}</Td>
                  <Td>{r.mobile}</Td>
                  <Td>{[r.property, r.unit].filter(Boolean).join(" ")}</Td>
                </tr>
              ))}
            </Tbody>
          </>
        )}
        {data.kind === "vendors" && (
          <>
            {head(["Vendor", "Trade", "Phone", "E-mail", "1099", "Insurance expires"])}
            <Tbody>
              {data.records.slice(0, 8).map((r) => (
                <tr key={r.row}>
                  <Td>{r.business_name ?? `${r.first_name ?? ""} ${r.last_name ?? ""}`}</Td>
                  <Td>{r.trade}</Td>
                  <Td>{r.phone ?? r.mobile}</Td>
                  <Td>{r.email}</Td>
                  <Td>{r.is_1099 ? "Yes" : "No"}</Td>
                  <Td>{r.coi_expires_on}</Td>
                </tr>
              ))}
            </Tbody>
          </>
        )}
        {data.kind === "owners" && (
          <>
            {head(["Owner", "Type", "E-mail", "Phone", "Properties"])}
            <Tbody>
              {data.records.slice(0, 8).map((r) => (
                <tr key={r.row}>
                  <Td>{r.name}</Td>
                  <Td>{r.entity_type}</Td>
                  <Td>{r.email}</Td>
                  <Td>{r.phone}</Td>
                  <Td>{r.properties.join(", ")}</Td>
                </tr>
              ))}
            </Tbody>
          </>
        )}
      </Table>
    </div>
  );
}
