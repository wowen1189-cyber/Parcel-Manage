import { NextResponse, type NextRequest } from "next/server";
import { verifySvix } from "@/lib/invoice-intake-rules";
import { receiveInvoiceEmail } from "@/lib/invoice-intake";

// Resend "email.received" webhook: invoices e-mailed to a company's bills address (lib/invoice-intake.ts).
// The body only carries the e-mail's id; its content is fetched from Resend's API.

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const ok = verifySvix(raw, { id: request.headers.get("svix-id"), timestamp: request.headers.get("svix-timestamp"), signature: request.headers.get("svix-signature") }, process.env.RESEND_WEBHOOK_SECRET);
  if (!ok) return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  const event = JSON.parse(raw) as { type?: string; data?: { email_id?: string } };
  if (event.type !== "email.received" || !event.data?.email_id) return NextResponse.json({ received: true });
  try {
    const result = await receiveInvoiceEmail(event.data.email_id);
    return NextResponse.json({ received: true, status: result.status });
  } catch {
    // Resend retries on an error, e.g. when its API couldn't be reached.
    return NextResponse.json({ error: "Couldn't fetch the e-mail" }, { status: 500 });
  }
}
