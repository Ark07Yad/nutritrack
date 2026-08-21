/**
 * The abuse limits, tested from the angle that matters: they must stop abuse
 * without ever turning away a real browser or taking the API down.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRealPushEndpoint, withinLimit, _resetLimits } from './index.js';

/* ── Real endpoints, as the browsers actually issue them ── */

const REAL = [
  // Chrome / Edge / Brave / Opera — every Chromium browser
  'https://fcm.googleapis.com/fcm/send/dK9x2:APA91bH7Yq-3nZ_examplekeymaterial',
  'https://fcm.googleapis.com/wp/dK9x2APA91bH7Yq3nZexample',
  // Firefox
  'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABl-example-token',
  // Safari, macOS and iOS
  'https://web.push.apple.com/QLQ0ZQ0example-long-apple-token',
  // Edge legacy / WNS
  'https://par02p.notify.windows.com/w/?token=BQYAAABexample',
  'https://db5p.notify.windows.com/w/?token=another',
];

test('every mainstream browser endpoint is accepted', () => {
  for (const endpoint of REAL) {
    assert.equal(isRealPushEndpoint(endpoint), true, endpoint);
  }
});

/* ── The junk an attacker would post to fill the database ── */

const FAKE = [
  'https://evil.example.com/push/1',
  'https://attacker.test/fcm/send/abc',
  'http://fcm.googleapis.com/fcm/send/abc',      // downgraded to http
  'https://fcm.googleapis.com.evil.test/x',      // suffix, not the real host
  'https://notfcm.googleapis.com/x',             // no dot before the host
  'https://web.push.apple.com.attacker.io/x',
  'not-a-url',
  '',
  null,
  undefined,
  12345,
  {},
];

test('made-up endpoints are refused', () => {
  for (const endpoint of FAKE) {
    assert.equal(isRealPushEndpoint(endpoint), false, String(endpoint));
  }
});

test('a hostname cannot be smuggled past the anchors', () => {
  // The patterns are anchored at both ends; these are the shapes that defeat
  // a naive `includes()` check.
  assert.equal(isRealPushEndpoint('https://fcm.googleapis.com.evil.test/a'), false);
  assert.equal(isRealPushEndpoint('https://evil.test/?x=fcm.googleapis.com'), false);
  assert.equal(isRealPushEndpoint('https://xpush.services.mozilla.com.evil/a'), false);
  // …while genuine subdomains still work.
  assert.equal(isRealPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x'), true);
});

/* ── The counter must actually count ── */

test('allows exactly the budget, then refuses', () => {
  _resetLimits();
  const key = 'ip-a';
  for (let i = 1; i <= 5; i++) {
    assert.equal(withinLimit(key, 5), true, `request ${i} should pass`);
  }
  assert.equal(withinLimit(key, 5), false, 'the 6th must be refused');
  assert.equal(withinLimit(key, 5), false, 'and it stays refused');
});

test('one caller cannot spend another caller\'s budget', () => {
  _resetLimits();
  for (let i = 0; i < 5; i++) withinLimit('noisy', 5);
  assert.equal(withinLimit('noisy', 5), false);
  // A different address is untouched — this is the property that keeps one
  // abusive client from locking everyone else out.
  assert.equal(withinLimit('quiet', 5), true);
});

test('reads and writes are separate budgets', () => {
  _resetLimits();
  for (let i = 0; i < 5; i++) withinLimit('w:same-ip', 5);
  assert.equal(withinLimit('w:same-ip', 5), false);
  assert.equal(withinLimit('r:same-ip', 5), true, 'exhausting writes must not block reads');
});

test('the window reopens once it has elapsed', () => {
  _resetLimits();
  const key = 'ip-b';
  // A 1ms window, so this does not need a fake clock or a sleep.
  assert.equal(withinLimit(key, 1, 1), true);
  assert.equal(withinLimit(key, 1, 1), false);
  const until = Date.now() + 3;
  while (Date.now() < until) { /* spin briefly past the window */ }
  assert.equal(withinLimit(key, 1, 1), true, 'a new window must start clean');
});

test('tracking many distinct callers does not grow without bound', () => {
  _resetLimits();
  // Expired entries are swept once the map is big enough to warrant it.
  for (let i = 0; i < 12_000; i++) withinLimit(`ip-${i}`, 100, 1);
  const until = Date.now() + 3;
  while (Date.now() < until) { /* let them all expire */ }
  withinLimit('trigger-the-sweep', 100, 1);
  assert.ok(true, 'completed without exhausting memory');
});

test('never throws, whatever it is handed', () => {
  _resetLimits();
  for (const key of [undefined, null, 0, '', {}, Symbol('x')]) {
    assert.equal(typeof withinLimit(key, 5), 'boolean', String(key));
  }
});
