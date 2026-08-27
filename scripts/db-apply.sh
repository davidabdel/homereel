#!/usr/bin/env bash
# Apply the schema to a fresh Supabase project, in dependency order.
#
# The repo inherited its schema split across two places — src/lib/*.sql created
# the base tables, supabase/migrations/*.sql layered on top. This records the
# order that actually works so it never has to be guessed again.
#
#   PAT=… REF=… ./scripts/db-apply.sh
set -euo pipefail
: "${PAT:?set PAT to a Supabase personal access token}"
: "${REF:?set REF to the project ref}"

FILES=(
  src/lib/subscription-setup.sql        # user_credits, credit_transactions, subscription_plans, user_subscriptions
  src/lib/database-setup.sql            # user_media
  src/lib/spend-credits-function.sql    # spend_user_credits
  src/lib/create-credits-function.sql
  src/lib/create-setup-function.sql
  supabase/migrations/0001_phase1_security.sql
  supabase/migrations/0002_projects.sql
  supabase/migrations/0003_stripe_billing.sql
  supabase/migrations/0004_homereel_wallet.sql   # two-bucket wallet, reservations, shots, the $19 plan
  supabase/migrations/0005_signup_and_grants.sql # empty wallet on signup; webhook grant functions
  supabase/migrations/0006_map_stripe_price.sql  # plan -> stripe price
)

for f in "${FILES[@]}"; do
  printf '%-46s ' "$(basename "$f")"
  body=$(python3 -c "import json,sys;print(json.dumps({'query':open(sys.argv[1]).read()}))" "$f")
  out=$(curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
        -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" -d "$body")
  if echo "$out" | grep -q '"message"'; then
    echo "FAILED"; echo "$out" | head -c 400; echo; exit 1
  fi
  echo "ok"
done
echo "schema applied."
