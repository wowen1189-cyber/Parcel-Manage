// Dashboard tiles (docs/01-product-spec.md §3): each person can move them, make them half or full width,
// hide them, and reset. Layout is saved on their profile (profile.preferences.dashboard).

export type TileDef = { id: string; title: string; wide: boolean };

export const DASHBOARD_TILES: TileDef[] = [
  { id: "key-numbers", title: "Key numbers", wide: true },
  { id: "owes", title: "Who owes the most", wide: false },
  { id: "ending", title: "Leases ending in 90 days", wide: false },
  { id: "expirations", title: "Lease expirations", wide: false },
  { id: "vendors", title: "Vendors missing paperwork", wide: false },
  { id: "work-orders", title: "Open work orders", wide: false },
];

export type DashboardPrefs = { order?: string[]; wide?: string[]; hidden?: string[] };

export type TileLayout = { id: string; title: string; wide: boolean; hidden: boolean };

/** Tiles in the person's saved order; tiles added later appear at the end. */
export function dashboardLayout(prefs: DashboardPrefs | null | undefined): TileLayout[] {
  const known = new Set(DASHBOARD_TILES.map((t) => t.id));
  const order = [...(prefs?.order ?? []).filter((id) => known.has(id)), ...DASHBOARD_TILES.map((t) => t.id).filter((id) => !prefs?.order?.includes(id))];
  return order.map((id) => {
    const def = DASHBOARD_TILES.find((t) => t.id === id)!;
    return { id, title: def.title, wide: prefs?.wide ? prefs.wide.includes(id) : def.wide, hidden: prefs?.hidden?.includes(id) ?? false };
  });
}
