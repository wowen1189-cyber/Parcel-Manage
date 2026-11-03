import { describe, expect, it } from "vitest";
import { twilioSignature, validTwilioRequest } from "@/lib/integrations/twilio/client";
import { keyword, outboundText, prettyPhone, textMode, toE164 } from "@/lib/sms";

// Made-up numbers (555-01xx is reserved for fiction).
describe("texting", () => {
  it("turns US numbers into +1 and 10 digits, and refuses anything else", () => {
    expect(toE164("(352) 555-0100")).toBe("+13525550100");
    expect(toE164("1-352-555-0100")).toBe("+13525550100");
    expect(toE164("+1 352 555 0100")).toBe("+13525550100");
    expect(toE164("555-0100")).toBeNull();
    expect(toE164("(052) 555-0100")).toBeNull();
    expect(toE164(null)).toBeNull();
    expect(prettyPhone("+13525550100")).toBe("(352) 555-0100");
  });

  it("knows the carrier STOP, START and HELP words, only as the whole message", () => {
    for (const w of ["STOP", "stop", " Stop. ", "unsubscribe", "Cancel", "END", "quit", "STOPALL", "opt out"]) expect(keyword(w)).toBe("stop");
    for (const w of ["START", "unstop", "Yes"]) expect(keyword(w)).toBe("start");
    expect(keyword("help")).toBe("help");
    expect(keyword("Please stop by at 3")).toBeNull();
    expect(keyword("Thanks!")).toBeNull();
  });

  it("starts every text with the company name and adds how to stop on the first one", () => {
    expect(outboundText("Test PM", "Rent is due Friday.", true)).toBe("Test PM: Rent is due Friday.\nReply STOP to opt out.");
    expect(outboundText("Test PM", "Rent is due Friday.", false)).toBe("Test PM: Rent is due Friday.");
    expect(outboundText("Test PM", "Test PM here, your repair is booked.", false)).toBe("Test PM here, your repair is booked.");
  });

  it("stays in practice mode until Twilio, the number and the admin's switch are all set", () => {
    expect(textMode({ sms_from_number: "+13525550100", sms_live: true }, false).live).toBe(false);
    expect(textMode({ sms_from_number: null, sms_live: true }, true).live).toBe(false);
    expect(textMode({ sms_from_number: "+13525550100", sms_live: false }, true).live).toBe(false);
    expect(textMode({ sms_from_number: "+13525550100", sms_live: true }, true).live).toBe(true);
  });

  it("checks Twilio's webhook signature (Twilio's published example)", () => {
    const url = "https://mycompany.com/myapp.php?foo=1&bar=2";
    const params = { CallSid: "CA1234567890ABCDE", Caller: "+12349013030", Digits: "1234", From: "+12349013030", To: "+18005551212" };
    expect(twilioSignature("12345", url, params)).toBe("0/KCTR6DLpKmkAf8muzZqo1nDgQ=");
    expect(validTwilioRequest(url, params, "0/KCTR6DLpKmkAf8muzZqo1nDgQ=", "12345")).toBe(true);
    expect(validTwilioRequest(url, { ...params, Digits: "9999" }, "0/KCTR6DLpKmkAf8muzZqo1nDgQ=", "12345")).toBe(false);
    expect(validTwilioRequest(url, params, null, "12345")).toBe(false);
    expect(validTwilioRequest(url, params, "0/KCTR6DLpKmkAf8muzZqo1nDgQ=", undefined)).toBe(false);
  });
});
