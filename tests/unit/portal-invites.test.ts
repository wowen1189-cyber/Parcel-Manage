import { describe, expect, it } from "vitest";
import { emailList, inviteRow, type Invitee } from "@/lib/portal-invites";

// Made-up people.
const base: Invitee = { key: "t:00000000-0000-0000-0000-000000000001", name: "Zoe Tester", greet: "Zoe", detail: "Test Duplex · A", emails: ["zoe@example.test"], invitedAt: null, usingPortal: false };

describe("portal invites", () => {
  it("reads every valid address in an e-mail field, once (any letter case)", () => {
    expect(emailList("a@example.test, b@example.test; A@example.test")).toEqual(["a@example.test", "b@example.test"]);
    expect(emailList("a@example.test,a@example.test, not-an-email")).toEqual(["a@example.test"]);
    expect(emailList(null)).toEqual([]);
  });

  it("shows who's using the portal, invited, not invited or has no e-mail", () => {
    expect(inviteRow(base, "America/New_York").status).toBe("new");
    expect(inviteRow({ ...base, emails: [] }, "America/New_York").status).toBe("no-email");
    expect(inviteRow({ ...base, usingPortal: true, invitedAt: "2026-11-03T15:00:00Z" }, "America/New_York").status).toBe("using");
    const invited = inviteRow({ ...base, invitedAt: "2026-11-04T02:00:00Z" }, "America/New_York");
    expect(invited).toMatchObject({ status: "invited", invitedOn: "Nov 3, 2026" });
  });
});
