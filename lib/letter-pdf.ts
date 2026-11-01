import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// A filed copy of a letter or notice as a PDF: letterhead, date, title, statute citation and paragraphs,
// wrapped to US Letter with one-inch margins. Standard fonts only (WinAnsi), so unusual characters are replaced.

const clean = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[^\x20-\x7E\n]/g, "");

export async function letterPdf(input: { letterhead: string[]; date: string; title: string; cite?: string; paragraphs: string[] }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const size = 11.5;
  const lineHeight = 16;
  const margin = 72;
  const width = 612 - margin * 2;
  let page = pdf.addPage([612, 792]);
  let y = 792 - margin;

  const draw = (text: string, f = font, s = size, color = rgb(0.08, 0.12, 0.11)) => {
    for (const para of clean(text).split("\n")) {
      const words = para.split(" ");
      let line = "";
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (f.widthOfTextAtSize(next, s) > width && line) {
          if (y < margin) {
            page = pdf.addPage([612, 792]);
            y = 792 - margin;
          }
          page.drawText(line, { x: margin, y, size: s, font: f, color });
          y -= lineHeight;
          line = w;
        } else line = next;
      }
      if (y < margin) {
        page = pdf.addPage([612, 792]);
        y = 792 - margin;
      }
      page.drawText(line, { x: margin, y, size: s, font: f, color });
      y -= lineHeight;
    }
  };

  for (const l of input.letterhead.filter(Boolean)) draw(l, font, 10, rgb(0.4, 0.39, 0.36));
  y -= 18;
  draw(input.date);
  y -= 10;
  draw(input.title, bold, 13);
  if (input.cite) draw(input.cite, font, 9.5, rgb(0.4, 0.39, 0.36));
  y -= 8;
  for (const p of input.paragraphs) {
    draw(p);
    y -= 8;
  }
  return pdf.save();
}
