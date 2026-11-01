// One look for every email Parcel Manage sends: sign-in links (Supabase), invites and notices (Resend).
// Email clients ignore most CSS, so this is table-based HTML with inline styles, no images (the mark is a
// colored cell, so it shows even when images are blocked), and a 600px column that shrinks on phones.

const C = {
  bg: "#f9f6f2",
  surface: "#ffffff",
  line: "#e9e6e0",
  ink: "#14201c",
  muted: "#4f4b44",
  subtle: "#67635b",
  accent: "#007852",
  accentDeep: "#043728",
  accentSoft: "#e7f8f1",
};
const FONT = "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif";

export type EmailContent = {
  /** Hidden inbox preview line. */
  preheader: string;
  heading: string;
  /** Paragraphs of trusted HTML (escape any user text before passing it in). */
  paragraphs: string[];
  button?: { label: string; url: string };
  /** Small print under the button, e.g. "This link works for one hour." */
  note?: string;
  /** Who it's from, shown under the mark, e.g. a company name. */
  fromLine?: string;
  /** Footer line, e.g. "Sent by SIM REI Property Management · (352) 715-6203" */
  footer?: string;
};

export function emailHtml(e: EmailContent): string {
  const p = (html: string) => `<p style="margin:0 0 16px;font:16px/1.55 ${FONT};color:${C.muted};">${html}</p>`;
  const button = e.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;"><tr>
        <td style="border-radius:12px;background:${C.accent};">
          <a href="${e.button.url}" target="_blank" style="display:inline-block;padding:15px 30px;font:700 16px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:12px;">${e.button.label}</a>
        </td></tr></table>`
    : "";
  const fallback = e.button
    ? `<p style="margin:0 0 4px;font:13px/1.5 ${FONT};color:${C.subtle};">Button not working? Copy this link into your browser:</p>
       <p style="margin:0 0 20px;font:13px/1.5 ${FONT};word-break:break-all;"><a href="${e.button.url}" style="color:${C.accent};">${e.button.url}</a></p>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${e.heading}</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
    <tr><td style="padding:0 4px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="40" height="40" align="center" valign="middle" style="width:40px;height:40px;background:${C.accent};border-radius:11px;font:800 19px/40px ${FONT};color:#ffffff;">P</td>
        <td style="padding-left:12px;">
          <div style="font:800 17px/1.2 ${FONT};color:${C.ink};letter-spacing:-0.01em;">Parcel Manage</div>
          ${e.fromLine ? `<div style="font:13px/1.3 ${FONT};color:${C.subtle};">${e.fromLine}</div>` : ""}
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="background:${C.surface};border:1px solid ${C.line};border-radius:18px;">
      <div style="height:6px;background:${C.accent};border-radius:18px 18px 0 0;"></div>
      <div style="padding:32px 32px 16px;">
        <h1 style="margin:0 0 16px;font:800 26px/1.2 ${FONT};color:${C.ink};letter-spacing:-0.015em;">${e.heading}</h1>
        ${e.paragraphs.map(p).join("\n")}
        ${button}
        ${e.note ? `<div style="margin:0 0 20px;padding:12px 16px;background:${C.accentSoft};border-radius:10px;font:14px/1.5 ${FONT};color:${C.accentDeep};">${e.note}</div>` : ""}
        ${fallback}
      </div>
    </td></tr>
    <tr><td style="padding:20px 8px 0;font:12px/1.6 ${FONT};color:${C.subtle};text-align:center;">
      ${e.footer ? `${e.footer}<br>` : ""}Didn&#39;t expect this email? You can safely ignore it.
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

/** Plain-text version for clients that don't show HTML (and for spam filters, which like having both). */
export function emailText(e: EmailContent): string {
  const strip = (h: string) => h.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  return [
    e.heading,
    "",
    ...e.paragraphs.map(strip).flatMap((x) => [x, ""]),
    ...(e.button ? [`${e.button.label}: ${e.button.url}`, ""] : []),
    ...(e.note ? [strip(e.note), ""] : []),
    e.footer ? strip(e.footer) : "",
  ].join("\n").trim();
}
