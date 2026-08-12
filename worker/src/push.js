/**
 * Web Push on Web Crypto — no Node, no dependencies.
 *
 * The `web-push` npm package cannot run on Workers because it uses Node's
 * crypto module, so this implements the two specs directly:
 *
 *   RFC 8292 (VAPID)  — an ES256 JWT proving the server owns the key pair
 *   RFC 8291 (aes128gcm) — payload encryption to the subscription's keys
 *
 * Both are fiddly and fail in ways that look identical from the outside, so
 * the notes below record what each step is for. The whole thing is verifiable
 * end to end: a push service returns 401 for a bad JWT, 400 for malformed
 * encryption, and 404 only once it is satisfied with both and cannot find the
 * endpoint — so a 404 against a bogus endpoint proves the crypto is right.
 */

/* ────────────────────────────── Encoding ────────────────────────────── */

const utf8 = (s) => new TextEncoder().encode(s);

function b64urlEncode(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const bin = atob((str + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const concat = (...parts) => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
};

/* ──────────────────────────────── HKDF ──────────────────────────────── */

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

/* ──────────────────────────── VAPID (RFC 8292) ──────────────────────── */

/**
 * Import a raw base64url VAPID private key as an ECDSA P-256 signing key.
 *
 * VAPID keys are distributed as raw scalars, but Web Crypto only imports
 * structured formats — so the private scalar and the public point are
 * reassembled into a JWK.
 */
async function importVapidKey(privateKeyB64, publicKeyB64) {
  const pub = b64urlDecode(publicKeyB64); // 65 bytes: 0x04 || X(32) || Y(32)
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error('VAPID public key must be a 65-byte uncompressed P-256 point');
  }
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: b64urlEncode(pub.slice(1, 33)),
    y: b64urlEncode(pub.slice(33, 65)),
    d: privateKeyB64,
    ext: true,
  };
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

/**
 * Build the `Authorization: vapid t=<jwt>, k=<publicKey>` header.
 *
 * `aud` must be the push service's origin — not the full endpoint. Getting
 * that wrong is the single most common cause of a 401.
 */
async function vapidHeader(endpoint, { publicKey, privateKey, subject }) {
  const aud = new URL(endpoint).origin;
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud,
    // 12 hours. The spec caps this at 24; going near the limit invites clock-
    // skew rejections.
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  };

  const signingInput = `${b64urlEncode(utf8(JSON.stringify(header)))}.${b64urlEncode(utf8(JSON.stringify(payload)))}`;
  const key = await importVapidKey(privateKey, publicKey);
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    utf8(signingInput)
  );

  // Web Crypto already emits the raw r||s pair that JWS wants, unlike Node,
  // which produces DER and needs converting.
  return `vapid t=${signingInput}.${b64urlEncode(sig)}, k=${publicKey}`;
}

/* ─────────────────────── Payload encryption (RFC 8291) ───────────────── */

/**
 * Encrypt a payload to a subscription using the aes128gcm content encoding.
 *
 * The output is self-describing — salt, record size and the server's public
 * key are all carried in the body header — which is why no extra HTTP headers
 * are needed beyond `Content-Encoding: aes128gcm`.
 */
async function encryptPayload(plaintext, p256dhB64, authB64) {
  const uaPublic = b64urlDecode(p256dhB64); // the device's public key
  const authSecret = b64urlDecode(authB64); // 16 shared random bytes

  // An ephemeral key pair per message: this is what makes each payload
  // independently encrypted even to the same device.
  const asKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));

  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256)
  );

  // Bind the derived secret to both parties' public keys, so a shared secret
  // captured from one exchange cannot be replayed into another.
  const prkInfo = concat(utf8('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, shared, prkInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12);

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // 0x02 is the final-record delimiter. A single record is always the last one.
  const padded = concat(utf8(plaintext), new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, padded)
  );

  // Body header: salt(16) || record size(4, big-endian) || keyid length(1) || keyid
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);

  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

/* ──────────────────────────────── Send ──────────────────────────────── */

/**
 * Deliver one push.
 *
 * Returns a discriminated result rather than throwing, because the caller
 * cares about one distinction above all: "this endpoint is gone, delete it"
 * versus "try again later".
 */
export async function sendPush(subscription, payload, vapid, { ttl = 3600, urgency = 'normal', topic } = {}) {
  const { endpoint, p256dh, auth } = subscription;

  try {
    const body = await encryptPayload(JSON.stringify(payload), p256dh, auth);
    const authorization = await vapidHeader(endpoint, vapid);

    const headers = {
      Authorization: authorization,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: urgency,
    };
    // Lets the push service collapse an undelivered reminder rather than
    // stacking three of them up when a phone comes back online.
    if (topic) headers.Topic = topic;

    const res = await fetch(endpoint, { method: 'POST', headers, body });

    if (res.ok) return { ok: true, status: res.status };

    // The browser threw this subscription away: uninstalled, permission
    // revoked, profile cleared. Not retryable — delete the row.
    if (res.status === 404 || res.status === 410) {
      return { ok: false, reason: 'expired', expired: true, status: res.status };
    }
    if (res.status === 413) return { ok: false, reason: 'payload-too-large', status: 413 };
    if (res.status === 429) return { ok: false, reason: 'rate-limited', status: 429 };

    const detail = await res.text().catch(() => '');
    return { ok: false, reason: detail.slice(0, 200) || `HTTP ${res.status}`, status: res.status };
  } catch (err) {
    return { ok: false, reason: err?.message || 'send-failed' };
  }
}

/** Exported for tests — the crypto is worth being able to inspect. */
export const __internals = { b64urlEncode, b64urlDecode, hkdf, vapidHeader, encryptPayload };
