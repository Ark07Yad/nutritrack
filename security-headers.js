/**
 * Security headers, defined once.
 *
 * They have to be applied in two places, which is the whole reason this file
 * exists. Cloudflare's asset server answers requests that match a built file
 * *without* invoking the Worker, so headers set in worker-entry.js never
 * reached the actual page — only the SPA fallback and 404s got them, which
 * looks like protection while the thing being protected is uncovered. Assets
 * are covered by a generated `_headers` file instead, and the Worker covers
 * everything it still handles itself. Both read from here.
 *
 * The one that does real work is `script-src 'self'`. This app keeps a lot on
 * the device — a year of food logs, cycle dates, and the user's own AI key in
 * localStorage — and all of it is readable by any script that manages to run
 * on the page. Refusing to execute anything but our own bundle is what makes
 * that hard.
 *
 * `style-src` keeps 'unsafe-inline' deliberately. Charts and the animation
 * code set element styles at runtime, and inline *style* injection is a far
 * weaker attack than script injection — it cannot read localStorage or make
 * requests. Dropping it would risk breaking the UI to close a much smaller
 * hole, which is the wrong trade.
 *
 * `connect-src` is the directive most likely to break something quietly: a
 * blocked request fails in the console, not in the UI. Every origin the app
 * talks to has to be listed, so each entry says who needs it.
 */
export function securityHeaders(pushOrigin = '') {
  const connect = [
    "'self'",
    pushOrigin,                                     // reminders backend
    'https://generativelanguage.googleapis.com',    // Coach — Gemini
    'https://api.groq.com',                         // Coach — Groq
    'https://openrouter.ai',                        // Coach — OpenRouter
  ].filter(Boolean).join(' ');

  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // data: for the inline SVG favicon, blob: for the JSON data export.
      "img-src 'self' data: blob:",
      `connect-src ${connect}`,
      "worker-src 'self'",          // the reminders service worker
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",            // stops an injected <base> retargeting URLs
      "form-action 'self'",
      "frame-ancestors 'none'",     // clickjacking
      'upgrade-insecure-requests',
    ].join('; '),

    // For older browsers that ignore frame-ancestors.
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Nothing here uses any of these; refusing them costs nothing.
    'Permissions-Policy':
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
    // No includeSubDomains and no preload: this is a shared workers.dev name,
    // and neither is ours to assert for anything but this host.
    'Strict-Transport-Security': 'max-age=31536000',
  };
}
