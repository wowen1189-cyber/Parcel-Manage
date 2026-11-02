import "server-only";
import mammoth from "mammoth";
import { getDocumentProxy } from "unpdf";

// Text from an uploaded agreement (PDF or Word), keeping line breaks so headings can be found
// (lib/agreement-templates.ts textToParts). Scanned PDFs have no text; they come back empty.

export const AGREEMENT_UPLOAD_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export async function agreementText(bytes: Uint8Array, kind: "pdf" | "docx"): Promise<string> {
  if (kind === "docx") return (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
  const pdf = await getDocumentProxy(bytes);
  let out = "";
  for (let i = 1; i <= Math.min(pdf.numPages, 60); i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    for (const item of content.items) {
      if (!("str" in item)) continue;
      out += item.str;
      if (item.hasEOL) out += "\n";
    }
    out += "\n";
  }
  return out;
}
