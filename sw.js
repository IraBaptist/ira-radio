const CACHE='ira-simple-scoreboard-v2.0.0';
const STATIC=['./','./index.html','./styles.css?v=2000','./app.js?v=2000'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).catch(()=>{}))});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key!==CACHE)await caches.delete(key);await self.clients.claim()})())});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET')return;if(url.pathname.endsWith('/public.html')||url.pathname.endsWith('/public.js')||url.pathname.endsWith('/public.css')||url.pathname.endsWith('/config.js')){event.respondWith(fetch(event.request,{cache:'no-store'}));return}event.respondWith(fetch(event.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return r}).catch(()=>caches.match(event.request)))});
