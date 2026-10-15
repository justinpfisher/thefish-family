// Network-only service worker. Never cache family records, Auth or API replies.
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
// All pushes are visible; Apple can revoke silent-push subscriptions.
const messages={
  jobsReady:"Something is ready for Mama or Dad to check.",
  goalsToReview:"There's a goal ready for Mama or Dad to look at.",
  minutesAdded:"Your minutes have been updated.",
  goalReplies:"There's an update to one of your goals.",
  reportsAndIdeas:"Something new is ready in the family app.",
  test:"This is a test alert from your family space."
};
self.addEventListener("push",event=>{
  let kind="";
  try{
    const payload=event.data?.json();
    kind=payload?.data?.kind||payload?.message?.data?.kind||payload?.kind||"";
  }catch{}
  const body=messages[kind]||"There's an update in your family space.";
  event.waitUntil(self.registration.showNotification("thefish.ca",{
    body, icon:"assets/icon-192.png",tag:"thefish-"+(kind||"update"),
    data:{url:new URL("family.html",self.registration.scope).href}
  }));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const url=new URL("family.html",self.registration.scope).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    const existing=windows.find(w=>w.url.startsWith(self.registration.scope));
    if(existing)return existing.focus();
    return self.clients.openWindow(url);
  })());
});
