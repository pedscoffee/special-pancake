import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const root = "out";
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(path)));
    else if (!path.endsWith(".map") && !path.endsWith("sw.js"))
      result.push(path);
  }
  return result;
}
const files = (await walk(root)).sort();
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile(file));
const version = hash.digest("hex").slice(0, 12);
const assets = files.map((path) => `/${path.slice(root.length + 1)}`);
const routes = assets
  .filter((path) => path.endsWith("/index.html"))
  .map((path) => path.slice(0, -10));
const precache = [...new Set([...assets, ...routes])];
const worker = `/* Generated from the production export. Never caches family care records. */
const CACHE = 'kiddymeds-v2-${version}';
const ASSETS = ${JSON.stringify(precache)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('kiddymeds-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (event.request.mode === 'navigate') {
      try {
        const response = await fetch(event.request);
        if (response.ok) return response;
      } catch {}
      const path = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
      const cached = await cache.match(url.pathname) || await cache.match(path) || await cache.match('/404.html');
      // Static hosts may redirect /index.html to /. Strip the redirect metadata
      // so legacy installed-app URLs remain navigable when the device is offline.
      return cached ? new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers: cached.headers }) : Response.error();
    }
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    try { return await fetch(event.request); } catch { return Response.error(); }
  })());
});
`;
await writeFile(join(root, "sw.js"), worker);
console.log(
  `Offline app ready: ${precache.length} assets and routes · ${version}`,
);
