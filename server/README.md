# NutriTrack push backend

Sends the reminders that arrive when NutriTrack is **fully closed**. Without
this, reminders still work — they just need the app open in a tab.

It is deliberately small: one file of routes, one of scheduling, one of storage.
No framework, and the only dependency is `web-push`.

```bash
npm install
npm run keys          # generate VAPID keys, paste the output into .env
npm start
```

Then point the web app at it — in `nutritrack/.env.local`:

```
VITE_PUSH_SERVER=http://localhost:8787
```

Restart the Vite dev server, open Settings → Reminders, and turn on
**Background push**.

---

## What it knows about you

This is the part worth being precise about, because a push server is the one
piece of NutriTrack that is not on your device.

**Stored per device:**

| Field | Why |
| --- | --- |
| Push endpoint + keys | The address the browser gave us to reach your device |
| Reminder schedule | Interval, active window, streak check time |
| UTC offset | So "20:00" means 20:00 where you are |
| `waterDoneDay` | A date. Set when today's water goal is met, so we stop nudging |
| `loggedDay` | A date. Set when you have logged a meal, so we skip the streak check |

**Never stored, never sent:** what you ate, your weight, your name, your
targets, your logs. There is no account and no identifier tying a subscription
to a person — the row is keyed by an opaque push endpoint.

**How the notification is still specific.** The server sends only a wake-up
signal: `{"kind":"water"}`. The service worker on your device receives it, opens
the app's own IndexedDB, and writes the text — "6 of 15 glasses so far, 2.25 L
left today". That sentence is composed on your phone and the server never sees
the numbers in it.

The two date flags exist because a wake-up you have already acted on is worse
than useless. They are the minimum needed to avoid that, and they say nothing
about what you actually did.

---

## Configuration

Copy `.env.example` to `.env`:

| Variable | Default | Notes |
| --- | --- | --- |
| `VAPID_PUBLIC_KEY` | — | From `npm run keys`. Handed to browsers; not secret |
| `VAPID_PRIVATE_KEY` | — | **A credential.** Never commit it |
| `VAPID_SUBJECT` | `mailto:nobody@example.com` | Contact address; push services want one |
| `PORT` | `8787` | |
| `ALLOWED_ORIGINS` | `*` | Set to your app's real origin in production |
| `DATABASE_PATH` | `./data/push.db` | Mount as a volume in a container |
| `TICK_SECRET` | — | Required to use `POST /api/tick`. Generate with `openssl rand -hex 32` |
| `INTERNAL_SCHEDULER` | `true` | Set `false` when an external cron drives the tick |

Rotating the VAPID keys invalidates every existing subscription — every device
has to re-enable push. Generate once and keep them.

---

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Status, subscription count, scheduler stats |
| `GET` | `/api/vapid-public-key` | The key browsers need to subscribe |
| `POST` | `/api/subscribe` | Register a device. Idempotent per endpoint |
| `GET` | `/api/subscribe/:id` | Read back the stored schedule |
| `PATCH` | `/api/subscribe/:id` | Update schedule or the two suppression flags |
| `DELETE` | `/api/subscribe/:id` | Unsubscribe |
| `POST` | `/api/test/:id` | Send one push immediately |
| `POST` | `/api/tick` | Run one scheduler pass. Requires `TICK_SECRET` |

Responses never include the push endpoint or keys — only the schedule.

Inputs are clamped rather than trusted: intervals to 15–360 minutes, offsets to
±14 h, times must match `HH:MM`, dates `YYYY-MM-DD`. Bodies over 8 KB are
rejected, and there is a crude per-IP rate limit.

---

## How the schedule works

A tick runs once a minute, aligned to the top of the minute so notifications
land on the clock rather than drifting by however long boot took.

For each device it converts "now" into that device's local time, then:

- **Water** — send if it is inside the active window, the interval has elapsed
  since the last send, and today's goal is not already flagged as met.
- **Streak** — send if local time has passed the check time, nothing has been
  sent today, and today is not already flagged as logged.

Windows that wrap past midnight (22:00 → 06:00) are handled. All of this is in
`decide()`, which is pure and covered by tests:

```bash
node --test src/scheduler.test.js
```

**Expired subscriptions.** A 404 or 410 from the push service means the browser
threw the subscription away — uninstalled, permission revoked, profile cleared.
That is not a transient error, so the row is deleted immediately rather than
retried. Devices that have not checked in for 90 days are pruned hourly.

---

## Deploying

### The scheduling problem, and why it is solved this way

Reminders need something to fire every minute. An in-process `setInterval` does
that fine on a machine that stays up — but almost every free tier stops your
process after ~15 minutes idle, which silently kills every reminder.

