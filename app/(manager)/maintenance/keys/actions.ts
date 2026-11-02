"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompany } from "@/lib/session";

export type KeysState = { error?: string; message?: string; values?: Record<string, string> };

const EDIT = ["admin", "property_manager", "maintenance", "leasing_agent"];
const NOT_ALLOWED = "Your role can't change keys or inventory.";
const typed = (form: FormData) => Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
const refresh = () => revalidatePath("/maintenance/keys");

export async function addKeySet(_: KeysState, form: FormData): Promise<KeysState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT.includes(membership.role)) return { error: NOT_ALLOWED };
  const p = z
    .object({
      property_id: z.string().uuid("Choose the property."),
      unit_id: z.union([z.literal(""), z.string().uuid()]).transform((v) => v || null),
      label: z.string().trim().min(1, "Say which key, like Front door or Mailbox.").max(120),
      tag: z.string().trim().max(40).transform((v) => v || null),
      copies: z.coerce.number().int().min(0).max(50),
      location: z.string().trim().max(120).transform((v) => v || null),
    })
    .safeParse(typed(form));
  if (!p.success) return { error: p.error.issues[0].message, values: typed(form) };
  const { data: prop } = await supabase.from("property").select("id").eq("id", p.data.property_id).eq("company_id", company.id).maybeSingle();
  if (!prop) return { error: "Choose the property.", values: typed(form) };
  const { error } = await supabase.from("key_set").insert({ company_id: company.id, ...p.data });
  if (error) return { error: error.message, values: typed(form) };
  refresh();
  return { message: "Key added." };
}

export async function checkOutKey(_: KeysState, form: FormData): Promise<KeysState> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!EDIT.includes(membership.role)) return { error: NOT_ALLOWED };
  const p = z
    .object({
      key_set_id: z.string().uuid(),
      holder: z.string().trim().min(1, "Who has it?").max(120),
      due_back_on: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).transform((v) => v || null),
    })
    .safeParse(typed(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { data: key } = await supabase.from("key_set").select("id").eq("id", p.data.key_set_id).eq("company_id", company.id).maybeSingle();
  if (!key) return { error: "Key not found." };
  const { error } = await supabase.from("key_checkout").insert({ company_id: company.id, ...p.data, checked_out_by: user.id });
  if (error) return { error: error.code === "23505" ? "That key is already out. Mark it returned first." : error.message };
  refresh();
  return { message: "Checked out." };
}

export async function returnKey(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT.includes(membership.role)) return;
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return;
  await supabase.from("key_checkout").update({ returned_at: new Date().toISOString() }).eq("id", id.data).eq("company_id", company.id).is("returned_at", null);
  refresh();
}

export async function addItem(_: KeysState, form: FormData): Promise<KeysState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT.includes(membership.role)) return { error: NOT_ALLOWED };
  const p = z
    .object({
      name: z.string().trim().min(1, "Name the item, like 20x25x1 AC filter.").max(120),
      location: z.string().trim().max(120).transform((v) => v || null),
      quantity: z.coerce.number().int().min(0).max(100_000),
      reorder_at: z.coerce.number().int().min(0).max(100_000),
      unit_cost: z
        .string()
        .trim()
        .transform((v) => v.replace(/[$,\s]/g, "") || "0")
        .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Enter the cost each, like 12.50.")
        .transform((v) => Math.round(Number(v) * 100)),
    })
    .safeParse(typed(form));
  if (!p.success) return { error: p.error.issues[0].message, values: typed(form) };
  const { unit_cost, ...rest } = p.data;
  const { error } = await supabase.from("inventory_item").insert({ company_id: company.id, ...rest, unit_cost_cents: unit_cost });
  if (error) return { error: error.message, values: typed(form) };
  refresh();
  return { message: "Item added." };
}

/** Received (+) or used (-), optionally on a work order by its number. Stock never goes below zero. */
export async function moveStock(_: KeysState, form: FormData): Promise<KeysState> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!EDIT.includes(membership.role)) return { error: NOT_ALLOWED };
  const p = z
    .object({
      item_id: z.string().uuid(),
      direction: z.enum(["in", "out"]),
      qty: z.coerce.number().int().min(1, "Enter how many.").max(100_000),
      work_order: z.union([z.literal(""), z.coerce.number().int().min(1)]).optional(),
      note: z.string().trim().max(200).optional(),
    })
    .safeParse(typed(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { data: item } = await supabase.from("inventory_item").select("id, quantity").eq("id", p.data.item_id).eq("company_id", company.id).maybeSingle();
  if (!item) return { error: "Item not found." };
  const change = p.data.direction === "in" ? p.data.qty : -p.data.qty;
  if (item.quantity + change < 0) return { error: `Only ${item.quantity} on hand.` };
  let workOrderId: string | null = null;
  if (p.data.work_order) {
    const { data: wo } = await supabase.from("work_order").select("id").eq("company_id", company.id).eq("number", p.data.work_order).maybeSingle();
    if (!wo) return { error: `Work order #${p.data.work_order} wasn't found.` };
    workOrderId = wo.id;
  }
  const { error } = await supabase.from("inventory_item").update({ quantity: item.quantity + change }).eq("id", item.id).eq("quantity", item.quantity);
  if (error) return { error: error.message };
  await supabase.from("inventory_move").insert({ company_id: company.id, item_id: item.id, change, work_order_id: workOrderId, note: p.data.note || null, moved_by: user.id });
  refresh();
  return { message: p.data.direction === "in" ? `Added ${p.data.qty}.` : `Used ${p.data.qty}.` };
}
