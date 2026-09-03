const CACHE='ira-radio-v1.6.0-final';
const SHELL=['./','./index.html','./styles.css?v=1600','./app.js?v=1600','./manifest.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(['public.html','public.js','public.css','config.js'].some(x=>u.pathname.endsWith('/'+x))){e.respondWith(fetch(e.request,{cache:'no-store'}));return}
 if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(k=>k.put('./index.html',c));return r}).catch(()=>caches.match('./index.html')));return}
 e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(k=>k.put(e.request,c));return r}).catch(()=>caches.match(e.request)));
});
