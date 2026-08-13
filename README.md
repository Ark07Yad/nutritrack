# NutriTrack

**→ [Open the app](https://nutritrack.ark07yad.workers.dev)** · [push API](https://nutritrack-push.ark07yad.workers.dev/health)

Runs entirely on Cloudflare's free tier. No account, no sign-up — your log
lives on your device.


A calorie, micronutrient and training tracker. It works out what you should be
eating, tracks what you actually ate down to all 27 vitamins and minerals, logs
your workouts, and has a coach that reads your real data rather than handing you
generic advice.

Everything lives on your device. There is no server, no account, and nothing is
uploaded.

```bash
npm install
npm run dev
```

Then open http://localhost:5180.

Optionally, for reminders that arrive with the app closed:

```bash
cd server && npm install && npm run keys && npm start
```

---

## What it does

**Works out your numbers.** Six onboarding questions (sex, age, height, weight,
activity, goal) produce your BMR, maintenance calories, and a daily target for
your goal — with a realistic timeline and an honest warning when the timeframe
you asked for would need an unsafe deficit.

**Tracks food.** A database of 123 foods, weighted toward what people actually
eat in India — dal, paneer, roti, poha, idli, rajma — alongside the usual
Western staples. Every food carries a full nutrient profile, not just calories
and macros.

**Tracks all 27 micronutrients.** 14 vitamins and 13 minerals, each against an
RDA adjusted for your sex, age and life stage, each with an explanation of what
it does and which foods on *your* diet supply the most of it.

**Handles every diet.** Vegan, vegetarian (with or without eggs) and
non-vegetarian. The setting filters every search result, meal suggestion and
piece of coaching advice in the app.

**Three ways to log a meal.** Search the database; pick one of 47 ready-made
meals organised by slot and diet; or build your own — combine ingredients into a
plate with live totals and save it for reuse, or enter calories and macros
manually for anything the database does not have.

**Tracks training.** 42 exercises with MET-based calorie burn, sets/reps/load
for strength work, five ready-made training splits you can load straight into
your log, and a weekly view of which muscle groups you have actually hit.

**Coaches you.** A rules engine reads your logged data and tells you what stands
out — protein short, sodium over, three days without training, weight moving the
wrong way for your goal. It needs no key, no account and no network.

**Reminds you.** Water nudges through a window you choose, and an evening check
that warns you when a logging streak is about to break — plus a celebration at
3, 7, 14, 30, 60, 100, 180 and 365 days. They arrive as system notifications,
and always as an in-app banner too, so they still land if you declined the
notification prompt. Run the optional push backend in `server/` and they arrive
with the app fully closed.

---

## The AI coach

Two layers, both free:

**Built-in (default).** A local rules engine plus a question-answering system
covering calories, protein, micronutrient gaps, fat loss, muscle gain, plateaus,
supplements, sleep, vegan and vegetarian nutrition, and training splits. It runs
entirely on your device and always works offline.

**Hosted model (optional).** For open-ended conversation, connect one of three
providers with a free tier — Google Gemini Flash, Groq, or an OpenRouter `:free`
model. Paste your own key in Settings; it is stored only in your browser and
sent only to that provider, along with a summary of your profile and today's log
so the model can answer with your actual numbers. If a request fails, the app
falls back to the built-in coach automatically.

---

## Where the numbers come from

| Quantity | Method |
| --- | --- |
| BMR | Mifflin-St Jeor; Katch-McArdle when you supply a body-fat percentage |
| TDEE | BMR × activity factor (1.2 – 1.9) |
| Goal calories | Energy balance at 7700 kcal per kg, with the guardrails below |
| Protein | 1.6 – 2.2 g per kg of bodyweight, depending on goal |
| Fat | 25 – 28% of calories; carbs take the remainder |
| Exercise burn | MET × 3.5 × bodyweight(kg) ÷ 200, per minute |
| Micronutrient targets | US Institute of Medicine DRIs, adjusted for sex, age, pregnancy and lactation |
| Food composition | USDA FoodData Central and the Indian Food Composition Tables |

**Guardrails on the goal calculation**, applied in order:

1. Weekly change capped at 1% of bodyweight for loss, 0.5% for gain.
2. Deficit capped at 25% of maintenance; surplus at 20%.
3. Absolute floor of 1200 kcal (female) / 1500 kcal (male).

When any of these bind, the app says so, explains why, and recalculates the
timeline honestly rather than quietly showing you a number you cannot hit.

**A caveat on trace minerals.** Biotin, iodine, chromium and molybdenum are
sparsely reported in public food composition databases. Those four columns are
best-available estimates and should be read as indicative.

---

## Project layout

```
src/
  data/
    foods.js       123 foods × 35 nutrients, per 100 g
    recipes.js     47 ready-made meals, composed from foods.js
    exercises.js   42 exercises with MET values, plus 5 training splits
    rdi.js         RDA/AI targets and upper limits for every micronutrient
  lib/
    calc.js        BMR, TDEE, goal planning, macro splits — all pure functions
    store.jsx      Reducer + context, and the reminder loop
    persist.js     IndexedDB + localStorage, eviction guard, daily snapshots
    reminders.js   Water and streak scheduling, notification delivery
    useNutrition.js  One hook that assembles targets vs. intake for a date
    coach.js       Local analysis engine, Q&A, and the hosted-model bridge
    push.js        Client half of the optional push backend
  components/
    ui.jsx         Design system: cards, rings, bars, sheets, inline icons
    Onboarding · Dashboard · Diary · Workouts · Nutrients · Progress · Coach · Profile
public/
  sw.js            Service worker: turns a push into a notification, on-device

worker/            Optional. Push backend on Cloudflare Workers (recommended)
  src/
    index.js       Routes + the native cron handler
    push.js        RFC 8291/8292 on Web Crypto, no dependencies
    db.js          D1 storage
    push.test.js   Crypto tests, incl. an RFC 5869 vector and a round-trip decrypt
server/            Optional. The same backend on Node
  src/
    index.js       Six routes, no framework
    schedule-core.js  Shared with the Worker — the only real logic, and tested
    scheduler.js   Timer and tick loop
    db.js          node:sqlite storage
    push.js        VAPID send via web-push, expiry pruning
```

Meals are composed from food IDs rather than hardcoded nutrition, so correcting
a food's data automatically corrects every meal that uses it.

---

## How your data is stored

Losing a month of logs to a browser cleaning up after itself is the fastest way
to make someone quit an app, so this gets four layers rather than one:

1. **IndexedDB** is the primary store — a much larger quota than localStorage,
   and the storage type browsers actually protect.
2. **localStorage** mirrors it synchronously, so first paint never waits on a
   database and a second copy exists if either backend fails. On load the app
   compares timestamps and takes whichever is newer, so losing one does not roll
   you back to an older copy of the other.
3. **Persistent storage** is requested via `navigator.storage.persist()`. This
   is the actual fix: without it browsers evict "inactive" sites — Safari after
   about a week of not visiting — and that is how logs disappear. Settings →
   Storage & backup shows whether it has been granted and lets you request it on
   a tap. Chrome usually grants it once you have used the site a few times or
   added it to your home screen.
4. **Daily snapshots**, seven kept, recoverable from Settings. Deleting
   something by accident is survivable, and so is a mistaken reset.

Writes are debounced and flushed on `pagehide`, `beforeunload` and tab-hide, so
closing the tab mid-edit does not drop the last change.

What this still cannot do is follow you to another browser or another device —
no server means no sync. Settings → Export writes a JSON file for that.

---

## Reminders

There are two delivery modes, and the Settings screen is explicit about which
one you are on.

**In-app (default, no setup).** Reminders are scheduled in the page. They fire
whenever NutriTrack is open in a tab — a backgrounded tab counts, as does an
installed PWA in your app switcher. Close it completely and nothing fires until
you reopen it, at which point anything missed appears as a banner.

**Background push (optional).** Run a push backend and reminders arrive with the
app fully closed, like any other app's notifications. There are two, with the
same API — the app cannot tell them apart:

| | [`worker/`](worker) — Cloudflare | [`server/`](server) — Node |
| --- | --- | --- |
| Scheduling | Native cron, every minute | In-process timer, or an external cron |
| Accuracy | To the minute | ±10 min on a host that sleeps |
| Cost | Free, genuinely | Needs a paid always-on host, or tolerates sleeping |
| Dependencies | None — Web Push on Web Crypto | `web-push` |

**Cloudflare is the one to pick.**

```bash
cd worker
npx wrangler login      # opens a browser — the only manual step
./scripts/deploy.sh
```

Or run either locally:

```bash
cd worker && npm run db:local && npm run dev     # :8788
cd server && npm install && npm run keys && npm start   # :8787
```

Then set `VITE_PUSH_SERVER` in `.env.local`, restart Vite, and enable it in
Settings → Reminders.

Both share `server/src/schedule-core.js`, so the decision of *when* to send is
one file with one set of tests rather than two implementations that drift.

### What the push server knows

It is the one piece of NutriTrack that is not on your device, so this matters.

It stores your push endpoint, your reminder schedule, a UTC offset, and two
dates: "water goal met today" and "logged today". Those two exist only so it
does not nudge you about something you have already done.

It never receives what you ate, your weight, your name, or your targets.

The notification still says *"6 of 15 glasses so far, 2.25 L left today"* —
because the server sends only a wake-up signal (`{"kind":"water"}`), and the
service worker on your device opens the local database and writes that sentence
itself. The numbers never leave the phone.

Full detail, API reference and deployment notes:
[`worker/README.md`](worker/README.md) · [`server/README.md`](server/README.md).

---

## Notes

- Light and dark themes are both first-class; accents route through semantic
  tokens so contrast holds in either.
- This gives general nutrition and training information. It is not medical
  advice and not a substitute for a doctor or registered dietitian.
