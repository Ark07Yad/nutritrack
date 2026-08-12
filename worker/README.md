# NutriTrack push backend — Cloudflare Workers

The same push backend as [`../server`](../server), ported to Workers. Pick this
one if you want it free and precise.

```bash
npx wrangler login      # opens a browser — the only manual step
./scripts/deploy.sh
```

---

## Why this version exists

The Node server has to solve a problem that does not exist here. Reminders need
something firing every minute; free hosts stop your process when idle, killing
an in-process timer, so that version leans on a GitHub Actions cron every five
minutes and reminders land within roughly ±10 minutes of their time.

Workers has a real cron trigger. So:

| | `server/` (Node) | `worker/` (this) |
| --- | --- | --- |
| Scheduling | In-process timer, or an external cron | Native cron trigger, every minute |
| Accuracy | ±10 min on a free host | To the minute |
| Always-on cost | Needs a paid always-on host, or tolerates sleeping | Free — nothing to keep awake |
| Database | SQLite on disk | D1, free to 5 GB |
| Dependencies | `web-push` | none |
| Free tier | Not really — Fly and Railway both want a card | Yes, genuinely |

Both share `server/src/schedule-core.js`, so the actual decision of *when to
send* is one file with one set of tests. Only the plumbing differs.

---

## Web Push without `web-push`

`web-push` depends on Node's crypto, which Workers does not have, so
[`src/push.js`](src/push.js) implements the two specs directly on Web Crypto:

- **RFC 8292 (VAPID)** — an ES256 JWT proving the server owns the key pair.
- **RFC 8291 (aes128gcm)** — ECDH to the subscription's public key, HKDF to
  derive the content key and nonce, AES-GCM to encrypt.

That is a risky thing to hand-roll, because a mistake produces output that
looks fine and is simply rejected later by the push service. So it is tested
from both ends:

```bash
npm test
```

- HKDF is checked against **RFC 5869 test vector 1**.
- The VAPID JWT is **signature-verified** with Web Crypto, and checked for the
  detail that most often causes a silent 401: `aud` must be the push service's
  *origin*, not the full endpoint.
- The encrypted payload is **decrypted again by an independent implementation
  of the receiver half** — the strongest available proof that the encryption is
  correct rather than merely well-formed.
- Each message is confirmed to use a fresh ephemeral key and salt, and a
  tampered ciphertext is confirmed to fail authentication.

It was also validated against real FCM: sending to a deliberately fake endpoint
returns **410 Gone**, meaning FCM accepted the signature and the payload and
only then failed to find the endpoint. A bad JWT returns 401; malformed
encryption returns 400.

---

## What it knows about you

Unchanged from the Node version, and worth restating because this is the one
piece of NutriTrack that is not on your device.

**Stored:** the push endpoint, your reminder schedule, a UTC offset, and two
dates — "water goal met today" and "logged today" — which exist only so it does
not nudge you about something you have already done.

**Never stored:** what you ate, your weight, your name, your targets.

The server sends `{"kind":"water"}` and nothing else. Your service worker opens
the app's own IndexedDB and writes the text — "6 of 15 glasses so far, 2.25 L
left today" — so those numbers never leave the device.

---

## Setup

### Automatic

```bash
npx wrangler login
./scripts/deploy.sh
```

Reuses the VAPID keys from `../server/.env` if they exist (rotating them would
force every device to re-enable push), creates the D1 database, applies the
schema, uploads secrets, deploys, and prints what to do next. Idempotent.

### By hand

```bash
npx wrangler login
npx wrangler d1 create nutritrack-push          # put the id in wrangler.toml
npx wrangler d1 execute nutritrack-push --file schema.sql --remote
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put TICK_SECRET             # optional
npx wrangler deploy
```

Set `VAPID_PUBLIC_KEY` and `VAPID_SUBJECT` under `[vars]` in `wrangler.toml` —
the public key is not a secret, browsers need it to subscribe.

Then point the app at it, in `nutritrack/.env.local`:

```
VITE_PUSH_SERVER=https://nutritrack-push.<your-subdomain>.workers.dev
```

### Locally

```bash
npm run db:local        # apply the schema to a local D1
npm run dev             # http://localhost:8788
```

Put `VAPID_PRIVATE_KEY` and `TICK_SECRET` in `.dev.vars` (gitignored). Cron does
not fire automatically in local dev — trigger it by hand:

```bash
curl "http://localhost:8788/cdn-cgi/local/scheduled"
```

---

## Configuration

| Where | Name | Notes |
| --- | --- | --- |
| `[vars]` | `VAPID_PUBLIC_KEY` | Not secret; browsers need it |
| `[vars]` | `VAPID_SUBJECT` | Contact address, e.g. `mailto:you@example.com` |
| `[vars]` | `ALLOWED_ORIGINS` | **Set this to your real origin before going live.** `*` is for local dev |
| secret | `VAPID_PRIVATE_KEY` | A credential. `wrangler secret put` |
| secret | `TICK_SECRET` | Only needed for the manual `/api/tick` route |

`nodejs_compat` is deliberately **not** enabled — the whole point of the Web
Crypto implementation is that it runs on the plain runtime.

---

## API

Identical to the Node version, so the client cannot tell them apart.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Status, subscription count, which runtime |
| `GET` | `/api/vapid-public-key` | The key browsers need to subscribe |
| `POST` | `/api/subscribe` | Register a device. Idempotent per endpoint |
| `GET` | `/api/subscribe/:id` | Read back the stored schedule |
| `PATCH` | `/api/subscribe/:id` | Update the schedule or the suppression flags |
| `DELETE` | `/api/subscribe/:id` | Unsubscribe |
| `POST` | `/api/test/:id` | Send one push immediately |
| `POST` | `/api/tick` | Run one scheduler pass. Requires `TICK_SECRET` |

The 404 from `PATCH` matters: the app treats it as "re-register me", which is
what makes losing the database survivable rather than silently fatal.

---

## Operating it

```bash
npx wrangler tail                     # live logs, cron runs included
npx wrangler d1 execute nutritrack-push --remote \
  --command "SELECT COUNT(*) FROM subscriptions"
```

Cron failures are invisible by default — there is no request to inspect — so
`[observability.logs]` is enabled in `wrangler.toml`.

Sends within a tick run concurrently, because a Worker has a wall-clock budget
and a few hundred sequential round trips to push services would exhaust it.

Expired subscriptions (404/410) are deleted immediately rather than retried;
devices unseen for 90 days are pruned hourly.

---

## Free-tier limits

Comfortably inside them for personal use: 100,000 requests a day, cron triggers
at no cost, 5 GB of D1 storage and 5 million row reads a day.

The cron runs 1,440 times a day and each tick is one D1 query plus a write per
device actually being notified — so the binding constraint is subscribers, not
schedule frequency, and it is a long way off.
