import "server-only";
import { CHECKR_API_VERSION, retryable, type CheckrReport } from "./rules";

// Checkr Tenant API client (docs/reference/checkr-tenant-api-v1.yaml). The key lives only in the server's
// environment (CHECKR_TENANT_API_KEY): test keys start ckr_sk_test_, live keys place real, billed screenings.
// Errors carry Checkr's code; only server errors, rate limits and network failures are retried, with a cap.

const BASE = process.env.CHECKR_TENANT_API_URL ?? "https://tenant.checkr.com/api";

export const checkrConfigured = () => Boolean(process.env.CHECKR_TENANT_API_KEY);
export const checkrLiveMode = () => (process.env.CHECKR_TENANT_API_KEY ?? "").startsWith("ckr_sk_live_");

export class CheckrError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field: string | null = null,
  ) {
    super(message);
  }
}

export type CheckrOrder = { id: string; live_mode: boolean; status: "waiting_for_applicant" | "pending" | "completed" | "canceled"; package: string; application_url: string | null; completed_at: string | null; canceled_at: string | null };

async function call<T>(method: "GET" | "POST", path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const key = process.env.CHECKR_TENANT_API_KEY;
  if (!key) throw new CheckrError(0, "not_configured", "Checkr isn't connected yet.");
  let last: CheckrError | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, Math.min(8000, 500 * 2 ** attempt)));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch(`${BASE}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          "Checkr-Tenant-Version": CHECKR_API_VERSION,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) return (await res.json()) as T;
      const json = (await res.json().catch(() => ({}))) as { errors?: { code?: string; detail?: string; title?: string; source?: { pointer?: string } }[] };
      const e = json.errors?.[0];
      last = new CheckrError(res.status, e?.code ?? `http_${res.status}`, e?.detail ?? e?.title ?? `Checkr error ${res.status}`, e?.source?.pointer ?? null);
      if (!retryable(res.status)) throw last;
    } catch (e) {
      if (e instanceof CheckrError && !retryable(e.status)) throw e;
      last = e instanceof CheckrError ? e : new CheckrError(0, "network", "Checkr couldn't be reached.");
    } finally {
      clearTimeout(timer);
    }
  }
  throw last ?? new CheckrError(0, "network", "Checkr couldn't be reached.");
}

/** Is the key valid and test access on? (GET /orders?per_page=1) */
export async function checkKey(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await call("GET", "/orders?per_page=1");
    return { ok: true };
  } catch (e) {
    const err = e as CheckrError;
    return { ok: false, reason: err.status === 401 ? "The Checkr key is wrong or was revoked." : err.status === 403 ? "Checkr test access isn't on yet: finish identity vetting in Checkr, or contact Checkr support." : err.message };
  }
}

export const createOrder = (body: unknown, idempotencyKey: string) => call<CheckrOrder>("POST", "/orders", body, idempotencyKey);
export const getOrder = (id: string) => call<CheckrOrder>("GET", `/orders/${encodeURIComponent(id)}`);

/** The report for an order, or null while it isn't ready yet (Checkr answers 404 until then). */
export async function getOrderReport(orderId: string): Promise<CheckrReport | null> {
  try {
    return await call<CheckrReport>("GET", `/orders/${encodeURIComponent(orderId)}/report`);
  } catch (e) {
    if (e instanceof CheckrError && e.status === 404) return null;
    throw e;
  }
}
