// Public settings, safe in the browser. Server-only secrets live in lib/supabase/admin.ts.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Root domain that company subdomains hang off: parcelmanage.com in production, localhost:3000 locally.
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
