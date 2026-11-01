// Document templates: SIM REI's residential lease and disclosures, rebuilt with the Florida law fixes
// from docs/reference/lease-review-2026-11.md, and SIM REI's commercial lease (ch. 83 Part I).

import { COMMERCIAL_LEASE } from "./commercial-lease";
import { FLOOD_DISCLOSURE } from "./flood-disclosure";
import { LEAD_PAINT_DISCLOSURE } from "./lead-paint-disclosure";
import { RESIDENTIAL_LEASE } from "./residential-lease";

export { COMMERCIAL_LEASE, FLOOD_DISCLOSURE, LEAD_PAINT_DISCLOSURE, RESIDENTIAL_LEASE };

/** Residential lease and its Florida disclosures. */
export const TEMPLATES = [RESIDENTIAL_LEASE, FLOOD_DISCLOSURE, LEAD_PAINT_DISCLOSURE];

/** Commercial (nonresidential) lease, ch. 83 Part I. */
export const COMMERCIAL_TEMPLATES = [COMMERCIAL_LEASE];
