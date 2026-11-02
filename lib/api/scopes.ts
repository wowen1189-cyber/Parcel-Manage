// What an API key may do (api_key.scopes).
export const API_SCOPES = { read: "Read properties, units, leases, owners, vendors and work orders", "write:work_orders": "Create work orders" } as const;
export type ApiScope = keyof typeof API_SCOPES;
