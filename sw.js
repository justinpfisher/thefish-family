// Network-only worker. Push display requires a durable, current device grant.
const DB_NAME="thefish-push-consent-v2",DB_STORE="consent";
let serialized=Promise.resolve();
const messages={
  jobsReady:"Something is ready for Mama or Dad to check.",
  minutesAdded:"Your minutes have been updated.",
  routineReminders:"There's a family reminder.",
  test:"This is a test alert from your family space."
};
function consent(){return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(DB_STORE);
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
    const db=request.result;
    if(!db.objectStoreNames.contains(DB_STORE)){db.close();reject(Error("Consent store missing."));return;}
    const tx=db.transaction(DB_STORE,"readonly"),read=tx.objectStore(DB_STORE).get("current");
    read.onsuccess=()=>{const value=read.result||null;db.close();resolve(value);};
    read.onerror=()=>{db.close();reject(read.error);};
  };
});}
function serial(task){
  const result=serialized.then(task,task);
  serialized=result.catch(()=>{});
  return result;
}
async function closeStale(){
  let state=null;
  try{state=await consent();}catch{}
  const active=state?.enabled===true&&state.personalBrowserConfirmed===true&&state.shared!==true&&typeof state.grant==="string"?state.grant:null;
  const current=await self.registration.getNotifications();
  for(const notification of current){
    const grant=notification.data?.grant;
    const kind=notification.data?.kind;
    const topicAllowed=kind==="test"
      ?Object.values(state?.topics||{}).some(value=>value===true)
      :state?.topics?.[kind]===true;
    if(!Object.hasOwn(messages,kind)||!active||grant!==active||!topicAllowed)notification.close();
  }
}
self.addEventListener("install",event=>event.waitUntil(self.skipWaiting()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{
  await self.clients.claim();
  try{await serial(closeStale);}catch{}
})()));
self.addEventListener("message",event=>{
  if(event.data?.type==="thefish-push-protocol"){
    event.ports?.[0]?.postMessage({version:2});
    return;
  }
  if(event.data?.type!=="thefish-push-consent-changed")return;
  const port=event.ports?.[0];
  event.waitUntil(serial(async()=>{
    await closeStale();
    port?.postMessage({ok:true});
  }).catch(()=>port?.postMessage({ok:false})));
});
self.addEventListener("push",event=>event.waitUntil(serial(async()=>{
  let payload;
  try{payload=event.data?.json();}catch{return;}
  const data=payload?.data;
  if(data?.protocol!=="2"||typeof data.grant!=="string"||
     !Object.hasOwn(messages,data.kind))return;
  let state;
  try{state=await consent();}catch{return;}
  const topicAllowed=data.kind==="test"
    ?Object.values(state?.topics||{}).some(value=>value===true)
    :state?.topics?.[data.kind]===true;
  if(state?.enabled!==true||state.personalBrowserConfirmed!==true||state.shared===true||state.grant!==data.grant||!topicAllowed)return;
  await self.registration.showNotification("thefish.ca",{
    body:messages[data.kind],icon:"assets/icon-192.png",
    tag:"thefish-"+data.kind+"-"+data.grant,
    data:{grant:data.grant,kind:data.kind,url:new URL("family.html",self.registration.scope).href}
  });
})));
self.addEventListener("notificationclick",event=>{
  const notification=event.notification;
  event.waitUntil(serial(async()=>{
    let state;
    try{state=await consent();}catch{notification.close();return;}
    const kind=notification.data?.kind;
    const topicAllowed=kind==="test"
      ?Object.values(state?.topics||{}).some(value=>value===true)
      :state?.topics?.[kind]===true;
    if(!Object.hasOwn(messages,kind)||state?.enabled!==true||state.personalBrowserConfirmed!==true||
       state.shared===true||state.grant!==notification.data?.grant||!topicAllowed){notification.close();return;}
    notification.close();
    const url=new URL("family.html",self.registration.scope).href;
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    const existing=windows.find(w=>w.url.startsWith(self.registration.scope));
    if(existing)return existing.focus();
    return self.clients.openWindow(url);
  }));
});
