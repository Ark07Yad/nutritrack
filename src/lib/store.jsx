/**
 * Application state: one object, persisted to the device, exposed through a
 * context. Everything the app knows about you lives here — there is no server
 * and nothing leaves the browser.
 *
 * Writes go through `lib/persist`, which mirrors to IndexedDB and localStorage
 * and asks the browser not to evict either.
 */

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { FOODS, NUTRIENT_KEYS, allowedDiets } from '../data/foods';
import { EXERCISES } from '../data/exercises';
import { todayKey } from './calc';
import { DEFAULT_REMINDERS, runReminderTick, registerServiceWorker } from './reminders';
import { syncPrefs } from './push';
import * as persist from './persist';

export const emptyDay = () => ({
  meals: { breakfast: [], lunch: [], snack: [], dinner: [] },
  workouts: [],
  water: 0,
  weight: null,
  note: '',
});

const initialState = {
  version: 1,
  onboarded: false,
  profile: {
    name: '',
    gender: 'male',
    age: 25,
    height: 175,
    weight: 70,
    bodyFat: null,
    activity: 'moderate',
    goal: 'lose',
    targetWeight: 65,
    weeks: 12,
    dietMode: 'vegetarian',
    eatsEggs: true,
    lifeStage: 'none',
    units: 'metric',
    /** Reference standard for micronutrient targets: 'eu' (EFSA) or 'us' (IOM). */
    standard: 'eu',
  },
  days: {},
  customFoods: [],
  savedMeals: [],
  ai: { provider: 'local', key: '', model: '' },
  reminders: DEFAULT_REMINDERS,
  /** Background push: `id` is the server-side subscription id, or null. */
  push: { enabled: false, id: null, syncedAt: 0 },
  theme: 'dark',
};

