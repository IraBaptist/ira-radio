const CACHE='ira-radio-v1.5.3r1';
const ASSETS=['./','./index.html','./styles.css?v=1531','./app.js?v=1531','./manifest.json','./public.html','./public.css?v=1531','./public.js?v=1531','./config.js'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim();})());});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url);
 if(u.origin!==location.origin)return;
 const publicAsset=/\/(?:public\.html|public\.js|public\.css|config\.js)$/.test(u.pathname);
 if(publicAsset){e.respondWith(fetch(e.request,{cache:'no-store'}));return;}
 e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;}).catch(()=>caches.match(e.request).then(hit=>hit||caches.match('./index.html'))));
});
