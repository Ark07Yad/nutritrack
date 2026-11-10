/**
 * Link to ARC — opt-in live sync to ARC, the owner's personal dashboard,
 * when both run on the same Mac.
 *
 * Off by default and stored per browser, so nobody using the deployed app is
 * affected. When on, every change is sent (two seconds after the last edit)
 * to ARC's local server at 127.0.0.1:8795, which accepts it only from this
 * app's localhost address. Only the last 60 days of meals (name + macros),
 * water, weight, steps and workouts leave — never the AI key, cycle data,
 * reminders, diary notes, custom foods or the body profile.
 */

const KEY = 'arc-link';
const URL_ = 'http://127.0.0.1:8795/api/bridge/push/nutritrack';
const DELAY = 2000;
const DAYS = 60;

let status = { state: 'off', at: null };
const listeners = new Set();
const emit = (next) => {
  status = { ...status, ...next };
  listeners.forEach((fn) => fn(status));
};

export function isArcLinkOn() {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export function setArcLink(on, state) {
  try {
    if (on) localStorage.setItem(KEY, 'on');
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: the link just stays off */
  }
  emit({ state: on ? 'waiting' : 'off' });
  if (on && state) send(state);
}

export function onArcLink(fn) {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}

const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The minimum ARC uses — what leaves this app. */
export function arcPayload(state, now = new Date()) {
  const from = keyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DAYS - 1)));
  const days = {};
  for (const [date, d] of Object.entries(state.days || {})) {
    if (date < from || !d) continue;
    const meals = {};
    for (const [slot, items] of Object.entries(d.meals || {})) {
      meals[slot] = (items || []).map((e) => ({ name: e.name, n: { kcal: e.n?.kcal || 0, protein: e.n?.protein || 0, carbs: e.n?.carbs || 0, fat: e.n?.fat || 0 } }));
    }
    days[date] = {
      meals,
      workouts: (d.workouts || []).map((w) => ({ name: w.name, minutes: w.minutes, kcal: w.kcal, type: w.type })),
      water: d.water || 0,
      weight: d.weight ?? null,
      steps: d.steps || 0,
    };
  }
  // ARC recognises NutriTrack by these profile fields; nothing personal is in them.
  return { version: state.version, profile: { dietMode: state.profile?.dietMode, stepGoal: state.profile?.stepGoal }, days };
}

async function send(state, fetchImpl = fetch) {
  emit({ state: 'sending' });
  try {
    const res = await fetchImpl(URL_, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-arc-bridge': '1' },
      body: JSON.stringify(arcPayload(state)),
    });
    emit(res.ok ? { state: 'ok', at: Date.now() } : { state: 'refused' });
  } catch {
    emit({ state: 'offline' });
  }
}

let timer = null;
/** Called on every saved state; sends after edits settle. A no-op while the link is off. */
export function scheduleArcSync(state, fetchImpl = fetch) {
  if (!isArcLinkOn()) return;
  clearTimeout(timer);
  timer = setTimeout(() => send(state, fetchImpl), DELAY);
}
