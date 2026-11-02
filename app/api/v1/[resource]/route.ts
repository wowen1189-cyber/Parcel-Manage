import { NextResponse } from "next/server";
import { apiCaller, apiError } from "@/lib/api/auth";
import { createApiWorkOrder, listResource, newWorkOrderSchema, pageSchema, RESOURCES, type Resource } from "@/lib/api/data";

// Public REST API (docs/05-integrations.md): GET /api/v1/{properties|units|leases|owners|vendors|work-orders}
// with ?limit=&offset=&property_id=, and POST /api/v1/work-orders. Authorization: Bearer <API key>.

export async function GET(request: Request, ctx: RouteContext<"/api/v1/[resource]">) {
  const { resource } = await ctx.params;
  if (!(RESOURCES as readonly string[]).includes(resource)) return apiError(404, `Unknown resource. Use one of: ${RESOURCES.join(", ")}.`);
  const caller = await apiCaller(request);
  if (caller instanceof NextResponse) return caller;
  if (!caller.scopes.includes("read")) return apiError(403, "This key can't read data (it needs the read scope).");
  const p = pageSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!p.success) return apiError(400, "limit is 1-200, offset is 0 or more, property_id is an id.");
  const data = await listResource(caller.companyId, resource as Resource, { limit: p.data.limit, offset: p.data.offset, property: p.data.property_id });
  return NextResponse.json({ data, next_offset: data.length === p.data.limit ? p.data.offset + p.data.limit : null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, ctx: RouteContext<"/api/v1/[resource]">) {
  const { resource } = await ctx.params;
  if (resource !== "work-orders") return apiError(405, "Only work-orders can be created through the API.");
  const caller = await apiCaller(request);
  if (caller instanceof NextResponse) return caller;
  if (!caller.scopes.includes("write:work_orders")) return apiError(403, "This key can't create work orders (it needs the write:work_orders scope).");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Send JSON: {\"property_id\", \"title\", \"details\"?, \"unit_id\"?, \"priority\"?}.");
  }
  const input = newWorkOrderSchema.safeParse(body);
  if (!input.success) return apiError(400, `${input.error.issues[0].path.join(".") || "body"}: ${input.error.issues[0].message}`);
  const r = await createApiWorkOrder(caller.companyId, input.data);
  if ("error" in r) return apiError(400, r.error);
  return NextResponse.json({ data: r }, { status: 201 });
}
