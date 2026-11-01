#!/bin/sh
# Regenerates lib/supabase/database.types.ts from the live database.
# Needs a Supabase access token in SUPABASE_ACCESS_TOKEN (supabase.com/dashboard/account/tokens).
curl -sf -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/kfnqedhwupsmmhsunvfl/types/typescript?included_schemas=public" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).types))' \
  > lib/supabase/database.types.ts
