/**
 * Static-asset entry point.
 *
 * Exists for one reason: a blanket single-page-application fallback answers
 * *every* miss with index.html and a 200, including a missing hashed asset.
 * The browser then reports "Expected a JavaScript-or-Wasm module script but the
 * server responded with a MIME type of text/html", which says nothing about the
 * actual problem — the file is simply not there. That happens for real during a
 * deploy, when a client holding the previous index.html requests a bundle that
 * has just been replaced.
 *
 * So: real 404s for assets, app shell for client routes.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const res = await env.ASSETS.fetch(request);

    if (res.status !== 404) return res;

    // A hashed bundle that is not there is a genuine 404. Say so, and tell a
    // stale client to reload rather than leaving it wedged.
    if (url.pathname.startsWith('/assets/')) {
      return new Response(`Asset not found: ${url.pathname}\n\nThis usually means the page was loaded before a deploy. Reload to pick up the current build.`, {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    // Anything else is a client-side route — serve the app shell so a refresh
    // on a deep link still works.
    return env.ASSETS.fetch(new Request(new URL('/', url), request));
  },
};
