/**
 * Generate a VAPID keypair and print a ready-to-paste .env block.
 *
 * These identify your server to the push services (FCM, Mozilla, Apple). The
 * private key must stay on the server; the public key is handed to browsers
 * and is not a secret. Rotating them invalidates every existing subscription,
 * so generate once and keep them.
 */

import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`
Generated a VAPID keypair. Save this as server/.env — and never commit it.

VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}
VAPID_SUBJECT=mailto:you@example.com

Then give the web app the public key, either in nutritrack/.env.local:

VITE_PUSH_SERVER=http://localhost:8787

(the app fetches the public key from the server, so it only needs the URL)
`);
