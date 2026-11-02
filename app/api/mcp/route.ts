import { NextResponse } from "next/server";
import { z } from "zod";
import { apiCaller } from "@/lib/api/auth";
import { createApiWorkOrder, listResource, newWorkOrderSchema, RESOURCES, type Resource } from "@/lib/api/data";

// MCP server (Model Context Protocol, Streamable HTTP, stateless): AI tools such as Claude connect to
// https://parcelmanage.com/api/mcp with "Authorization: Bearer <API key>" and get the same data as the REST
// API: one list tool per resource, plus create_work_order for keys with that scope.

const PROTOCOL = "2025-06-18";
type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const LIST_TOOLS = RESOURCES.map((r) => ({
  name: `list_${r.replace("-", "_")}`,
  description: {
    properties: "List the company's properties with address, owner and number of units.",
    units: "List units with beds, baths, size, status (vacant, occupied, notice) and market rent in cents.",
    leases: "List leases with tenant name and contact, rent, deposit, current balance owed (cents), start and end dates and status.",
    owners: "List owners (the LLCs or people on the deed) with their properties.",
    vendors: "List vendors with trade, W-9 status and insurance and license expiration dates.",
    "work-orders": "List work orders, newest first, with priority, status, property, unit, vendor and dates.",
  }[r],
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 200, description: "How many to return (default 50)." },
      offset: { type: "integer", minimum: 0, description: "How many to skip, for paging." },
      property_id: { type: "string", description: "Only this property (not for owners or vendors)." },
    },
  },
  resource: r,
}));
const CREATE_TOOL = {
  name: "create_work_order",
  description: "Create a work order for the office to assign. Priority is routine, urgent or emergency.",
  inputSchema: {
    type: "object",
    required: ["property_id", "title"],
    properties: {
      property_id: { type: "string" },
      unit_id: { type: "string" },
      title: { type: "string", description: "What's wrong, in a few words." },
      details: { type: "string" },
      priority: { type: "string", enum: ["routine", "urgent", "emergency"] },
    },
  },
};

const ok = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const fail = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const text = (value: unknown, isError = false) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }], isError });

export async function POST(request: Request) {
  const caller = await apiCaller(request);
  if (caller instanceof NextResponse) return caller;
  let msg: Rpc;
  try {
    msg = (await request.json()) as Rpc;
  } catch {
    return NextResponse.json(fail(null, -32700, "Parse error"), { status: 400 });
  }
  if (Array.isArray(msg)) return NextResponse.json(fail(null, -32600, "Batches aren't supported."), { status: 400 });
  // Notifications (no id) get an empty 202.
  if (msg.id === undefined) return new NextResponse(null, { status: 202 });
  const tools = [...(caller.scopes.includes("read") ? LIST_TOOLS : []), ...(caller.scopes.includes("write:work_orders") ? [CREATE_TOOL] : [])];

  switch (msg.method) {
    case "initialize":
      return NextResponse.json(ok(msg.id, { protocolVersion: PROTOCOL, capabilities: { tools: {} }, serverInfo: { name: "parcel-manage", version: "1.0.0" }, instructions: "Read-only property management data for one company, plus creating work orders when the key allows it. Money is in cents." }));
    case "ping":
      return NextResponse.json(ok(msg.id, {}));
    case "tools/list":
      return NextResponse.json(ok(msg.id, { tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) }));
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      const listTool = LIST_TOOLS.find((t) => t.name === name);
      if (listTool && caller.scopes.includes("read")) {
        const p = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50), offset: z.coerce.number().int().min(0).default(0), property_id: z.string().uuid().optional() }).safeParse(args);
        if (!p.success) return NextResponse.json(ok(msg.id, text("limit is 1-200, offset is 0 or more, property_id is an id.", true)));
        const data = await listResource(caller.companyId, listTool.resource as Resource, { limit: p.data.limit, offset: p.data.offset, property: p.data.property_id });
        return NextResponse.json(ok(msg.id, text({ data, next_offset: data.length === p.data.limit ? p.data.offset + p.data.limit : null })));
      }
      if (name === CREATE_TOOL.name && caller.scopes.includes("write:work_orders")) {
        const input = newWorkOrderSchema.safeParse(args);
        if (!input.success) return NextResponse.json(ok(msg.id, text(`${input.error.issues[0].path.join(".")}: ${input.error.issues[0].message}`, true)));
        const r = await createApiWorkOrder(caller.companyId, input.data);
        return NextResponse.json(ok(msg.id, "error" in r ? text(r.error, true) : text({ created: r })));
      }
      return NextResponse.json(fail(msg.id, -32602, `Unknown tool or not allowed for this key: ${name}`));
    }
    default:
      return NextResponse.json(fail(msg.id, -32601, `Method not found: ${msg.method}`));
  }
}

export async function GET() {
  return new NextResponse("Parcel Manage MCP server. POST JSON-RPC with Authorization: Bearer <API key>.", { status: 405, headers: { Allow: "POST" } });
}
