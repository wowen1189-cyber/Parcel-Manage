// Switching to Parcel Manage from another property management system. Nothing here is tied to one
// product: each company records what it is leaving (company.settings.switchOver.from) and the checklist,
// cutover posting and notes use that name.

/** Suggestions for the "Moving from" field. Any name can be typed. */
export const PREVIOUS_SOFTWARE = [
  "AppFolio",
  "Buildium",
  "Rent Manager",
  "Yardi Breeze",
  "Yardi Voyager",
  "Propertyware",
  "RentVine",
  "DoorLoop",
  "TenantCloud",
  "Rentec Direct",
  "RentRedi",
  "Entrata",
  "ResMan",
  "MRI",
  "QuickBooks",
  "Spreadsheets",
];

/** What the company is leaving, as typed in the checklist; null until someone sets it. */
export function previousSoftware(settings: unknown): string | null {
  const so = settings && typeof settings === "object" && "switchOver" in settings ? (settings as { switchOver: unknown }).switchOver : null;
  const from = so && typeof so === "object" && "from" in so ? (so as { from: unknown }).from : null;
  return typeof from === "string" && from.trim() ? from.trim().slice(0, 60) : null;
}

/** The name to show in sentences: the software's own name, or "your old software" if not set. */
export function oldSystemName(settings: unknown): string {
  return previousSoftware(settings) ?? "your old software";
}

// Payment references that mark what the cutover posted, so running it again skips those leases.
// The AppFolio-worded ones were written before the switch-over became product-neutral; keep matching them.
export const CUTOVER_DEPOSIT_REF = "Held at cutover";
export const CUTOVER_CREDIT_REF = "Credit at cutover";
export const CUTOVER_DEPOSIT_REFS = [CUTOVER_DEPOSIT_REF, "Held at AppFolio cutover"];
export const CUTOVER_CREDIT_REFS = [CUTOVER_CREDIT_REF, "Credit from AppFolio"];
