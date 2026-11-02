import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import writeExcelFile from "write-excel-file/node";
import { date, money } from "@/lib/format";
import type { Column } from "./report-math";
import { columnWidths, reportSheet } from "./report-sheet";

// Excel and PDF versions of a report (the CSV export is lib/report-math.ts toCsv).

type Report = { title: string; filtersLine: string; columns: Column[]; rows: Record<string, unknown>[]; totals?: Record<string, unknown>; note?: string };

export async function reportXlsx(r: Report): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the library's cell type is a wide union; reportSheet builds valid cells
  return writeExcelFile(reportSheet(r.title, r.filtersLine, r.columns, r.rows, r.totals) as any, { columns: columnWidths(r.columns, r.rows) }).toBuffer();
}

const clean = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/·/g, "-").replace(/✓/g, "Y").replace(/[^\x20-\x7E]/g, "");
const show = (v: unknown, kind?: Column["kind"]) => {
  if (v === null || v === undefined || v === "") return "";
  if (kind === "money") return money(Number(v));
  if (kind === "date") return date(String(v));
  if (kind === "percent") return `${(Number(v) * 100).toFixed(1)}%`;
  return String(v);
};
const right = (k?: Column["kind"]) => k === "money" || k === "number" || k === "percent";

function fit(text: string, font: PDFFont, size: number, width: number): string {
  let t = clean(text);
  if (font.widthOfTextAtSize(t, size) <= width) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > width) t = t.slice(0, -1);
  return `${t}...`;
}

/** A landscape US Letter table: title and filters, the header repeated on each page, totals at the end. */
export async function reportPdf(r: Report, companyName: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [W, H, M] = [792, 612, 36];
  const size = r.columns.length > 9 ? 7 : 8;
  const rowH = size + 6;
  const widths = columnWidths(r.columns, r.rows).map((c) => c.width);
  const scale = (W - 2 * M) / widths.reduce((s, w) => s + w, 0);
  const cols = r.columns.map((c, i) => ({ ...c, w: widths[i] * scale }));
  const ink = rgb(0.08, 0.12, 0.11);
  let page = pdf.addPage([W, H]);
  let y = H - M;
  let pageNo = 1;

  const header = () => {
    let x = M;
    page.drawRectangle({ x: M, y: y - 3, width: W - 2 * M, height: rowH, color: rgb(0.95, 0.94, 0.92) });
    for (const c of cols) {
      const t = fit(c.label, bold, size, c.w - 6);
      page.drawText(t, { x: right(c.kind) ? x + c.w - 3 - bold.widthOfTextAtSize(t, size) : x + 3, y, size, font: bold, color: ink });
      x += c.w;
    }
    y -= rowH;
  };
  const footer = () => page.drawText(clean(`${companyName} - ${r.title} - page ${pageNo}`), { x: M, y: M / 2, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
  const line = (row: Record<string, unknown>, f: PDFFont) => {
    if (y < M + rowH) {
      footer();
      page = pdf.addPage([W, H]);
      pageNo++;
      y = H - M;
      header();
    }
    let x = M;
    for (const c of cols) {
      const t = fit(show(row[c.key], c.kind), f, size, c.w - 6);
      page.drawText(t, { x: right(c.kind) ? x + c.w - 3 - f.widthOfTextAtSize(t, size) : x + 3, y, size, font: f, color: ink });
      x += c.w;
    }
    page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, thickness: 0.3, color: rgb(0.85, 0.84, 0.8) });
    y -= rowH;
  };

  page.drawText(clean(r.title), { x: M, y, size: 15, font: bold, color: ink });
  y -= 18;
  page.drawText(fit(`${companyName} - ${r.filtersLine}`, font, 9, W - 2 * M), { x: M, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
  y -= 14;
  if (r.note) {
    page.drawText(fit(r.note, font, 8, W - 2 * M), { x: M, y, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 14;
  }
  y -= 4;
  header();
  for (const row of r.rows) line(row, font);
  if (r.totals) line(r.totals, bold);
  if (!r.rows.length) page.drawText("Nothing to show for these filters.", { x: M, y, size: 9, font, color: ink });
  footer();
  return pdf.save();
}
