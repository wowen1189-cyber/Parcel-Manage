"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCompany } from "@/lib/session";

export type ProjectState = { error?: string; message?: string; values?: Record<string, string> };

const EDIT = ["admin", "property_manager", "maintenance", "accountant"];
// A purchase order commits money: a person with spending authority approves it (CLAUDE.md rule 4).
const APPROVE = ["admin", "property_manager", "accountant"];
const typed = (form: FormData) => Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
const dollars = (msg: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/[$,\s]/g, ""))
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), msg)
    .transform((v) => Math.round(Number(v) * 100));
const optDay = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).transform((v) => v || null);

export async function createProject(_: ProjectState, form: FormData): Promise<ProjectState> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!EDIT.includes(membership.role)) return { error: "Your role can't add projects." };
  const p = z
    .object({
      name: z.string().trim().min(2, "Name the project, like Unit 2 turn or Roof replacement.").max(150),
      property_id: z.string().uuid("Choose the property."),
      unit_id: z.union([z.literal(""), z.string().uuid()]).transform((v) => v || null),
      budget: dollars("Enter the budget, like 12,500."),
      start_on: optDay,
      target_on: optDay,
      notes: z.string().trim().max(2000).transform((v) => v || null),
    })
    .safeParse(typed(form));
  if (!p.success) return { error: p.error.issues[0].message, values: typed(form) };
  const { data: prop } = await supabase.from("property").select("id").eq("id", p.data.property_id).eq("company_id", company.id).maybeSingle();
  if (!prop) return { error: "Choose the property.", values: typed(form) };
  const { budget, ...rest } = p.data;
  const { data, error } = await supabase.from("project").insert({ company_id: company.id, ...rest, budget_cents: budget, created_by: user.id }).select("id").single();
  if (error) return { error: error.message, values: typed(form) };
  revalidatePath("/maintenance/projects");
  redirect(`/maintenance/projects/${data.id}`);
}

export async function updateProject(_: ProjectState, form: FormData): Promise<ProjectState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT.includes(membership.role)) return { error: "Your role can't change projects." };
  const p = z
    .object({ id: z.string().uuid(), status: z.enum(["planning", "active", "done", "canceled"]), budget: dollars("Enter the budget."), target_on: optDay })
    .safeParse(typed(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { error } = await supabase.from("project").update({ status: p.data.status, budget_cents: p.data.budget, target_on: p.data.target_on }).eq("id", p.data.id).eq("company_id", company.id);
  if (error) return { error: error.message };
  revalidatePath(`/maintenance/projects/${p.data.id}`);
  revalidatePath("/maintenance/projects");
  return { message: "Saved." };
}

export async function createPurchaseOrder(_: ProjectState, form: FormData): Promise<ProjectState> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!EDIT.includes(membership.role)) return { error: "Your role can't write purchase orders." };
  const p = z
    .object({
      project_id: z.string().uuid(),
      vendor_id: z.string().uuid("Choose the vendor."),
      description: z.string().trim().min(2, "Say what it's for.").max(500),
      amount: dollars("Enter the amount, like 3,200.").refine((v) => v > 0, "Enter the amount."),
    })
    .safeParse(typed(form));
  if (!p.success) return { error: p.error.issues[0].message, values: typed(form) };
  const { data: project } = await supabase.from("project").select("id, property_id").eq("id", p.data.project_id).eq("company_id", company.id).maybeSingle();
  if (!project) return { error: "Project not found." };
  const { data: vendor } = await supabase.from("vendor").select("id").eq("id", p.data.vendor_id).eq("company_id", company.id).maybeSingle();
  if (!vendor) return { error: "Choose the vendor.", values: typed(form) };
  const { error } = await supabase.from("purchase_order").insert({
    company_id: company.id,
    number: 0, // set by the database (purchase_order_number)
    vendor_id: vendor.id,
    property_id: project.property_id,
    project_id: project.id,
    description: p.data.description,
    amount_cents: p.data.amount,
    created_by: user.id,
  });
  if (error) return { error: error.message, values: typed(form) };
  revalidatePath(`/maintenance/projects/${project.id}`);
  return { message: "Purchase order written. It needs approval before it counts against the budget." };
}

/** Approve, close (work done, nothing more to bill) or void a purchase order. */
export async function setPurchaseOrderStatus(form: FormData): Promise<void> {
  const { supabase, company, membership, user } = await requireCompany();
  const id = z.string().uuid().safeParse(form.get("id"));
  const to = z.enum(["approved", "closed", "void"]).safeParse(form.get("to"));
  if (!id.success || !to.success) return;
  if (!(to.data === "approved" ? APPROVE : EDIT).includes(membership.role)) return;
  const { data: po } = await supabase.from("purchase_order").select("id, status, project_id").eq("id", id.data).eq("company_id", company.id).maybeSingle();
  if (!po) return;
  const allowed: Record<string, string[]> = { approved: ["draft"], closed: ["approved"], void: ["draft", "approved"] };
  if (!allowed[to.data].includes(po.status)) return;
  await supabase
    .from("purchase_order")
    .update({ status: to.data, ...(to.data === "approved" ? { approved_by: user.id, approved_at: new Date().toISOString() } : {}) })
    .eq("id", po.id);
  if (po.project_id) revalidatePath(`/maintenance/projects/${po.project_id}`);
  revalidatePath("/maintenance/projects");
}
