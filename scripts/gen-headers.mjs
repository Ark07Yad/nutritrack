/**
 * Writes dist/_headers after a build.
 *
 * Cloudflare's asset server applies this file to every asset it serves, which
 * is the only way to get headers onto the actual page — a Worker is not
 * invoked for requests that match a built file.
 *
 * The push origin is read with Vite's own loadEnv and the same mode the build
 * used, so the connect-src entry cannot disagree with the URL compiled into
 * the bundle. If those two ever drift the browser blocks every call to the
 * reminders backend and the only symptom is a console error, so deriving both
 * from one value is worth more here than it looks.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadEnv } from 'vite';
import { securityHeaders } from '../security-headers.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production';

const pushOrigin = (loadEnv(mode, root, 'VITE_')?.VITE_PUSH_SERVER || '').replace(/\/+$/, '');

const headers = securityHeaders(pushOrigin);
const body = ['/*', ...Object.entries(headers).map(([k, v]) => `  ${k}: ${v}`), ''].join('\n');

writeFileSync(resolve(root, 'dist/_headers'), body);

console.log(
  `Wrote dist/_headers (${Object.keys(headers).length} headers)` +
  (pushOrigin ? `\n  connect-src includes ${pushOrigin}` : '\n  no VITE_PUSH_SERVER set — connect-src omits the push backend')
);
