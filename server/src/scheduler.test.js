/**
 * Tests for the scheduling decision, which is the only genuinely tricky part
 * of this server: local-time windows that wrap past midnight, per-device
 * timezones, and the suppression flags that stop us pushing pointlessly.
 *
 *   node --test src/scheduler.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { decide } from './schedule-core.js';

const base = {
  id: 't',
  water_every_min: 90,
  water_from: '08:00',
  water_to: '22:00',
  streak_at: '20:00',
  tz_offset_min: 330, // IST
  water_done_day: '',
  logged_day: '',
  last_water_at: 0,
  last_streak_day: '',
};

const waterOnly = (o) => ({ ...base, water_on: 1, streak_on: 0, ...o });
const streakOnly = (o) => ({ ...base, water_on: 0, streak_on: 1, ...o });
const both = (o) => ({ ...base, water_on: 1, streak_on: 1, ...o });

/** The UTC instant at which an IST wall clock reads h:m on 2026-08-12. */
const ist = (h, m = 0) => Date.UTC(2026, 7, 12, h, m) - 330 * 60_000;

const kinds = (row, at) => decide(row, at).map((j) => j.kind);

test('water fires inside the window when nothing has been sent', () => {
  assert.deepEqual(kinds(waterOnly(), ist(9)), ['water']);
});

test('water stays quiet outside the window', () => {
  assert.deepEqual(kinds(waterOnly(), ist(6)), []);
  assert.deepEqual(kinds(waterOnly(), ist(23, 30)), []);
});

test('water respects the interval since the last send', () => {
  const row = waterOnly({ last_water_at: ist(8, 30) });
  assert.deepEqual(kinds(row, ist(9)), [], 'only 30 min elapsed');
  assert.deepEqual(kinds(row, ist(10, 5)), ['water'], '95 min elapsed');
});

test('water stops once the device says the goal is met', () => {
  assert.deepEqual(kinds(waterOnly({ water_done_day: '2026-08-12' }), ist(9)), []);
});

test('a window that wraps past midnight is handled', () => {
  const row = waterOnly({ water_from: '22:00', water_to: '06:00' });
  assert.deepEqual(kinds(row, ist(23)), ['water'], 'late evening is inside');
  assert.deepEqual(kinds(row, ist(3)), ['water'], 'small hours are inside');
  assert.deepEqual(kinds(row, ist(12)), [], 'midday is outside');
});

test('streak waits until its time, then fires once', () => {
  assert.deepEqual(kinds(streakOnly(), ist(19, 59)), []);
  assert.deepEqual(kinds(streakOnly(), ist(20, 30)), ['streak']);
  assert.deepEqual(kinds(streakOnly({ last_streak_day: '2026-08-12' }), ist(20, 30)), []);
});

test('streak stays quiet when the day is already logged', () => {
  assert.deepEqual(kinds(streakOnly({ logged_day: '2026-08-12' }), ist(20, 30)), []);
});

test('switched-off reminders never fire', () => {
  assert.deepEqual(kinds(waterOnly({ water_on: 0 }), ist(9)), []);
  assert.deepEqual(kinds(streakOnly({ streak_on: 0 }), ist(20, 30)), []);
});

test('both can be due at the same tick', () => {
  assert.deepEqual(kinds(both(), ist(21)), ['water', 'streak']);
  assert.deepEqual(kinds(both(), ist(23, 30)), ['streak'], 'water is out of its window');
});

test('the same instant means different things in different timezones', () => {
  // 15:00 UTC is 20:30 in India but 11:00 in New York.
  const at = Date.UTC(2026, 7, 12, 15, 0);
  assert.deepEqual(kinds(streakOnly({ tz_offset_min: 330 }), at), ['streak']);
  assert.deepEqual(kinds(streakOnly({ tz_offset_min: -240 }), at), []);

  // …and 00:30 UTC the next day is 20:30 in New York.
  const later = Date.UTC(2026, 7, 13, 0, 30);
  assert.deepEqual(kinds(streakOnly({ tz_offset_min: -240 }), later), ['streak']);
});

test("suppression resets on the device's day boundary, not UTC's", () => {
  const row = streakOnly({ tz_offset_min: 330, last_streak_day: '2026-08-12' });

  // Still 20:30 on the 12th in India — yesterday's send must still suppress.
  assert.deepEqual(kinds(row, ist(20, 30)), [], 'same local day, already sent');

  // 20:30 on the 13th in India. The local day has rolled over even though this
  // is still the 13th in UTC terms only after the offset is applied.
  const nextDay = Date.UTC(2026, 7, 13, 15, 0);
  assert.deepEqual(kinds(row, nextDay), ['streak'], 'a new local day has begun');
});

test('a UTC-day rollover does not reset a device whose local day has not turned', () => {
  // 00:30 UTC on the 13th is 20:00 on the 12th in New York, so a send recorded
  // for the 12th must still suppress even though UTC has moved on.
  const row = streakOnly({ tz_offset_min: -240, last_streak_day: '2026-08-12' });
  assert.deepEqual(kinds(row, Date.UTC(2026, 7, 13, 0, 30)), []);
});
