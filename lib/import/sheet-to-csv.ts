// An Excel sheet (rows of cells from read-excel-file) as CSV text, so the Import data screen reads .xlsx
// files the same way as CSV. Dates become YYYY-MM-DD; everything else is written as shown.

type Cell = string | number | boolean | Date | null | undefined | object;

function cellText(c: Cell): string {
  if (c == null) return "";
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? "" : c.toISOString().slice(0, 10);
  return String(c);
}

const quote = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function sheetToCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map((c) => quote(cellText(c))).join(",")).join("\n");
}
