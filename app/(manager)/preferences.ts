"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/supabase/database.types";
import { z } from "zod";
import { NAV_GROUPS, NAV_ITEMS } from "@/lib/nav";
import { requireCompany } from "@/lib/session";
import { DASHBOARD_TILES } from "@/lib/dashboard-tiles";

// Saves one person's screen preferences (menu order, dashboard layout) on their own profile.

const groupIds = NAV_GROUPS.map((g) => g.id) as [string, ...string[]];
const slugs = NAV_ITEMS.map((i) => i.slug) as [string, ...string[]];
const tileIds = DASHBOARD_TILES.map((t) => t.id) as [string, ...string[]];

const navSchema = z.object({
  groups: z.array(z.enum(groupIds)).max(groupIds.length),
  items: z.record(z.enum(groupIds), z.array(z.enum(slugs)).max(slugs.length)),
});

const dashboardSchema = z.object({
  order: z.array(z.enum(tileIds)).max(tileIds.length),
  wide: z.array(z.enum(tileIds)).max(tileIds.length),
  hidden: z.array(z.enum(tileIds)).max(tileIds.length),
});

async function save(key: "nav" | "dashboard", value: unknown | null) {
  const { supabase, user } = await requireCompany();
  const { data } = await supabase.from("profile").select("preferences").eq("id", user.id).single();
  const prefs = { ...((data?.preferences as Record<string, unknown>) ?? {}) };
  if (value === null) delete prefs[key];
  else prefs[key] = value;
  const { error } = await supabase.from("profile").update({ preferences: prefs as Json }).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveNavOrder(value: z.infer<typeof navSchema> | null) {
  if (value === null) return save("nav", null);
  const parsed = navSchema.safeParse(value);
  if (!parsed.success) return { error: "That menu order couldn't be saved." };
  return save("nav", parsed.data);
}

export async function saveDashboardLayout(value: z.infer<typeof dashboardSchema> | null) {
  if (value === null) return save("dashboard", null);
  const parsed = dashboardSchema.safeParse(value);
  if (!parsed.success) return { error: "That layout couldn't be saved." };
  return save("dashboard", parsed.data);
}
