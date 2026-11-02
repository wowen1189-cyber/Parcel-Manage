// Legal descriptions from the county property appraiser, for Exhibit A of the commercial lease
// (lease_settings.legalDescription). Public records, no key needed. Each county publishes them its own way,
// so each supported county has an adapter; other counties return a message and the office types it in.
//
// Lake County: the county's open-data parcel layer finds the parcel from the street address, then the
// appraiser's parcel page has the "Property Description" (an abbreviated legal description with the
// plat book and page). Both are public pages.

const LAKE_PARCELS = "https://gis.lakecountyfl.gov/lakegis/rest/services/OpenData/OpenData1/MapServer/12/query";
const LAKE_PARCEL_PAGE = "https://www.lakecopropappr.com/property-details.aspx?AltKey=";

export type LegalLookup = { legal: string; parcelId: string; sourceUrl: string } | { error: string };
type Address = { address_line1: string | null; city?: string | null; state?: string | null; county?: string | null };

const WORDS: Record<string, string> = {
  NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W", NORTHEAST: "NE", NORTHWEST: "NW", SOUTHEAST: "SE", SOUTHWEST: "SW",
  STREET: "ST", AVENUE: "AVE", ROAD: "RD", DRIVE: "DR", LANE: "LN", BOULEVARD: "BLVD", COURT: "CT", CIRCLE: "CIR",
  PLACE: "PL", TERRACE: "TER", TRAIL: "TRL", PARKWAY: "PKWY", HIGHWAY: "HWY", WAY: "WAY",
};

/** "100 North Dewey Street" → "100 N DEWEY ST", the way the appraiser writes addresses. */
export function normalizeAddress(line: string): string {
  return line
    .toUpperCase()
    .replace(/[.,#]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => WORDS[w] ?? w)
    .join(" ");
}

/** Lake County parcel numbers print as 11-19-26-0100-036-01301. */
export function formatLakeParcel(n: string): string {
  return /^[0-9A-Z]{18}$/.test(n) ? [n.slice(0, 2), n.slice(2, 4), n.slice(4, 6), n.slice(6, 10), n.slice(10, 13), n.slice(13)].join("-") : n;
}

const decode = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The "Property Description" cell of a Lake County appraiser parcel page. */
export function parseLakeDescription(html: string): string | null {
  const m = html.match(/Property Description:\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  const text = m ? decode(m[1]) : "";
  return text || null;
}

async function get(url: string, timeoutMs = 10_000) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Parcel Manage legal description lookup)" }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

async function lakeParcel(address: string): Promise<{ AltKey: string; ParcelNumber: string; PropertyAddress: string }[]> {
  const q = (where: string) =>
    get(`${LAKE_PARCELS}?${new URLSearchParams({ where, outFields: "AltKey,ParcelNumber,PropertyAddress", returnGeometry: "false", f: "json" })}`)
      .then((r) => r.json() as Promise<{ features?: { attributes: { AltKey: string; ParcelNumber: string; PropertyAddress: string } }[] }>)
      .then((j) => (j.features ?? []).map((f) => f.attributes));
  const sql = (s: string) => s.replace(/'/g, "''");
  const exact = await q(`PropertyAddress = '${sql(address)}'`);
  if (exact.length) return exact;
  // Fall back to the house number and the street name, ignoring direction and suffix differences.
  const [num, ...rest] = address.split(" ");
  const name = rest.filter((w) => !Object.values(WORDS).includes(w)).sort((a, b) => b.length - a.length)[0];
  if (!/^\d+$/.test(num ?? "") || !name) return [];
  const loose = await q(`PropertyAddress LIKE '${sql(num)} %${sql(name)}%'`);
  // Prefer the parcel whose address starts with this one ("133 S GROVE ST STE 1&2"), not a look-alike street.
  const same = loose.filter((m) => m.PropertyAddress.startsWith(`${address} `));
  return same.length ? same : loose;
}

export async function lookupLegalDescription(p: Address): Promise<LegalLookup> {
  if (!p.address_line1) return { error: "Add the street address first." };
  const county = (p.county ?? "").replace(/\s*county$/i, "").trim().toLowerCase();
  if ((p.state ?? "FL").toUpperCase() !== "FL" || county !== "lake")
    return { error: `Automatic lookup works for Lake County, Florida so far. Copy the legal description from the deed or the ${p.county ? `${p.county} County` : "county"} property appraiser.` };
  try {
    const matches = await lakeParcel(normalizeAddress(p.address_line1));
    if (!matches.length) return { error: "The Lake County property appraiser has no parcel at this street address. Check the address, or copy the legal description from the deed." };
    if (matches.length > 1) return { error: `The address matches ${matches.length} parcels (${matches.slice(0, 3).map((m) => m.PropertyAddress).join("; ")}). Copy the right legal description from the deed or the appraiser's site.` };
    const sourceUrl = `${LAKE_PARCEL_PAGE}${encodeURIComponent(matches[0].AltKey)}`;
    const legal = parseLakeDescription(await (await get(sourceUrl, 15_000)).text());
    if (!legal) return { error: "Found the parcel, but its page had no legal description. Copy it from the deed." };
    return { legal, parcelId: formatLakeParcel(matches[0].ParcelNumber), sourceUrl };
  } catch {
    return { error: "The county's website didn't answer. Try again in a few minutes." };
  }
}

/** The text stored for Exhibit A: the description, then the parcel number. */
export function legalDescriptionText(r: { legal: string; parcelId: string }) {
  return `${r.legal}\nParcel ID ${r.parcelId}`;
}
