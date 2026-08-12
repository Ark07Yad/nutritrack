/**
 * Tests for the hand-rolled Web Push crypto.
 *
 * The risk with reimplementing RFC 8291/8292 is that a mistake produces output
 * that looks plausible and is simply rejected by the push service later, so
 * these check the structure that the specs pin down exactly — and, crucially,
 * decrypt a payload back with an independent implementation of the receiver
 * side, which is what proves the encryption is actually correct rather than
 * merely well-formed.
 *
 *   node --test src/push.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

// Node's global crypto has subtle; make sure the module sees the same shape a
// Worker would.
globalThis.crypto ??= webcrypto;

const { __internals } = await import('./push.js');
const { b64urlEncode, b64urlDecode, hkdf, vapidHeader, encryptPayload } = __internals;

/* ────────────────────────────── Fixtures ────────────────────────────── */

/** A throwaway subscription key pair, standing in for a browser's. */
async function makeSubscriptionKeys() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  return {
    p256dh: b64urlEncode(raw),
    auth: b64urlEncode(crypto.getRandomValues(new Uint8Array(16))),
    privateKey: kp.privateKey,
    publicRaw: raw,
  };
}

async function makeVapidKeys() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  return { publicKey: b64urlEncode(raw), privateKey: jwk.d, verifyKey: kp.publicKey };
}

/* ─────────────────────────────── Encoding ─────────────────────────────── */

test('base64url round-trips and uses no padding or unsafe characters', () => {
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  const encoded = b64urlEncode(bytes);
  assert.ok(!/[+/=]/.test(encoded), 'must be URL-safe and unpadded');
  assert.deepEqual(Array.from(b64urlDecode(encoded)), Array.from(bytes));
});

/* ──────────────────────────────── HKDF ──────────────────────────────── */

test('HKDF matches RFC 5869 test vector 1', async () => {
  const ikm = new Uint8Array(22).fill(0x0b);
  const salt = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const info = Uint8Array.from([0xf0, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9]);
  const okm = await hkdf(salt, ikm, info, 42);
  assert.equal(
    Buffer.from(okm).toString('hex'),
    '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865'
  );
});

/* ─────────────────────────────── VAPID ─────────────────────────────── */

test('VAPID header is a verifiable ES256 JWT with the right audience', async () => {
  const keys = await makeVapidKeys();
  const header = await vapidHeader('https://fcm.googleapis.com/fcm/send/abc123', {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    subject: 'mailto:test@example.com',
  });

  const m = header.match(/^vapid t=([\w-]+\.[\w-]+\.[\w-]+), k=([\w-]+)$/);
  assert.ok(m, `malformed header: ${header}`);
  const [, jwt, k] = m;
  assert.equal(k, keys.publicKey, 'k must carry the public key');

  const [h, p, s] = jwt.split('.');
  const decodedHeader = JSON.parse(Buffer.from(b64urlDecode(h)).toString());
  const payload = JSON.parse(Buffer.from(b64urlDecode(p)).toString());

  assert.deepEqual(decodedHeader, { typ: 'JWT', alg: 'ES256' });
  assert.equal(payload.aud, 'https://fcm.googleapis.com', 'aud is the origin, not the full endpoint');
  assert.equal(payload.sub, 'mailto:test@example.com');
  assert.ok(payload.exp > Date.now() / 1000, 'not already expired');
  assert.ok(payload.exp <= Date.now() / 1000 + 24 * 3600, 'within the 24 h cap');

  // The signature must actually verify — a raw r||s pair, not DER.
  const sig = b64urlDecode(s);
  assert.equal(sig.length, 64, 'ES256 signature is 64 raw bytes');
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    keys.verifyKey,
    sig,
    new TextEncoder().encode(`${h}.${p}`)
  );
  assert.ok(ok, 'signature does not verify');
});

test('a bad VAPID public key is rejected rather than silently mis-signed', async () => {
  await assert.rejects(
    () => vapidHeader('https://example.com/x', {
      publicKey: b64urlEncode(new Uint8Array(10)),
      privateKey: 'nonsense',
      subject: 'mailto:a@b.c',
    }),
    /65-byte uncompressed P-256 point/
  );
});

/* ─────────────────────── Payload encryption (RFC 8291) ───────────────── */

test('encrypted payload has the aes128gcm body header the spec requires', async () => {
  const sub = await makeSubscriptionKeys();
  const body = await encryptPayload('{"kind":"water"}', sub.p256dh, sub.auth);

  assert.ok(body.length > 16 + 4 + 1 + 65, 'too short to contain a header');

  const rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0, false);
  assert.equal(rs, 4096, 'record size');
  assert.equal(body[20], 65, 'key id length is a P-256 point');
  assert.equal(body[21], 0x04, 'key id is an uncompressed point');
});

test('the receiver can decrypt it — an independent implementation of RFC 8291', async () => {
  const sub = await makeSubscriptionKeys();
  const plaintext = '{"kind":"streak","sentAt":123}';
  const body = await encryptPayload(plaintext, sub.p256dh, sub.auth);

  // Everything the receiver needs is carried in the body itself.
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const ciphertext = body.slice(21 + idlen);

  // Derive the same secret from the other side of the exchange.
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, sub.privateKey, 256)
  );

  const enc = new TextEncoder();
  const prkInfo = new Uint8Array([
    ...enc.encode('WebPush: info\0'), ...sub.publicRaw, ...asPublic,
  ]);
  const ikm = await hkdf(b64urlDecode(sub.auth), shared, prkInfo, 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const decrypted = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, ciphertext)
  );

  assert.equal(decrypted[decrypted.length - 1], 0x02, 'final-record delimiter');
  assert.equal(new TextDecoder().decode(decrypted.slice(0, -1)), plaintext);
});

test('every message uses a fresh ephemeral key and salt', async () => {
  const sub = await makeSubscriptionKeys();
  const a = await encryptPayload('same', sub.p256dh, sub.auth);
  const b = await encryptPayload('same', sub.p256dh, sub.auth);

  assert.notDeepEqual(Array.from(a.slice(0, 16)), Array.from(b.slice(0, 16)), 'salt must differ');
  assert.notDeepEqual(Array.from(a.slice(21, 86)), Array.from(b.slice(21, 86)), 'ephemeral key must differ');
  assert.notDeepEqual(Array.from(a), Array.from(b), 'ciphertext must differ');
});

test('tampering with the ciphertext fails authentication', async () => {
  const sub = await makeSubscriptionKeys();
  const body = await encryptPayload('{"kind":"water"}', sub.p256dh, sub.auth);

  const salt = body.slice(0, 16);
  const asPublic = body.slice(21, 21 + body[20]);
  const ciphertext = body.slice(21 + body[20]);
  ciphertext[0] ^= 0xff; // flip a bit

  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, sub.privateKey, 256)
  );
  const enc = new TextEncoder();
  const ikm = await hkdf(
    b64urlDecode(sub.auth),
    shared,
    new Uint8Array([...enc.encode('WebPush: info\0'), ...sub.publicRaw, ...asPublic]),
    32
  );
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);

  await assert.rejects(() =>
    crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, ciphertext)
  );
});
