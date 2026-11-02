import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cleanRead, guessAmountCents, guessInvoiceNumber, inboundAddress, invoiceFlags, parseInvoiceRead, subdomainFromRecipients, vendorByEmail, verifySvix } from "@/lib/invoice-intake-rules";

const vendors = [
  { id: "v1", name: "ZZ Ace Plumbing", email: "Billing@zz-ace.test" },
  { id: "v2", name: "ZZ Cool Air", email: null },
];
const properties = [
  { id: "p1", name: "ZZ Oak Street", address: "1 Oak St, Testville" },
  { id: "p2", name: "ZZ Pine Court", address: "2 Pine Ct, Testville" },
];
const workOrders = [{ number: 1042, title: "Kitchen leak", propertyId: "p1", vendorId: "v1" }];
const ctx = { vendors, properties, workOrders, accounts: ["5000", "5200"] };

describe("e-mailed invoices", () => {
  it("gives each company its own address and finds the company from it", () => {
    expect(inboundAddress("zz-test", "in.example.test")).toBe("bills-zz-test@in.example.test");
    expect(subdomainFromRecipients(["Office <someone@else.test>", "BILLS-zz-test@IN.example.test"], "in.example.test")).toBe("zz-test");
    expect(subdomainFromRecipients(["bills-zz-test@inXexample.test"], "in.example.test")).toBeNull();
    expect(subdomainFromRecipients(["support@in.example.test"], "in.example.test")).toBeNull();
  });

  it("checks Resend's signature and refuses old or altered messages", () => {
    const secret = "whsec_" + Buffer.from("zz-test-secret").toString("base64");
    const body = '{"type":"email.received","data":{"email_id":"e1"}}';
    const ts = "1800000000";
    const sig = createHmac("sha256", Buffer.from("zz-test-secret")).update(`msg_1.${ts}.${body}`).digest("base64");
    const h = { id: "msg_1", timestamp: ts, signature: `v1,bad v1,${sig}` };
    expect(verifySvix(body, h, secret, 1800000000_000)).toBe(true);
    expect(verifySvix(body + " ", h, secret, 1800000000_000)).toBe(false);
    expect(verifySvix(body, h, secret, 1800000400_000)).toBe(false);
    expect(verifySvix(body, h, undefined, 1800000000_000)).toBe(false);
  });

  it("finds the total and invoice number without AI", () => {
    expect(guessAmountCents("Subtotal $100.00\nTax $7.00\nAmount due: $1,107.00")).toBe(110700);
    expect(guessAmountCents("Thanks for your business")).toBeNull();
    expect(guessInvoiceNumber("INVOICE # A-1042\nDate 10/1")).toBe("A-1042");
  });

  it("matches the sender to a vendor by e-mail, ignoring case and display name", () => {
    expect(vendorByEmail("Ace <billing@ZZ-ace.test>", vendors)?.id).toBe("v1");
    expect(vendorByEmail("stranger@zz.test", vendors)).toBeNull();
  });

  it("keeps only the AI's answers that point at this company's records", () => {
    const read = parseInvoiceRead('```json\n{"vendor_id":"v1","property_id":"made-up","work_order_number":1042,"invoice_number":"A-1042","invoice_date":"2026-10-30","due_date":"2026-11-29","amount_cents":24500,"expense_account":"9999","memo":"Fixed leak","notes":["Late fee added"]}\n```');
    expect(read).not.toBeNull();
    const c = cleanRead(read!, ctx);
    expect(c.vendorId).toBe("v1");
    expect(c.propertyId).toBe("p1"); // from the work order, since the AI's property id isn't real
    expect(c.workOrder?.number).toBe(1042);
    expect(c.expenseAccount).toBe("5000");
    expect(c.amountCents).toBe(24500);
    expect(parseInvoiceRead("Sorry, I can't")).toBeNull();
    expect(parseInvoiceRead('{"amount_cents": -5}')).toBeNull();
  });

  it("drops a work order that's for a different property", () => {
    const c = cleanRead({ property_id: "p2", work_order_number: 1042 }, ctx);
    expect(c.propertyId).toBe("p2");
    expect(c.workOrder).toBeNull();
  });

  it("tells the approver what to check", () => {
    const flags = invoiceFlags({ senderKnown: false, vendorFound: true, propertyFound: false, amountCents: 90000, duplicateOf: "A-1042", vendorAverageCents: 20000, noAttachment: false, aiUsed: true });
    expect(flags.join(" ")).toMatch(/isn't on any vendor's record/);
    expect(flags.join(" ")).toMatch(/Property not identified/);
    expect(flags.join(" ")).toMatch(/Possible duplicate: this vendor's invoice A-1042/);
    expect(flags.join(" ")).toMatch(/Much higher/);
    expect(invoiceFlags({ senderKnown: true, vendorFound: true, propertyFound: true, amountCents: 100, duplicateOf: null, vendorAverageCents: 100, noAttachment: false, aiUsed: true })).toEqual([]);
  });
});