/** Merge a persisted blob over the defaults, tolerating older shapes. */
function hydrateState(parsed) {
  if (!parsed) return initialState;
  return {
    ...initialState,
    ...parsed,
    profile: { ...initialState.profile, ...parsed.profile },
    ai: { ...initialState.ai, ...parsed.ai },
    reminders: {
      ...DEFAULT_REMINDERS,
      ...parsed.reminders,
      water: { ...DEFAULT_REMINDERS.water, ...parsed.reminders?.water },
      streak: { ...DEFAULT_REMINDERS.streak, ...parsed.reminders?.streak },
    },
    push: { ...initialState.push, ...parsed.push },
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'reset':
      return { ...initialState, theme: state.theme };

    case 'hydrate':
      return hydrateState(action.state);

    case 'profile':
      return { ...state, profile: { ...state.profile, ...action.patch } };

    case 'onboarded':
      return { ...state, onboarded: true };

    case 'theme':
      return { ...state, theme: action.theme };

    case 'ai':
      return { ...state, ai: { ...state.ai, ...action.patch } };

    case 'reminders':
      return { ...state, reminders: { ...state.reminders, ...action.patch } };

    case 'push':
      return { ...state, push: { ...state.push, ...action.patch } };

    case 'remindersSection':
      return {
        ...state,
        reminders: {
          ...state.reminders,
          [action.section]: { ...state.reminders[action.section], ...action.patch },
        },
      };

    case 'addEntry': {
      const { date, slot, entry } = action;
      const day = state.days[date] || emptyDay();
      return {
        ...state,
        days: {
          ...state.days,
          [date]: { ...day, meals: { ...day.meals, [slot]: [...day.meals[slot], entry] } },
        },
      };
    }

    case 'addEntries': {
      const { date, slot, entries } = action;
      const day = state.days[date] || emptyDay();
      return {
        ...state,
        days: {
          ...state.days,
          [date]: { ...day, meals: { ...day.meals, [slot]: [...day.meals[slot], ...entries] } },
        },
      };
    }

    case 'updateEntry': {
      const { date, slot, id, patch } = action;
      const day = state.days[date] || emptyDay();
      return {
        ...state,
        days: {
          ...state.days,
          [date]: {
            ...day,
            meals: {
              ...day.meals,
              [slot]: day.meals[slot].map((e) => (e.id === id ? { ...e, ...patch } : e)),
            },
          },
        },
      };
    }

    case 'removeEntry': {
      const { date, slot, id } = action;
      const day = state.days[date] || emptyDay();
      return {
        ...state,
        days: {
          ...state.days,
          [date]: { ...day, meals: { ...day.meals, [slot]: day.meals[slot].filter((e) => e.id !== id) } },
        },
      };
    }

    case 'addWorkout': {
      const day = state.days[action.date] || emptyDay();
      return {
        ...state,
        days: { ...state.days, [action.date]: { ...day, workouts: [...day.workouts, action.workout] } },
      };
    }

    case 'removeWorkout': {
      const day = state.days[action.date] || emptyDay();
      return {
        ...state,
        days: {
          ...state.days,
          [action.date]: { ...day, workouts: day.workouts.filter((w) => w.id !== action.id) },
        },
      };
    }

    case 'setDayField': {
      const day = state.days[action.date] || emptyDay();
      return { ...state, days: { ...state.days, [action.date]: { ...day, [action.field]: action.value } } };
    }

    case 'logWeight': {
      const day = state.days[action.date] || emptyDay();
      return {
        ...state,
        profile: { ...state.profile, weight: action.weight },
        days: { ...state.days, [action.date]: { ...day, weight: action.weight } },
      };
    }

    case 'saveMeal':
      return { ...state, savedMeals: [...state.savedMeals, action.meal] };

    case 'deleteSavedMeal':
      return { ...state, savedMeals: state.savedMeals.filter((m) => m.id !== action.id) };

    case 'addCustomFood':
      return { ...state, customFoods: [...state.customFoods, action.food] };

    case 'deleteCustomFood':
      return { ...state, customFoods: state.customFoods.filter((f) => f.id !== action.id) };

    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  // First render uses the synchronous localStorage mirror so there is no blank
  // frame; IndexedDB is consulted immediately after and wins if it is newer.
  const [state, dispatch] = useReducer(reducer, undefined, () => hydrateState(persist.loadSync()));
  const [nudges, setNudges] = useState([]);
  const [ready, setReady] = useState(false);

  /* ── Authoritative load, then start persisting ── */
  useEffect(() => {
    let cancelled = false;
    persist
      .load()
      .then((stored) => {
        if (cancelled) return;
        // Only replace what we already rendered if IndexedDB holds something newer.
        const current = persist.loadSync();
        if (stored && (!current || (stored.savedAt || 0) > (current.savedAt || 0))) {
          dispatch({ type: 'hydrate', state: stored });
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    // Ask the browser to stop evicting us. This is what actually prevents the
    // "my log vanished" problem, and it is safe to re-request on every load.
    persist.requestPersistence();

    return () => { cancelled = true; };
  }, []);

  // `ready` gates the first write so that loading cannot race with saving, and
  // flipping it also triggers the initial mirror into IndexedDB.
  useEffect(() => {
    if (!ready) return;
    persist.save(state);
  }, [state, ready]);

  /* ── Never lose the last few hundred milliseconds of edits ── */
  useEffect(() => {
    const flush = () => persist.flushNow();
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, []);

  /**
   * Theme. 'system' follows the OS and keeps following it — the media query
   * listener matters, because otherwise switching your Mac to dark at sunset
   * would leave the app bright until a reload.
   */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = state.theme === 'system' ? (mq.matches ? 'dark' : 'light') : state.theme;
      document.documentElement.dataset.theme = resolved;
      // Keep the mobile browser chrome in step with the page.
      document.querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', resolved === 'dark' ? '#03100b' : '#eef5f0');
    };
    apply();
    if (state.theme !== 'system') return;
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [state.theme]);

  /* ── Reminders ── */
  const remindersEnabled = state.reminders?.enabled;

  useEffect(() => {
    if (!remindersEnabled) return;
    registerServiceWorker();
  }, [remindersEnabled]);

  // Keep the latest state in a ref so the interval never needs re-creating.
  const latest = useRef(state);
  latest.current = state;

  // When background push is live the server owns the schedule, and running the
  // in-page timer as well would fire everything twice.
  const backgroundPushActive = !!(state.push?.enabled && state.push?.id);

  useEffect(() => {
    if (!remindersEnabled || backgroundPushActive) return;

    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      const s = latest.current;
      const glasses = Math.round((s.profile.gender === 'female' ? 2.7 : 3.7) / 0.25);
      const result = await runReminderTick({
        reminders: s.reminders,
        days: s.days,
        waterGoalGlasses: glasses,
      });
      if (stopped || !result) return;
      dispatch({ type: 'reminders', patch: result.patch });
      if (result.nudges.length) setNudges((prev) => [...prev, ...result.nudges].slice(-3));
    };

    tick();
    const id = setInterval(tick, 60_000);
    const onFocus = () => tick();
    window.addEventListener('focus', onFocus);
    return () => {
      stopped = true;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [remindersEnabled, backgroundPushActive]);

  /* ── Keep the push server's copy of the schedule current ──
     Debounced, and only when something it actually cares about changed: the
     schedule itself, or whether today's water goal / logging is already done.
     The server needs those two flags so it does not push a reminder you have
     already acted on. */
  const pushId = state.push?.id;
  const today = todayKey();
  const todayDay = state.days[today];
  const waterGoalGlasses = Math.round(
    (state.profile.gender === 'female' ? 2.7 : 3.7) / 0.25
  );
  const syncSignature = JSON.stringify({
    r: state.reminders?.water,
    s: state.reminders?.streak,
    waterDone: (todayDay?.water || 0) >= waterGoalGlasses,
    logged: !!todayDay && Object.values(todayDay.meals || {}).some((l) => l.length > 0),
  });

  useEffect(() => {
    if (!ready || !pushId || !state.push?.enabled) return;
    const id = setTimeout(() => {
      syncPrefs(pushId, {
        reminders: latest.current.reminders,
        days: latest.current.days,
        waterGoalGlasses,
      })
        .then((currentId) => {
          // syncPrefs re-registers if the server has forgotten us — which
          // happens whenever a free-tier host restarts and loses its disk — so
          // the id it returns is the authoritative one.
          dispatch({
            type: 'push',
            patch: { syncedAt: Date.now(), ...(currentId !== pushId ? { id: currentId } : {}) },
          });
        })
        .catch(() => { /* offline or server down; the next change retries */ });
    }, 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pushId, state.push?.enabled, syncSignature, waterGoalGlasses]);

  /* ── Actions taken from a notification ── */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const applyAction = (action) => {
      if (action === 'log-water') {
        const key = todayKey();
        const glasses = (latest.current.days[key]?.water || 0) + 1;
        dispatch({ type: 'setDayField', date: key, field: 'water', value: glasses });
      }
      // '#diary' is handled by App, which reads the hash on mount.
    };

    const onMessage = (event) => {
      if (event.data?.type === 'notification-action') applyAction(event.data.action);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);

    // Cold start from a notification click arrives as a URL hash instead.
    if (window.location.hash === '#log-water') {
      applyAction('log-water');
      history.replaceState(null, '', window.location.pathname);
    }

    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  const dismissNudge = (id) => setNudges((prev) => prev.filter((n) => n.id !== id));

  const value = useMemo(
    () => ({ state, dispatch, nudges, dismissNudge, waterGoalGlasses }),
    [state, nudges, waterGoalGlasses]
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

/* ───────────────────────────── Derived helpers ───────────────────────────── */

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Every food available to the user, built-ins plus their own. */
export function useAllFoods() {
  const { state } = useStore();
  return useMemo(() => [...FOODS, ...state.customFoods], [state.customFoods]);
}

/** The diet tags this user is willing to eat — memoised so it is dependency-safe. */
export function useAllowedDiets() {
  const { state } = useStore();
  const { dietMode, eatsEggs } = state.profile;
  return useMemo(() => allowedDiets(dietMode, eatsEggs), [dietMode, eatsEggs]);
}

export function useDay(date = todayKey()) {
  const { state } = useStore();
  return state.days[date] || emptyDay();
}

const zeroTotals = () => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0]));

/** Sum a list of log entries into a full nutrient total. */
export function sumEntries(entries) {
  const total = zeroTotals();
  for (const e of entries) {
    for (const k of NUTRIENT_KEYS) total[k] += (e.n?.[k] || 0);
  }
  return total;
}

/** Totals for a whole day, broken down by meal slot. */
export function dayTotals(day) {
  const bySlot = {};
  const all = [];
  for (const slot of Object.keys(day.meals)) {
    bySlot[slot] = sumEntries(day.meals[slot]);
    all.push(...day.meals[slot]);
  }
  const total = sumEntries(all);
  const burned = day.workouts.reduce((s, w) => s + (w.kcal || 0), 0);
  return { total, bySlot, burned, net: total.kcal - burned, entryCount: all.length };
}

export function exerciseById(id) {
  return EXERCISES.find((e) => e.id === id);
}

/** The last `n` days ending today, oldest first — used by the charts. */
export function recentDays(days, n = 14) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    out.push({ key, day: days[key] || emptyDay() });
  }
  return out;
}
