"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseIcs } from "@/lib/ical";
import { requireCompany } from "@/lib/session";
import { newToken } from "@/lib/vendor-requests";

// Self-serve calendar connection: each person manages only their own subscription link and calendars.

export type CalState = { error?: string; message?: string; link?: string };

/** A new private subscription link (replaces any earlier one, which stops working). Shown once. */
export async function makeFeedLink(): Promise<CalState> {
  const { supabase, company, user } = await requireCompany();
  const { token, hash } = newToken();
  const { error } = await supabase.from("calendar_feed").upsert({ company_id: company.id, profile_id: user.id, token_hash: hash, created_at: new Date().toISOString(), last_read_at: null }, { onConflict: "company_id,profile_id" });
  if (error) return { error: "The link couldn't be made." };
  revalidatePath("/calendar");
  return { link: token };
}

export async function stopFeedLink(): Promise<void> {
  const { supabase, company, user } = await requireCompany();
  await supabase.from("calendar_feed").delete().eq("company_id", company.id).eq("profile_id", user.id);
  revalidatePath("/calendar");
}

/** Add one of your calendars by its secret iCal address (read now, so a wrong address is caught at once). */
export async function addCalendar(_: CalState, form: FormData): Promise<CalState> {
  const { supabase, company, user } = await requireCompany();
  const p = z
    .object({
      name: z.string().trim().min(1, "Name the calendar (for example: Work).").max(60),
      url: z
        .string()
        .trim()
        .transform((u) => u.replace(/^webcal:\/\//i, "https://"))
        .refine((u) => /^https:\/\/[^\s]+$/i.test(u), "Paste the calendar's secret address in iCal format (it starts with https:// and ends in .ics)."),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  try {
    const res = await fetch(p.data.url, { signal: AbortSignal.timeout(10_000), headers: { Accept: "text/calendar" } });
    const text = res.ok ? await res.text() : "";
    if (!text.includes("BEGIN:VCALENDAR")) return { error: "That address didn't return a calendar. In Google Calendar use Settings → your calendar → Integrate calendar → Secret address in iCal format." };
    const n = parseIcs(text, new Date(), new Date(Date.now() + 14 * 86_400_000), company.time_zone).length;
    const { error } = await supabase.from("external_calendar").insert({ company_id: company.id, profile_id: user.id, name: p.data.name, ics_url: p.data.url, last_fetched_at: new Date().toISOString() });
    if (error) return { error: "The calendar couldn't be saved." };
    revalidatePath("/calendar");
    return { message: `Connected. ${n} event${n === 1 ? "" : "s"} in the next two weeks.` };
  } catch {
    return { error: "That address couldn't be reached. Check it and try again." };
  }
}

export async function removeCalendar(id: string): Promise<void> {
  const { supabase, company, user } = await requireCompany();
  await supabase.from("external_calendar").delete().eq("id", id).eq("company_id", company.id).eq("profile_id", user.id);
  revalidatePath("/calendar");
}
