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

Any host that runs Node 22+ and gives you a persistent disk works. Set the
environment variables, mount a volume at `DATABASE_PATH`, and run `npm start`.

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV DATABASE_PATH=/data/push.db
VOLUME /data
EXPOSE 8787
CMD ["node", "src/index.js"]
```

Two things that will bite you otherwise:

- **Set `ALLOWED_ORIGINS`** to your real origin. The `*` default is for local
  development.
- **Serve the app over HTTPS.** Service workers and push are refused on plain
  HTTP everywhere except `localhost`.

---

## iOS

Safari only allows push from an app added to the home screen. On iPhone the
sequence is: open the site in Safari → Share → Add to Home Screen → open it
from the home screen → then enable background push. There is no way around
this; it is an Apple restriction, and the app says so in Settings when it
detects that push is unavailable.
