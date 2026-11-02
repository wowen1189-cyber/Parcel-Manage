// A report as spreadsheet cells (for the Excel export): a title row, a filters row, a bold header, the rows
// and a bold totals row. Money is dollars with two decimals, dates are real dates, percents are percents,
// so the numbers add up in Excel. Kept pure so it can be tested.
import type { Column } from "./report-math";

export type SheetCell = { value: string | number | Date | null; fontWeight?: "bold"; format?: string; type?: typeof String | typeof Number | typeof Date } | null;

function cell(v: unknown, kind: Column["kind"], bold: boolean): SheetCell {
  const style = bold ? { fontWeight: "bold" as const } : {};
  if (v === null || v === undefined || v === "") return { value: null, ...style };
  if (kind === "money") return { value: Number(v) / 100, type: Number, format: "#,##0.00", ...style };
  if (kind === "percent") return { value: Number(v), type: Number, format: "0.0%", ...style };
  if (kind === "number") return { value: Number(v), type: Number, ...style };
  if (kind === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return { value: new Date(`${v}T12:00:00Z`), type: Date, format: "mm/dd/yyyy", ...style };
  return { value: String(v), type: String, ...style };
}

export function reportSheet(title: string, filtersLine: string, columns: Column[], rows: Record<string, unknown>[], totals?: Record<string, unknown>): SheetCell[][] {
  return [
    [{ value: title, fontWeight: "bold" }],
    [{ value: filtersLine }],
    [],
    columns.map((c) => ({ value: c.label, fontWeight: "bold" as const })),
    ...rows.map((r) => columns.map((c) => cell(r[c.key], c.kind, false))),
    ...(totals ? [columns.map((c) => cell(totals[c.key], c.kind, true))] : []),
  ];
}

/** Rough column widths in characters, from the header and the longest value. */
export function columnWidths(columns: Column[], rows: Record<string, unknown>[]): { width: number }[] {
  return columns.map((c) => ({ width: Math.min(60, Math.max(c.label.length, ...rows.slice(0, 500).map((r) => String(r[c.key] ?? "").length), c.kind === "money" ? 12 : 8) + 2) }));
}
