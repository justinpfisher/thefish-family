// No private records, authentication requests or API responses are cached.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// Network-only: avoids showing stale household data on shared devices.
