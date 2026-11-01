// CSV exports for list screens. Opens cleanly in Excel and Google Sheets.

type Cell = string | number | boolean | null | undefined;

function escape(value: Cell): string {
  if (value == null) return "";
  const s = String(value);
  // A leading = + - @ makes spreadsheets run the cell as a formula; prefix it so it stays text.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(escape).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(fileName: string, header: string[], rows: Cell[][]): Response {
  return new Response("﻿" + toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Money for spreadsheets: 1234.5, not "$1,234.50", so it stays a number. */
export function csvMoney(cents: number | null | undefined): string {
  return cents == null ? "" : (cents / 100).toFixed(2);
}
