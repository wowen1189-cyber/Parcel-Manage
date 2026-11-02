import { describe, expect, it } from "vitest";
import { formatLakeParcel, normalizeAddress, parseLakeDescription } from "@/lib/integrations/property-appraiser/lookup";
import { readCommercialTerms, withCurrent } from "@/lib/commercial-terms";

describe("county legal description lookup", () => {
  it("writes addresses the way the appraiser does", () => {
    expect(normalizeAddress("123 North Sample Street")).toBe("123 N SAMPLE ST");
    expect(normalizeAddress("45 Oak Lane, #2")).toBe("45 OAK LN 2");
  });
  it("prints Lake County parcel numbers with dashes", () => {
    expect(formatLakeParcel("111926010003601301")).toBe("11-19-26-0100-036-01301");
    expect(formatLakeParcel("271924210000C00601")).toBe("27-19-24-2100-00C-00601");
  });
  it("reads the property description cell", () => {
    const html = `<tr><td class="property_field">Property Description:</td>\n <td class="property_item" colspan="3">SAMPLE PB 1 PG 2 LOTS 3 &amp; 4 BLOCK 5</td></tr>`;
    expect(parseLakeDescription(html)).toBe("SAMPLE PB 1 PG 2 LOTS 3 & 4 BLOCK 5");
    expect(parseLakeDescription("<p>nothing</p>")).toBeNull();
  });
});

describe("commercial term choices", () => {
  it("defaults renewals to 1 year at a 5% higher rent", () => {
    expect(readCommercialTerms({})).toMatchObject({ renewalTermMonths: 12, renewalIncreasePercent: 5 });
  });
  it("keeps a lease's own value in the choice list", () => {
    expect(withCurrent([0, 3, 5], 4)).toEqual([0, 3, 4, 5]);
    expect(withCurrent([0, 3, 5], 3)).toEqual([0, 3, 5]);
  });
});
