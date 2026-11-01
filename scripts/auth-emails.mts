// Builds the Supabase Auth emails (sign-in link, confirm email, reset password, change email) from
// lib/email/layout.ts and installs them on the Supabase project, so the designs live in the repo.
// Run: SUPABASE_ACCESS_TOKEN=... npm run auth:emails            (prints a preview file path, changes nothing)
//      SUPABASE_ACCESS_TOKEN=... npm run auth:emails -- --apply
// Links carry token_hash so they work in any browser or device (see app/auth/callback/route.ts).
// Supabase sends these for every company, so they say "Parcel Manage", never a company name.

import { mkdirSync, writeFileSync } from "node:fs";
import { emailHtml, type EmailContent } from "../lib/email/layout.ts";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "kfnqedhwupsmmhsunvfl";
const apply = process.argv.includes("--apply");
const link = (type: string) => `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=${type}`;

const templates: Record<string, { subject: string; content: EmailContent }> = {
  magic_link: {
    subject: "Your Parcel Manage sign-in link",
    content: {
      preheader: "Tap the button to sign in. The link works for one hour.",
      heading: "Sign in to Parcel Manage",
      paragraphs: ["Hi there,", "Tap the button below to sign in. No password needed."],
      button: { label: "Sign in", url: link("email") },
      note: "This link works for <strong>one hour</strong>, on any phone or computer, and can be used once.",
      footer: "Requested for {{ .Email }}",
    },
  },
  confirmation: {
    subject: "Confirm your email for Parcel Manage",
    content: {
      preheader: "One tap to confirm your email and finish signing up.",
      heading: "Confirm your email",
      paragraphs: ["Welcome to Parcel Manage.", "Tap the button below to confirm this is your email address and finish setting up your account."],
      button: { label: "Confirm my email", url: link("email") },
      note: "This link works for <strong>one hour</strong> and can be used once.",
      footer: "Sent to {{ .Email }}",
    },
  },
  recovery: {
    subject: "Reset your Parcel Manage password",
    content: {
      preheader: "Choose a new password for Parcel Manage.",
      heading: "Reset your password",
      paragraphs: ["We received a request to reset the password for your Parcel Manage account.", "Tap the button below to choose a new one."],
      button: { label: "Choose a new password", url: link("recovery") },
      note: "This link works for <strong>one hour</strong>. If you didn&#39;t ask for this, your password stays the same.",
      footer: "Requested for {{ .Email }}",
    },
  },
  email_change: {
    subject: "Confirm your new email for Parcel Manage",
    content: {
      preheader: "Confirm the change to your Parcel Manage email address.",
      heading: "Confirm your new email",
      paragraphs: ["Someone asked to change the email on a Parcel Manage account to <strong>{{ .NewEmail }}</strong>.", "If that was you, tap the button below to confirm."],
      button: { label: "Confirm new email", url: link("email_change") },
      note: "If you didn&#39;t ask for this, ignore this email and nothing changes.",
      footer: "Sent to {{ .Email }}",
    },
  },
};

const body: Record<string, string> = {};
for (const [key, t] of Object.entries(templates)) {
  body[`mailer_subjects_${key}`] = t.subject;
  body[`mailer_templates_${key}_content`] = emailHtml(t.content);
}

mkdirSync("scripts/.out", { recursive: true });
const preview = "scripts/.out/sign-in-email.html";
writeFileSync(preview, emailHtml({ ...templates.magic_link.content, button: { ...templates.magic_link.content.button!, url: "https://simreipm.parcelmanage.com/auth/callback?next=%2Fdashboard&token_hash=example&type=email" } }).replace(/\{\{ \.Email \}\}/g, "you@example.com"));
console.log(`Preview: ${preview}`);

if (!apply) {
  console.log("Dry run. Add --apply to install the templates on Supabase.");
} else {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("Set SUPABASE_ACCESS_TOKEN (a Supabase personal access token).");
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase said ${res.status}: ${await res.text()}`);
  console.log(`Installed ${Object.keys(templates).length} email templates.`);
}
