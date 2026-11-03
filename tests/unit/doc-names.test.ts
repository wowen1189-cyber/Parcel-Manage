import { describe, expect, it } from "vitest";
import { describeFile, documentName, uniqueNames } from "@/lib/import/doc-names";

// Made-up tenants; the file name patterns are AppFolio's.
describe("AppFolio document names", () => {
  it("names AppFolio's e-signed leases, ledgers and letters by what they are and their date", () => {
    expect(documentName("zoe-q-tester_04-26-2026.pdf", "Zoe Q. Tester")).toBe("Signed lease – Zoe Q. Tester – Apr 26, 2026.pdf");
    expect(documentName("lease_zoe-q-tester_02-28-2025 (1).pdf", "Zoe Q. Tester")).toBe("Signed lease – Zoe Q. Tester – Feb 28, 2025.pdf");
    expect(documentName("tenant_ledger-zoe_q_tester-20260413.pdf", "Zoe Q. Tester")).toBe("Tenant ledger – Zoe Q. Tester – Apr 13, 2026.pdf");
    expect(documentName("elevator_down_zoe_q_tester_103126.pdf", "Zoe Q. Tester")).toBe("Elevator down notice – Zoe Q. Tester – Oct 31, 2026.pdf");
    expect(documentName("trash_disposal_policy_zoe_q_tester_041626.pdf", "Zoe Q. Tester")).toBe("Trash disposal policy – Zoe Q. Tester – Apr 16, 2026.pdf");
    expect(documentName("preview_of_deposit_disposition_refund_zoe_q_tester_060226.pdf", "Zoe Q. Tester")).toBe("Deposit disposition (preview) – Zoe Q. Tester – Jun 2, 2026.pdf");
  });

  it("turns camera, scanner and random names into Photo or Scan", () => {
    expect(documentName("IMG_7042.jpeg", "Zoe Q. Tester")).toBe("Photo – Zoe Q. Tester.jpeg");
    expect(documentName("image.jpg", "Zoe Q. Tester")).toBe("Photo – Zoe Q. Tester.jpg");
    expect(documentName("AD9E85F4-26B6-4CB2-8E44-D45906877833.jpeg", "Zoe Q. Tester")).toBe("Photo – Zoe Q. Tester.jpeg");
    expect(documentName("8503143587034385042.pdf", "Unit 204")).toBe("Scan – Unit 204.pdf");
    expect(documentName("Screenshot_20260311_175501_Chrome.jpg", "Zoe Q. Tester")).toBe("Screenshot – Zoe Q. Tester – Mar 11, 2026.jpg");
  });

  it("tidies other names and doesn't repeat who it's for", () => {
    expect(documentName("Utilities _ Zoe Q.pdf", "Zoe Q. Tester")).toBe("Utilities - Zoe Q.pdf");
    expect(documentName("Certificate of Completion[92].pdf")).toBe("Certificate of Completion.pdf");
    expect(documentName("duke_energy_-_Zoe_Tester.pdf", "Zoe Q. Tester (past tenant)")).toBe("Duke energy - Zoe Tester (past tenant).pdf");
    expect(documentName("Proof of Income (2)", "Zoe Q. Tester")).toBe("Proof of Income – Zoe Q. Tester");
    expect(describeFile("GL_COVERAGESUMMARY_02_09_2024.PDF")).toEqual({ what: "GL COVERAGESUMMARY 02/09/2024", date: "", ext: "pdf" });
    expect(documentName("Zoe Tester _ Lease 07_01_2024-06_30_2025.pdf", "Zoe Q. Tester")).toBe("Zoe Tester - Lease 07/01/2024-06/30/2025.pdf");
    expect(documentName("Promise_to_Pay_Agreement_Zoe_Tester.pdf", "Zoe Q. Tester (past tenant)")).toBe("Promise to Pay Agreement Zoe Tester (past tenant).pdf");
    expect(documentName(",DanaInfo=example.org,SSL+REPORT (1).pdf", "Zoe Q. Tester")).toBe("Document – Zoe Q. Tester.pdf");
    expect(documentName("att.OTHAMHf1UQjhF4dn_aZipy0ZViwjOBg2iv2q5_bE5Fw.jpg", "Zoe Q. Tester")).toBe("Photo – Zoe Q. Tester.jpg");
  });

  it("numbers repeats on the same record", () => {
    expect(uniqueNames(["Photo – Zoe.jpeg", "Photo – Zoe.jpeg", "Scan", "Scan"])).toEqual(["Photo – Zoe.jpeg", "Photo – Zoe (2).jpeg", "Scan", "Scan (2)"]);
  });
});
