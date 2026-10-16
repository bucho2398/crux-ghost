const CACHE='crux-ghost-v1';
const SHELL=['./','index.html','styles.css','app.js','manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','third-party.html'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('crux-ghost-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
 // Never cache blob videos, user files or generated outputs. Only app/runtime assets.
 const u=new URL(e.request.url);
 if(!u.pathname.startsWith(new URL('./',self.location).pathname))return;
 if(u.pathname.endsWith('.mp4'))return;
 e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(response=>{
   if(response.ok){const copy=response.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}
   return response;
 })));
});
