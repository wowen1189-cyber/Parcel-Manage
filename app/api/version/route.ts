import { connection, NextResponse } from "next/server";

// Which build is live, so open pages can tell they're out of date (components/update-banner.tsx).
export async function GET() {
  await connection();
  return NextResponse.json({ build: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" }, { headers: { "cache-control": "no-store" } });
}