So the tick can also be driven from outside:

```
POST /api/tick
Authorization: Bearer $TICK_SECRET
```

The request itself wakes a sleeping instance. `.github/workflows/push-tick.yml`
calls it every five minutes, and GitHub Actions is free on public repositories.
Set `INTERNAL_SCHEDULER=false` when you rely on this, so the two do not both run.

The trade is precision: GitHub's scheduled runs are five-minute granularity and
can be delayed a few minutes under load, so reminder times are accurate to
roughly ±10 minutes. For a 90-minute water interval and an evening streak check
that is unnoticeable. If you want to-the-minute delivery, keep the process
always-on and leave `INTERNAL_SCHEDULER` at its default.

### Running this for free

Two properties of free tiers used to make them unusable for a reminder service.
Both are now handled, so a free host is a real option rather than a compromise:

| Free-tier limitation | How it is handled |
| --- | --- |
| The process sleeps after ~15 min idle, killing the timer | `POST /api/tick` is driven by GitHub Actions cron; the request wakes the instance |
| No persistent disk, so the database is wiped on restart | The app re-registers automatically when the server returns 404 for its subscription |

The second one matters more than it looks. Without it, a restart would silently
end every reminder and the app would carry on believing it was subscribed.
With it, the next time you open NutriTrack it notices the server has forgotten
it and re-subscribes — so the worst case is missing reminders between a restart
and your next visit, rather than losing them permanently.

**Render's free plan** is the easiest of these: no card, sleeps when idle
(fine), no disk (fine). Use the one-click button below.

**Oracle Cloud Always Free** gives you a genuinely free always-on VM with real
disk, which removes both caveats — at the cost of setting up a machine yourself.
Card verification required.

**Cloudflare Workers + D1** would be the best free fit of all: always available,
a built-in one-minute cron so GitHub Actions is not needed, and free SQLite.
It needs a port, because `web-push` depends on Node's crypto — the Web Crypto
equivalent is `@block65/webcrypto-web-push`. Worth doing if this ever outgrows
a hobby deployment.

**Not free, despite older guides saying so:** Fly.io removed its free allowance
for new organisations, and Railway's free credit is a trial rather than a tier.
Both are cheap for something this small, but they will ask for a card.

### Fly.io — one command

Suits this best: real persistent volumes, and machines that suspend when idle so
the cost stays near zero.

```bash
fly auth login          # opens a browser — the only manual step
cd server
./scripts/deploy-fly.sh my-nutritrack-push
```

The script generates or reuses your VAPID keys, creates the app and a 1 GB
volume, sets every secret, deploys, health-checks the result, and prints the
exact repo secrets to add for the cron. It is idempotent — run it again to
redeploy.

### Render — one click

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Ark07Yad/nutritrack)

Reads `render.yaml` from the repo root. Set `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `ALLOWED_ORIGINS` in the dashboard when
prompted; `TICK_SECRET` is generated for you.

The free plan has no persistent disk, so the subscription database is wiped on
every restart and redeploy. The app handles that by re-registering when the
server no longer recognises it, so this degrades to "you may miss reminders
between a restart and your next visit" rather than breaking.

If you would rather it never happen, take the Starter plan, add a disk mounted
at `/var/data`, and set `DATABASE_PATH=/var/data/push.db`.

### Anywhere else

Any host that runs Node 22+ works — there is a `Dockerfile`, and the only state
is one SQLite file. Set the environment variables, mount a volume at
`DATABASE_PATH`, run `node src/index.js`.

### After deploying

1. Point the app at the server — `VITE_PUSH_SERVER=https://…` in
   `nutritrack/.env.local`, then rebuild the frontend.
2. Add the cron secrets, so reminders actually fire:
   ```bash
   gh secret set PUSH_SERVER_URL --body "https://your-server.fly.dev"
   gh secret set TICK_SECRET --body "the-same-secret-as-the-server"
   ```
3. Lock down CORS: set `ALLOWED_ORIGINS` to your frontend's real origin. The
   `*` default is for local development only.
4. **Serve the frontend over HTTPS.** Service workers and push are refused on
   plain HTTP everywhere except `localhost`.

Verify it end to end:

```bash
curl https://your-server.fly.dev/health
curl -X POST https://your-server.fly.dev/api/tick -H "Authorization: Bearer $TICK_SECRET"
```

---

## iOS

Safari only allows push from an app added to the home screen. On iPhone the
sequence is: open the site in Safari → Share → Add to Home Screen → open it
from the home screen → then enable background push. There is no way around
this; it is an Apple restriction, and the app says so in Settings when it
detects that push is unavailable.
