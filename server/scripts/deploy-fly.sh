#!/usr/bin/env bash
#
# Deploy the push backend to Fly.io.
#
# Everything here is automatic except signing in — run `fly auth login` first,
# which opens a browser. This script is idempotent: run it again to redeploy.
#
#   ./scripts/deploy-fly.sh [app-name] [region]
#
set -euo pipefail

APP="${1:-nutritrack-push-$(head -c4 /dev/urandom | xxd -p)}"
REGION="${2:-bom}"
cd "$(dirname "$0")/.."

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
fail() { printf '\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

command -v flyctl >/dev/null 2>&1 || fail "flyctl not found. Install it: brew install flyctl"
flyctl auth whoami >/dev/null 2>&1 || fail "Not signed in. Run: fly auth login"

bold "Deploying as '$APP' in $REGION"

# ── 1. VAPID keys ──────────────────────────────────────────────────────────
# Reuse the local pair if there is one. Rotating these invalidates every
# existing subscription, so we never regenerate silently.
if [ -f .env ] && grep -q '^VAPID_PUBLIC_KEY=.\+' .env; then
  bold "Reusing the VAPID keys in .env"
  VAPID_PUBLIC=$(grep '^VAPID_PUBLIC_KEY=' .env | cut -d= -f2-)
  VAPID_PRIVATE=$(grep '^VAPID_PRIVATE_KEY=' .env | cut -d= -f2-)
  VAPID_SUBJ=$(grep '^VAPID_SUBJECT=' .env | cut -d= -f2- || echo 'mailto:nobody@example.com')
else
  bold "Generating a new VAPID keypair"
  KEYS=$(node -e "
    const w = require('web-push');
    const k = w.generateVAPIDKeys();
    console.log(k.publicKey + ' ' + k.privateKey);
  ")
  VAPID_PUBLIC=$(echo "$KEYS" | cut -d' ' -f1)
  VAPID_PRIVATE=$(echo "$KEYS" | cut -d' ' -f2)
  VAPID_SUBJ='mailto:nobody@example.com'
  printf 'VAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s\nVAPID_SUBJECT=%s\n' \
    "$VAPID_PUBLIC" "$VAPID_PRIVATE" "$VAPID_SUBJ" >> .env
  bold "Saved to .env (gitignored)"
fi

TICK_SECRET="${TICK_SECRET:-$(openssl rand -hex 32)}"

# ── 2. App and volume ──────────────────────────────────────────────────────
if flyctl status --app "$APP" >/dev/null 2>&1; then
  bold "App '$APP' already exists — redeploying"
else
  bold "Creating app '$APP'"
  flyctl apps create "$APP" --machines
fi

# Without a volume, subscriptions are wiped on every deploy.
if ! flyctl volumes list --app "$APP" 2>/dev/null | grep -q push_data; then
  bold "Creating a 1 GB volume for the subscription database"
  flyctl volumes create push_data --app "$APP" --region "$REGION" --size 1 --yes
fi

# ── 3. Secrets ─────────────────────────────────────────────────────────────
bold "Setting secrets"
flyctl secrets set --app "$APP" --stage \
  VAPID_PUBLIC_KEY="$VAPID_PUBLIC" \
  VAPID_PRIVATE_KEY="$VAPID_PRIVATE" \
  VAPID_SUBJECT="$VAPID_SUBJ" \
  TICK_SECRET="$TICK_SECRET" \
  ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-*}" >/dev/null

# ── 4. Deploy ──────────────────────────────────────────────────────────────
bold "Deploying"
flyctl deploy --app "$APP" --config fly.toml --yes

URL="https://$APP.fly.dev"
echo
bold "Deployed → $URL"
echo
echo "Checking it is alive…"
sleep 4
curl -fsS "$URL/health" && echo || echo "(not up yet — try: curl $URL/health)"

cat <<EOF

────────────────────────────────────────────────────────────────────
Two things left, both one-liners.

1. Point the web app at it. In nutritrack/.env.local:

     VITE_PUSH_SERVER=$URL

   Then rebuild and redeploy the frontend.

2. Drive the schedule. The machine suspends when idle to keep costs
   near zero, so the tick comes from GitHub Actions. Add these repo
   secrets (Settings → Secrets and variables → Actions):

     PUSH_SERVER_URL   $URL
     TICK_SECRET       $TICK_SECRET

   Or set them from the CLI:

     gh secret set PUSH_SERVER_URL --body "$URL"
     gh secret set TICK_SECRET --body "$TICK_SECRET"

   Prefer always-on instead? Set min_machines_running = 1 and
   INTERNAL_SCHEDULER = "true" in fly.toml, then redeploy.

Lock down CORS once the frontend has a real origin:

     fly secrets set --app $APP ALLOWED_ORIGINS=https://your-frontend
────────────────────────────────────────────────────────────────────
EOF
