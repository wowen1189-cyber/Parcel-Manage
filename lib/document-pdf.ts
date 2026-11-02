import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { DocText } from "@/lib/documents/text";

// The signed copy: every document as text, then a signature certificate page (who signed, when, from where,
// and the document fingerprint). US Letter, one-inch margins, standard fonts.

const clean = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/•/g, "-").replace(/✓/g, "X").replace(/[^\x20-\x7E\n]/g, "");

export async function documentPdf(docs: DocText[], certificate: { title: string; lines: string[] }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const margin = 72;
  const width = 612 - margin * 2;
  let page: PDFPage = pdf.addPage([612, 792]);
  let y = 792 - margin;
  const newPage = () => {
    page = pdf.addPage([612, 792]);
    y = 792 - margin;
  };
  const draw = (text: string, f: PDFFont = font, size = 10.5, gap = 4) => {
    for (const para of clean(text).split("\n")) {
      let line = "";
      for (const w of para.split(" ")) {
        const next = line ? `${line} ${w}` : w;
        if (f.widthOfTextAtSize(next, size) > width && line) {
          if (y < margin) newPage();
          page.drawText(line, { x: margin, y, size, font: f, color: rgb(0.08, 0.12, 0.11) });
          y -= size + 4;
          line = w;
        } else line = next;
      }
      if (y < margin) newPage();
      page.drawText(line, { x: margin, y, size, font: f, color: rgb(0.08, 0.12, 0.11) });
      y -= size + 4;
    }
    y -= gap;
  };
  for (const d of docs) {
    if (y < 792 - margin) newPage();
    draw(d.title, bold, 15, 10);
    for (const s of d.sections) {
      if (s.heading) draw(s.heading, bold, 12, 4);
      for (const p of s.paragraphs) draw(p);
    }
  }
  // The certificate starts on its own page (unless nothing came before it).
  if (y < 792 - margin) newPage();
  draw(certificate.title, bold, 14, 10);
  for (const l of certificate.lines) draw(l, font, 10, 2);
  return pdf.save();
}

/** An uploaded PDF, signed: the original pages unchanged, then the signature certificate. */
export async function appendCertificate(original: Uint8Array, certificate: { title: string; lines: string[] }): Promise<Uint8Array> {
  const out = await PDFDocument.load(original, { ignoreEncryption: true });
  const cert = await PDFDocument.load(await documentPdf([], certificate));
  for (const page of await out.copyPages(cert, cert.getPageIndices())) out.addPage(page);
  return out.save();
}
