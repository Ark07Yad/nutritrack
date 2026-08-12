/**
 * The scheduling decision, with no dependencies on any runtime.
 *
 * Both backends import this — the Node server and the Cloudflare Worker — so
 * the one piece of real logic cannot drift between them. Keep it free of
 * imports, Node builtins and Workers globals: plain arithmetic on plain
 * objects, which is also what makes it trivial to test.
 */

export const MINUTE = 60_000;

/**
 * `tzOffsetMinutes` is minutes to ADD to UTC to reach the device's wall clock
 * (+330 for IST). Shifting the timestamp and then reading UTC fields gives us
 * that wall clock without dragging in a timezone database.
 */
export function localParts(tzOffsetMinutes, at = Date.now()) {
  const d = new Date(at + tzOffsetMinutes * MINUTE);
  return {
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    day: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
  };
}

export const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Handles windows that wrap past midnight, e.g. 22:00 → 06:00. */
export const withinWindow = (now, from, to) => {
  const a = toMinutes(from);
  const b = toMinutes(to);
  return b >= a ? now >= a && now <= b : now >= a || now <= b;
};

/**
 * Given a stored subscription row and the current instant, what should be sent?
 *
 * Returns an array of `{ kind, day }`, empty when nothing is due. The row shape
 * is the database's snake_case, shared by both backends.
 */
export function decide(row, at = Date.now()) {
  const out = [];
  const { minutes, day } = localParts(row.tz_offset_min, at);

  if (row.water_on) {
    const goalAlreadyMet = row.water_done_day === day;
    const due = at - row.last_water_at >= row.water_every_min * MINUTE;
    if (!goalAlreadyMet && due && withinWindow(minutes, row.water_from, row.water_to)) {
      out.push({ kind: 'water', day });
    }
  }

  if (row.streak_on) {
    const alreadySentToday = row.last_streak_day === day;
    const alreadyLogged = row.logged_day === day;
    if (!alreadySentToday && !alreadyLogged && minutes >= toMinutes(row.streak_at)) {
      out.push({ kind: 'streak', day });
    }
  }

  return out;
}
