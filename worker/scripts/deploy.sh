#!/usr/bin/env bash
#
# Deploy the push backend to Cloudflare Workers.
#
# Everything is automatic except signing in — run `npx wrangler login` first,
# which opens a browser. Idempotent: run it again to redeploy.
#
#   ./scripts/deploy.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
warn() { printf '\033[33m%s\033[0m\n' "$1"; }
fail() { printf '\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

WRANGLER="npx --yes wrangler"

# `wrangler whoami` exits 0 even when signed out, so check the output rather
# than the exit code — otherwise this script sails past the guard and fails
# later with something far more confusing.
WHOAMI=$($WRANGLER whoami 2>&1 || true)
if echo "$WHOAMI" | grep -qi 'not authenticated'; then
  fail "Not signed in. Run: npx wrangler login"
fi
ACCOUNT=$(echo "$WHOAMI" | grep -oE '[[:alnum:]._%+-]+@[[:alnum:].-]+' | head -1)
bold "Signed in${ACCOUNT:+ as $ACCOUNT}"

# ── 1. VAPID keys ──────────────────────────────────────────────────────────
# Reuse the Node server's pair if there is one — rotating these invalidates
# every existing subscription, so we never regenerate silently.
if [ -f ../server/.env ] && grep -q '^VAPID_PUBLIC_KEY=.\+' ../server/.env; then
  bold "Reusing the VAPID keys from ../server/.env"
  VAPID_PUBLIC=$(grep '^VAPID_PUBLIC_KEY=' ../server/.env | cut -d= -f2-)
  VAPID_PRIVATE=$(grep '^VAPID_PRIVATE_KEY=' ../server/.env | cut -d= -f2-)
else
  bold "Generating a VAPID keypair"
  command -v node >/dev/null || fail "node is required to generate keys"
  KEYS=$(cd ../server && node -e "
    const w = require('web-push');
    const k = w.generateVAPIDKeys();
    console.log(k.publicKey + ' ' + k.privateKey);
  " 2>/dev/null) || fail "Run 'npm install' in ../server first, or set the keys manually."
  VAPID_PUBLIC=$(echo "$KEYS" | cut -d' ' -f1)
  VAPID_PRIVATE=$(echo "$KEYS" | cut -d' ' -f2)
fi

# ── 2. D1 database ─────────────────────────────────────────────────────────
if grep -q 'REPLACE_WITH_YOUR_D1_DATABASE_ID\|local-dev-placeholder' wrangler.toml; then
  bold "Creating the D1 database"
  OUT=$($WRANGLER d1 create nutritrack-push 2>&1 || true)
  DB_ID=$(echo "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)

  if [ -z "$DB_ID" ]; then
    # Already exists? Find it in the account's list.
    DB_ID=$($WRANGLER d1 list --json 2>/dev/null \
      | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
          try{const r=JSON.parse(s).find(d=>d.name==='nutritrack-push');console.log(r?r.uuid:'')}catch{console.log('')}})")
  fi
  [ -n "$DB_ID" ] || fail "Could not create or find the D1 database.\n$OUT"

  bold "Database id: $DB_ID"
  # Portable in-place edit (BSD and GNU sed differ on -i).
  node -e "
    const fs=require('fs');
    const p='wrangler.toml';
    let s=fs.readFileSync(p,'utf8');
    s=s.replace(/database_id = \".*\"/, 'database_id = \"$DB_ID\"');
    fs.writeFileSync(p,s);
  "
else
  bold "Using the D1 database already configured in wrangler.toml"
fi

bold "Applying the schema"
$WRANGLER d1 execute nutritrack-push --file schema.sql --remote --yes >/dev/null

# ── 3. Config and secrets ──────────────────────────────────────────────────
bold "Setting the public key in wrangler.toml"
node -e "
  const fs=require('fs');
  const p='wrangler.toml';
  let s=fs.readFileSync(p,'utf8');
  s=s.replace(/VAPID_PUBLIC_KEY = \".*\"/, 'VAPID_PUBLIC_KEY = \"$VAPID_PUBLIC\"');
  fs.writeFileSync(p,s);
"

bold "Uploading secrets"
printf '%s' "$VAPID_PRIVATE" | $WRANGLER secret put VAPID_PRIVATE_KEY >/dev/null
TICK_SECRET="${TICK_SECRET:-$(openssl rand -hex 32)}"
printf '%s' "$TICK_SECRET" | $WRANGLER secret put TICK_SECRET >/dev/null

# ── 4. Deploy ──────────────────────────────────────────────────────────────
bold "Deploying"
$WRANGLER deploy

URL=$($WRANGLER deployments list --json 2>/dev/null | grep -oE 'https://[a-z0-9.-]+workers\.dev' | head -1)
URL="${URL:-https://nutritrack-push.<your-subdomain>.workers.dev}"

echo
bold "Deployed"
echo "Checking health…"
sleep 3
curl -fsS "$URL/health" 2>/dev/null && echo || warn "(not resolvable yet — DNS can take a minute)"

cat <<EOF

────────────────────────────────────────────────────────────────────
The cron is already running — every minute, no extra setup. You can
delete the GitHub Actions tick workflow if you were using it.

One thing left: point the app at this server. In nutritrack/.env.local

    VITE_PUSH_SERVER=$URL

then rebuild the frontend.

Before going live, lock down CORS — edit ALLOWED_ORIGINS in
wrangler.toml to your frontend's real origin and redeploy.

Useful:
    npx wrangler tail                 # live logs, including cron runs
    npx wrangler d1 execute nutritrack-push --remote \\
      --command "SELECT COUNT(*) FROM subscriptions"
────────────────────────────────────────────────────────────────────
EOF
