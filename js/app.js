(async()=>{
window.__appStarted=true;
const DV="?v=20261102111727";
const SB_URL="https://zuesxdqifsnvhleiukum.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1ZXN4ZHFpZnNudmhsZWl1a3VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2OTAxNjcsImV4cCI6MjEwMzI2NjE2N30.PyutAHmY_he3VoPTT7r67oHOY5P75YpQSThqy4mO8ZI";
let sbOnline=true;
function dummyQuery(){const q={select(){return q},order(){return q},eq(){return q},
  upsert:async()=>({error:{message:"offline"}}),insert:async()=>({error:{message:"offline"}}),
  then(res){return Promise.resolve({data:[],error:null}).then(res)}};return q}
const sbFallback={from:dummyQuery,
  auth:{getSession:async()=>({data:{}}),signOut:async()=>({}),
        signInWithPassword:async()=>({error:{message:"Kan inte nå inloggningstjänsten just nu."}}),
        signInAnonymously:async()=>({error:{message:"Kan inte nå inloggningstjänsten just nu."}})},
  channel:()=>({on(){return this},subscribe(){}}),
  storage:{from:()=>({upload:async()=>({error:{message:"offline"}}),getPublicUrl:()=>({data:{publicUrl:""}})})}};
let sb;
try{
  if(!window.supabase||!window.supabase.createClient)throw new Error("supabase-js laddades inte");
  sb=window.supabase.createClient(SB_URL,SB_KEY);
}catch(e){
  console.warn("Supabase otillgängligt – appen körs i läsläge:",e.message);
  sb=sbFallback;sbOnline=false;
}
let sbUser=null;
/* PR 4.5: gap-photos-bucketen i Storage hade ingen bibliotekskoppling -
   vem som helst inloggad kunde läsa alla foton. Nya uppladdningar läggs nu
   under <library_id>/ i bucketen, och storage.objects-policyn kräver
   medlemskap i just det biblioteket (samma mönster som uh-inlamningar).
   Cachas per sidladdning - en sidladdning = en inloggad användare. */
let _myLibId=null;
async function myLibraryId(){
  if(_myLibId)return _myLibId;
  const {data,error}=await sb.from("library_members").select("library_id").limit(1).maybeSingle();
  if(error||!data){console.warn("kunde inte slå upp library_id",error);return null}
  _myLibId=data.library_id;
  return _myLibId;
}

/* ---------- Designhjälpare (ikoner, färger, profil) ---------- */
const ICONS={"image-plus":"<path d=\"M16 5h6\"/> <path d=\"M19 2v6\"/> <path d=\"M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5\"/> <path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\"/> <circle cx=\"9\" cy=\"9\" r=\"2\"/>","sliders-horizontal":"<line x1=\"21\" x2=\"14\" y1=\"4\" y2=\"4\"/> <line x1=\"10\" x2=\"3\" y1=\"4\" y2=\"4\"/> <line x1=\"21\" x2=\"12\" y1=\"12\" y2=\"12\"/> <line x1=\"8\" x2=\"3\" y1=\"12\" y2=\"12\"/> <line x1=\"21\" x2=\"16\" y1=\"20\" y2=\"20\"/> <line x1=\"12\" x2=\"3\" y1=\"20\" y2=\"20\"/> <line x1=\"14\" x2=\"14\" y1=\"2\" y2=\"6\"/> <line x1=\"8\" x2=\"8\" y1=\"10\" y2=\"14\"/> <line x1=\"16\" x2=\"16\" y1=\"18\" y2=\"22\"/>","list":"<path d=\"M3 12h.01\"/> <path d=\"M3 18h.01\"/> <path d=\"M3 6h.01\"/> <path d=\"M8 12h13\"/> <path d=\"M8 18h13\"/> <path d=\"M8 6h13\"/>","history":"<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"/> <path d=\"M3 3v5h5\"/> <path d=\"M12 7v5l4 2\"/>","sun-moon":"<path d=\"M12 8a2.83 2.83 0 0 0 4 4 4 4 0 1 1-4-4\"/> <path d=\"M12 2v2\"/> <path d=\"M12 20v2\"/> <path d=\"m4.9 4.9 1.4 1.4\"/> <path d=\"m17.7 17.7 1.4 1.4\"/> <path d=\"M2 12h2\"/> <path d=\"M20 12h2\"/> <path d=\"m6.3 17.7-1.4 1.4\"/> <path d=\"m19.1 4.9-1.4 1.4\"/>","sun":"<circle cx=\"12\" cy=\"12\" r=\"4\"/> <path d=\"M12 2v2\"/> <path d=\"M12 20v2\"/> <path d=\"m4.93 4.93 1.41 1.41\"/> <path d=\"m17.66 17.66 1.41 1.41\"/> <path d=\"M2 12h2\"/> <path d=\"M20 12h2\"/> <path d=\"m6.34 17.66-1.41 1.41\"/> <path d=\"m19.07 4.93-1.41 1.41\"/>","moon":"<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\"/>","smartphone":"<rect width=\"14\" height=\"20\" x=\"5\" y=\"2\" rx=\"2\" ry=\"2\"/> <path d=\"M12 18h.01\"/>","eye":"<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"/> <circle cx=\"12\" cy=\"12\" r=\"3\"/>","eye-off":"<path d=\"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49\"/> <path d=\"M14.084 14.158a3 3 0 0 1-4.242-4.242\"/> <path d=\"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143\"/> <path d=\"m2 2 20 20\"/>","scan-text":"<path d=\"M3 7V5a2 2 0 0 1 2-2h2\"/> <path d=\"M17 3h2a2 2 0 0 1 2 2v2\"/> <path d=\"M21 17v2a2 2 0 0 1-2 2h-2\"/> <path d=\"M7 21H5a2 2 0 0 1-2-2v-2\"/> <path d=\"M7 8h8\"/> <path d=\"M7 12h10\"/> <path d=\"M7 16h6\"/>","circle-check":"<circle cx=\"12\" cy=\"12\" r=\"10\"/> <path d=\"m9 12 2 2 4-4\"/>","rotate-cw":"<path d=\"M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8\"/> <path d=\"M21 3v5h-5\"/>","chevron-down":"<path d=\"m6 9 6 6 6-6\"/>","check":"<path d=\"M20 6 9 17l-5-5\"/>","plus":"<path d=\"M5 12h14\"/> <path d=\"M12 5v14\"/>","settings":"<path d=\"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z\"/> <circle cx=\"12\" cy=\"12\" r=\"3\"/>","users":"<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/> <circle cx=\"9\" cy=\"7\" r=\"4\"/> <path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"/> <path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/>","library":"<path d=\"m16 6 4 14\"/> <path d=\"M12 6v14\"/> <path d=\"M8 8v12\"/> <path d=\"M4 4v16\"/>","tag":"<path d=\"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z\"/> <circle cx=\"7.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\"/>","pencil":"<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\"/> <path d=\"m15 5 4 4\"/>","camera":"<path d=\"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z\"/> <circle cx=\"12\" cy=\"13\" r=\"3\"/>","x":"<path d=\"M18 6 6 18\"/> <path d=\"m6 6 12 12\"/>","chevron-right":"<path d=\"m9 18 6-6-6-6\"/>","map-pin":"<path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\"/> <circle cx=\"12\" cy=\"10\" r=\"3\"/>","folder":"<path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\"/>","play":"<polygon points=\"6 3 20 12 6 21 6 3\"/>","scan-search":"<path d=\"M3 7V5a2 2 0 0 1 2-2h2\"/> <path d=\"M17 3h2a2 2 0 0 1 2 2v2\"/> <path d=\"M21 17v2a2 2 0 0 1-2 2h-2\"/> <path d=\"M7 21H5a2 2 0 0 1-2-2v-2\"/> <circle cx=\"12\" cy=\"12\" r=\"3\"/> <path d=\"m16 16-1.9-1.9\"/>","search":"<circle cx=\"11\" cy=\"11\" r=\"8\"/> <path d=\"m21 21-4.3-4.3\"/>","user":"<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\"/> <circle cx=\"12\" cy=\"7\" r=\"4\"/>","info":"<circle cx=\"12\" cy=\"12\" r=\"10\"/> <path d=\"M12 16v-4\"/> <path d=\"M12 8h.01\"/>","link":"<path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\"/> <path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\"/>","chevron-left":"<path d=\"m15 18-6-6 6-6\"/>","image":"<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\"/> <circle cx=\"9\" cy=\"9\" r=\"2\"/> <path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\"/>","layout-grid":"<rect width=\"7\" height=\"7\" x=\"3\" y=\"3\" rx=\"1\"/> <rect width=\"7\" height=\"7\" x=\"14\" y=\"3\" rx=\"1\"/> <rect width=\"7\" height=\"7\" x=\"14\" y=\"14\" rx=\"1\"/> <rect width=\"7\" height=\"7\" x=\"3\" y=\"14\" rx=\"1\"/>","align-justify":"<path d=\"M3 12h18\"/> <path d=\"M3 18h18\"/> <path d=\"M3 6h18\"/>","copy":"<rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\"/> <path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\"/>"};
function ic(n){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]||""}</svg>`}
function fillIcons(root){(root||document).querySelectorAll("i[data-ic]").forEach(el=>{if(!el.firstChild)el.innerHTML=ic(el.dataset.ic)})}
fillIcons();
const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const PAL=["#F24B78","#BF348E","#F29441","#F26D3D","#4A3D41","#D474BB","#F6B878","#F486A3","#F6935F","#7D6D72"];
function catColor(c){let h=0;for(const ch of String(c||""))h=(h*31+ch.charCodeAt(0))|0;return PAL[Math.abs(h)%PAL.length]}
const fmtN=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,"\u2009");
let toastT=null;
function toast(msg){const t=document.getElementById("toast");if(!t)return;t.textContent=msg;t.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("show"),2600)}
/* Bibliotekets namn och bild. Sparas i webbläsaren tills vidare - i databasen
   behövs en egen tabell (per konto) innan det kan följa med vid delning. */
const PROFILE_KEY="minbokhylla-profile";
/* Delning v1: token sparas i localStorage, inte bara i minnet, eftersom
   både "Skapa konto" (updateUser, ingen reload) och "Logga in på
   befintligt konto" (signInWithPassword, location.reload()) måste kunna
   hitta den igen efteråt - en reload tömmer alla JS-variabler men inte
   localStorage. Se startDelaFlow(). */
const DELA_TOKEN_KEY="minbokhylla-dela-token";
let profile={name:"Min Bokhylla",avatar:null};
/* Titel och bild hör till kontot: sparas under en nyckel per användar-id och
   läses först när vi vet vem som är inloggad (loadProfile, anropas där
   sbUser sätts). Utloggad visas alltid standardtiteln. Tillfällig lösning -
   den följer inte med mellan enheter förrän profilen ligger i databasen,
   se backloggen ("Profil (titel och bild) i databasen"). */
const profKey=()=>sbUser&&sbUser.id?PROFILE_KEY+":"+sbUser.id:null;
function loadProfile(){
  profile={name:"Min Bokhylla",avatar:null};
  const k=profKey();
  try{
    if(k){
      let raw=localStorage.getItem(k);
      /* Engångsflytt: den gamla nyckeln var gemensam för alla konton i
         webbläsaren. Första riktiga (ej anonyma) kontot som loggar in tar
         över den, sedan tas den bort så ingen annan ärver den. */
      if(!raw&&!sbUser.is_anonymous){
        const old=localStorage.getItem(PROFILE_KEY);
        if(old){localStorage.setItem(k,old);localStorage.removeItem(PROFILE_KEY);raw=old}
      }
      const pr=JSON.parse(raw||"null");
      if(pr)profile={name:pr.name||"Min Bokhylla",avatar:pr.avatar||null};
    }
  }catch(e){}
  renderProfile();
}
const initials=n=>(n||"MB").split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join("");
function paintAvatar(el,av,name){if(!el)return;el.style.backgroundImage=av?`url("${av}")`:"none";el.textContent=av?"":initials(name)}
function renderProfile(){
  ["homeAvatar","shareAvatar"].forEach(id=>paintAvatar(document.getElementById(id),profile.avatar,profile.name));
  const set=(id,t)=>{const el=document.getElementById(id);if(el)el.textContent=t};
  set("homeName",profile.name);set("shareName",profile.name);set("splashTitle",profile.name);set("setNameSub",profile.name);
}
renderProfile();
/* ---------- Startsida: 5 s, tryck = hoppa över ---------- */
const splashEl=document.getElementById("splash");
let splashT=[];
/* Bild och typsnitt väljs av ett litet skript direkt i index.html, så att
   rätt bild syns från första stund. Vid första start är det redan gjort;
   "Visa startsidan igen" slumpar en ny. */
let splashFirst=true;
function playSplash(i){
  if(!splashEl)return;
  const S=window.__splash;
  if(S&&!(splashFirst&&S.applied))S.apply(Number.isInteger(i)?i:S.pick());
  splashFirst=false;
  splashT.forEach(clearTimeout);splashT=[];
  splashEl.style.display="";splashEl.classList.remove("fade","go");document.body.classList.add("splashing");
  void splashEl.offsetWidth;
  splashT.push(setTimeout(()=>splashEl.classList.add("go"),60));
  splashT.push(setTimeout(fadeSplash,5000));
}
function fadeSplash(){
  if(!splashEl||splashEl.classList.contains("fade"))return;
  splashT.forEach(clearTimeout);splashT=[];
  splashEl.classList.add("fade");document.body.classList.remove("splashing");
  splashT.push(setTimeout(()=>{splashEl.style.display="none"},1100));
}
if(splashEl){splashEl.addEventListener("click",fadeSplash);playSplash()}

/* Efter Fas 2.6: bocker och beskrivningar bor i databasen (manual_books).
   BOOK_INFO fylls nu av loadManualBooks, inte fran fil. */
const BOOK_INFO={};
/* Innehöll tidigare Thomas riktiga rumsnamn hårdkodade här - synliga för
   alla i den publicerade JS-koden oavsett inloggning. Koden faller redan
   tillbaka på "Hylla "+bc överallt där bcNames saknar ett namn
   (se t.ex. shortName/placeList), och de riktiga namnen laddas från
   databasen (loadBcNames) inom en sekund för en inloggad användare - så
   den här tomma startgissningen kostar ingenting i praktiken. */
const DEFAULT_BC={};
let bcNames={...DEFAULT_BC};
/* Hyllfotona (tidigare data/photos.json + img/) flyttade till databasen -
   filen och mappen låg okrypterade och publikt nåbara i det publicerade
   repot oavsett inloggning. Miniatyrer sparas som base64 direkt i
   bc_photos-raden (litet, visas i varje rutnät-render); fullstora fotot
   ligger i den privata gap-photos-bucketen och hämtas som en
   tidsbegränsad signerad länk först när man faktiskt öppnar det stort (se
   signedPhotoUrl, loadBcPhotos). Tomma tills loadBcPhotos() körts efter
   inloggning. */
let SHELF_IMGS=[],FLAT=[],PH=[];
/* HEAT/SELL flyttade hit uppifrån Sälj-avsnittet (de låg annars långt ner i
   filen) - renderHome() körs redan vid första render()-anropet, innan
   skriptet hunnit så långt, så en const/let där nere gav
   "Cannot access before initialization" (temporal dead zone). */
const HEAT={het:["Het","var(--pink-600)"],medel:["Medel","var(--orange-600)"],lag:["Låg efterfrågan","var(--ink-500)"],
            "kolla-upplaga":["Kolla upplaga","var(--ink-500)"],kolla:["Ej prisverifierad","var(--ink-500)"]};
let SELL=null;
let SELL_PRICES={};
/* Samma TDZ-skäl som HEAT/SELL ovan: renderHome() körs redan vid den
   första render()-anropet och läser homeView. */
const HOMEVIEW_KEY="minbokhylla-homeview";
let homeView="grid";
try{homeView=localStorage.getItem(HOMEVIEW_KEY)||"grid"}catch(e){}
/* Startsidan (#homeEmptyGuide) får inte visas förrän appen vet om du är
   inloggad och har läst in dina hyllor. Första render() körs innan
   getSession() och loadNewShelves() hunnit klart, så utan den här spärren
   blinkade/låg startsidan kvar efter inloggning (sidan laddas om) trots att
   du redan har hyllor. Sätts till true i uppstarten längre ner. */
let homeReady=false;
function flatIndex(gi,ii){let n=0;for(let k=0;k<gi;k++)n+=SHELF_IMGS[k].imgs.length;return n+ii}
/* FLAT/SHELF_IMGS - källan för "sågs senast" (lbShelf) och bläddringen i
   helskärmsvyn (lbShow) - byggdes tidigare bara ur bc_photos, en tabell som
   aldrig fylldes (0 rader i produktion). De riktiga hyllfotona ligger i
   new_shelves och hamnar i PH via syncShelfPhotos. Den här funktionen
   bygger därför om FLAT/SHELF_IMGS ur PH istället, varje gång PH ändras -
   så att "sågs senast" känner till samma foton som resten av appen redan
   visar. Grupperar bara per bc (inte per "label" som bc_photos-tiden
   gjorde - det fältet finns inte på de riktiga fotona). */
function rebuildFlatFromPH(){
  SHELF_IMGS=[];
  PH.forEach(p=>{
    let g=SHELF_IMGS.find(x=>x.bc===p.bc);
    if(!g){g={bc:p.bc,imgs:[]};SHELF_IMGS.push(g)}
    g.imgs.push({cap:p.cap,shelves:p.shelves||[],thumb:p.thumb,path:p.path||null});
  });
  FLAT=PH.map(p=>({path:p.path||null,thumb:p.thumb,cap:(p.bc?(bcNames[p.bc]||"")+" · ":"")+p.cap,shelves:p.shelves||[]}));
}
function buildPhotoIndexes(rows){
  PH=(rows||[]).map((p,i)=>({bc:p.bc,cap:p.cap,thumb:p.thumb_data,path:p.storage_path,shelves:p.shelves||[],fi:i}));
  rebuildFlatFromPH();
}
async function loadBcPhotos(){
  const {data:rows,error}=await sb.from("bc_photos").select("*");
  if(error){console.warn("bc_photos",error);return}
  buildPhotoIndexes(rows);
}
/* Hämtar en tidsbegränsad länk till originalfotot i den privata lagringen.
   Anropas bara när ett foto faktiskt ska visas i fullstorlek - miniatyren
   (ovan) räcker för rutnät och tumnagelrad. */
async function signedPhotoUrl(path,seconds){
  if(!path||!sbUser)return null;
  try{
    const {data,error}=await sb.storage.from("gap-photos").createSignedUrl(path,seconds||3600);
    return error?null:data.signedUrl;
  }catch(e){return null}
}
let curView="hem";
/* Hyllor kan grupperas (parent_bc) och tas bort (hidden). En grupperad
   hylla visas som underhyllor inuti sin förälder; hyllkoderna ändras aldrig. */
let bcParent={},bcHidden=new Set();
let pmMerge=null; /* {sel:Set, name} när du väljer hyllor att slå ihop */
async function loadBcNames(){const {data:rows}=await sb.from("bc_names").select("*");
  if(rows)rows.forEach(r=>{bcNames[r.bc]=r.name;
    if(r.parent_bc)bcParent[r.bc]=String(r.parent_bc);else delete bcParent[r.bc];
    if(r.hidden)bcHidden.add(r.bc);else bcHidden.delete(r.bc)})}
function topBc(bc){let b=String(bc),n=0;while(bcParent[b]&&n++<10)b=bcParent[b];return b}
/* Hyllan själv plus allt som ligger inuti den, utan borttagna. */
function membersOf(bc){const out=[String(bc)];for(let i=0;i<out.length;i++)
  Object.keys(bcParent).forEach(k=>{if(bcParent[k]===out[i]&&!out.includes(k))out.push(k)});
  return out.filter(b=>!bcHidden.has(b))}
/* "Sovrummet – vid sängen" inuti "Sovrummet" visas som "vid sängen". */
function shortName(bc){const nm=bcNames[bc]||("Hylla "+bc),par=bcParent[bc];
  if(!par)return nm;const pn=(bcNames[par]||"").trim();
  const re=new RegExp("^"+pn.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\s*[–—-]\\s*","i");
  const t=nm.replace(re,"").trim();return t?t.charAt(0).toUpperCase()+t.slice(1):nm}
const topPlaces=()=>{const bcs=new Set([...Object.keys(bcNames),...PH.map(p=>p.bc),...data.filter(d=>d.shelf).map(d=>d.shelf.split(":")[0])]);
  return [...bcs].filter(b=>!bcParent[b]&&!bcHidden.has(b)).sort((a,b)=>Number(a)-Number(b))};
/* Lösa hyllplan: bocker som ligger utanfor ett vanligt hyllplan. Kod <bc>:L<n>. */
let spotNames={};
async function loadSpotNames(){
  const {data:rows}=await sb.from("spot_names").select("*");
  if(rows)rows.forEach(r=>spotNames[r.code]=r.name);
}
const SEC={V:"vänster",H:"höger",S:"hyllplan",K:"hyllplan"};
function locLabel(shelf){
  if(!shelf)return "hylla dold – logga in för att se";
  const [bc,rest]=shelf.split(":");const sec=rest[0],plan=rest.slice(1);
  const place=bcParent[bc]?`${bcNames[topBc(bc)]} · ${shortName(bc)}`:bcNames[bc];
  if(sec==="L")return `${place} · ${spotNames[shelf]||"löst"}`;
  return (sec==="S"||sec==="K")?`${place} · hyllplan ${plan}`:`${place} · ${SEC[sec]} · plan ${plan}`}
/* Efter Fas 2.6: alla bocker kommer fran databasen via loadManualBooks. */
let data=[];
async function loadStatuses(){
  const {data:rows,error}=await sb.from("book_status").select("*");
  if(error||!rows)return;
  const map={};rows.forEach(r=>map[r.book_id]=r);
  data.forEach(d=>{const r=map[d.id];if(r){d.status=r.status;d.lentTo=r.lent_to||"";d.ts=r.seen_date||null}else{d.status="hylla";d.lentTo="";d.ts=null}});
  render();
}
const $=s=>document.querySelector(s);
let fs="",fShelf="",fCat="",q="";
/* Filterraderna i sökvyn är hopfällda som standard (se bpFilterSync).
   Deklareras här, inte vid funktionen längre ner: render() körs redan vid
   inläsning och hann annars läsa variabeln innan den fanns. */
let bpFiltersOppna=false;
function buildShelfOptions(){
  const sel=$("#fShelf");sel.innerHTML='<option value="">Alla hyllor</option>';
  const shelves=[...new Set(data.map(d=>d.shelf).filter(Boolean))].sort();
  let lastBc="";
  let grp=null;
  shelves.forEach(s=>{const bc=s.split(":")[0];if(bcHidden.has(bc))return;
    if(bc!==lastBc){grp=document.createElement("optgroup");grp.label=bcParent[bc]?bcNames[topBc(bc)]+" · "+shortName(bc):bcNames[bc];sel.appendChild(grp);lastBc=bc}
    const o=document.createElement("option");o.value=s;o.textContent=locLabel(s).split("· ").slice(1).join("· ");grp.appendChild(o)});
  // bookcase-level options
  topPlaces().reverse().forEach(bc=>{const o=document.createElement("option");o.value="bc:"+bc;o.textContent="Hela "+bcNames[bc];sel.insertBefore(o,sel.children[1])});
}
buildShelfOptions();
[...new Set(data.map(d=>d.cat))].sort((a,b)=>a.localeCompare(b,"sv")).forEach(c=>{const o=document.createElement("option");o.value=c;o.textContent=c;$("#fCat").appendChild(o)});
const STATUS={hylla:["På plats","s-hylla"],utlanad:["Utlånad","s-utlanad"],flyter:["Flyter runt","s-flyter"]};
/* Sparar status. Misslyckas det säger vi till och backar - tidigare
   svaldes felet, och ändringen såg sparad ut fast den inte var det. */
async function saveBook(d,prev){
  if(!sbUser)return;
  const {error}=await sb.from("book_status").upsert({book_id:d.id,status:d.status,lent_to:d.lentTo||"",seen_date:d.ts,updated_at:new Date().toISOString(),updated_by:sbUser.id});
  if(error){
    if(prev)Object.assign(d,prev);render();
    alert("Statusen kunde inte sparas: "+(error.message||error));
  }
}
function save(){}
function cycle(id){if(!sbUser){alert("Logga in för att ändra status.");return}const d=data.find(x=>x.id===id);const prev={status:d.status,lentTo:d.lentTo,ts:d.ts};const order=["hylla","utlanad","flyter"];d.status=order[(order.indexOf(d.status)+1)%3];
d.ts=new Date().toISOString().slice(0,10);
if(d.status!=="utlanad")d.lentTo="";
saveBook(d,prev);render();
if(d.status==="utlanad"){const inp=document.querySelector(`input[data-lent="${id}"]`);if(inp)inp.focus()}}
function setLent(id,val){if(!sbUser)return;const d=data.find(x=>x.id===id);d.lentTo=val.trim();saveBook(d);
document.querySelectorAll(`button[data-sbtn="${id}"]`).forEach(btn=>btn.textContent="Utlånad"+(d.lentTo?" → "+d.lentTo:""))}
/* En bokrad: färgstreck efter kategori, titel (öppnar bokinfo), byline och
   status som badge. Tryck på badgen byter status. */
/* Sökträffarnas rad (design: screens-ovriga.html, Search). Egen funktion,
   inte bookRow() - den ritar också boklistan inne i hyllvyn (renderPlace),
   och hyllvyn ska inte ändras av det här arbetet (projektplanens punkt 0).

   Designens rad har pris och temperatur till höger. De hör till Värdera,
   inte till sökningen: sökningen finns för att hitta en bok och se var den
   står (beslut 29/10). Platsen till höger går därför till statusknappen,
   så man kan markera en bok som utlånad direkt ur träfflistan precis som
   i den gamla listan. */
function searchRow(d){
  const [label]=STATUS[d.status]||STATUS.hylla;
  const tone={hylla:"b-success",utlanad:"b-warning",flyter:"b-brand"}[d.status]||"b-success";
  const lent=d.status==="utlanad"&&d.lentTo?` → ${esc(d.lentTo)}`:"";
  return `<button class="sr" onclick="showInfo(${d.id})">
    <span class="sr-stripe" style="background:${catColor(d.cat)}"></span>
    <span class="sr-main">
      <span class="sr-title">${esc(d.title)}</span>
      <span class="sr-by">${esc([d.author,d.cat].filter(Boolean).join(" · "))}</span>
      <span class="sr-loc">${ic("map-pin")}<span class="${d.shelf?"":"loc-dold"}">${esc(locLabel(d.shelf))}</span>${
        d.shelf?`<a class="var-link" onclick="event.stopPropagation();lbShelf('${d.shelf}',${d.id})">sågs senast${d.ts?" "+d.ts:""}</a>`:""}</span>
    </span>
    <span class="badge ${tone}" data-sbtn="${d.id}" onclick="event.stopPropagation();cycle(${d.id})">${label}${lent}</span>
  </button>`;
}
function bookRow(d,opts){
  const [label]=STATUS[d.status]||STATUS.hylla;
  const tone={hylla:"b-success",utlanad:"b-warning",flyter:"b-brand"}[d.status]||"b-success";
  const lent=d.status==="utlanad"&&d.lentTo?` → ${esc(d.lentTo)}`:"";
  const lentInp=d.status==="utlanad"?`<input class="lent-input" data-lent="${d.id}" placeholder="Utlånad till…" value="${esc(d.lentTo||"")}" onchange="setLent(${d.id},this.value)">`:"";
  const showLoc=!(opts&&opts.noLoc);
  const loc=showLoc?`<div class="bk-loc"><span class="${d.shelf?"":"loc-dold"}">${esc(locLabel(d.shelf))}</span>${d.shelf?`<a class="var-link" onclick="lbShelf('${d.shelf}',${d.id})">${ic("map-pin")}sågs senast${d.ts?" "+d.ts:""}</a>`:""}</div>`:"";
  return `<div class="bk"><span class="bk-stripe" style="background:${catColor(d.cat)}"></span>
    <div class="bk-main"><button class="bk-title" onclick="showInfo(${d.id})">${esc(d.title)}</button>
      <span class="bk-by">${esc([d.author,d.cat].filter(Boolean).join(" · "))}</span>${loc}${lentInp}</div>
    <button class="badge ${tone}" data-sbtn="${d.id}" onclick="cycle(${d.id})">${label}${lent}</button></div>`;
}
function renderSummary(){
  const n=k=>data.filter(d=>d.status===k).length;
  const segs=[[n("hylla"),"var(--pink-500)"],[n("utlanad"),"var(--orange-500)"],[n("flyter"),"var(--magenta-300)"]];
  const bar=document.getElementById("sumBar");
  if(bar)bar.innerHTML=segs.filter(x=>x[0]>0).map(([v,c])=>`<span style="flex:${v};background:${c}"></span>`).join("");
  $("#stTot").textContent=fmtN(data.length);
  const np=placeList().length;
  const sp=document.getElementById("stPlaces");if(sp)sp.textContent=`böcker på ${np} hyllor`;
  const sm=document.getElementById("shareMeta");if(sm)sm.textContent=`${fmtN(data.length)} böcker · ${np} hyllor`;
}
function render(){
  const norm=s=>s.toLowerCase();
  const fMembers=fShelf.startsWith("bc:")?membersOf(fShelf.slice(3)):null;
  const shelfOk=d=>!fShelf||(fMembers?fMembers.includes(d.shelf.split(":")[0]):d.shelf===fShelf);
  const list=data.filter(d=>(!fs||d.status===fs)&&shelfOk(d)&&(!fCat||d.cat===fCat)&&(!q||norm(d.title+" "+d.author).includes(norm(q))));
  $("#stTot").textContent=data.length;
  $("#stHylla").textContent=data.filter(d=>d.status==="hylla").length;
  $("#stUt").textContent=data.filter(d=>d.status==="utlanad").length;
  $("#stFly").textContent=data.filter(d=>d.status==="flyter").length;
  $("#count").textContent=list.length+(list.length===1?" träff":" träffar");
  if(typeof bpFilterSync==="function")bpFilterSync();
  if(window.__lt)window.__lt();
  $("#grid").innerHTML=list.length?list.map(searchRow).join("")
    :`<p class="pl-empty">${q?`Inga träffar på ”${esc(q)}”.`:"Inga böcker matchar filtret."}</p>`;
  renderSummary();renderHome();
  if(curView==="place")renderPlace();
  renderBcEditor();
}
$("#q").addEventListener("input",e=>{q=e.target.value;render();renderRecent();saveRecentSoon()});
$("#q").addEventListener("keydown",e=>{if(e.key==="Enter"&&q.trim())openBooks()});
$("#fShelf").addEventListener("change",e=>{fShelf=e.target.value;render()});
$("#fCat").addEventListener("change",e=>{fCat=e.target.value;render()});
document.querySelectorAll(".chip").forEach(c=>c.addEventListener("click",()=>{document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));c.classList.add("active");fs=c.dataset.s;render()}));
render();
/* ---------- Hyllor: byt namn, slå ihop, dela upp, ta bort ---------- */
function booksIn(bcs){return data.filter(d=>d.shelf&&bcs.includes(d.shelf.split(":")[0]))}
function shelvesIn(bcs){return [...new Set(booksIn(bcs).map(d=>d.shelf))]}
function renderBcEditor(){
  const el=$("#bcEditorIns");if(!el)return;
  const tops=topPlaces();
  if(pmMerge){
    el.innerHTML=`<div class="card pm-merge"><b>Slå ihop hyllor</b>
      <span class="fine">Välj två eller fler. De blir underhyllor inuti en ny hylla, och böckerna står kvar där de står.</span>
      ${tops.map(bc=>`<label class="pm-check"><input type="checkbox" data-mbc="${bc}" ${pmMerge.sel.has(bc)?"checked":""}><span>${esc(bcNames[bc])}</span>
        <small class="mono">${booksIn(membersOf(bc)).length}</small></label>`).join("")}
      <span class="lbl">Namn på den nya hyllan</span>
      <input class="inp inp-lg" id="pmName" placeholder="T.ex. Sovrummet" value="${esc(pmMerge.name)}">
      <div class="btn-row"><button class="btn btn-primary" id="pmDoMerge">Slå ihop</button><button class="btn btn-ghost" id="pmCancel">Avbryt</button></div></div>`;
    el.querySelectorAll("[data-mbc]").forEach(c=>c.addEventListener("change",()=>{
      c.checked?pmMerge.sel.add(c.dataset.mbc):pmMerge.sel.delete(c.dataset.mbc);
      if(!pmMerge.touched){pmMerge.name=commonPrefix([...pmMerge.sel].map(b=>bcNames[b]));el.querySelector("#pmName").value=pmMerge.name}}));
    el.querySelector("#pmName").addEventListener("input",e=>{pmMerge.name=e.target.value;pmMerge.touched=true});
    el.querySelector("#pmCancel").addEventListener("click",()=>{pmMerge=null;renderBcEditor()});
    el.querySelector("#pmDoMerge").addEventListener("click",placeMerge);
    return;
  }
  el.innerHTML=`<button class="btn btn-outline" id="pmStartMerge">Slå ihop hyllor</button>`+tops.map(bc=>{
    const mem=membersOf(bc),kids=mem.filter(b=>b!==bc),n=booksIn(mem).length;
    return `<div class="pm-place">
      <div class="pm-row"><button class="bc-name" data-bc="${bc}">${ic("pencil")}<span>${esc(bcNames[bc])}</span></button><small class="mono">${n}</small></div>
      ${kids.map(k=>`<div class="pm-row pm-kid"><button class="bc-name" data-bc="${k}">${ic("pencil")}<span>${esc(shortName(k))}</span></button>
        <small class="mono">${booksIn([k]).length}</small><button class="link-btn" data-out="${k}">Flytta ut</button></div>`).join("")}
      <div class="pm-acts">${kids.length?`<button class="link-btn" data-split="${bc}">Dela upp</button>`:""}<button class="link-btn pm-del" data-del="${bc}">Ta bort</button></div>
    </div>`}).join("");
  el.querySelector("#pmStartMerge").addEventListener("click",()=>{pmMerge={sel:new Set(),name:"",touched:false};renderBcEditor()});
  el.querySelectorAll("[data-out]").forEach(b=>b.addEventListener("click",()=>placeMoveOut(b.dataset.out)));
  el.querySelectorAll("[data-split]").forEach(b=>b.addEventListener("click",()=>placeSplit(b.dataset.split)));
  el.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",()=>placeDelete(b.dataset.del)));
  el.querySelectorAll("button.bc-name").forEach(b=>b.addEventListener("click",()=>{
    const bc=b.dataset.bc;
    const inp=document.createElement("input");inp.type="text";inp.value=bcNames[bc];inp.className="bc-input";
    b.replaceWith(inp);inp.focus();inp.select();
    let done=false;
    const commit=async()=>{if(done)return;done=true;const n=inp.value.trim();
      if(n&&n!==bcNames[bc]){
        if(!sbUser){alert("Logga in för att byta namn.");renderBcEditor();return}
        const ok=await ask({title:"Byta namn?",text:`"${bcNames[bc]}" byter namn till "${n}".`,buttons:[{label:"Byt namn",value:true,kind:"primary"},{label:"Avbryt",value:false}]});
        if(ok&&await placeSave([{bc,name:n}])){bcNames[bc]=n;toast("Namnet är bytt")}
      }
      placesChanged()};
    inp.addEventListener("keydown",e=>{if(e.key==="Enter")inp.blur();if(e.key==="Escape"){done=true;renderBcEditor()}});
    inp.addEventListener("blur",commit)}));
}
function commonPrefix(names){
  if(names.length<2)return names[0]?names[0].split(/\s[–—-]\s/)[0]:"";
  const parts=names.map(n=>n.split(/\s[–—-]\s/)[0].trim());
  return parts.every(x=>x.toLowerCase()===parts[0].toLowerCase())?parts[0]:"";
}
/* Sparar ändringar i bc_names. Tar alltid med namnet, så att en hylla som
   bara har ett standardnamn i appen också får en rad i databasen. */
async function placeSave(rows){
  /* Alla rader i en upsert måste ha samma fält - fyll i det som inte
     ändras med nuvarande värde. */
  const full=rows.map(r=>({bc:r.bc,
    name:("name" in r)?r.name:(bcNames[r.bc]||("Hylla "+r.bc)),
    parent_bc:("parent_bc" in r)?r.parent_bc:(bcParent[r.bc]||null),
    hidden:("hidden" in r)?r.hidden:bcHidden.has(r.bc)}));
  /* onConflict måste anges explicit - annars matchar Supabase bara mot
     primärnyckeln id (som aldrig skickas med här), och ett nytt försök på
     en bc som redan har en rad krockar med den unika regeln på
     (library_id, bc) istället för att uppdatera raden. library_id behöver
     inte skickas med - databastriggern fyller i den före konfliktkollen. */
  const {error}=await sb.from("bc_names").upsert(full,{onConflict:"library_id,bc"});
  if(error){alert("Kunde inte spara: "+error.message);return false}
  return true;
}
function placesChanged(){buildShelfOptions();render();renderBcEditor();if(curPlace&&!topPlaces().includes(curPlace))curPlace=null}
function needLogin(){if(sbUser)return false;alert("Logga in för att ändra hyllor.");return true}
async function placeMerge(){
  if(needLogin())return;
  const sel=[...pmMerge.sel],name=(pmMerge.name||"").trim();
  if(sel.length<2){alert("Välj minst två hyllor att slå ihop.");return}
  if(!name){alert("Skriv ett namn på den nya hyllan.");return}
  const ok=await ask({title:"Slå ihop hyllor?",
    text:`${sel.map(b=>bcNames[b]).join(", ")} blir underhyllor i den nya hyllan "${name}". Böckerna står kvar där de står, och du kan dela upp hyllan igen.`,
    buttons:[{label:"Slå ihop",value:true,kind:"primary"},{label:"Avbryt",value:false}]});
  if(!ok)return;
  const nb=nextFreeBc();
  bcNames[nb]=name;
  if(!await placeSave([{bc:nb,name,parent_bc:null,hidden:false},...sel.map(b=>({bc:b,parent_bc:nb}))])){delete bcNames[nb];return}
  sel.forEach(b=>bcParent[b]=nb);
  pmMerge=null;placesChanged();toast(`"${name}" skapad`);
}
async function placeSplit(bc){
  if(needLogin())return;
  const kids=membersOf(bc).filter(b=>bcParent[b]===bc);
  const own=booksIn([bc]).length+PH.filter(p=>p.bc===bc).length;
  const ok=await ask({title:"Dela upp hyllan?",
    text:`${kids.map(k=>bcNames[k]).join(", ")} blir egna hyllor igen.${own?"":` "${bcNames[bc]}" har inga egna underhyllor och försvinner.`}`,
    buttons:[{label:"Dela upp",value:true,kind:"primary"},{label:"Avbryt",value:false}]});
  if(!ok)return;
  const rows=kids.map(k=>({bc:k,parent_bc:null}));
  if(!own)rows.push({bc,hidden:true});
  if(!await placeSave(rows))return;
  kids.forEach(k=>delete bcParent[k]);if(!own)bcHidden.add(bc);
  placesChanged();toast("Hyllan är uppdelad");
}
async function placeMoveOut(bc){
  if(needLogin())return;
  const ok=await ask({title:"Flytta ut?",text:`"${bcNames[bc]}" blir en egen hylla igen.`,
    buttons:[{label:"Flytta ut",value:true,kind:"primary"},{label:"Avbryt",value:false}]});
  if(!ok||!await placeSave([{bc,parent_bc:null}]))return;
  delete bcParent[bc];placesChanged();toast("Flyttad");
}
async function placeDelete(bc){
  if(needLogin())return;
  const mem=membersOf(bc),n=booksIn(mem).length,sh=shelvesIn(mem).length,name=bcNames[bc];
  const others=topPlaces().filter(b=>b!==bc);
  const choice=await ask({title:`Ta bort "${name}"?`,
    text:n?`Hyllan har ${n} böcker på ${sh} ${sh===1?"hyllplan":"hyllplan"}. Vad ska hända med dem?`:"Hyllan har inga böcker.",
    buttons:(n&&others.length?[{label:"Flytta böckerna till en annan hylla",value:"move",kind:"primary"}]:[])
      .concat([{label:n?"Ta bort böckerna med hyllan":"Ta bort hyllan",value:"delete",kind:n?"danger":"primary"},{label:"Avbryt",value:false}])});
  if(!choice)return;
  if(choice==="move"){
    const target=await ask({title:"Flytta till vilken hylla?",text:`Innehållet i "${name}" hamnar inuti hyllan du väljer. Böckerna står kvar där de står.`,
      select:others.map(b=>({value:b,label:bcNames[b]})),
      buttons:[{label:"Flytta",value:"__sel",kind:"primary"},{label:"Avbryt",value:false}]});
    if(!target)return;
    const ok=await ask({title:"Är du säker?",text:`${n} böcker på ${sh} ${sh===1?"hyllplan":"hyllplan"} flyttas till "${bcNames[target]}", och "${name}" försvinner som egen hylla.`,
      buttons:[{label:"Ja, flytta",value:true,kind:"primary"},{label:"Avbryt",value:false}]});
    if(!ok||!await placeSave([{bc,parent_bc:target}]))return;
    bcParent[bc]=target;placesChanged();toast(`Flyttat till ${bcNames[target]}`);return;
  }
  if(n){
    const ok=await ask({title:"Är du säker?",text:`${n} böcker tas bort ur katalogen för gott, tillsammans med hyllan "${name}". Det går inte att ångra.`,
      buttons:[{label:"Ja, ta bort",value:true,kind:"danger"},{label:"Avbryt",value:false}]});
    if(!ok)return;
    for(const b of mem){
      const {error}=await sb.from("manual_books").delete().like("shelf",b+":%");
      if(error){alert("Kunde inte ta bort böckerna: "+error.message);return}
    }
    for(let i=data.length-1;i>=0;i--)if(data[i].shelf&&mem.includes(data[i].shelf.split(":")[0]))data.splice(i,1);
    /* Luckor på hyllan går inte längre att fylla - markera dem klara. */
    const deadGaps=GAPS.filter(g=>g.shelf&&mem.includes(g.shelf.split(":")[0])&&gapStateOf(g.id)!=="done");
    for(const g of deadGaps){await sb.from("gap_status").upsert({gap_id:g.id,state:"done",updated_at:new Date().toISOString(),updated_by:sbUser.id});gapState[g.id]={state:"done"}}
    updateGapCount();
  }
  if(!await placeSave(mem.map(b=>({bc:b,hidden:true}))))return;
  mem.forEach(b=>bcHidden.add(b));
  placesChanged();toast(`"${name}" är borttagen`);
}
/* ---------- Dialog: fråga med knappar (och ev. en väljare) ---------- */
function ask({title,text,buttons,select,input}){
  return new Promise(res=>{
    const wrap=document.createElement("div");wrap.className="dlg-wrap";
    wrap.innerHTML=`<div class="dlg" role="alertdialog" aria-modal="true"><b>${esc(title)}</b>${text?`<p>${esc(text)}</p>`:""}
      ${select?`<select class="inp dlg-sel">${select.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select>`:""}
      ${input?`<input class="inp dlg-in" placeholder="${esc(input.placeholder||"")}" value="${esc(input.value||"")}">`:""}
      <div class="dlg-btns">${buttons.map((b,i)=>`<button class="btn ${b.kind==="primary"?"btn-primary":b.kind==="danger"?"btn-danger":"btn-ghost"}" data-i="${i}">${esc(b.label)}</button>`).join("")}</div></div>`;
    document.body.appendChild(wrap);
    const close=v=>{wrap.remove();res(v)};
    wrap.querySelectorAll("[data-i]").forEach(b=>b.addEventListener("click",()=>{
      const v=buttons[+b.dataset.i].value;const sEl=wrap.querySelector(".dlg-sel"),iEl=wrap.querySelector(".dlg-in");
      close(v==="__sel"?sEl.value:v==="__form"?{sel:sEl?sEl.value:null,input:iEl?iEl.value:""}:v)}));
    wrap.addEventListener("click",e=>{if(e.target===wrap)close(false)});
    const inEl=wrap.querySelector(".dlg-in");
    if(inEl){inEl.focus();inEl.addEventListener("keydown",e=>{if(e.key==="Enter")wrap.querySelector(".dlg-btns .btn").click()})}
    else{const first=wrap.querySelector(".dlg-btns .btn");if(first)first.focus()}
  });
}
function renderPhotoTabs(){renderHome();if(curView==="place")renderPlace()}
function placeList(){
  return topPlaces().map(bc=>{
    const mem=membersOf(bc);
    const ph=PH.filter(p=>mem.includes(p.bc)&&!p.replaced)
      .sort((a,b)=>cmpKey(photoKey(a,mem),photoKey(b,mem)));
    return {bc,members:mem,name:bcNames[bc]||("Hylla "+bc),photos:ph,cover:ph[0]?ph[0].thumb:"",
            count:data.filter(d=>d.shelf&&mem.includes(d.shelf.split(":")[0])).length};
  });
}
/* PR 6: tomt läge för ny användare. Ett nytt bibliotek (anonymt eller
   nyss skapat via signup) har varken hyllor, foton eller böcker - utan
   den här guiden var Hem bara en enda "+"-ruta med ingen förklaring. */
function setHomeView(v){
  homeView=v;try{localStorage.setItem(HOMEVIEW_KEY,v)}catch(e){}
  renderHomeViewSeg();renderHome();
}
window.setHomeView=setHomeView;
function renderHomeViewSeg(){
  document.querySelectorAll("#homeViewSeg [data-view]").forEach(b=>b.classList.toggle("on",b.dataset.view===homeView));
}
/* Hyllistan på Hem (design 2026-10-26, "Startsida"): tre valbara vyer
   (Rutnät/Lista/Textlista), se Inställningar -> "Startsidans utseende".
   "Lägg till hylla" är sista raden/cellen i alla tre, ingen egen
   kameraknapp i headern längre (fanns inte i den nya designen - samma
   flöde nås via addShelf() från listans "Lägg till hylla" i stället). */
function renderHome(){
  const gridEl=document.getElementById("viewGrid"),listEl=document.getElementById("viewList"),textEl=document.getElementById("viewText");
  if(!gridEl||!listEl||!textEl)return;
  const known=data.some(d=>d.shelf);
  const places=placeList();
  const guide=document.getElementById("homeEmptyGuide");
  const firstRun=homeReady&&(!sbUser||places.length===0);
  if(guide)guide.style.display=firstRun?"":"none";
  /* Första gången (ingen hylla än) tar guiden över hela skärmen (se
     .eg-card i style.css, position:fixed över rubrik och fliklist) -
     bara bilden, rubriken och de två knapparna syns. body.eg-lock
     stänger av bakgrundsscroll medan den täcker skärmen. */
  document.body.classList.toggle("eg-lock",!!firstRun);
  gridEl.hidden=homeView!=="grid";listEl.hidden=homeView!=="list";textEl.hidden=homeView!=="text";
  if(homeView==="grid"){
    gridEl.innerHTML=places.map(p=>`<button class="hv-g-item" onclick="openPlace('${p.bc}')">
        ${p.cover?`<img src="${p.cover}" alt="" loading="lazy" decoding="async">`:`<span class="hv-g-noimg"></span>`}
        <span class="hv-g-scrim"></span>
        <span class="hv-g-info"><span class="hv-g-name">${esc(p.name)}</span>${known?`<span class="hv-g-n">${p.count}</span>`:""}</span>
      </button>`).join("")+
      `<button class="hv-add hv-g-item" onclick="addShelf()">Lägg till hylla</button>`;
  } else if(homeView==="list"){
    listEl.innerHTML=places.map(p=>`<button class="hv-l-item" onclick="openPlace('${p.bc}')">
        ${p.cover?`<img class="hv-l-thumb" src="${p.cover}" alt="" loading="lazy" decoding="async">`:`<span class="hv-l-thumb"></span>`}
        <span class="hv-l-info"><span class="hv-l-name">${esc(p.name)}</span>${known?`<span class="hv-l-n">${p.count}</span>`:""}</span>
        ${ic("chevron-right")}
      </button>`).join("")+
      `<button class="hv-add hv-l-item" onclick="addShelf()">Lägg till hylla</button>`;
  } else {
    textEl.innerHTML=places.map(p=>`<button class="hv-t-item" onclick="openPlace('${p.bc}')">
        <span class="hv-t-spine" style="background:${catColor(p.name)}"></span>
        <span class="hv-t-name">${esc(p.name)}</span>
        ${known?`<span class="hv-t-n">${p.count}</span>`:""}
        ${ic("chevron-right")}
      </button>`).join("")+
      `<button class="hv-add hv-t-item" onclick="addShelf()">Lägg till hylla</button>`;
  }
  const ps=document.getElementById("setPlacesSub");if(ps)ps.textContent=places.length+" hyllor · byt namn, slå ihop, ta bort";
  /* Titeln "N böcker" - totalt antal, inte filtrerat. */
  const cnt=document.getElementById("hmCount");if(cnt)cnt.textContent=fmtN(data.length)+" böcker";
}
let curPlace=null,curPhoto=null;
function openPlace(bc,fi){
  curPlace=topBc(bc);
  const p=placeList().find(x=>x.bc===curPlace);
  curPhoto=(fi!=null)?fi:(p&&p.photos[0]?p.photos[0].fi:null);
  go("place");
}
const capOf=ph=>(ph.bc!==curPlace?shortName(ph.bc)+" · ":"")+ph.cap;
/* Helskärm: fotona ur repot bläddras i helskärmsvyn, uppladdade öppnas ett och ett. */
function showPhoto(fi){const ph=PH[fi];if(!ph)return;if(ph.db)lbSrc(ph.src,capOf(ph));else lbOpen(fi)}
function pickPhoto(fi){curPhoto=fi;renderPlace()}
function renderPlace(){
  const el=document.getElementById("view-place");if(!el)return;
  const p=placeList().find(x=>x.bc===curPlace);if(!p){el.innerHTML="";return}
  /* Valt foto måste höra till hyllan eller någon av dess underhyllor - i en
     sammanslagen hylla har fotona de gamla hyllornas nummer. */
  const sel=PH[curPhoto]&&p.members.includes(PH[curPhoto].bc)?PH[curPhoto]:p.photos[0];
  const prevStrip=el.querySelector(".thumbs"),keepX=prevStrip&&prevStrip.dataset.place===p.bc?prevStrip.scrollLeft:0;
  const coverSrc=sel?sel.thumb:p.cover;
  const inPlace=data.filter(d=>d.shelf&&p.members.includes(d.shelf.split(":")[0]));
  const cm={};inPlace.forEach(d=>cm[d.cat]=(cm[d.cat]||0)+1);
  const cats=Object.entries(cm).sort((a,b)=>b[1]-a[1]).slice(0,5);const cMax=cats.length?cats[0][1]:1;
  const books=sel?data.filter(d=>sel.shelves.includes(d.shelf)):inPlace;
  /* "Inte inloggad" ska betyda "ingen Supabase-session alls" - inte "inga
     böcker ännu". En nyss registrerad användare vars granskningskö fortfarande
     är tom är inloggad men boklös, och ska inte få "Logga in för att se". */
  const loggedOut=!sbUser;
  el.innerHTML=`<div class="pl-cover">${coverSrc?`<img src="${coverSrc}" alt="${sel?esc(capOf(sel)):""}" onclick="showPhoto(${sel?sel.fi:-1})">`:`<div class="no-img"></div>`}
      <button class="pill-back" onclick="go('hem')">← Hem</button></div>
    <div class="pl-head"><h1>${esc(p.name)}</h1><span>${loggedOut?"":p.count+" böcker · "}${p.photos.length} foton</span></div>
    ${p.photos.length?`<div class="thumbs" data-place="${p.bc}">${p.photos.map(ph=>`<button class="th${sel&&ph.fi===sel.fi?" on":""}" onclick="pickPhoto(${ph.fi})">
        <img src="${ph.thumb}" alt="" loading="lazy"><span>${esc(capOf(ph))}</span></button>`).join("")}</div>`:""}
    <div class="pl-acts">${sel?`<button class="btn btn-outline btn-sm btn-ic" onclick="placePhoto('byt')">${ic("camera")}Byt bild</button>`:""}
      <button class="btn btn-primary btn-sm btn-ic" onclick="placePhoto('ny')">${ic("image-plus")}Ny bild</button></div>
    ${cats.length?`<div class="card pl-cats"><h2>Vad står här</h2>${cats.map(([c,n])=>`<div class="cat-bar"><span>${esc(c)}</span>
        <span class="track"><span style="width:${Math.round(n/cMax*100)}%;background:${catColor(c)}"></span></span><b>${n}</b></div>`).join("")}</div>`:""}
    <div class="pl-books">
      ${sel?`<div class="pl-sel"><span>${esc(capOf(sel))}${books.length?" · tryck på status för att byta":""}</span><button onclick="showPhoto(${sel.fi})">Visa foto</button></div>`:""}
      <div class="booklist">${loggedOut?`<p class="pl-empty">Logga in för att se vilka böcker som står här.</p>`
        :(books.length?books.map(d=>bookRow(d,{noLoc:true})).join(""):`<p class="pl-empty">Inga böcker registrerade för det här fotot ännu.${sel&&sel.db?" Läs av det under Inställningar → Hyllor.":""}</p>`)}</div>
    </div>`;
  /* Bildraden ritas om vid varje val - behåll var du var, och se till att
     det valda fotot syns. Utan detta hoppade raden tillbaka till början. */
  const strip=el.querySelector(".thumbs");
  if(strip){strip.scrollLeft=keepX;const on=strip.querySelector(".th.on");
    if(on){const l=on.offsetLeft-strip.offsetLeft,r=l+on.offsetWidth;
      if(l<strip.scrollLeft||r>strip.scrollLeft+strip.clientWidth)strip.scrollLeft=Math.max(0,l-20)}}
}
/* ---------- Byt bild / Ny bild direkt i hyllvyn ----------
   Byt bild: nytt foto av det valda hyllplanet; det ersätter det gamla när det
   klarmarkeras. Ny bild: foto av ett hyllplan som inte är fotat än. Efter
   uppladdning erbjuds avläsning, och efter avläsning klarmarkering. */
let ppMode=null,psFromPlace=null;
function placePhoto(mode){
  if(!sbUser){alert("Logga in för att lägga till foton.");return}
  ppMode=mode;const inp=document.getElementById("ppFile");inp.value="";inp.click();
}
async function onPlaceFile(input){
  const f=input.files&&input.files[0];if(!f)return;
  const p=placeList().find(x=>x.bc===curPlace);if(!p)return;
  const sel=PH[curPhoto]&&p.members.includes(PH[curPhoto].bc)?PH[curPhoto]:p.photos[0];
  let bc,code=null,label;
  if(ppMode==="byt"&&sel){
    bc=sel.bc;label=sel.cap;code=sel.shelves.join(",")||null;
    const ok=await ask({title:"Byt bild?",text:`Det nya fotot av "${capOf(sel)}" ersätter det gamla när du har läst av det och tryckt Klar. Fram till dess visas båda.`,
      buttons:[{label:"Ladda upp",value:true,kind:"primary"},{label:"Avbryt",value:false}]});
    if(!ok)return;
  }else{
    /* Den del av hyllan du tittar på står först (förvald). */
    const first=sel?sel.bc:p.bc;
    const opts=p.members.length>1?[first].concat(p.members.filter(b=>b!==first)).map(b=>({value:b,label:b===p.bc?bcNames[b]:shortName(b)})):null;
    const r=await ask({title:"Ny bild",text:"Vad heter hyllplanet på fotot? Till exempel \"Plan 5\", \"Vänster plan 2\" eller \"Skrivbord\".",
      select:opts,input:{placeholder:"Hyllplanets namn"},
      buttons:[{label:"Ladda upp",value:"__form",kind:"primary"},{label:"Avbryt",value:false}]});
    if(!r)return;
    label=(r.input||"").trim();if(!label){alert("Skriv vad hyllplanet heter.");return}
    bc=r.sel||p.bc;
  }
  toast("Laddar upp…");
  try{
    let dataUrl;
    try{dataUrl=await shrinkToDataURL(f,1100,0.62)}
    catch(e){dataUrl=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(f)})}
    const row=await uploadShelfPhoto({bc,name:bcNames[bc]||bcNames[topBc(bc)]||"",code,label,file:f,dataUrl});
    await loadNewShelves();
    if(row){const ph=PH.find(x=>x.nsId===row.id);if(ph)curPhoto=ph.fi;renderPlace()}
    const now=await ask({title:"Fotot är uppladdat",text:"Vill du läsa av böckerna på fotot nu?",
      buttons:[{label:"Läs av nu",value:true,kind:"primary"},{label:"Senare",value:false}]});
    if(now&&row){psFromPlace=row.id;await runAnalys("shelf",row.id,null)}
  }catch(e){alert("Kunde inte ladda upp: "+(e.message||e))}
}
window.placePhoto=placePhoto;
document.getElementById("ppFile").addEventListener("change",e=>onPlaceFile(e.target));
/* Äldre ingång: öppna ett foto ur SHELF_IMGS - leder nu till hyllvyn. */
function openShelfView(gi,j){const g=SHELF_IMGS[gi];if(!g)return;openPlace(g.bc,flatIndex(gi,j))}
renderBcEditor();

/* ---------- Bokinfo ---------- */
const infoModal=document.createElement("div");infoModal.className="info-modal";
infoModal.innerHTML='<div class="info-box"><button class="info-close">✕</button><div class="ib-top"><div id="ibCover" class="ib-cover"></div><div class="ib-head"><h3 id="ibTitle"></h3><div class="ib-auth" id="ibAuth"></div></div></div><div id="ibBody"></div><div class="ib-src" id="ibSrc"></div></div>';
document.body.appendChild(infoModal);
infoModal.addEventListener("click",e=>{if(e.target===infoModal||e.target.classList.contains("info-close"))infoModal.classList.remove("open")});
document.addEventListener("keydown",e=>{if(e.key==="Escape")infoModal.classList.remove("open")});
/* ---------- Bokdetalj (design: screens-ovriga.html, Detail) ----------
   Behåller den befintliga rutan (infoModal) och byter bara innehållet mot
   designens tre flikar - beslut 29/10: addera eller dra ifrån, bygg inte
   om det som fungerar. Omslag, beskrivning, kategoriväljare och de externa
   länkarna som redan fanns ligger kvar, nu under Fakta.

   "Sälj boken" ur designen är backloggad: värderingsrundorna körs manuellt
   i en Claude-session, så appen kan inte lägga till en bok i listan själv -
   knappen hade lett till en återvändsgränd. */
let ibTab="fakta",ibBok=null;

/* Värderingsposten för en bok, om den finns. De flesta böcker har ingen -
   bara en minoritet av katalogen har gått genom en värderingsrunda. */
function sellForBook(d){
  if(!SELL||!SELL.items)return null;
  return SELL.items.find(it=>it.book_id===d.id)||
         SELL.items.find(it=>it.match_title&&(it.match_title===d.title||d.title.startsWith(it.match_title)))||null;
}
/* Hyllfotots rad för bokens hyllkod - behövs för att "Ändra" ska kunna
   öppna rättningsvyn (psOpen). Böcker utan matchande foto saknar rad. */
function rowForBook(d){
  if(!d.shelf)return null;
  return (window.__nsRows||[]).find(r=>shelfCodeForRow(r)===d.shelf)||null;
}
function ibSetTab(t){ibTab=t;if(ibBok!=null)showInfo(ibBok,true)}
function ibAndra(){
  const d=data.find(x=>x.id===ibBok);if(!d)return;
  const r=rowForBook(d);
  if(!r){toast("Den här boken hör inte till något hyllfoto – ändra kategorin här i rutan.");return}
  infoModal.classList.remove("open");
  psOpen("ratta",r.id);
}
function ibVardeHtml(d){
  const it=sellForBook(d);
  if(!it)return `<div class="ib-tom"><b>Inte värderad än</b>
    <p class="fine">Boken har inte gått genom någon värderingsrunda, så det finns inget pris att visa.
    Värderingarna körs i omgångar – nästa gång en körs kommer den här boken med.</p></div>`;
  /* Väntar på kontroll: ingen prissiffra alls, bara länken till den
     troliga sidan (Design 29/10 g). */
  if(it.price_status==="vantar"){
    const kalla=(SELL_PRICES[it.id]||[])[0];
    return `<div class="ib-varde"><div class="card ib-kort">
      <span class="ib-eyebrow">Väntar på kontroll</span>
      <p class="fine">Sidan hittad men priset gick inte att läsa av automatiskt.</p>
      ${kalla&&kalla.url?`<a href="${esc(kalla.url)}" target="_blank" rel="noopener">Öppna</a>`:""}
    </div></div>`;
  }
  const kallor=(SELL_PRICES[it.id]||[]).filter(k=>k.price!=null);
  const priser=kallor.map(k=>k.price);
  const auto=it.price_status==="automatiskt",osakert=it.price_status==="osakert";
  const varde=auto||osakert?(it.price_low!=null?it.price_low:null):(it.estimated_value!=null?it.estimated_value:(it.low||null));
  const lag=osakert&&it.price_low!=null?it.price_low:(priser.length?Math.min(...priser):null);
  const hog=osakert&&it.price_high!=null?it.price_high:(priser.length?Math.max(...priser):null);
  /* Intervallet räknas ur de verkliga sajtpriserna, inte ur ett påhittat
     spann: designens markör ska stå någonstans som betyder något. */
  const pos=(varde!=null&&lag!=null&&hog!=null&&hog>lag)?Math.max(0,Math.min(100,(varde-lag)/(hog-lag)*100)):50;
  const h=HEAT[it.heat_score||it.heat];
  const u=it.uncertainty?(it.uncertainty==="lag"?"Säkert pris":it.uncertainty==="hog"?"Osäkert pris":"Medel säkerhet"):"";
  /* Okontrollerat: "ca"-prefix och egen eyebrow (Design 29/10 e). Varierande:
     ingen markör i spannet - det finns inget enskilt värde att placera
     (Design 29/10 f) - och ingen egen prissiffra ovanför baren. */
  return `<div class="ib-varde">
    <div class="card ib-kort">
      <span class="ib-eyebrow">${auto?"Okontrollerat pris":osakert?"Varierande pris":"Indikerat pris"}</span>
      ${osakert?"":`<span class="ib-kr"${auto?' style="color:var(--ink-500)"':""}>${varde!=null?(auto?"ca ":"")+fmtN(varde)+" kr":"–"}</span>`}
      ${auto?"":u?`<span class="u ${esc(it.uncertainty)}">${u}</span>`:""}
      ${h?`<span class="ib-hetta" style="color:${h[1]}">${h[0]}</span>`:""}
      ${lag!=null&&hog!=null&&hog>lag?`<div class="ib-span">
        <div class="ib-spanbar">${osakert?"":`<span class="ib-markor" style="left:${pos}%"></span>`}</div>
        <div class="ib-spantal"><span>${fmtN(lag)} kr</span><span>${fmtN(hog)} kr</span></div>
      </div>`:""}
      ${auto?`<p class="fine">Priset kan höra till en annan upplaga än din. Samma titel kan skilja flera hundra kronor mellan upplagor.</p>`:""}
    </div>
    ${kallor.length?`<ul class="sell-sources">${kallor.map(k=>`<li><span>${esc(SELL_SITES[k.site]||k.site)}</span>
        <span>${fmtN(k.price)} kr${k.url?` · <a href="${esc(k.url)}" target="_blank" rel="noopener">Öppna</a>`:""}</span></li>`).join("")}</ul>`:""}
  </div>`;
}
function ibFaktaHtml(d){
  const info=BOOK_INFO[d.title];
  const it=sellForBook(d);
  const sq=encodeURIComponent(d.title+" "+(d.author||""));
  const cats=[...new Set(data.map(x=>x.cat))].sort((a,b)=>a.localeCompare(b,"sv"));
  const rad=(k,v)=>`<div class="ib-rad"><span>${k}</span><span>${v}</span></div>`;
  /* Författaren står redan under titeln i rutans huvud - ingen egen rad.
     Tom beskrivning får ingen mening alls; tystnad säger samma sak. */
  return `<div class="ib-fakta">
    ${rad("Kategori",`<select class="ib-catsel" onchange="setBookCat(${d.id},this.value)">${
      cats.map(c=>`<option${c===d.cat?" selected":""}>${esc(c)}</option>`).join("")}</select>`)}
    ${rad("Hylla",d.shelf?esc(locLabel(d.shelf)):"<i>ingen</i>")}
    ${it&&it.condition_note?rad("Skick",esc(it.condition_note)):""}
  </div>
  ${info?`<p>${esc(info)}</p><p class="ib-src2">Skriven av Claude – kan innehålla fel.</p>`:""}
  <p class="ib-lankar"><a href="https://www.goodreads.com/search?q=${sq}" target="_blank" rel="noopener">Goodreads</a>
   <a href="https://www.adlibris.com/se/sok?q=${sq}" target="_blank" rel="noopener">Adlibris</a></p>`;
}
/* Historik (Design 29/10 i): en rad per ersatt pris, nyast först. Laddas
   bara när fliken faktiskt öppnas (sällan använd, ingen poäng att hämta
   den i förväg för varje bok man råkar öppna). */
let SELL_HISTORY={};
async function loadSellHistory(itemId){
  const{data:rows,error}=await sb.from("sell_price_history").select("*").eq("sell_item_id",itemId).order("replaced_at",{ascending:false});
  if(error){console.warn("sell_price_history",error);SELL_HISTORY[itemId]=[];return}
  SELL_HISTORY[itemId]=rows||[];
  if(ibTab==="historik")showInfo(ibBok,true);
}
function ibHistorikHtml(d){
  const it=sellForBook(d);
  if(!it)return `<div class="ib-tom"><b>Ingen historik än</b>
    <p class="fine">Tidigare priser visas här när boken värderas om.</p></div>`;
  const rader=SELL_HISTORY[it.id];
  if(rader===undefined){loadSellHistory(it.id);return `<div class="ib-tom"><p class="fine">Laddar…</p></div>`}
  if(!rader.length)return `<div class="ib-tom"><b>Ingen historik än</b>
    <p class="fine">Tidigare priser visas här när boken värderas om.</p></div>`;
  return rader.map(r=>`<div class="ib-rad"><span>${esc(new Date(r.replaced_at).toLocaleDateString("sv-SE"))} · ${esc(SELL_SITES[r.site]||r.site)}</span>
    <span>${r.price!=null?fmtN(r.price)+" kr":"–"} · ${esc(STATUS_NAMN[r.status]||r.status)}</span></div>`).join("");
}
function showInfo(id,behallFlik){
  const d=data.find(x=>x.id===id);if(!d)return;
  if(!behallFlik){ibBok=id;ibTab="fakta"}
  document.getElementById("ibTitle").textContent=d.title;
  document.getElementById("ibAuth").textContent=[d.author,d.cat].filter(Boolean).join(" · ");
  const flikar=[["varde","Värde"],["fakta","Fakta"],["historik","Historik"]];
  const kropp=ibTab==="varde"?ibVardeHtml(d)
    :ibTab==="historik"?ibHistorikHtml(d)
    :ibFaktaHtml(d);
  document.getElementById("ibBody").innerHTML=
    `<div class="ib-flikar">${flikar.map(([k,l])=>
      `<button class="${ibTab===k?"on":""}" onclick="ibSetTab('${k}')">${l}</button>`).join("")}</div>
     <div class="ib-kropp">${kropp}</div>
     <div class="ib-knappar"><button class="btn btn-outline btn-sm" onclick="ibAndra()">${ic("pencil")}Ändra</button></div>`;
  document.getElementById("ibSrc").textContent="";
  const slot=document.getElementById("ibCover");
  if(!behallFlik){
    slot.innerHTML='<div class="ib-ph">…</div>';
    findCover(d).then(url=>{
      slot.innerHTML = url
        ? `<img src="${url}" alt="Omslag" onerror="this.parentNode.innerHTML=coverUploadHtml(${d.id})">`
        : coverUploadHtml(d.id);
    });
  }
  infoModal.classList.add("open");
}

function coverUploadHtml(id){
  return `<label class="ib-ph up">${ic("camera")}<span>Lägg till omslag</span>
    <input type="file" accept="image/*" style="display:none" onchange="uploadCover(${id},this)"></label>`;
}
window.coverUploadHtml=coverUploadHtml;
/* ---------- Lightbox ---------- */
const lb=document.createElement("div");lb.className="lb";lb.innerHTML=
 `<div class="lb-stage"><img id="lbImg" alt=""></div>
  <button class="lb-btn lb-close" aria-label="Stäng">✕</button>
  <button class="lb-btn lb-prev" aria-label="Föregående">‹</button>
  <button class="lb-btn lb-next" aria-label="Nästa">›</button>
  <div class="lb-cap" id="lbCap"></div>`;
document.body.appendChild(lb);
const lbImg=lb.querySelector("#lbImg"),lbCap=lb.querySelector("#lbCap"),stage=lb.querySelector(".lb-stage");
const lbMark=document.createElement("div");lbMark.className="lb-mark";lb.appendChild(lbMark);
let lbIdx=0,scale=1,tx=0,ty=0,markFrac=null,baseRect=null;
function measureBase(){
  const prev=lbImg.style.transform;
  lbImg.style.transition="none";lbImg.style.transform="none";
  baseRect=lbImg.getBoundingClientRect();
  lbImg.style.transform=prev;
}
function updateMark(){
  if(!markFrac||!baseRect){lbMark.style.display="none";return}
  const L=baseRect.left+tx, T=baseRect.top+ty, W=baseRect.width*scale, H=baseRect.height*scale;
  lbMark.style.display="block";
  lbMark.style.left=(L+W*markFrac.x0)+"px";
  lbMark.style.width=(W*(markFrac.x1-markFrac.x0))+"px";
  lbMark.style.top=(T+H*markFrac.y0)+"px";
  lbMark.style.height=(H*(markFrac.y1-markFrac.y0))+"px";
}
function applyT(){
  lbImg.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;
  lbImg.style.cursor=scale>1?"grab":"zoom-in";
  requestAnimationFrame(updateMark);
}
function resetT(){scale=1;tx=0;ty=0;lbImg.style.transition="";applyT()}
/* zooma mot en punkt på skärmen */
function zoomAt(clientX,clientY,ns){
  if(!baseRect)measureBase();
  ns=Math.min(6,Math.max(1,ns));
  const localX=(clientX-baseRect.left-tx)/scale;
  const localY=(clientY-baseRect.top-ty)/scale;
  tx=clientX-baseRect.left-localX*ns;
  ty=clientY-baseRect.top-localY*ns;
  scale=ns;
  if(scale===1){tx=0;ty=0}
  applyT();
}
function lbShow(i){
  lbIdx=(i+FLAT.length)%FLAT.length;
  const f=FLAT[lbIdx];
  /* Visa miniatyren direkt, hämta en signerad länk till originalet i
     bakgrunden och byt upp när den kommer - bara om man inte redan
     bläddrat vidare till ett annat foto under tiden. */
  lbImg.src=f.thumb||"";lbCap.textContent=f.cap;markFrac=null;
  if(f.path)signedPhotoUrl(f.path).then(url=>{if(url&&lbIdx===(i+FLAT.length)%FLAT.length)lbImg.src=url});
  scale=1;tx=0;ty=0;lbImg.style.transition="";lbImg.style.transform="none";
  lbImg.onload=()=>{measureBase();applyT()};
}
function lbOpen(i){lb.classList.add("open");document.body.style.overflow="hidden";lbShow(i)}
function lbClose(){lb.classList.remove("open");document.body.style.overflow=""}
addEventListener("resize",()=>{if(lb.classList.contains("open")){measureBase();applyT()}});
lb.querySelector(".lb-close").addEventListener("click",lbClose);
lb.querySelector(".lb-prev").addEventListener("click",e=>{e.stopPropagation();lbShow(lbIdx-1)});
lb.querySelector(".lb-next").addEventListener("click",e=>{e.stopPropagation();lbShow(lbIdx+1)});
lb.addEventListener("click",e=>{if(e.target===lb||e.target===stage)lbClose()});
document.addEventListener("keydown",e=>{if(!lb.classList.contains("open"))return;
 if(e.key==="Escape")lbClose();
 if(e.key==="ArrowLeft"&&scale===1)lbShow(lbIdx-1);
 if(e.key==="ArrowRight"&&scale===1)lbShow(lbIdx+1);
 if(e.key==="0")resetT();});
/* Styrplatta/mus: ctrl+scroll (nyp) = zoom, vanlig scroll = panorera */
stage.addEventListener("wheel",e=>{
  e.preventDefault();
  if(!baseRect)measureBase();
  if(e.ctrlKey||e.metaKey){
    lbImg.style.transition="";
    zoomAt(e.clientX,e.clientY,scale*Math.pow(0.99,e.deltaY));
  }else if(scale>1){
    lbImg.style.transition="";
    tx-=e.deltaX;ty-=e.deltaY;applyT();
  }else{
    lbImg.style.transition="transform .12s ease-out";
    zoomAt(e.clientX,e.clientY,scale*Math.pow(0.995,e.deltaY));
  }
},{passive:false});
lbImg.addEventListener("dblclick",e=>{e.preventDefault();
  lbImg.style.transition="transform .25s ease-out";
  if(scale>1)resetT();else zoomAt(e.clientX,e.clientY,2.5);});
/* Pekskärm: dra = panorera, nyp = zooma, svep = bläddra */
const pts=new Map();let start=null,pinch=null,swipeX=null;
lbImg.addEventListener("pointerdown",e=>{
  e.preventDefault();lbImg.style.transition="";lbImg.setPointerCapture(e.pointerId);
  pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pts.size===1){start={x:e.clientX,y:e.clientY,tx,ty};swipeX=e.clientX}
  if(pts.size===2){const a=[...pts.values()];
    pinch={d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),s:scale,
           cx:(a[0].x+a[1].x)/2,cy:(a[0].y+a[1].y)/2};start=null}});
lbImg.addEventListener("pointermove",e=>{
  if(!pts.has(e.pointerId))return;
  pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pts.size===2&&pinch){
    const a=[...pts.values()];
    const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
    zoomAt(pinch.cx,pinch.cy,pinch.s*d/pinch.d);
  }else if(pts.size===1&&start&&scale>1){
    tx=start.tx+e.clientX-start.x;ty=start.ty+e.clientY-start.y;applyT();
  }});
function up(e){
  if(pts.has(e.pointerId)){
    if(pts.size===1&&scale===1&&swipeX!==null){
      const dx=e.clientX-swipeX;
      if(dx<-60)lbShow(lbIdx+1);else if(dx>60)lbShow(lbIdx-1);
    }
    pts.delete(e.pointerId);
  }
  if(pts.size<2)pinch=null;
  if(pts.size===0){start=null;swipeX=null}
}
lbImg.addEventListener("pointerup",up);lbImg.addEventListener("pointercancel",up);

/* till toppen-knapp */
const toTop=document.createElement("button");toTop.id="toTop";toTop.setAttribute("aria-label","Till toppen");toTop.textContent="↑";
document.body.appendChild(toTop);
toTop.addEventListener("click",()=>scrollTo({top:0,behavior:"smooth"}));
addEventListener("scroll",()=>toTop.classList.toggle("show",scrollY>600),{passive:true});


/* PR 5: en anonym session (PR5a) har inget e-postkonto att visa eller logga
   ut från - att logga ut skulle bara göra det tillfälliga biblioteket
   onåtkomligt för gott, utan något sätt att komma tillbaka till det. Den
   som är anonymt inloggad ska istället kunna "spara sitt bibliotek" genom att
   lägga på e-post + lösenord på exakt samma session (sb.auth.updateUser) -
   samma library_id, samma data, bara en riktig inloggning runt den. */
function renderAuth(){
  const el=document.getElementById("authBar");if(!el)return;
  const sub=document.getElementById("setAuthSub");
  if(sub)sub.textContent=sbUser?(sbUser.is_anonymous?"Tillfälligt bibliotek · spara det med ett konto":"Inloggad: "+sbUser.email):(sbOnline?"Inte inloggad · logga in för att ändra":"Servern går inte att nå");
  if(sbUser&&sbUser.is_anonymous){
    el.innerHTML=`<p class="fine">Du har ett tillfälligt bibliotek. Lägg till e-post och lösenord för att spara det och kunna logga in på en annan enhet.</p>
      <input id="saEmail" type="email" placeholder="E-post" autocomplete="username">
      <input id="saPass" type="password" placeholder="Lösenord (minst 6 tecken)" autocomplete="new-password">
      <button id="btnSaveAcc">Skapa konto</button><span class="err" id="saErr"></span>
      <p class="fine" style="margin-top:12px">Har du redan ett konto? <button class="link-btn" id="btnGotoLogin" type="button">Logga in på det istället</button></p>
      <button class="btn-outline" id="btnAnonOut" type="button" style="margin-top:4px">Logga ut</button>`;
    const doSave=async()=>{
      const email=el.querySelector("#saEmail").value.trim(),pass=el.querySelector("#saPass").value;
      const errEl=el.querySelector("#saErr");errEl.textContent="";
      if(!email||pass.length<6){errEl.textContent="Fyll i e-post och ett lösenord på minst 6 tecken.";return}
      const btn=el.querySelector("#btnSaveAcc");btn.disabled=true;btn.textContent="Sparar…";
      const {data:res,error}=await sb.auth.updateUser({email,password:pass});
      if(error){errEl.textContent=error.message||"Kunde inte skapa kontot.";btn.disabled=false;btn.textContent="Skapa konto";return}
      sbUser=res.user;toast("Kontot är skapat - biblioteket är sparat.");renderAuth();};
    el.querySelector("#btnSaveAcc").onclick=doSave;
    el.querySelector("#saPass").addEventListener("keydown",e=>{if(e.key==="Enter")doSave()});
    el.querySelector("#btnGotoLogin").onclick=()=>{if(typeof window.showLoginScreen==="function")window.showLoginScreen()};
    el.querySelector("#btnAnonOut").onclick=async()=>{
      if(!confirm("Det tillfälliga biblioteket försvinner för gott om du loggar ut utan att först spara det som konto ovan. Logga ut ändå?"))return;
      await sb.auth.signOut();location.reload();
    };
  }
  else if(sbUser){el.innerHTML=`<span class="who">Inloggad som <b>${esc(sbUser.email)}</b></span><button id="btnOut">Logga ut</button>`;
    el.querySelector("#btnOut").onclick=async()=>{await sb.auth.signOut();location.reload()};}
  else if(!sbOnline){el.innerHTML='<span class="who">Inloggningen går inte att nå just nu. Ladda om sidan.</span>'}
  else{el.innerHTML=`<input id="aEmail" type="email" placeholder="E-post" autocomplete="username"><input id="aPass" type="password" placeholder="Lösenord" autocomplete="current-password"><button id="btnIn">Logga in</button><span class="err" id="aErr"></span>`;
    const doIn=async()=>{
      const {data:res,error}=await sb.auth.signInWithPassword({email:el.querySelector("#aEmail").value,password:el.querySelector("#aPass").value});
      if(error){el.querySelector("#aErr").textContent=error.message||"Inloggningen misslyckades";console.warn("login",error);return}
      /* Inloggad läser hela katalogen med hyllplatser - enklast och säkrast
         att ladda om, så att alla vyer bygger på samma data. */
      sbUser=res.user;location.reload();};
    el.querySelector("#btnIn").onclick=doIn;
    el.querySelector("#aPass").addEventListener("keydown",e=>{if(e.key==="Enter")doIn()});}
}


function lbShelf(shelf,bookId){
  const [bc,rest]=shelf.split(":");const plan=rest.slice(1);
  /* Hitta fotot som faktiskt är taggat med den här hyllkoden - generellt
     för alla hyllor, istället för den tidigare hårdkodade matchningen mot
     Thomas fyra bc:er (1-4) och deras rumsnamn. */
  if(!FLAT.length){alert("Inget foto av den här hyllan ännu.");return}
  let found=FLAT.findIndex(f=>f.shelves&&f.shelves.includes(shelf));
  if(found<0)found=0;
  lbOpen(found);
  lbCap.textContent=locLabel(shelf);
  if(bookId!==undefined){
    const sib=data.filter(d=>d.shelf===shelf);
    const rank=sib.findIndex(d=>d.id===bookId);
    if(rank>=0&&sib.length>1){
      const w=1/sib.length,pad=Math.min(.02,w*.3);
      markFrac={x0:Math.max(0,rank*w-pad),x1:Math.min(1,(rank+1)*w+pad),y0:.08,y1:.95};
      if(bc==="4"||bc==="6"){markFrac.y0=(plan==="2"?.08:.52);markFrac.y1=(plan==="2"?.48:.95)}
      requestAnimationFrame(updateMark);
    }
  }
}

/* exportera klickhanterare tidigt så UI aldrig dör av ett misslyckat DB-anrop */
window.cycle=cycle;window.setLent=setLent;window.lbShelf=lbShelf;window.lbOpen=lbOpen;
window.showInfo=showInfo;window.openShelfView=openShelfView;
window.gapSet=gapSet;window.gapUpload=gapUpload;window.gapNext=gapNext;window.gapSkip=gapSkip;window.gapGo=gapGo;window.gapDelBook=gapDelBook;window.gapRestart=gapRestart;
window.openPlace=openPlace;window.pickPhoto=pickPhoto;window.go=go;window.runAnalys=runAnalys;window.toggleNote=toggleNote;window.saveNote=saveNote;
window.analysEdit=analysEdit;window.analysKeep=analysKeep;window.analysRotate=analysRotate;window.analysDrop=analysDrop;window.analysSetCode=analysSetCode;
window.analysSetSpot=analysSetSpot;window.analysClose=analysClose;window.analysSave=analysSave;
window.setBookCat=setBookCat;window.uploadCover=uploadCover;

const {data:sess}=await sb.auth.getSession();
if(sess&&sess.session)sbUser=sess.session.user;
loadProfile();

/* PR 5: länken i återställningsmejlet landar här med en färdig
   "recovery"-session - Supabase-klienten läser token ur URL:en automatiskt
   och skickar det här eventet. Enda sättet att faktiskt byta lösenord är
   att fånga det och fråga efter det nya, en gång. */
if(sb.auth.onAuthStateChange)sb.auth.onAuthStateChange((event,recSess)=>{
  if(event!=="PASSWORD_RECOVERY")return;
  sbUser=recSess&&recSess.user;
  const np=prompt("Ange ditt nya lösenord (minst 6 tecken):");
  if(!np)return;
  if(np.length<6){alert("Lösenordet måste vara minst 6 tecken. Prova igen via länken i mejlet.");return}
  sb.auth.updateUser({password:np}).then(({error})=>{
    if(error){alert("Kunde inte byta lösenord: "+error.message);return}
    toast("Nytt lösenord sparat.");location.reload();
  });
});

/* Utloggad: fråga istället för att gissa (PR 5b). Den som inte har en
   sparad session ser ett vägval - "Kom igång" (samma automatiska anonyma
   inloggning som innan, PR 5a: ett tomt bibliotek skapas direkt utan
   konto) eller "Logga in" (det befintliga formuläret nedan, nu den
   vanliga vägen för den som redan har ett konto, inte bara en
   undanskymd nödutgång). Samma formulär nås också från Inställningar →
   Konto (renderAuth) via showLoginScreen, t.ex. om man vill byta konto
   eller hamnade i ett anonymt bibliotek av misstag. */
function hideAppChrome(){
  const hemEl=document.getElementById("view-hem"),tabbar=document.querySelector(".tabbar");
  const panelEl=document.getElementById("panel"),panelScrimEl=document.getElementById("panelScrim");
  if(hemEl)hemEl.style.display="none";
  if(tabbar)tabbar.style.display="none";
  if(panelEl)panelEl.classList.remove("open");
  if(panelScrimEl)panelScrimEl.classList.remove("open");
}
/* Motsatsen till hideAppChrome: göms inloggningsskärmarna och fliklisten
   återställs. Körs först i go(), eftersom varje väg ut ur inloggningen eller
   guiden (nsLamnaGuiden, Kom igång, tillbaka från Konto) går via go().
   Lyckad inloggning laddar om sidan och behöver den inte. */
function showAppChrome(){
  const loginEl=document.getElementById("view-login"),forgotEl=document.getElementById("view-forgot");
  const tabbar=document.querySelector(".tabbar");
  if(loginEl)loginEl.style.display="none";
  if(forgotEl)forgotEl.style.display="none";
  if(tabbar)tabbar.style.display="";
}
/* Ryggrad-grafiken överst på Logga in-skärmen (login.html, LoggaIn):
   BOOKS.slice(0,6), samma NS_SPINE_COLORS/WIDTHS som Steg 5 Konto och
   Jobb A-animationen - men här bara en rad mot papper, ingen fotoruta. */
function loginSpinesHtml(){
  return Array.from({length:6}).map((x,i)=>
    `<span class="ns-spine on" style="width:${NS_SPINE_WIDTHS[i]}px;height:${64-(i%3)*9}px;
      background:${NS_SPINE_COLORS[i%NS_SPINE_COLORS.length]}"></span>`).join("");
}
function wireLoginForm(){
  const loginForm=document.getElementById("loginForm");
  const errEl=document.getElementById("loginErr"),submitBtn=document.getElementById("loginBtn");
  const forgotBtn=document.getElementById("loginForgot"),startBtn=document.getElementById("loginStart");
  const spinesEl=document.querySelector("#view-login .login-spines");
  if(spinesEl&&!spinesEl.childElementCount)spinesEl.innerHTML=loginSpinesHtml();
  if(!loginForm)return;
  /* .onclick/.onsubmit istället för addEventListener - skärmen kan visas
     flera gånger under samma sidvisning (från vägvalet och från
     Inställningar), och en assignment skriver bara över förra
     handlern istället för att stapla flera. */
  if(forgotBtn)forgotBtn.onclick=()=>showForgotScreen();
  if(startBtn)startBtn.onclick=()=>startFromGuide();
  loginForm.onsubmit=async e=>{
    e.preventDefault();
    const email=document.getElementById("loginEmail").value.trim(),pass=document.getElementById("loginPass").value;
    errEl.textContent="";submitBtn.disabled=true;submitBtn.textContent="Loggar in…";
    const {data:res,error}=await sb.auth.signInWithPassword({email,password:pass});
    if(error){errEl.textContent=error.message||"Fel e-post eller lösenord.";submitBtn.disabled=false;submitBtn.textContent="Logga in";return}
    sbUser=res.user;location.reload();
  };
}
/* Glömt lösenord (login.html, Glomt): egen skärm med eget tillbaka-läge,
   inte ett läge inuti loginformuläret - renderas om varje gång den visas
   så "skickat"-läget alltid startar om från början. */
function renderForgotBody(sent){
  const body=document.getElementById("forgotBody");
  if(!body)return;
  body.innerHTML=!sent?`
    <h2 class="login-title" style="font-size:28px">Återställ lösenord</h2>
    <p class="fine login-sub">Ange din e-post och vi skickar en länk för att skapa ett nytt lösenord.</p>
    <form id="forgotForm" class="login-form">
      <input id="forgotEmail" class="inp inp-lg" type="email" placeholder="E-post" autocomplete="email" required>
      <span class="err" id="forgotErr"></span>
      <button class="btn btn-primary" type="submit" id="forgotBtn">Skicka återställningslänk</button>
    </form>`:`
    <div class="login-sentcheck">${ic("check")}</div>
    <h2 class="login-title" style="font-size:26px">Mejl skickat</h2>
    <p class="fine login-sub">Kolla din inkorg — länken är giltig en kort stund.</p>
    <button class="btn btn-outline" id="forgotBackToLogin" type="button">Tillbaka till inloggning</button>`;
  if(!sent){
    const form=document.getElementById("forgotForm"),errEl=document.getElementById("forgotErr"),btn=document.getElementById("forgotBtn");
    form.onsubmit=async e=>{
      e.preventDefault();
      const email=document.getElementById("forgotEmail").value.trim();
      errEl.textContent="";btn.disabled=true;btn.textContent="Skickar…";
      const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
      btn.disabled=false;btn.textContent="Skicka återställningslänk";
      if(error){errEl.textContent=error.message||"Kunde inte skicka länken.";return}
      renderForgotBody(true);
    };
  } else {
    document.getElementById("forgotBackToLogin").onclick=()=>showLoginScreen();
  }
}
function showForgotScreen(){
  const loginEl=document.getElementById("view-login"),forgotEl=document.getElementById("view-forgot");
  if(loginEl)loginEl.style.display="none";
  if(forgotEl)forgotEl.style.display="";
  const backBtn=document.getElementById("forgotBack");
  if(backBtn){if(!backBtn.childElementCount)backBtn.innerHTML=ic("chevron-left");backBtn.onclick=()=>showLoginScreen();}
  renderForgotBody(false);
}
function showLoginScreen(){
  hideAppChrome();
  const forgotEl=document.getElementById("view-forgot");
  if(forgotEl)forgotEl.style.display="none";
  const loginEl=document.getElementById("view-login");
  if(loginEl)loginEl.style.display="";
  wireLoginForm();
}
window.showLoginScreen=showLoginScreen;

/* Resten av filen (ikonrendering, onclick-exports, knapplyssnare) ska
   köra oavsett inloggningsläge - precis som innan - så inget här får
   blockera huvudtråden på en await som väntar in en klick-interaktion.
   Datainläsningen som kräver sbUser läggs därför i en egen funktion och
   startas antingen direkt (sparad session) eller efter att "Kom igång"/
   inloggningen löst sig (klick-styrt, inte await-styrt). */
async function afterAuthReady(){
  renderAuth();
  /* Gäster (anonym session, sparas efter "Kom igång") ska alltid kunna
     logga in från startsidan - länken göms bara för ett riktigt konto. */
  const loginLink=document.getElementById("homeEmptyLogin");
  if(loginLink){const riktig=!!(sbUser&&!sbUser.is_anonymous);
    loginLink.style.display=riktig?"none":"";
    if(!riktig)loginLink.onclick=showLoginScreen}
  if(!sbUser){homeReady=true;renderHome();return}
  try{await loadBcNames()}catch(e){console.warn("bcNames",e)}
  try{await loadSpotNames()}catch(e){console.warn("spotNames",e)}
  try{await loadBcPhotos();renderHome();if(curView==="place")renderPlace()}catch(e){console.warn("bcPhotos",e)}
  /* bc_photos har 0 rader i produktion (se #66) - de riktiga hyllfotona
     ligger i new_shelves och laddas annars bara in i PH efter en mutation
     i samma session (uppladdning/redigering/klarmarkering). Utan den här
     raden stod FLAT/SHELF_IMGS tomma vid varje ny sida, och "sågs senast"
     kraschade ändå trots #66:s fix av själva algoritmen - söker man i en
     tom FLAT hittar man förstås inget. Körs efter loadBcPhotos() med
     flit: den sätter PH=[] från bc_photos, och syncShelfPhotos (som
     loadNewShelves anropar) lägger bara till/ersätter db:true-poster utan
     att nollställa resten av PH. */
  try{await loadNewShelves()}catch(e){console.warn("newShelves",e)}
  homeReady=true;renderHome();
  try{await loadSell()}catch(e){console.warn("sell",e)}
  buildShelfOptions();
  try{await loadStatuses()}catch(e){console.warn("statuses",e)}
  sb.channel("book_status").on("postgres_changes",{event:"*",schema:"public",table:"book_status"},p=>{
    const r=p.new;if(!r)return;const d=data.find(x=>x.id===r.book_id);
    if(d){d.status=r.status;d.lentTo=r.lent_to||"";d.ts=r.seen_date||null;render()}
  }).subscribe();
}

/* ================= DELA V1: mottagarflöde via länk =================
   Egen tillståndsmaskin utanför VIEWS/go() - fångas vid uppstart, innan
   afterAuthReady(), på samma sätt som showLoginScreen() tar över hela
   skärmen. Byggregler (se rapporten för 29/10-30/10):
   - Pris syns ALDRIG här - frågas aldrig, hämtas aldrig.
   - Plats syns för alla nivåer utom vid delning av en enskild bok.
   - Bara två länktillstånd (okänt/återkallat) - inget tredje.
   - Introbilden är gemensam/generisk (CSS-gradient), aldrig ägarens
     eget hyllfoto.
   Token hålls kvar i localStorage tills en lånönskan lyckas (eller
   länken visar sig okänd/återkallad) - se kommentaren vid
   DELA_TOKEN_KEY. Det gör att boot-sekvensen längst ner i filen kan
   anropa redeem_share_link() igen efter VARJE inloggning (nytt konto
   eller befintligt), helt automatiskt, eftersom både "Skapa konto" och
   "Logga in" redan laddar om sidan vid lyckat utfall. */
let delaCtx=null; // {tokens,library_id,scope,bc:[],book_id:[]}
let delaBooks=[];
let delaWishBookId=null;

function delaShow(view){
  document.querySelectorAll("#view-dela [data-dv]").forEach(el=>{el.style.display=(el.dataset.dv===view?"":"none")});
}

/* DELA_TOKEN_KEY höll tidigare EN bar token-sträng. Flerval (Fråga A)
   gör att en länk nu kan bunta flera tokens (?dela=token1,token2,...),
   så nyckeln håller numera en JSON-lista - med bakåtkompatibel läsning
   av en gammal bar sträng som en lista med ett element, så att en länk
   kvarbliven i någons localStorage sedan innan den här ändringen
   fortsätter fungera precis som förut. */
function delaReadTokenKey(){
  try{
    const raw=localStorage.getItem(DELA_TOKEN_KEY);
    if(!raw)return [];
    try{const v=JSON.parse(raw);return Array.isArray(v)?v:[String(v)]}
    catch(e){return [raw]} // äldre bar sträng, inte JSON
  }catch(e){return []}
}
function delaWriteTokenKey(tokens){
  try{localStorage.setItem(DELA_TOKEN_KEY,JSON.stringify(tokens))}catch(e){}
}

/* Tar emot en array av tokens (en ensam token funkar också). Varje token
   löses in var för sig mot den OFÖRÄNDRADE redeem_share_link() - ett
   misslyckat token i en bunt stoppar inte de andra (feltolerant, se
   granskningens varv 1). Avvikande bibliotek eller scope mot den FÖRSTA
   lyckade token i samma bunt ignoreras tyst (kan bara uppstå via en
   handknåpad URL, aldrig via appens egen "Dela"-knapp - varv 3). */
async function startDelaFlow(tokens){
  hideAppChrome();
  const el=document.getElementById("view-dela");
  if(el)el.style.display="";
  delaShow("laddar");
  const list=(Array.isArray(tokens)?tokens:[tokens]).filter(Boolean);
  if(!list.length){delaShow("fel");return}
  try{
    if(!sbUser){
      const {data:anonRes,error:anonErr}=await sb.auth.signInAnonymously({options:{data:{invited:true}}});
      if(anonErr){console.warn("dela: anonym inloggning",anonErr);delaShow("fel");return}
      sbUser=anonRes.user;
    }
    let ctx=null,lastOutcome="okant",anyOk=false;
    for(const token of list){
      let r=null;
      try{
        const {data:rows,error}=await sb.rpc("redeem_share_link",{p_token:token});
        if(error){console.warn("redeem_share_link",error);continue}
        r=rows&&rows[0];
      }catch(e){console.warn("redeem_share_link",e);continue}
      if(!r||r.outcome==="okant"||r.outcome==="aterkallat"){lastOutcome=r?r.outcome:"okant";continue}
      anyOk=true;
      if(!ctx){
        ctx={tokens:[token],library_id:r.library_id,scope:r.scope,bc:r.scope==="shelf"?[r.bc]:[],book_id:r.scope==="book"?[r.book_id]:[]};
      } else if(ctx.library_id===r.library_id&&ctx.scope===r.scope){
        ctx.tokens.push(token);
        if(r.scope==="shelf")ctx.bc.push(r.bc);
        if(r.scope==="book")ctx.book_id.push(r.book_id);
      }
    }
    if(!anyOk||!ctx){
      renderDelaLankstatus(lastOutcome);
      try{localStorage.removeItem(DELA_TOKEN_KEY)}catch(e){}
      return;
    }
    delaCtx=ctx;
    await renderDelaIntro();
  }catch(e){console.warn("startDelaFlow",e);delaShow("fel")}
}

function renderDelaLankstatus(outcome){
  const body=document.getElementById("delaLankBody");
  if(!body)return;
  const TXT={
    okant:{h:"Länken fungerar inte",p:"Den här länken finns inte, eller är felstavad. Be den som delade att skicka en ny."},
    aterkallat:{h:"Länken är inte längre giltig",p:"Den som delade har tagit bort delningen. Be om en ny länk om du fortfarande vill se hyllan."}
  };
  const t=TXT[outcome]||TXT.okant;
  body.innerHTML=`<h1 class="login-title" style="font-size:26px">${esc(t.h)}</h1><p class="fine login-sub">${esc(t.p)}</p>`;
  delaShow("lankstatus");
}

/* Introsidans namn: bryt efter kolon om titeln har ett sådant (kursiv
   rad delas i två), annars minska graden stegvis över en viss längd -
   så att en lång titel (fyra-fem ord) inte trycker ned knappen. */
function delaHeadlineHtml(name){
  const n=name||"";
  const ci=n.indexOf(":");
  if(ci>-1&&ci<n.length-1){
    const a=n.slice(0,ci+1),b=n.slice(ci+1).trim();
    return `<em class="dela-name">${esc(a)}<br>${esc(b)}</em>`;
  }
  const len=n.length;
  const cls=len>40?"dela-name dela-name-xs":len>26?"dela-name dela-name-s":"dela-name";
  return `<em class="${cls}">${esc(n)}</em>`;
}

/* Rubriken för en bunt (flera hyllor/hyllplan/böcker i samma länk) är en
   interim-text beslutad i planeringen 30/10 - Design har inte sett den
   ännu, men Thomas gav klartecken att bygga vidare utan att vänta. En
   ensam del (bc.length<=1 / book_id.length<=1) beter sig precis som
   förut. */
async function renderDelaIntro(){
  let name="";
  try{
    if(delaCtx.scope==="library"){
      const {data}=await sb.from("libraries").select("name").eq("id",delaCtx.library_id).maybeSingle();
      name=(data&&data.name)||"ett bibliotek";
    } else if(delaCtx.scope==="shelf"){
      const bcs=delaCtx.bc||[];
      if(bcs.length<=1){
        const bc=bcs[0];
        if(String(bc).includes(":")){
          try{await loadBcNames()}catch(e){console.warn("dela: bcNames",e)}
          const top=topBc(String(bc).split(":")[0]);
          const {data}=await sb.from("bc_names").select("name").eq("bc",top).maybeSingle();
          name=`${(data&&data.name)||("Hylla "+top)} · ${dpPlanLabel(bc)}`;
        } else {
          const {data}=await sb.from("bc_names").select("name").eq("bc",bc).maybeSingle();
          name=(data&&data.name)||("Hylla "+bc);
        }
      } else {
        name=bcs.length+" hyllor";
      }
    } else {
      const ids=delaCtx.book_id||[];
      if(ids.length<=1){
        const {data}=await sb.from("manual_books").select("title").eq("id",ids[0]).maybeSingle();
        name=(data&&data.title)||"en bok";
      } else {
        name=ids.length+" böcker";
      }
    }
  }catch(e){console.warn("delaIntroNamn",e)}
  const body=document.getElementById("delaIntroBody");
  if(body)body.innerHTML=`<p class="fine">Du har fått tillgång till</p>${delaHeadlineHtml(name)}`;
  delaShow("intro");
  const btn=document.getElementById("delaOpenBtn");
  if(btn)btn.onclick=renderDelaShelf;
}

/* Skärm 1/2: delad hylla (read-only rader) + sökning. Platsen (locLabel)
   visas för alla nivåer utom scope==="book" - en enskild delad bok ska
   inte avslöja var den (eller grannböckerna på samma hyllkod) står. */
function sharedBookRow(d){
  const showLoc=delaCtx.scope!=="book";
  const loc=showLoc?`<div class="bk-loc"><span class="${d.shelf?"":"loc-dold"}">${esc(locLabel(d.shelf))}</span></div>`:"";
  return `<div class="bk"><span class="bk-stripe" style="background:${catColor(d.cat)}"></span>
    <div class="bk-main"><span class="bk-title-ro">${esc(d.title)}</span>
      <span class="bk-by">${esc([d.author,d.cat].filter(Boolean).join(" · "))}</span>${loc}</div>
    <button class="btn btn-outline btn-sm dela-wish" onclick="delaWish(${d.id})">Önskar låna</button></div>`;
}

function renderDelaBooklist(){
  const grid=document.getElementById("delaGrid");if(!grid)return;
  const q=(document.getElementById("delaQ").value||"").trim().toLowerCase();
  const list=!q?delaBooks:delaBooks.filter(d=>(d.title||"").toLowerCase().includes(q)||(d.author||"").toLowerCase().includes(q));
  grid.innerHTML=list.length?list.map(sharedBookRow).join(""):'<div class="empty">Inga böcker hittades.</div>';
}

async function renderDelaShelf(){
  delaShow("hylla");
  const titelEl=document.getElementById("delaHyllaTitel");
  if(titelEl)titelEl.textContent=delaCtx.scope==="book"?"Delad bok":"Delad hylla";
  try{await loadBcNames()}catch(e){console.warn("dela: bcNames",e)}
  const {data:rows,error}=await sb.from("manual_books").select("id,title,author,cat,shelf").eq("library_id",delaCtx.library_id).order("title");
  if(error){console.warn("dela: manual_books",error);delaBooks=[]}
  else delaBooks=rows||[];
  renderDelaBooklist();
  const qEl=document.getElementById("delaQ");
  if(qEl)qEl.oninput=renderDelaBooklist;
}
window.delaWish=delaWish;

/* Skärm 4: "Önskar låna" + konto. En redan riktig (icke-anonym) session
   skickar lånönskan direkt - sheeten med namn/e-post/lösenord är bara
   till för den som ännu inte har något konto att identifiera sig med. */
async function delaWish(bookId){
  delaWishBookId=bookId;
  if(sbUser&&!sbUser.is_anonymous){
    await delaSendWish();
    return;
  }
  const bk=delaBooks.find(b=>b.id===bookId);
  const t=document.getElementById("delaWishBookTitel");
  if(t)t.textContent=bk?bk.title:"";
  document.getElementById("delaWErr").textContent="";
  document.getElementById("delaWName").value="";
  document.getElementById("delaWEmail").value="";
  document.getElementById("delaWPass").value="";
  document.getElementById("delaWishScrim").classList.add("open");
  document.getElementById("delaWishSheet").classList.add("open");
}
function delaWishClose(){
  document.getElementById("delaWishScrim").classList.remove("open");
  document.getElementById("delaWishSheet").classList.remove("open");
}
async function delaSendWish(){
  if(!delaWishBookId)return;
  const {error}=await sb.from("book_events").insert({book_id:delaWishBookId,event_type:"onskar_lana",actor_id:sbUser.id});
  if(error){console.warn("dela: book_events insert",error);toast("Kunde inte skicka lånönskan just nu.");return}
  delaWishClose();
  /* Mottagarens ärende är uppfyllt - nu behövs inte längre att
     redeem_share_link spelas om vid nästa inloggning. */
  try{localStorage.removeItem(DELA_TOKEN_KEY)}catch(e){}
  toast("Lånönskan skickad.");
}
document.getElementById("delaWishScrim")&&document.getElementById("delaWishScrim").addEventListener("click",delaWishClose);
document.getElementById("delaWCancel")&&(document.getElementById("delaWCancel").onclick=delaWishClose);
document.getElementById("delaWLogin")&&(document.getElementById("delaWLogin").onclick=()=>{delaWishClose();showLoginScreen()});
document.getElementById("delaWSubmit")&&(document.getElementById("delaWSubmit").onclick=async()=>{
  const name=document.getElementById("delaWName").value.trim();
  const email=document.getElementById("delaWEmail").value.trim();
  const pass=document.getElementById("delaWPass").value;
  const errEl=document.getElementById("delaWErr");errEl.textContent="";
  if(!email||pass.length<6){errEl.textContent="Fyll i e-post och ett lösenord på minst 6 tecken.";return}
  const btn=document.getElementById("delaWSubmit");btn.disabled=true;btn.textContent="Skapar…";
  /* updateUser på den redan anonyma (invited:true) sessionen - samma
     auth.uid(), samma shelf_shares-rad som redan beviljats. Utlöser inte
     handle_new_user igen (den körs bara vid INSERT i auth.users). */
  const {data:res,error}=await sb.auth.updateUser({email,password:pass,data:name?{full_name:name}:undefined});
  btn.disabled=false;btn.textContent="Skapa konto och skicka";
  if(error){errEl.textContent=error.message||"Kunde inte skapa kontot.";return}
  sbUser=res.user;
  await delaSendWish();
});

/* ---------- Delade (ägarens vy): Lånönskningar, Mina delningar,
   Delat med dig. Bara den minimala vyn skissen visar - inte de två
   fulla sidorna (medveten, godkänd avvikelse i v1). ---------- */
/* Lånönskningar: tre lägen (väntar/accepterad/nekad) låg tidigare blandade
   i en enda lista utan rubrik - en accepterad förfrågan syntes bara som
   " · accepterad" på samma rad som väntande, utan förklaring (Thomas
   31/10). Delas nu upp: väntande under "Väntar på dig" (oförändrat
   Acceptera/Neka), accepterade i en egen sektion (renderDelaAccepted,
   nedan) med bock för överlämning. Nekade visas inte alls längre -
   färdigbehandlade utan något mer att göra, samma princip som att en
   återkallad delning inte får en egen rad kvar här. */
async function delaBokEvents(){
  const libId=await myLibraryId();if(!libId)return[];
  const {data:rows,error}=await sb.from("book_events")
    .select("id,book_id,actor_id,response,created_at,manual_books(title,author,library_id)")
    .eq("event_type","onskar_lana").order("created_at",{ascending:false});
  if(error){console.warn("dela: book_events",error);return[]}
  return (rows||[]).filter(r=>r.manual_books&&r.manual_books.library_id===libId);
}
async function delaActorNamn(r){
  try{const {data:e}=await sb.rpc("book_event_actor_email",{p_book_id:r.book_id,p_actor_id:r.actor_id});return e||""}
  catch(e){return ""}
}
async function renderDelaWishList(){
  const el=document.getElementById("delaWishList");if(!el)return false;
  const alla=await delaBokEvents();
  const pending=alla.filter(r=>!r.response);
  delaBokEventsCache=alla;
  const n=document.getElementById("delaWishN");if(n)n.textContent=pending.length||"";
  if(!pending.length){el.innerHTML="";return false}
  const withMail=await Promise.all(pending.map(async r=>({...r,mail:await delaActorNamn(r)})));
  /* 4.2 Väntar på svar (designspec 31/10): avatar + titel/namn, Ja/Nej som
     rena textknappar (ingen ram/bakgrund), inte btn-outline-knappar. */
  el.innerHTML=withMail.map(r=>`<div class="row">
    <div class="avatar ava32" data-ava="${esc(r.mail||"")}"></div>
    <div class="main"><b>${esc(r.manual_books.title)}</b><small>${esc(r.mail||"Okänd låntagare")} önskar låna · ${esc(delaFmtDatum(r.created_at))}</small></div>
    <button class="row-cta" onclick="delaWishRespond('${r.id}','accepterad')">Ja</button>
    <button class="row-cta muted" onclick="delaWishRespond('${r.id}','nekad')">Nej</button>
  </div>`).join("");
  el.querySelectorAll("[data-ava]").forEach(av=>paintAvatar(av,null,av.dataset.ava||"?"));
  return true;
}
async function delaWishRespond(eventId,resp){
  const {error}=await sb.from("book_events").update({response:resp}).eq("id",eventId);
  if(error){console.warn("dela: svara lånönskan",error);toast("Kunde inte spara svaret.");return}
  await renderDelade();
}
window.delaWishRespond=delaWishRespond;

/* Accepterade förfrågningar som väntar på att boken faktiskt byter
   hand (Thomas 31/10, egen sektion). En rad räknas som klar - och
   försvinner ur listan - så fort BÅDE statusen är "utlanad" OCH
   lent_to matchar just den här personen, inte bara att boken råkar
   vara utlånad till någon annan sedan tidigare. */
let delaBokEventsCache=[];
/* Markerar en accepterad förfrågan som överlämnad - delas av kryssrutan
   och "Överlämnad"-knappen (designspec 31/10, 4.1: "Både kryssrutan och
   knappen utför samma sak"), så ingen syntetisk change-händelse behövs. */
async function delaAcceptMarkera(bookId,namn){
  const d=data.find(x=>x.id===bookId);
  if(!d){toast("Hittar inte boken.");return}
  const prev={status:d.status,lentTo:d.lentTo,ts:d.ts};
  d.status="utlanad";d.lentTo=namn||"";d.ts=new Date().toISOString().slice(0,10);
  await saveBook(d,prev);
  render();
  await renderDelaAccepted();
  toast(namn?`Utlånad till ${namn}.`:"Markerad som utlånad.");
}
window.delaAcceptMarkera=delaAcceptMarkera;
async function renderDelaAccepted(){
  const h=document.getElementById("delaAcceptH"),el=document.getElementById("delaAcceptList");
  const n=document.getElementById("delaAcceptN");
  if(!el)return;
  const accepterade=(delaBokEventsCache.length?delaBokEventsCache:await delaBokEvents()).filter(r=>r.response==="accepterad");
  if(!accepterade.length){h.hidden=true;el.innerHTML="";if(n)n.textContent="";return}
  const rows=await Promise.all(accepterade.map(async r=>{
    const namn=await delaActorNamn(r);
    const bok=data.find(x=>x.id===r.book_id);
    const klar=!!(bok&&bok.status==="utlanad"&&bok.lentTo&&namn&&bok.lentTo===namn);
    return {...r,namn,klar};
  }));
  const kvar=rows.filter(r=>!r.klar);
  h.hidden=!kvar.length;
  if(n)n.textContent=kvar.length||"";
  if(!kvar.length){el.innerHTML="";return}
  /* "accepterad <datum>" (ordalydelsen i designspecen) finns inget eget
     fält för - book_events har bara created_at, dvs. önskedatumet, inte
     när förfrågan accepterades. Thomas 31/10: visa det datumet men under
     en ärlig etikett ("önskad"), inte som om det vore ett accept-datum
     som inte finns. */
  el.innerHTML=kvar.map(r=>`<div class="row">
    <input type="checkbox" class="chk22" data-acc-book="${r.book_id}" data-acc-namn="${esc(r.namn||"")}">
    <div class="main"><b>${esc(r.manual_books.title)}</b><small>${esc(r.namn||"Okänd låntagare")} · önskad ${esc(delaFmtDatum(r.created_at))}</small></div>
    <button class="row-cta" data-acc-book-btn="${r.book_id}" data-acc-namn-btn="${esc(r.namn||"")}">Överlämnad</button>
  </div>`).join("");
}
document.getElementById("delaAcceptList")&&document.getElementById("delaAcceptList").addEventListener("change",e=>{
  const inp=e.target.closest("[data-acc-book]");if(!inp||!inp.checked)return;
  delaAcceptMarkera(+inp.dataset.accBook,inp.dataset.accNamn);
});
document.getElementById("delaAcceptList")&&document.getElementById("delaAcceptList").addEventListener("click",e=>{
  const btn=e.target.closest("[data-acc-book-btn]");if(!btn)return;
  delaAcceptMarkera(+btn.dataset.accBookBtn,btn.dataset.accNamnBtn);
});

/* Ett hyllplan har ingen egen rad i bc_names - bara delen efter ":" i en
   boks eget shelf-fält (t.ex. "6:S1"). Samma namnmönster som locLabel
   använder för planet självt, utan "plats"-delen. */
function dpPlanLabel(shelf){
  const parts=String(shelf).split(":"),bc=parts[0],rest=parts[1]||"";
  if(!rest)return bcNames[bc]||("Hylla "+bc);
  const sec=rest[0],plan=rest.slice(1);
  if(sec==="L")return spotNames[shelf]||"löst";
  return (sec==="S"||sec==="K")?("Hyllplan "+plan):(SEC[sec]+" plan "+plan);
}
function delaScopeLabel(r){
  if(r.scope==="library")return "Hela biblioteket";
  if(r.scope==="shelf"){
    if(String(r.bc).includes(":")){
      const top=topBc(String(r.bc).split(":")[0]);
      return `${bcNames[top]||("Hylla "+top)} · ${dpPlanLabel(r.bc)}`;
    }
    return bcNames[r.bc]||("Hylla "+r.bc);
  }
  return "En bok";
}
/* Datumformat (designspec 31/10, avsnitt 7): "30 okt" - dag utan
   inledande nolla, månad förkortad med tre bokstäver, ingen punkt, samma
   år utelämnat. sv-SE:s "short"-månad ger redan tre bokstäver utan
   punkt ("okt", "maj") för alla månader utom maj/jun/jul som redan är
   kortast möjliga, så ingen extra strippning behövs. */
const DELA_MAN=["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"];
function delaFmtDatum(iso){
  try{
    const d=new Date(iso),nu=new Date(),sammaAr=d.getFullYear()===nu.getFullYear();
    return `${d.getDate()} ${DELA_MAN[d.getMonth()]}${sammaAr?"":" "+d.getFullYear()}`;
  }catch(e){return ""}
}
/* Lokaldelen av en e-postadress (designspec 31/10, 4.3): visas i
   personkortet när personen inte har ett sparat namn, i stället för en
   avkapad adress. */
function delaLocalPart(email){return String(email||"").split("@")[0]}

/* "Nytt"-markering på "Delas med dig" (Design 31/10, punkt 5): ingen
   notisinfrastruktur byggs i den här omgången - en tidsstämpel i
   localStorage räcker för att markera rader som tillkommit sedan
   förra besöket. Uppdateras bara när #view-delade faktiskt öppnas (inte
   vid varje render), annars hinner markeringen aldrig synas. */
const DELA_SETT_KEY="minbokhylla-dela-sett";
function delaSettVid(){try{return localStorage.getItem(DELA_SETT_KEY)||""}catch(e){return ""}}
function delaMarkeraSett(){try{localStorage.setItem(DELA_SETT_KEY,new Date().toISOString())}catch(e){}}

/* Gemensam grupperingsfunktion (plan 31/10, steg 2): hämtar ALLA
   shelf_shares-rader för biblioteket - INTE bara de aktiva, annars
   försvinner en person vars delningar alla är återkallade, och
   "inget delat"-kortet med henne - och grupperar per mottagare. Namn:
   e-post när mottagaren har ett konto (shelf_share_recipient_email),
   annars det manuella share_contact_labels-namnet, annars null (visas
   som "Lägg till namn" i UI-lagret, inte här). */
let delaGruppData=null;
async function delaGrupper(){
  const libId=await myLibraryId();
  if(!libId)return{people:[],links:[]};
  const [{data:shares,error:e1},{data:links,error:e2}]=await Promise.all([
    sb.from("shelf_shares").select("id,scope,bc,book_id,level,revoked_at,created_at,recipient_id").eq("library_id",libId).order("created_at",{ascending:false}),
    sb.from("share_links").select("id,scope,bc,book_id,token,revoked_at,created_at").eq("library_id",libId).order("created_at",{ascending:false})
  ]);
  if(e1||e2){console.warn("dela: grupper",e1||e2);return{people:[],links:[]}}
  const byRecip=new Map();
  (shares||[]).forEach(s=>{
    if(!byRecip.has(s.recipient_id))byRecip.set(s.recipient_id,[]);
    byRecip.get(s.recipient_id).push(s);
  });
  const recipIds=[...byRecip.keys()];
  const [{data:labelRows,error:e3},emailPairs]=await Promise.all([
    sb.from("share_contact_labels").select("recipient_id,label").eq("library_id",libId),
    Promise.all(recipIds.map(id=>sb.rpc("shelf_share_recipient_email",{p_recipient_id:id}).then(r=>[id,r.data||null]).catch(()=>[id,null])))
  ]);
  if(e3)console.warn("dela: share_contact_labels",e3);
  const labelMap=new Map((labelRows||[]).map(l=>[l.recipient_id,l.label]));
  const emailMap=new Map(emailPairs);
  const people=recipIds.map(id=>{
    const rows=byRecip.get(id).slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    const active=rows.filter(r=>!r.revoked_at);
    const email=emailMap.get(id)||null,label=labelMap.get(id)||null;
    const withBc=active.find(r=>r.bc)||rows.find(r=>r.bc);
    let thumb=null;
    if(withBc&&withBc.bc){const topbc=topBc(String(withBc.bc).split(":")[0]);const p=PH.find(p=>p.bc===topbc);thumb=p?p.thumb:null}
    const shelfN=new Set(active.filter(r=>r.scope==="shelf").map(r=>r.bc)).size+active.filter(r=>r.scope==="library").length;
    const bookN=active.filter(r=>r.scope==="book").length;
    return {recipient_id:id,rows,active,lastDate:rows[0].created_at,email,label,
      name:email||label||null,thumb,shelfN,bookN,fullyRevoked:active.length===0,
      revokedDate:active.length===0?rows[0].created_at:null};
  }).sort((a,b)=>new Date(b.lastDate)-new Date(a.lastDate));
  delaGruppData={people,links:links||[]};
  return delaGruppData;
}
window.delaMottagarNamn=id=>{
  const p=delaGruppData&&delaGruppData.people.find(p=>p.recipient_id===id);
  return p?p.name:null;
};

function pcCounterText(p){
  const parts=[];
  if(p.shelfN)parts.push(p.shelfN+(p.shelfN===1?" hylla":" hyllor"));
  if(p.bookN)parts.push(p.bookN+(p.bookN===1?" bok":" böcker"));
  return parts.join(" · ")||"inget delat";
}
/* Visningsnamn i personkortet (designspec 31/10, 4.3): sparat namn
   (label) om det finns, annars LOKALDELEN av e-posten - aldrig en
   avkapad adress som "helena.ringne…" (det var vad ellipsis+hela
   adressen gav innan). Personpanelen (oförändrad enligt specen) läser
   fortfarande p.name som tidigare. */
function pcVisningsnamn(p){
  if(p.label)return p.label;
  if(p.email)return delaLocalPart(p.email);
  return null;
}
function renderPersonkort(people){
  const grid=document.getElementById("delaPersonkort"),tom=document.getElementById("delaPersonkortTom");
  const n=document.getElementById("delaPersonkortN");
  const tk=document.getElementById("delaTkLank"),tkSub=document.getElementById("delaTkSub");
  if(!grid)return;
  const aktiva=people.filter(p=>!p.fullyRevoked),tidigare=people.filter(p=>p.fullyRevoked);
  if(n)n.textContent=aktiva.length?`${aktiva.length} ${aktiva.length===1?"aktiv":"aktiva"}`:"";
  /* "Inga delningar alls" = aldrig delat någonsin (ingen aktiv, ingen
     tidigare). Finns bara tidigare (ingen aktiv) ska rutnätet vara tomt
     UTAN den texten - tk-raden räcker då som förklaring. */
  tom.hidden=!!(aktiva.length||tidigare.length);
  grid.innerHTML=aktiva.map(p=>{
    const bg=p.thumb?` style="background-image:url('${p.thumb}')"`:"";
    const namn=pcVisningsnamn(p);
    return `<button class="pc${!namn?" namnlos":""}" data-rid="${esc(p.recipient_id)}" type="button">
      <div class="ryggar"${bg}></div><div class="scrim"></div>
      <div class="ctr">${esc(pcCounterText(p))}</div>
      <div class="cnt"><div class="avatar" data-ava></div><b class="nm">${namn?esc(namn):"<i>Lägg till namn</i>"}</b></div>
    </button>`;
  }).join("");
  grid.querySelectorAll(".pc .avatar[data-ava]").forEach(av=>{
    const rid=av.closest(".pc").dataset.rid,p=aktiva.find(x=>x.recipient_id===rid);
    paintAvatar(av,null,p?(pcVisningsnamn(p)||"?"):"?");
  });
  if(tk){
    tk.hidden=!tidigare.length;
    if(tidigare.length&&tkSub)tkSub.textContent=`${tidigare.length} ${tidigare.length===1?"person":"personer"} · inget delat just nu`;
  }
}
function renderLankar(links){
  const h=document.getElementById("delaLankarH"),el=document.getElementById("delaLankarList");
  const n=document.getElementById("delaLankarN");
  if(!el)return;
  const unredeemed=(links||[]).filter(r=>!r.revoked_at);
  h.hidden=el.hidden=!unredeemed.length;
  if(n)n.textContent=unredeemed.length||"";
  if(!unredeemed.length)return;
  /* "Väntar på att lösas in" står nu i etiketten (en gång för hela
     listan) i stället för på varje rad (designspec 31/10, 4.4) -
     raden visar i stället datumet. Redan nyast-först genom frågan i
     delaGrupper (order by created_at desc). */
  el.innerHTML=unredeemed.map(r=>`<div class="row">
    <div class="main"><b>${esc(delaScopeLabel(r))}</b><small>${esc(delaFmtDatum(r.created_at))}</small></div>
    <button class="ico-copy" data-kopiera="${esc(r.token)}" type="button" aria-label="Kopiera länken">${ic("copy")}</button>
  </div>`).join("");
  el.querySelectorAll("[data-kopiera]").forEach(b=>b.onclick=()=>{
    const url=location.origin+location.pathname+"?dela="+b.dataset.kopiera;
    (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject())
      .then(()=>toast("Länken är kopierad"),()=>prompt("Kopiera länken:",url));
  });
}
async function renderDelaMedDigBand(){
  const band=document.getElementById("delaMedDigBand"),el=document.getElementById("delaMedDigList");
  const n=document.getElementById("delaMedDigN");
  if(!el)return false;
  const libId=await myLibraryId();
  const {data:rows,error}=await sb.from("shelf_shares").select("id,scope,bc,book_id,library_id,revoked_at,created_at").eq("recipient_id",sbUser?sbUser.id:"").is("revoked_at",null);
  if(error){console.warn("dela: delat med dig",error);return false}
  const other=(rows||[]).filter(r=>r.library_id!==libId);
  band.hidden=!other.length;
  if(n)n.textContent=other.length||"";
  if(!other.length)return false;
  const sett=delaSettVid();
  // Ägarens namn (åt andra hållet) - det finns ingen färdig RPC för "ägaren
  // till det här biblioteket", så vi nöjer oss med hyllans/bibliotekets
  // egen etikett tills en sådan finns. Se backloggen.
  el.innerHTML=other.map(r=>{
    const topbc=r.bc?topBc(String(r.bc).split(":")[0]):null;
    const photo=topbc?PH.find(p=>p.bc===topbc):null;
    const bg=photo?` style="background-image:url('${photo.thumb}')"`:"";
    const isNy=r.created_at>sett;
    return `<div class="srow">
      <div class="thumb"${bg}>${photo?"":`<div class="noimg">${dpSpineBars(r.bc||r.library_id)}</div>`}</div>
      <div class="main"><b>${esc(delaScopeLabel(r))}</b><small>Delat med dig</small></div>
      ${isNy?'<span class="ny"></span>':""}
    </div>`;
  }).join("");
  return true;
}

/* Tomt läge (Design 30/10, punkt 1): visas bara om INGEN av de tre
   listorna har något innehåll alls - en lånönskan att svara på, eller
   något delat med dig, är lika mycket ett skäl att se fullt läge som en
   egen aktiv delning. */
async function renderDelade(){
  /* renderDelaAccepted läser delaBokEventsCache, satt av renderDelaWishList
     - körs därför EFTER den, inte parallellt, annars hinner den läsa
     gårdagens (tomma) cache. */
  const [hasWish,grp,hasMedDig]=await Promise.all([renderDelaWishList(),delaGrupper(),renderDelaMedDigBand()]);
  await renderDelaAccepted();
  document.getElementById("delaWishH").hidden=!hasWish;
  renderPersonkort(grp.people);
  renderLankar(grp.links);
  const tomt=document.getElementById("delaTomtLage"),fullt=document.getElementById("delaFulltLage");
  if(!tomt||!fullt)return;
  const hasAccepted=!document.getElementById("delaAcceptH").hidden;
  const hasAnyShare=grp.people.some(p=>!p.fullyRevoked)||grp.links.some(l=>!l.revoked_at);
  const visaTomt=!hasWish&&!hasAccepted&&!hasAnyShare&&!hasMedDig;
  /* Om undersidan "Tidigare kontakter" redan är öppen när det här körs
     (t.ex. en bakgrundsuppdatering medan man tittar på den) - rör inte
     tomt/fullt-växeln, bara datan på den sidan. Annars skulle en
     bakgrundsrender tysta växla tillbaka till fullt läge under fötterna. */
  const tkLage=document.getElementById("delaTkLage"),tkOpen=tkLage&&!tkLage.hidden;
  if(!tkOpen){tomt.hidden=!visaTomt;fullt.hidden=visaTomt}
  const slutaBtn=document.getElementById("delaSlutaBtn");
  if(slutaBtn)slutaBtn.hidden=!grp.people.some(p=>!p.fullyRevoked);
  const tb=document.getElementById("delaTidigareBtn");
  if(tb){const revokedN=grp.people.filter(p=>p.fullyRevoked).length+grp.links.filter(l=>l.revoked_at).length;
    tb.hidden=!revokedN;document.getElementById("delaTidigareN").textContent=revokedN}
  if(!visaTomt)delaMarkeraSett();
  if(tkOpen)renderDelaTk();
}

/* Tidigare kontakter (skärm 5, designspec 31/10): egen undersida, samma
   växlingsmönster som Värderas start/lista (hidden på en syskon-div, inte
   go() - det här är ingen flik). Ordning: senast återkallad först
   (delaGrupper sorterar redan hela people-listan på lastDate fallande,
   och en tidigare kontakts lastDate ÄR dess återkallelsedatum eftersom
   raden då saknar aktiva delningar). */
function delaTkVisa(v){
  const fullt=document.getElementById("delaFulltLage"),tk=document.getElementById("delaTkLage");
  if(!fullt||!tk)return;
  fullt.hidden=!!v;tk.hidden=!v;
  if(v)renderDelaTk();
  window.scrollTo({top:0});
}
window.delaTkVisa=delaTkVisa;
function renderDelaTk(){
  const el=document.getElementById("delaTkList"),n=document.getElementById("delaTkN");
  if(!el)return;
  const tidigare=(delaGruppData&&delaGruppData.people||[]).filter(p=>p.fullyRevoked);
  if(n)n.textContent=tidigare.length||"";
  el.innerHTML=tidigare.map(p=>{
    const namn=pcVisningsnamn(p);
    return `<div class="row">
      <div class="avatar${namn?"":" noname"}" data-rid="${esc(p.recipient_id)}"></div>
      <div class="main"><b${namn?"":' style="font-style:italic;font-weight:500;color:var(--text-secondary)"'}>${namn?esc(namn):"Lägg till namn"}</b><small>delade t.o.m. ${esc(delaFmtDatum(p.revokedDate))}</small></div>
      <button class="row-cta" data-tk-again="${esc(p.recipient_id)}">Dela igen</button>
    </div>`;
  }).join("");
  el.querySelectorAll(".avatar[data-rid]").forEach(av=>{
    const p=tidigare.find(x=>x.recipient_id===av.dataset.rid);
    paintAvatar(av,null,p?(pcVisningsnamn(p)||"?"):"?");
  });
  el.querySelectorAll("[data-tk-again]").forEach(b=>b.onclick=()=>{
    dpDirectRecipient=b.dataset.tkAgain;
    delaSkapaOpen();
  });
}
document.getElementById("delaTkLank")&&(document.getElementById("delaTkLank").onclick=()=>delaTkVisa(true));
document.getElementById("delaTkTillbaka")&&(document.getElementById("delaTkTillbaka").onclick=()=>delaTkVisa(false));

/* Personpanelen (skärm 2, Design 31/10). */
let delaPpRid=null;
function delaPpOpen(rid){
  const p=delaGruppData&&delaGruppData.people.find(x=>x.recipient_id===rid);
  if(!p)return;
  delaPpRid=rid;
  paintAvatar(document.getElementById("delaPpAvatar"),null,p.name||"?");
  document.getElementById("delaPpNamn").textContent=p.name||"Namnlös kontakt";
  const sedan=delaFmtDatum(p.rows[p.rows.length-1].created_at);
  document.getElementById("delaPpSub").textContent=`Kontakt sedan ${sedan}`;
  const addWrap=document.getElementById("delaPpAddnameWrap");
  addWrap.hidden=!!p.name;
  if(!p.name)document.getElementById("delaPpAddnameInput").value="";
  const duDelar=document.getElementById("delaPpDuDelar");
  duDelar.innerHTML=p.active.map(r=>{
    const topbc=r.bc?topBc(String(r.bc).split(":")[0]):null;
    const photo=topbc?PH.find(ph=>ph.bc===topbc):null;
    const bg=photo?` style="background-image:url('${photo.thumb}')"`:"";
    return `<div class="pp-item">
      <div class="thumb"${bg}></div>
      <div class="main"><b>${esc(delaScopeLabel(r))}</b><small>Delat ${esc(delaFmtDatum(r.created_at))}</small></div>
      <button class="link-btn danger" data-stop="${esc(r.id)}" type="button">Sluta dela</button>
    </div>`;
  }).join("")||'<div class="empty">Inget delat just nu.</div>';
  duDelar.querySelectorAll("[data-stop]").forEach(b=>b.onclick=()=>delaPpStoppaEn(b.dataset.stop));
  /* Kontroll 31/10: briefen skrev uttryckligen "Dela något mer med <namn>"
     och "Sluta dela allt med <namn>" - knapparna hade bara den statiska
     texten utan namnet. Rättat. */
  const namn=p.name||"henne";
  document.getElementById("delaPpDelaMer").textContent=`Dela något mer med ${namn}`;
  document.getElementById("delaPpStoppaAllt").textContent=`Sluta dela allt med ${namn}`;
  renderDelaPpOnskar(rid);
  document.getElementById("delaPpScrim").classList.add("open");
  document.getElementById("delaPpSheet").classList.add("open");
}
function delaPpClose(){
  document.getElementById("delaPpScrim").classList.remove("open");
  document.getElementById("delaPpSheet").classList.remove("open");
  delaPpRid=null;
}
async function renderDelaPpOnskar(rid){
  const wrap=document.getElementById("delaPpOnskarWrap"),el=document.getElementById("delaPpOnskar");
  const libId=await myLibraryId();if(!libId){wrap.hidden=true;return}
  const {data:rows,error}=await sb.from("book_events")
    .select("id,book_id,actor_id,response,created_at,manual_books(title,author,library_id)")
    .eq("event_type","onskar_lana").eq("actor_id",rid).order("created_at",{ascending:false});
  if(error){console.warn("dela: önskar låna",error);wrap.hidden=true;return}
  const mine=(rows||[]).filter(r=>r.manual_books&&r.manual_books.library_id===libId);
  wrap.hidden=!mine.length;
  if(!mine.length)return;
  el.innerHTML=mine.map(r=>`<div class="pp-wrow">
    <div class="main"><b>${esc(r.manual_books.title)}</b><small>${esc(r.manual_books.author||"")} · ${esc(delaFmtDatum(r.created_at))}${r.response?" · "+esc(r.response):""}</small></div>
    ${!r.response?`<button class="btn-outline btn-sm" onclick="delaWishRespond('${r.id}','accepterad')">Acceptera</button>
     <button class="btn-outline btn-sm" onclick="delaWishRespond('${r.id}','nekad')">Neka</button>`:""}
  </div>`).join("");
}
async function delaPpStoppaEn(shareId){
  if(!await ask({title:"Sluta dela det här?",text:"Hon förlorar tillgången direkt. Hon står kvar som kontakt.",buttons:[{label:"Avbryt",value:false},{label:"Sluta dela",value:true,kind:"danger"}]}))return;
  const {error}=await sb.rpc("revoke_shelf_share",{p_share_id:shareId});
  if(error){console.warn("dela: revoke_shelf_share",error);toast("Kunde inte sluta dela.");return}
  await renderDelade();
  if(delaPpRid)delaPpOpen(delaPpRid);
  toast("Sluta dela.");
}
document.getElementById("delaPpScrim")&&document.getElementById("delaPpScrim").addEventListener("click",delaPpClose);
document.getElementById("delaPpAddnameSpara")&&(document.getElementById("delaPpAddnameSpara").onclick=async()=>{
  const v=(document.getElementById("delaPpAddnameInput").value||"").trim();
  if(!v||!delaPpRid)return;
  const libId=await myLibraryId();if(!libId)return;
  const {error}=await sb.from("share_contact_labels").upsert({library_id:libId,recipient_id:delaPpRid,label:v,updated_at:new Date().toISOString()});
  if(error){console.warn("dela: share_contact_labels",error);toast("Kunde inte spara namnet.");return}
  await renderDelade();
  delaPpOpen(delaPpRid);
});
document.getElementById("delaPpStoppaAllt")&&(document.getElementById("delaPpStoppaAllt").onclick=async()=>{
  if(!delaPpRid)return;
  const p=delaGruppData.people.find(x=>x.recipient_id===delaPpRid);
  if(!p)return;
  const namn=p.name||"den här kontakten";
  if(!await ask({title:`Sluta dela allt med ${namn}?`,text:`${namn} förlorar tillgången till allt du delat direkt. Hon står kvar som kontakt - du kan dela igen utan ny länk.`,buttons:[{label:"Avbryt",value:false},{label:"Sluta dela allt",value:true,kind:"danger"}]}))return;
  for(const r of p.active){
    const {error}=await sb.rpc("revoke_shelf_share",{p_share_id:r.id});
    if(error)console.warn("dela: revoke_shelf_share (allt)",error);
  }
  delaPpClose();
  await renderDelade();
  toast(`Slutade dela med ${namn}.`);
});
document.getElementById("delaPpDelaMer")&&(document.getElementById("delaPpDelaMer").onclick=()=>{
  if(!delaPpRid)return;
  const rid=delaPpRid;
  delaPpClose();
  dpDirectRecipient=rid;
  delaSkapaOpen();
});

/* "Dela" - vem först (skärm 3, Fråga B). Samma lista återanvänds av
   åtgärdsradens "Sluta dela" när fler än en person har aktiva delningar
   (delaVemSluta=true) - klick går då till delaSdOpen i stället för
   urvalsarket. */
let delaVemSluta=false;
function delaVemOpen(){
  const people=(delaGruppData&&delaGruppData.people||[]).filter(p=>delaVemSluta?!p.fullyRevoked:true);
  document.getElementById("delaVemTitel").textContent=delaVemSluta?"Sluta dela med vem?":"Dela med vem?";
  document.getElementById("delaVemSub").hidden=!!delaVemSluta;
  document.getElementById("delaVemNy").hidden=!!delaVemSluta;
  document.getElementById("delaVemList").innerHTML=people.map(p=>`<button class="dv-item" data-rid="${esc(p.recipient_id)}" type="button">
    <div class="main"><b>${p.name?esc(p.name):"<i>Namnlös kontakt</i>"}</b><small>${p.shelfN} ${p.shelfN===1?"hylla":"hyllor"} delade</small></div>
    <i data-ic="chevron-right"></i>
  </button>`).join("")||'<div class="empty">Inga kontakter än.</div>';
  fillIcons(document.getElementById("delaVemList"));
  document.querySelectorAll("#delaVemList [data-rid]").forEach(b=>b.onclick=()=>{
    const rid=b.dataset.rid,sluta=delaVemSluta;
    delaVemClose();
    if(sluta)delaSdOpen(rid);
    else{dpDirectRecipient=rid;delaSkapaOpen()}
  });
  document.getElementById("delaVemScrim").classList.add("open");
  document.getElementById("delaVemSheet").classList.add("open");
}
function delaVemClose(){
  document.getElementById("delaVemScrim").classList.remove("open");
  document.getElementById("delaVemSheet").classList.remove("open");
  delaVemSluta=false;
}
document.getElementById("delaVemScrim")&&document.getElementById("delaVemScrim").addEventListener("click",delaVemClose);
document.getElementById("delaVemNy")&&(document.getElementById("delaVemNy").onclick=()=>{
  dpDirectRecipient=null;
  delaVemClose();
  delaSkapaOpen();
});

/* "Sluta dela" (skärm 4): tre nivåer i ett val. Startas antingen från
   åtgärdsraden (ingen förvald person) eller - vanligare - från
   personpanelens "Sluta dela allt" (redan hanterat ovan, utan det här
   arket). Åtgärdsradens knapp låter dig välja VILKEN person, därefter
   samma tre nivåer för just henne. */
let delaSdRid=null,delaSdLevel="allt",delaSdParts=new Set();
function delaSdOpen(rid){
  const p=delaGruppData.people.find(x=>x.recipient_id===rid);if(!p)return;
  delaSdRid=rid;delaSdLevel="allt";delaSdParts=new Set(p.active.map(r=>r.id));
  delaSdRender();
  document.getElementById("delaSdScrim").classList.add("open");
  document.getElementById("delaSdSheet").classList.add("open");
}
function delaSdRender(){
  const p=delaGruppData.people.find(x=>x.recipient_id===delaSdRid);if(!p)return;
  const namn=p.name||"den här kontakten";
  const body=document.getElementById("delaSdBody");
  body.innerHTML=`
    <button class="sd-opt" data-lvl="allt" ${delaSdLevel==="allt"?"data-on":""} type="button">
      <span class="box">${delaSdLevel==="allt"?'<i data-ic="check"></i>':""}</span>Allt med ${esc(namn)}
    </button>
    <button class="sd-opt" data-lvl="del" ${delaSdLevel==="del"?"data-on":""} type="button">
      <span class="box">${delaSdLevel==="del"?'<i data-ic="check"></i>':""}</span>Bara en del
    </button>
    <div class="sd-parts" ${delaSdLevel==="del"?"":"hidden"}>
      ${p.active.map(r=>`<label class="sd-part" data-id="${esc(r.id)}" ${delaSdParts.has(r.id)?"data-on":""}>
        <span class="box">${delaSdParts.has(r.id)?'<i data-ic="check"></i>':""}</span><small>${esc(delaScopeLabel(r))}</small>
      </label>`).join("")}
    </div>`;
  fillIcons(body);
  body.querySelectorAll("[data-lvl]").forEach(b=>b.onclick=()=>{delaSdLevel=b.dataset.lvl;if(delaSdLevel==="allt")delaSdParts=new Set(p.active.map(r=>r.id));delaSdRender()});
  body.querySelectorAll(".sd-part").forEach(b=>b.onclick=()=>{
    const id=b.dataset.id;
    if(delaSdParts.has(id))delaSdParts.delete(id);else delaSdParts.add(id);
    delaSdRender();
  });
  const n=delaSdParts.size;
  document.getElementById("delaSdGor").textContent=delaSdLevel==="allt"?`Sluta dela allt med ${namn}`:n===1?`Sluta dela ${n} sak med ${namn}`:`Sluta dela ${n} saker med ${namn}`;
  document.getElementById("delaSdGor").disabled=n===0;
  document.getElementById("delaSdSub").textContent=`${esc(namn)} står kvar som kontakt. Du kan dela igen utan ny länk.`;
}
function delaSdClose(){
  document.getElementById("delaSdScrim").classList.remove("open");
  document.getElementById("delaSdSheet").classList.remove("open");
  delaSdRid=null;
}
document.getElementById("delaSdScrim")&&document.getElementById("delaSdScrim").addEventListener("click",delaSdClose);
document.getElementById("delaSdAvbryt")&&(document.getElementById("delaSdAvbryt").onclick=delaSdClose);
document.getElementById("delaSdGor")&&(document.getElementById("delaSdGor").onclick=async()=>{
  const p=delaGruppData.people.find(x=>x.recipient_id===delaSdRid);if(!p)return;
  const namn=p.name||"den här kontakten";
  for(const id of delaSdParts){
    const {error}=await sb.rpc("revoke_shelf_share",{p_share_id:id});
    if(error)console.warn("dela: revoke_shelf_share (sd)",error);
  }
  delaSdClose();
  await renderDelade();
  toast(`Slutade dela med ${namn}.`);
});
document.getElementById("delaSlutaBtn")&&(document.getElementById("delaSlutaBtn").onclick=()=>{
  const people=(delaGruppData&&delaGruppData.people||[]).filter(p=>!p.fullyRevoked);
  if(!people.length)return;
  if(people.length===1){delaSdOpen(people[0].recipient_id);return}
  delaVemSluta=true;
  delaVemOpen();
});
document.getElementById("delaPersonkort")&&document.getElementById("delaPersonkort").addEventListener("click",e=>{
  const card=e.target.closest(".pc");if(!card)return;
  delaPpOpen(card.dataset.rid);
});

/* Skapa delning: visuellt urval (Design 30/10, punkt 2) i stället för
   rullgardiner. Tre steg i samma ark (dpStepGrid/dpStepShelf/dpStepBooks).

   Flerval mot share_links (Fråga A, väg 2b - svaret i planen 30/10): INTE
   ett delat token över flera rader (det hade krävt att släppa token-
   kolumnens unik-villkor och skriva om redeem_share_link). I stället: ett
   urval med flera delar blir flera separata share_links-rader i samma
   insert, var sin egen token, och länken buntar alla tokens kommaseparerat
   (?dela=token1,token2,...). Mottagarsidan löser in var token för sig mot
   den OFÖRÄNDRADE redeem_share_link() - se startDelaFlow(tokens). Varje
   buntad rad är sedan fristående återkallningsbar (revoke_share_link tar
   bara ett id, verifierat mot den livedriftsatta funktionen).

   En bunt är alltid enhetlig - antingen bara hyllor (scope "shelf") eller
   bara böcker (scope "book"), aldrig blandat. Gaffeln i gränssnittet gör
   det omöjligt att välja båda samtidigt, men vi litar inte tyst på det -
   se den explicita kontrollen i #delaSkapaGor nedan (Varv 4).

   dpDirectRecipient (Fråga B, plan 31/10): satt till ett recipient_id när
   urvalet startades från "vem"-arket eller personpanelens "Dela något
   mer" - då skriver #delaSkapaGor direkt via share_direct i stället för
   att skapa en share_links-rad, och det finns ingen länk att visa. null
   betyder "ny" - dagens länkflöde, oförändrat. */
let dpDirectRecipient=null;
let dpMode="shelf";
let dpWholeLib=false;
let dpSelShelves=new Set();     // hela hyllor (topBc-koder)
let dpSelPlans=new Map();       // topBc -> Set(hyllplanskoder, t.ex. "6:S1")
let dpSelBooks=new Set();       // bok-id
let dpCurBc=null;               // vilken hylla man är inne i (steg 2)
let dpBookCat="",dpBookBc="";   // aktiva filterchips i "enskilda böcker"

/* "Ryggar som reserv" (öppen punkt 3 i uppdraget, Teknik avgör billigast):
   deterministiska stapel-"ryggar" från samma palett som bokryggarna i
   övriga appen, i stället för en tom ruta med namn - billigare att bygga
   och återanvänder ett mönster som redan finns, inget nytt utseende. */
function dpSpineBars(seed){
  let h=0;for(const ch of String(seed))h=(h*31+ch.charCodeAt(0))|0;
  const n=5+(Math.abs(h)%4);
  let out="";
  for(let i=0;i<n;i++){
    h=(h*31+i)|0;
    const w=3+(Math.abs(h)%5);
    out+=`<i style="min-width:${w}px;background:${PAL[Math.abs(h)%PAL.length]}"></i>`;
  }
  return out;
}

function dpRenderGrid(){
  const grid=document.getElementById("dpGrid");if(!grid)return;
  const places=placeList();
  grid.innerHTML=places.map(p=>{
    const on=dpSelShelves.has(p.bc);
    const img=p.cover?`<img src="${p.cover}" alt="">`:`<div class="noimg">${dpSpineBars(p.bc)}</div>`;
    const planCount=shelvesIn(p.members).length;
    return `<div class="dp-card${on?" on":""}" data-bc="${esc(p.bc)}">
      <div class="img">${img}</div>
      <div class="tx"><b>${esc(p.name)}</b><small>${planCount} plan · ${p.count} böcker</small></div>
      <div class="tick"><i data-ic="check"></i></div>
      <button class="dp-deeper" type="button" data-deeper="${esc(p.bc)}">Välj hyllplan ›</button>
    </div>`;
  }).join("")||'<div class="empty">Inga hyllor än.</div>';
  fillIcons(grid);
  const allBtn=document.getElementById("dpAllBtn");
  if(allBtn)allBtn.classList.toggle("on",dpWholeLib);
  const allN=document.getElementById("dpAllN");
  if(allN)allN.textContent=data.length+" böcker";
}
document.getElementById("dpGrid")&&document.getElementById("dpGrid").addEventListener("click",e=>{
  const deeper=e.target.closest("[data-deeper]");
  if(deeper){dpOpenShelf(deeper.dataset.deeper);return}
  const card=e.target.closest(".dp-card");if(!card)return;
  const bc=card.dataset.bc;
  dpWholeLib=false;
  if(dpSelShelves.has(bc))dpSelShelves.delete(bc);
  else{dpSelShelves.add(bc);dpSelPlans.delete(bc)}
  dpRenderGrid();dpSync();
});
document.getElementById("dpAllBtn")&&(document.getElementById("dpAllBtn").onclick=()=>{
  dpWholeLib=!dpWholeLib;
  if(dpWholeLib){dpSelShelves.clear();dpSelPlans.clear()}
  dpRenderGrid();dpSync();
});

function dpOpenShelf(bc){
  dpCurBc=bc;
  document.getElementById("dpStepGrid").hidden=true;
  document.getElementById("dpStepShelf").hidden=false;
  dpRenderShelf();
}
function dpRenderShelf(){
  const bc=dpCurBc;if(!bc)return;
  const mem=membersOf(bc);
  const titel=document.getElementById("dpShelfTitel");
  if(titel)titel.textContent=bcNames[bc]||("Hylla "+bc);
  const plans=shelvesIn(mem);
  const wholeBtn=document.getElementById("dpShelfWholeBtn");
  if(wholeBtn){
    wholeBtn.innerHTML=`<span>Hela hyllan</span><small>${plans.length} plan · ${booksIn(mem).length} böcker</small>`;
    wholeBtn.classList.toggle("on",dpSelShelves.has(bc));
  }
  const planSel=dpSelPlans.get(bc)||new Set();
  const list=document.getElementById("dpPlanList");
  if(list){
    list.innerHTML=plans.map(sh=>{
      const on=planSel.has(sh);
      const photo=PH.find(p=>!p.replaced&&(p.shelves||[]).includes(sh));
      const img=photo?`<img src="${photo.thumb}" alt="">`:`<div class="noimg">${dpSpineBars(sh)}</div>`;
      const n=data.filter(d=>d.shelf===sh).length;
      return `<button class="dp-plan${on?" on":""}" type="button" data-shelf="${esc(sh)}">
        <div class="img">${img}</div>
        <div class="tick"><i data-ic="check"></i></div>
        <div class="meta"><span>${esc(dpPlanLabel(sh))}</span><span>${n} böcker</span></div>
      </button>`;
    }).join("")||'<div class="empty">Inga hyllplan hittades.</div>';
    fillIcons(list);
  }
}
document.getElementById("dpShelfWholeBtn")&&(document.getElementById("dpShelfWholeBtn").onclick=()=>{
  const bc=dpCurBc;if(!bc)return;
  dpWholeLib=false;
  if(dpSelShelves.has(bc))dpSelShelves.delete(bc);
  else{dpSelShelves.add(bc);dpSelPlans.delete(bc)}
  dpRenderShelf();dpSync();
});
document.getElementById("dpPlanList")&&document.getElementById("dpPlanList").addEventListener("click",e=>{
  const btn=e.target.closest(".dp-plan");if(!btn)return;
  const bc=dpCurBc;if(!bc)return;
  const sh=btn.dataset.shelf;
  dpWholeLib=false;dpSelShelves.delete(bc);
  let set=dpSelPlans.get(bc);if(!set){set=new Set();dpSelPlans.set(bc,set)}
  if(set.has(sh))set.delete(sh);else set.add(sh);
  if(!set.size)dpSelPlans.delete(bc);
  dpRenderShelf();dpSync();
});
document.getElementById("dpBackBtn")&&(document.getElementById("dpBackBtn").onclick=()=>{
  dpCurBc=null;
  document.getElementById("dpStepShelf").hidden=true;
  document.getElementById("dpStepGrid").hidden=false;
  dpRenderGrid();dpSync();
});

function dpBooksFiltered(){
  const q=(document.getElementById("dpBookQ").value||"").trim().toLowerCase();
  return data.filter(d=>{
    if(dpBookCat&&d.cat!==dpBookCat)return false;
    if(dpBookBc&&(!d.shelf||topBc(d.shelf.split(":")[0])!==dpBookBc))return false;
    if(q&&!((d.title||"").toLowerCase().includes(q)||(d.author||"").toLowerCase().includes(q)))return false;
    return true;
  }).sort((a,b)=>(a.title||"").localeCompare(b.title||""));
}
function dpRenderBookChips(){
  const cats=[...new Set(data.map(d=>d.cat).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const bcs=topPlaces();
  const catEl=document.getElementById("dpCatChips");
  if(catEl)catEl.innerHTML=`<button class="hs-chip${!dpBookCat?" on":""}" data-cat="">Alla kategorier</button>`+
    cats.map(c=>`<button class="hs-chip${dpBookCat===c?" on":""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  const bcEl=document.getElementById("dpBcChips");
  if(bcEl)bcEl.innerHTML=`<button class="hs-chip${!dpBookBc?" on":""}" data-bc="">Alla hyllor</button>`+
    bcs.map(bc=>`<button class="hs-chip${dpBookBc===bc?" on":""}" data-bc="${esc(bc)}">${esc(bcNames[bc]||("Hylla "+bc))}</button>`).join("");
}
function dpRenderBooks(){
  const list=dpBooksFiltered();
  const countEl=document.getElementById("dpBookCount");
  if(countEl)countEl.textContent=list.length+" böcker";
  const listEl=document.getElementById("dpBookList");
  if(listEl)listEl.innerHTML=list.map(d=>{
    const on=dpSelBooks.has(d.id);
    return `<div class="dp-brow${on?" on":""}" data-id="${d.id}">
      <span class="dp-box">${on?'<i data-ic="check"></i>':""}</span>
      <span><span class="t">${esc(d.title)}</span><small class="by">${esc(d.author||"")}</small></span>
    </div>`;
  }).join("")||'<div class="empty">Inga böcker hittades.</div>';
  fillIcons(listEl);
}
document.getElementById("dpBookQ")&&document.getElementById("dpBookQ").addEventListener("input",dpRenderBooks);
document.getElementById("dpCatChips")&&document.getElementById("dpCatChips").addEventListener("click",e=>{
  const b=e.target.closest("[data-cat]");if(!b)return;
  dpBookCat=b.dataset.cat;dpRenderBookChips();dpRenderBooks();
});
document.getElementById("dpBcChips")&&document.getElementById("dpBcChips").addEventListener("click",e=>{
  const b=e.target.closest("[data-bc]");if(!b)return;
  dpBookBc=b.dataset.bc;dpRenderBookChips();dpRenderBooks();
});
document.getElementById("dpBookList")&&document.getElementById("dpBookList").addEventListener("click",e=>{
  const row=e.target.closest(".dp-brow");if(!row)return;
  const id=+row.dataset.id;
  if(dpSelBooks.has(id))dpSelBooks.delete(id);else dpSelBooks.add(id);
  dpRenderBooks();dpSync();
});

function dpSyncSeg(){
  document.querySelectorAll("#dpSeg [data-mode],#dpSegB [data-mode]").forEach(b=>b.classList.toggle("on",b.dataset.mode===dpMode));
}
document.querySelectorAll("#dpSeg [data-mode],#dpSegB [data-mode]").forEach(b=>b.addEventListener("click",()=>{
  const m=b.dataset.mode;if(m===dpMode)return;
  dpMode=m;dpSyncSeg();
  if(m==="shelf"){
    document.getElementById("dpStepBooks").hidden=true;
    document.getElementById("dpStepShelf").hidden=true;
    document.getElementById("dpStepGrid").hidden=false;
    dpRenderGrid();
  } else {
    document.getElementById("dpStepGrid").hidden=true;
    document.getElementById("dpStepShelf").hidden=true;
    document.getElementById("dpStepBooks").hidden=false;
    dpRenderBookChips();dpRenderBooks();
  }
  dpSync();
}));

/* Gemensamma knappraden: text/aktiverat läge enligt punkt 2.5 i
   uppdraget. dpLocNote syns bara i "enskilda böcker" - platsen ska
   fortfarande döljas när en enskild bok delas (samma regel som i
   sharedBookRow för mottagarsidan). */
function dpSync(){
  const btn=document.getElementById("delaSkapaGor");if(!btn)return;
  const note=document.getElementById("dpLocNote");if(note)note.hidden=dpMode!=="book";
  const sub=document.getElementById("dpSub");
  let n=0,text="Välj något att dela";
  if(dpMode==="shelf"){
    if(dpWholeLib){n=1;text=`Dela Hela bokhyllan · ${data.length} böcker`}
    else{
      const planEntries=[...dpSelPlans.entries()].flatMap(([bc,set])=>[...set].map(sh=>({bc,sh})));
      n=dpSelShelves.size+planEntries.length;
      if(n===1){
        if(dpSelShelves.size===1){
          const bc=[...dpSelShelves][0];
          text=`Dela ${bcNames[bc]||("Hylla "+bc)} · ${booksIn(membersOf(bc)).length} böcker`;
        } else {
          const sh=planEntries[0].sh;
          text=`Dela ${dpPlanLabel(sh)} · ${data.filter(d=>d.shelf===sh).length} böcker`;
        }
      } else if(n>1){
        let total=0;
        for(const bc of dpSelShelves)total+=booksIn(membersOf(bc)).length;
        for(const e of planEntries)total+=data.filter(d=>d.shelf===e.sh).length;
        text=`Dela ${n} hyllor · ${total} böcker`;
      }
    }
  } else {
    n=dpSelBooks.size;
    text=n===1?"Dela 1 bok":n>1?`Dela ${n} böcker`:"Välj något att dela";
  }
  btn.disabled=n===0;
  btn.textContent=n===0?"Välj något att dela":text;
  if(sub)sub.textContent=n===0?"Inget valt än":"";
}

/* UX-fix 30/10 (Thomas): efter att länken skapats var skärmen rörig -
   urvalet, "Dela N böcker"-knappen och "Avbryt" låg kvar trots att inget
   av det längre betydde något ("Avbryt" lät osäkert - avbryter det
   delningen som redan skapades?). I stället ersätts HELA urvalet av bara
   länken + en enda tydlig knapp ("Klar") när den är klar. */
function dpShowResultat(){
  document.getElementById("dpStepGrid").hidden=true;
  document.getElementById("dpStepShelf").hidden=true;
  document.getElementById("dpStepBooks").hidden=true;
  document.querySelector("#delaSkapaSheet .pickbar").hidden=true;
  document.getElementById("delaSkapaResultat").hidden=false;
}

function delaSkapaOpen(){
  dpMode="shelf";dpWholeLib=false;dpSelShelves=new Set();dpSelPlans=new Map();dpSelBooks=new Set();
  dpCurBc=null;dpBookCat="";dpBookBc="";
  document.getElementById("delaSkapaErr").textContent="";
  document.getElementById("delaSkapaResultat").hidden=true;
  document.querySelector("#delaSkapaSheet .pickbar").hidden=false;
  document.getElementById("dpStepGrid").hidden=false;
  document.getElementById("dpStepShelf").hidden=true;
  document.getElementById("dpStepBooks").hidden=true;
  const bq=document.getElementById("dpBookQ");if(bq)bq.value="";
  dpSyncSeg();dpRenderGrid();dpSync();
  document.getElementById("delaSkapaScrim").classList.add("open");
  document.getElementById("delaSkapaSheet").classList.add("open");
}
function delaSkapaClose(){
  document.getElementById("delaSkapaScrim").classList.remove("open");
  document.getElementById("delaSkapaSheet").classList.remove("open");
  dpDirectRecipient=null;
}
document.getElementById("delaSkapaBtn")&&(document.getElementById("delaSkapaBtn").onclick=()=>{
  const harKontakter=delaGruppData&&delaGruppData.people.some(p=>!p.fullyRevoked||p.name);
  if(harKontakter)delaVemOpen();
  else{dpDirectRecipient=null;delaSkapaOpen()}
});
document.getElementById("delaTomtKomIgang")&&(document.getElementById("delaTomtKomIgang").onclick=()=>{dpDirectRecipient=null;delaSkapaOpen()});
document.getElementById("delaTidigareBtn")&&(document.getElementById("delaTidigareBtn").onclick=()=>{
  document.getElementById("delaTomtLage").hidden=true;
  document.getElementById("delaFulltLage").hidden=false;
});
document.getElementById("delaSkapaAvbryt")&&(document.getElementById("delaSkapaAvbryt").onclick=delaSkapaClose);
document.getElementById("delaSkapaScrim")&&document.getElementById("delaSkapaScrim").addEventListener("click",delaSkapaClose);

document.getElementById("delaSkapaGor")&&(document.getElementById("delaSkapaGor").onclick=async()=>{
  const errEl=document.getElementById("delaSkapaErr");errEl.textContent="";
  const libId=await myLibraryId();if(!libId){errEl.textContent="Hittar inte ditt bibliotek.";return}
  let rows=[];
  if(dpMode==="shelf"){
    if(dpWholeLib){
      rows=[{library_id:libId,scope:"library",level:"read",created_by:sbUser.id}];
    } else {
      for(const bc of dpSelShelves)rows.push({library_id:libId,scope:"shelf",bc,level:"read",created_by:sbUser.id});
      for(const [,set] of dpSelPlans)for(const sh of set)rows.push({library_id:libId,scope:"shelf",bc:sh,level:"read",created_by:sbUser.id});
    }
  } else {
    for(const id of dpSelBooks)rows.push({library_id:libId,scope:"book",book_id:id,level:"read",created_by:sbUser.id});
  }
  if(!rows.length){errEl.textContent="Välj något att dela.";return}
  /* Varv 4 i granskningen: en bunt måste vara enhetlig. Gaffeln gör det
     redundant i sig, men vi litar inte tyst på den - stoppa här om något
     trots allt blandar scope. */
  if(new Set(rows.map(r=>r.scope)).size>1){errEl.textContent="Internt fel: blandat urval. Försök igen.";return}
  const btn=document.getElementById("delaSkapaGor"),prevText=btn.textContent;
  btn.disabled=true;btn.textContent="Skapar…";

  /* Fråga B (plan 31/10): känd kontakt - skriv direkt via share_direct,
     ingen länk, ingen inlösen. share_direct upprepar redeem_share_links
     egna uppslag-utan-revoked_at-filter så en tidigare återkallad rad
     återaktiveras i stället för att dubbleras. */
  if(dpDirectRecipient){
    const rid=dpDirectRecipient;
    let fail=null;
    for(const r of rows){
      const {error}=await sb.rpc("share_direct",{p_library_id:libId,p_scope:r.scope,p_bc:r.bc||null,p_book_id:r.book_id||null,p_recipient_id:rid,p_level:r.level});
      if(error){fail=error;break}
    }
    btn.disabled=false;btn.textContent=prevText;
    if(fail){console.warn("dela: share_direct",fail);errEl.textContent="Kunde inte dela direkt just nu.";return}
    delaSkapaClose();
    await renderDelade();
    const namn=window.delaMottagarNamn(rid)||"henne";
    toast(`Delat med ${namn}.`);
    return;
  }

  const {data:res,error}=await sb.from("share_links").insert(rows).select("token");
  btn.disabled=false;btn.textContent=prevText;
  if(error||!res||!res.length){console.warn("dela: skapa share_links",error);errEl.textContent="Kunde inte skapa länken just nu.";return}
  const url=location.origin+location.pathname+"?dela="+res.map(r=>r.token).join(",");
  document.getElementById("delaSkapaLankInput").value=url;
  dpShowResultat();
  renderDelade();
});
document.getElementById("delaSkapaKopiera")&&(document.getElementById("delaSkapaKopiera").onclick=()=>{
  const url=document.getElementById("delaSkapaLankInput").value;
  (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject())
    .then(()=>toast("Länken är kopierad"),()=>prompt("Kopiera länken:",url));
});
document.getElementById("delaSkapaKlar")&&(document.getElementById("delaSkapaKlar").onclick=delaSkapaClose);

async function startAnon(){
  const {data:anonRes,error:anonErr}=await sb.auth.signInAnonymously();
  if(anonErr){console.warn("anonym inloggning",anonErr);showLoginScreen();return}
  sbUser=anonRes.user;
  await afterAuthReady();
}

/* "Kom igång" på startsidan: utan session loggas man in anonymt först
   (samma bibliotek man sedan kan spara som konto), sedan går man rakt
   in i kamerasteget - enligt designflödet ska den som börjar om helt
   (ingen hylla alls än) aldrig se valet "ny hylla eller befintlig"
   eller fylla i namn/typ innan hon får fota. Namnet sätts till ett
   standardvärde ("Min första hylla"), bytbart senare precis som
   bibliotekets eget namn - inget extra fält i vägen för fotot. */
async function startFromGuide(){
  if(!sbUser)await startAnon();
  /* #nsCam ligger inuti Inställningar > Hyllor (samma markup som den
     vanliga guiden återanvänder) - openSet måste köras först, annars
     förblir kamera-ytan osynlig trots att dess egen display sätts till
     synlig, eftersom en förälder fortfarande är display:none. */
  openSet("platser");
  nsState={step:4,mode:"new",shots:[],bc:nextFreeBc(),name:"Min första hylla",type:"S",defLabel:"",origin:"hem"};
  nsRender();
  /* Fanns det foton kvar från ett tidigare besök - man backade ut, gick
     till inloggningen eller stängde appen - frågar vi om de ska användas
     innan kameran visas (B3). */
  await nsFragaSparade();
}
window.startFromGuide=startFromGuide;

/* Delning v1: en delningslänk (?dela=<token> eller en token kvarbliven i
   localStorage sedan tidigare, se DELA_TOKEN_KEY) tar över uppstarten
   helt - innan afterAuthReady() och innan det vanliga vägvalet nedan,
   oavsett om besökaren redan har en sparad session eller inte (en
   inloggad ägare som råkar öppna sin egen delade länk löses in mot sin
   egen, redan inloggade identitet precis som vem som helst annan). */
let delaBootTokens=[];
try{
  const qp=new URLSearchParams(location.search).get("dela");
  delaBootTokens=qp?qp.split(",").map(s=>s.trim()).filter(Boolean):delaReadTokenKey();
}catch(e){
  try{const qp=new URLSearchParams(location.search).get("dela");delaBootTokens=qp?qp.split(",").map(s=>s.trim()).filter(Boolean):[]}catch(e2){delaBootTokens=[]}
}
if(delaBootTokens.length){
  delaWriteTokenKey(delaBootTokens);
  /* Tokens flyttade till localStorage - strippa dem ur URL:en så att en
     omladdning efter en skickad lånönskan (DELA_TOKEN_KEY redan borttagen
     då) inte triggar flödet igen bara för att länken råkar ligga kvar i
     adressfältet eller webbläsarhistoriken. */
  try{
    const u=new URL(location.href);
    if(u.searchParams.has("dela")){u.searchParams.delete("dela");history.replaceState(null,"",u.toString())}
  }catch(e){}
  startDelaFlow(delaBootTokens);
} else if(sbUser){
  afterAuthReady();
} else {
  /* Ingen sparad session: startsidans tomma läge (samma .eg-card som
     annars visas när biblioteket är tomt) visas direkt, med en extra
     "Har du redan ett konto? Logga in"-länk - ingen separat väljarskärm. */
  homeReady=true;renderHome();
  const loginLink=document.getElementById("homeEmptyLogin");
  if(loginLink){loginLink.style.display="";loginLink.onclick=showLoginScreen}
}

/* ---------- Navigering ---------- */
const VIEWS=["hem","place","delade","salj","gaps","set"];
function go(v,opts){
  curView=v;
  showAppChrome();
  VIEWS.forEach(k=>{const el=document.getElementById("view-"+k);if(el)el.style.display=(k===v?"":"none")});
  if(v!=="hem")document.body.classList.remove("eg-lock");
  const homeish=["hem","place","gaps","set"].includes(v);
  document.querySelectorAll(".tabbar [data-tab]").forEach(t=>{
    const k=t.dataset.tab;t.classList.toggle("active",k==="hem"?homeish:k===v)});
  if(v==="salj")vardVisaListan(false);
  if(v==="place")renderPlace();
  if(v==="gaps")renderGaps();
  if(v==="delade")renderDelade();
  closePanel();
  if(!(opts&&opts.keepScroll))scrollTo({top:0});
}
document.querySelectorAll(".tabbar [data-tab]").forEach(t=>t.addEventListener("click",()=>go(t.dataset.tab)));
/* ---------- Inställningar (sidopanel + undersidor) ---------- */
const panel=document.getElementById("panel"),panelScrim=document.getElementById("panelScrim");
function openPanel(){panel.classList.add("open");panelScrim.classList.add("open");if(typeof renderThemeSeg==="function")renderThemeSeg()}
function closePanel(){panel.classList.remove("open");panelScrim.classList.remove("open")}
document.getElementById("gearBtn").addEventListener("click",openPanel);
document.getElementById("panelClose").addEventListener("click",closePanel);
panelScrim.addEventListener("click",closePanel);
const homeEmptyStart=document.getElementById("homeEmptyStart");
if(homeEmptyStart)homeEmptyStart.addEventListener("click",startFromGuide);
if(sbUser)go("hem",{keepScroll:true});
function openSet(page){
  document.querySelectorAll("#view-set .set-page").forEach(el=>el.classList.toggle("on",el.dataset.page===page));
  go("set");
}
/* "Vad är Bokhyllan?" i guiden för tom hylla leder till samma undersida
   som Inställningar > Om appen, men man kom inte via panelen - då ska
   tillbaka-knappen föra hem utan att öppna panelen i onödan. */
let setFromGuide=false;
document.querySelectorAll("[data-set]").forEach(b=>b.addEventListener("click",()=>{setFromGuide=!!b.closest("#homeEmptyGuide");openSet(b.dataset.set)}));
document.querySelectorAll("[data-back-settings]").forEach(b=>b.addEventListener("click",()=>{go("hem");if(!setFromGuide)openPanel();setFromGuide=false}));
document.getElementById("replaySplash").addEventListener("click",()=>{closePanel();playSplash()});
/* Dela länken till appen - viktigt när appen är installerad som webapp på
   hemskärmen, för då finns ingen vanlig "dela"-knapp i webbläsaren att
   komma åt. navigator.share öppnar telefonens delablad (t.ex. direkt till
   Meddelanden) när det finns; annars kopieras länken, med prompt() som
   sista reserv om inte ens urklipp går att skriva till. */
const shareAppBtn=document.getElementById("shareAppBtn");
if(shareAppBtn)shareAppBtn.addEventListener("click",async()=>{
  const url=location.origin+location.pathname;
  const title=(typeof profile!=="undefined"&&profile&&profile.name)||"Min Bokhylla";
  if(navigator.share){
    try{await navigator.share({title,text:"Kolla in min bokhylla-app:",url});return}
    catch(e){if(e&&e.name==="AbortError")return}
  }
  (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject())
    .then(()=>toast("Länken är kopierad"),()=>prompt("Kopiera länken:",url));
});
/* ---------- Redigera bibliotek (namn och bild) ---------- */
const sheet=document.getElementById("editSheet"),sheetScrim=document.getElementById("editScrim");
let draft={name:"",avatar:null};
function renderDraft(){
  paintAvatar(document.getElementById("edAvatar"),draft.avatar,draft.name||"Min Bokhylla");
  const picks=placeList().filter(p=>p.photos[0]).map(p=>p.photos[0].thumb);
  document.getElementById("edPicks").innerHTML=picks.map(t=>`<button class="${draft.avatar===t?"on":""}" data-pick="${t}" style="background-image:url('${t}')" aria-label="Välj foto"></button>`).join("");
  document.querySelectorAll("#edPicks [data-pick]").forEach(b=>b.addEventListener("click",()=>{draft.avatar=b.dataset.pick;renderDraft()}));
}
function openEdit(){
  closePanel();draft={name:profile.name,avatar:profile.avatar};
  document.getElementById("edName").value=profile.name;
  renderDraft();sheet.classList.add("open");sheetScrim.classList.add("open");
}
function closeEdit(){sheet.classList.remove("open");sheetScrim.classList.remove("open")}
document.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",openEdit));
sheetScrim.addEventListener("click",closeEdit);
document.getElementById("edCancel").addEventListener("click",closeEdit);
document.getElementById("edName").addEventListener("input",e=>{draft.name=e.target.value;if(!draft.avatar)renderDraft()});
document.getElementById("edClear").addEventListener("click",()=>{draft.avatar=null;renderDraft()});
document.getElementById("edFile").addEventListener("change",e=>{
  const f=e.target.files&&e.target.files[0];if(!f)return;
  const url=URL.createObjectURL(f),img=new Image();
  img.onload=()=>{const z=240,sc=Math.max(z/img.width,z/img.height),c=document.createElement("canvas");c.width=z;c.height=z;
    c.getContext("2d").drawImage(img,(z-img.width*sc)/2,(z-img.height*sc)/2,img.width*sc,img.height*sc);
    URL.revokeObjectURL(url);draft.avatar=c.toDataURL("image/jpeg",0.85);renderDraft()};
  img.onerror=()=>{URL.revokeObjectURL(url);alert("Kunde inte läsa bilden. Prova en annan.")};
  img.src=url;e.target.value="";
});
document.getElementById("edSave").addEventListener("click",()=>{
  const k=profKey();
  if(!k){alert("Logga in eller kom igång för att ändra titeln.");return}
  profile={name:(document.getElementById("edName").value||"").trim()||"Min Bokhylla",avatar:draft.avatar};
  try{localStorage.setItem(k,JSON.stringify(profile))}catch(e){alert("Kunde inte spara i webbläsaren - bilden kan vara för stor.")}
  renderProfile();closeEdit();toast("Sparat");
});
/* ---------- Boklistan (sök) ---------- */
/* ---------- Hem: sök och "Alla böcker" ----------
   Design 2026-10-26 ("Startsida"-handoffen): sökikonen i headern fäller ut
   #q + förslag (senaste sökningar/kategorichips); själva boklistan
   (#listWrap/#grid, oförändrad motor från tidigare) visas bara i panelen
   "Alla böcker", som öppnas från titeln "N böcker". #q är EN DOM-nod som
   flyttas (appendChild, aldrig kopieras) mellan sin plats i headerns
   sökfält (#hmSearchSlot) och panelens sökfält (#bpSearchSlot), så
   sökningen alltid är samma inputs/lyssnare oavsett var man skrev senast. */
const listWrap=document.getElementById("listWrap");
const hmSearchOv=document.getElementById("hmSearchOv"),hmSearchSlot=document.getElementById("hmSearchSlot");
const booksPanel=document.getElementById("booksPanel"),bpSearchSlot=document.getElementById("bpSearchSlot");
const qInput=document.getElementById("q");
function openSearch(){hmSearchOv.hidden=false;hmSearchSlot.appendChild(qInput);fPanel.hidden=false;renderCatUI();qInput.focus()}
function closeSearch(){hmSearchOv.hidden=true;fPanel.hidden=true}
window.openSearch=openSearch;window.closeSearch=closeSearch;
function openBooks(){closeSearch();bpSearchSlot.appendChild(qInput);booksPanel.hidden=false;document.body.classList.add("eg-lock");render();renderCatUI();bpFilterSync();qInput.focus()}
/* Filterknappen till höger om sökfältet fäller ut filtren. Hopfällt läge är
   normalfallet; pricken på knappen visar att ett filter är aktivt så man
   inte undrar varför listan är kortare än väntat. Öppnas automatiskt om ett
   filter redan är satt när vyn öppnas (t.ex. via en kategori på Hem). */
function bpFilterSync(){
  const btn=document.getElementById("bpFilterBtn");
  const box=document.getElementById("bpFilters");
  const dot=document.getElementById("bpFilterDot");
  const aktiv=!!(fs||fCat||fShelf);
  if(aktiv)bpFiltersOppna=true;
  if(box)box.hidden=!bpFiltersOppna;
  if(btn){btn.setAttribute("aria-expanded",bpFiltersOppna?"true":"false");btn.classList.toggle("on",aktiv)}
  if(dot)dot.hidden=!aktiv;
}
function bpToggleFilters(){bpFiltersOppna=!bpFiltersOppna;bpFilterSync()}
function closeBooks(){booksPanel.hidden=true;document.body.classList.remove("eg-lock");hmSearchSlot.appendChild(qInput)}
window.openBooks=openBooks;window.closeBooks=closeBooks;
document.getElementById("hmSearchBtn").addEventListener("click",openSearch);
document.getElementById("hmSearchClose").addEventListener("click",closeSearch);
document.getElementById("hmTitleBtn").addEventListener("click",openBooks);
document.getElementById("bpClose").addEventListener("click",closeBooks);
document.getElementById("bpFilterBtn").addEventListener("click",bpToggleFilters);
const fPanel=document.getElementById("fPanel");
let catsAll=false;
function catCounts(){const m={};data.forEach(d=>m[d.cat]=(m[d.cat]||0)+1);return m}
function renderCatUI(){
  const m=catCounts();
  const byCount=Object.keys(m).sort((a,b)=>m[b]-m[a]||a.localeCompare(b,"sv"));
  const shown=catsAll?byCount:byCount.slice(0,12);
  if(fCat&&!shown.includes(fCat))shown.push(fCat);
  /* Kategorierna ritas på två ställen: den lilla rutan på Hem (som öppnar
     sökvyn vid klick) och sökvyns egen rad (som bara filtrerar - man är
     redan framme). Fler kategorier än som får plats på en rad, därför en
     egen rad som scrollar i sidled i stället för att trängas med
     statusfiltren. */
  [["catChips",true],["bpCatChips",false]].forEach(([id,oppna])=>{
    const cc=document.getElementById(id);if(!cc)return;
    cc.innerHTML=shown.map(c=>`<button class="hs-chip${c===fCat?" on":""}" data-c="${esc(c)}">${esc(c)}</button>`).join("")+
      (byCount.length>12?`<button class="hs-more" data-more="1">${catsAll?"Färre":`+${byCount.length-12} fler`}</button>`:"");
    cc.querySelectorAll("[data-c]").forEach(b=>b.addEventListener("click",()=>{
      fCat=fCat===b.dataset.c?"":b.dataset.c;$("#fCat").value=fCat;render();renderCatUI();if(oppna)openBooks()}));
    const more=cc.querySelector("[data-more]");
    if(more)more.addEventListener("click",()=>{catsAll=!catsAll;renderCatUI()});
  });
  renderRecent();
}
/* Senaste sökningar: sparas i telefonen när du slutat skriva en stund och
   sökningen gav träffar. */
const RECENT_KEY="bokhyllan-recent";
const normTxt=x=>String(x||"").toLowerCase(); /* samma jämförelse som boklistan */
let recent=[];try{recent=JSON.parse(localStorage.getItem(RECENT_KEY)||"[]")}catch(e){}
let recentT=null;
function saveRecentSoon(){clearTimeout(recentT);recentT=setTimeout(()=>{
  const t=q.trim();if(t.length<3)return;
  if(!data.some(d=>normTxt(d.title+" "+d.author).includes(normTxt(t))))return;
  recent=[t].concat(recent.filter(x=>x.toLowerCase()!==t.toLowerCase())).slice(0,5);
  try{localStorage.setItem(RECENT_KEY,JSON.stringify(recent))}catch(e){}renderRecent()},1500)}
/* Senaste sökningar ritas på två ställen: den lilla rutan på Hem och
   sökvyn (där bara när sökfältet är tomt - har man skrivit något är
   träffarna intressantare än historiken). */
function renderRecent(){
  [["recentRow",false],["bpRecent",true]].forEach(([id,doljVidSok])=>{
    const el=document.getElementById(id);if(!el)return;
    const visa=recent.length&&!(doljVidSok&&q);
    el.innerHTML=visa?`${ic("history")}<span>${recent.map((t,i)=>`<button data-r="${i}">${esc(t)}</button>`).join(" · ")}</span>`:"";
    el.querySelectorAll("[data-r]").forEach(b=>b.addEventListener("click",()=>{
      q=recent[+b.dataset.r];$("#q").value=q;render();openBooks()}));
  });
}
/* "Lägg till hylla" sist bland hyllorna: samma flöde som i Hyllor. */
function addShelf(){openSet("platser");setTimeout(()=>{const b=document.getElementById("nsStart");if(b)b.click();
  const w=document.getElementById("nsWizard");if(w)w.scrollIntoView({behavior:"smooth",block:"start"})},60)}
window.addShelf=addShelf;
/* Utseende: ljust, mörkt eller auto. Själva temat sätts av skriptet i <head>. */
function renderThemeSeg(){
  const T=window.__theme;if(!T)return;const m=T.get();
  document.querySelectorAll("#themeSeg [data-mode]").forEach(b=>b.classList.toggle("on",b.dataset.mode===m));
  const sub=document.getElementById("modeSub");
  if(sub)sub.textContent=m==="auto"?"Följer telefonens inställning":m==="light"?"Ljust läge":"Mörkt läge";
}
document.querySelectorAll("#themeSeg [data-mode]").forEach(b=>b.addEventListener("click",()=>{if(window.__theme)window.__theme.set(b.dataset.mode);renderThemeSeg()}));
renderThemeSeg();
document.querySelectorAll("#homeViewSeg [data-view]").forEach(b=>b.addEventListener("click",()=>setHomeView(b.dataset.view)));
renderHomeViewSeg();
/* ---------- Värdera (tidigare "Sälj") ----------
   Låg tidigare i data/sell.json - en delad, publik fil utan
   inloggningskoppling (samma mönster som fotobehörighetshålet, PR 4.5
   hade). Ligger nu i sell_items/sell_meta, skyddade med samma RLS-mönster
   som manual_books/bc_photos (is_library_member).

   Fas 1 av Värdera-utbyggnaden (PR efter #71): nya kolumner på sell_items
   (estimated_value/uncertainty/heat_score/heat_reason/condition_note) och
   en ny tabell sell_price_sources (en rad per bok+sajt) för flera
   sajt-priser i detaljpanelen. De gamla kolumnerna (price/heat/why/low)
   finns kvar som fallback för de 31 raderna från innan de körts om genom
   den nya värderingsrundan - renderSell() visar nya fält när de finns,
   annars de gamla, så listan ser likadan ut tills en ny runda körts.
   Själva sökningen (mot Studentapan/Bokbörsen/Tradera) är fas B: ingen
   knapp i appen ännu, körs manuellt i en Claude-session på Thomas begäran
   (se claude/bokhyllan-projektplan.md). */
const SELL_SITES={studentapan:"Studentapan",bokborsen:"Bokbörsen",tradera:"Tradera",campusbokhandeln:"Campusbokhandeln"};
/* Namnen från Beslut 4 (claude/rapport-design-och-vardera-beslut-2026-10-29.md)
   - flyttad hit från ibHistorikHtml() 31/10 så att listans summeringskort
   och startsidan kan återanvända samma namn i stället för att hitta på
   sina egna. */
const STATUS_NAMN={bekraftat:"Kontrollerat",automatiskt:"Okontrollerat",vantar:"Väntar på kontroll",osakert:"Varierande pris",ingen_traff:"Inget hittat",ingen_begagnad:"Inget begagnat"};
/* Namnen för de gamla "Vad du kan göra"-kategorierna (pris/kolla/inget/
   osokt). Gruppen är borta ur filterarket (Design 31/10: slagen ihop med
   Status), men sellKat lever kvar som intern variabel - startsidans rutor
   navigerar hit med den (vardVisaListan). Delas mellan rubriken och
   listans summeringskort. */
/* okontr är inte en egen kategori utan "pris" minus de bekräftade - talet
   i totalkortet leder hit, så rubriken behöver ett namn även för den. */
const KAT_NAMN={pris:"Pris finns",okontr:"Okontrollerat pris",kolla:"Kolla själv",inget:"Inget hittat",osokt:"Osökta"};
/* Värderas egna filter. Skilda från sökvyns (fs/fCat/q): vyerna har olika
   syften, så de ska inte dela filtervariabler (beslut 29/10). sellLimit 0
   = visa alla. sellFiltersOppna styr nu filterARKET (Design 31/10), inte
   en inline-panel. */
let sellQ="",sellUnc="",sellHeat="",sellCat="",sellStatus="",sellKat="",sellSort="varde",sellLimit=0,sellFiltersOppna=false;
/* Titlar som precis fått ett manuellt pris den här listvisningen (Thomas
   31/10) - se banner-kommentaren i renderSell(). Rensas i vardVisaListan
   när man lämnar listan, inte vid varje filterbyte. */
let sellNyssVarderade=[];
/* Ögonblicksbild av filtren när arket öppnas, så "Avbryt" kan återställa
   dem exakt - filtren appliceras annars live medan arket är öppet (Design:
   "Visa N böcker (räknas live)"). */
let sellFilterSnapshot=null;
/* ---------- Värderas startsida (design 30/10) ----------
   Två tillstånd i samma vy: förstagångssidan med fotot i helskärm när
   ingenting är värderat, och statusöversikten med topp fem när något är
   det. Visas varje gång fliken öppnas - statusen ändras över tid, och en
   sida som bara syns en gång går inte att hitta tillbaka till.

   De fyra talen MÅSTE summera till antalet böcker i hyllan. En
   statusöversikt som inte går ihop slutar man lita på. Kontrollen 30/10
   mot produktionsdatan visade 830 böcker och 42 rader i sell_items, varav
   3 utan både status och pris - de hade fallit mellan stolarna med en
   rakare räkning (beslut 30/10: fjärde talet räknar böcker UTAN ANVÄNDBART
   PRIS, inte bara böcker utan rad). */
let vardVisarListan=false;

/* Pris att sortera och visa på: samma fält och ordning som listan. */
function vardPris(it){
  if(!it)return null;
  if(it.estimated_value!=null)return it.estimated_value;
  if(it.low!=null)return it.low;
  if(it.price_high!=null)return it.price_high;
  if(it.price_low!=null)return it.price_low;
  return null;
}
/* ---------- Tre kategorier efter vad användaren kan GÖRA (beslut 30/10) ----
   Statusetiketterna (bekraftat/automatiskt/vantar/osakert/ingen_traff) säger
   vad sökmotorn tyckte om sitt eget svar. De säger inget om vad Thomas kan
   göra åt saken, och de ljuger ibland: kontrollen 30/10 hittade två böcker
   märkta "ingen_traff" som ändå hade en sparad Studentapan-sida. Det som
   avgör kategorin är därför OM DET FINNS EN SPARAD LÄNK, inte etiketten.

     pris  - boken har ett pris. Visas med sajten vid priset.
     kolla - ingen prissiffra, men en sida hittades. Länken visas direkt på
             raden så att man kan titta själv.
     inget - ingen sida alls. Inget att göra än. */
function vardLank(it){
  if(!it)return null;
  const s=(SELL_PRICES[it.id]||[]).find(x=>x.url);
  if(s)return{url:s.url,site:SELL_SITES[s.site]||s.site};
  /* it.url är kvar från fas 1, då bara Studentapan söktes. */
  if(it.url)return{url:it.url,site:"Studentapan"};
  return null;
}
/* Sajten priset kommer från: den billigaste med pris, samma rad som
   summan räknar på. Tom sträng när priset är ett gammalt fas 1-fält
   utan källrad. */
function vardKalla(it){
  const s=(SELL_PRICES[it.id]||[]).filter(x=>x.price!=null).sort((a,b)=>a.price-b.price)[0];
  return s?(SELL_SITES[s.site]||s.site):"";
}
function vardKategori(it){
  if(!it)return "osokt";
  const p=vardPris(it);
  if(p!=null&&p>0)return "pris";
  /* Sidan är hittad, men det finns inget begagnat exemplar just nu. Att
     öppna länken ger ingenting, så boken hör inte i "Kolla själv" - den
     räknas med "Inget hittat" så att startsidans fyra tal fortsätter
     summera till hela hyllan. Raden säger skillnaden i klartext, och
     länken ligger kvar i utfällningen: lagret ändras över tid. */
  if(it.price_status==="ingen_begagnad")return "inget";
  return vardLank(it)?"kolla":"inget";
}
function vardStatusSiffror(){
  const n={pris:0,kolla:0,inget:0,osokt:0};
  data.forEach(d=>{n[vardKategori(sellForBook(d))]++});
  return n;
}
/* Summan och talen under den, räknade ur sell_items här och nu.
   sell_meta.summary är en handskriven JSON-klump från 26 augusti som
   ingenting räknar om - den får aldrig bära totalkortet.
   items: valfri lista att räkna på i stället för hela SELL.items - så att
   både startsidans totalsumma (alla böcker) och listans summeringskort
   (bara det som matchar aktivt filter, Thomas 31/10) kan använda samma
   räkning i stället för att hitta på en egen.

   Två summor, inte en (beslut 30/10). Ett okontrollerat pris får aldrig
   räknas in i totalen - det kan höra till en annan upplaga och skilja
   flera hundra kronor. Men det får inte heller gömmas, så det får ett
   eget tal under totalen med egen väg in i listan.
   Kontrollerat = price_status "bekraftat". Raderna från fas 1, som har
   pris men ingen status alls, räknas som okontrollerade: ingen människa
   har sagt ja till dem. */
function vardTotal(items){
  const t={summa:0,antal:0,okontrSumma:0,okontrAntal:0,sokta:0,utanPris:0,kolla:0,ingen:0};
  (items||(SELL&&SELL.items)||[]).forEach(it=>{
    t.sokta++;
    if(vardKategori(it)!=="pris"){
      t.utanPris++;if(vardKategori(it)==="kolla")t.kolla++;else t.ingen++;return;
    }
    const p=vardPris(it);
    /* Bugg hittad 31/10: ett manuellt pris (price_status "manuellt" - ett
       tal Thomas själv skrivit in) räknades in i okontrSumma, inte summa -
       samma hink som sökmotorns egna ogranskade gissningar. Fel: ett pris
       en människa skrivit in FÖR HAND är om något mer säkert än ett
       sökträff-pris ingen tittat på, inte mindre. "bekraftat" (en
       sökträff någon bockat av) och "manuellt" (ett pris någon skrivit in
       själv) hör båda till den kontrollerade summan. */
    if(it.price_status==="bekraftat"||it.price_status==="manuellt"){t.summa+=p;t.antal++}
    else{t.okontrSumma+=p;t.okontrAntal++}
  });
  return t;
}
/* Sant för en bok i pris-kategorin som ingen bekräftat eller skrivit in
   för hand - samma regel som vardTotal, så talet i kortet och raderna i
   listan kan aldrig glida isär. */
function vardOkontrollerat(it){
  return vardKategori(it)==="pris"&&it.price_status!=="bekraftat"&&it.price_status!=="manuellt";
}
function vardTopp(antal){
  if(!SELL||!SELL.items)return[];
  return SELL.items
    .map(it=>({it,pris:vardPris(it),bok:sellForBook2(it)}))
    .filter(x=>x.pris!=null&&x.pris>0)
    .sort((a,b)=>b.pris-a.pris)
    .slice(0,antal);
}
/* Omvänt uppslag mot sellForBook(): från värderingsrad till bok. */
function sellForBook2(it){
  return (it.book_id&&data.find(x=>x.id===it.book_id))||
    (it.match_title&&(data.find(x=>x.title===it.match_title)||data.find(x=>x.title.startsWith(it.match_title))))||null;
}
/* status: öppnar listan filtrerad på ett price_status, så att siffrorna på
   startsidan leder någonstans. Utan det låg t.ex. "4 väntar på kontroll"
   sorterade allra sist i listan, under alla prissatta böcker, utan att
   något pekade dit (Thomas 30/10). */
function vardVisaListan(v,status,kat){
  vardVisarListan=!!v;
  /* Banner-minnet (sellNyssVarderade) hör till EN visning av listan - inte
     till filtret inom den, så det rensas bara här, när man faktiskt lämnar
     listan (v===false), aldrig vid ett filterbyte medan man är kvar. */
  if(!v)sellNyssVarderade=[];
  if(v&&(status!==undefined||kat!==undefined)){
    sellStatus=status||"";
    sellKat=kat||"";
    /* Arket öppnas INTE längre automatiskt här (Design 31/10) - rubriken
       (satt nedan) visar redan vilket filter som är aktivt, och "Fem
       grupper på en gång" var precis det Thomas klagade på. Statuschipet
       hålls i synk i bakgrunden, så om man själv öppnar arket sen ser man
       rätt val förvalt. "kat"-chipgruppen finns inte kvar i arket (slagen
       ihop med Status), så raden nedan är nu bara kvar som en no-op. */
    document.querySelectorAll('#sellFilterSheet [data-grp="status"] .chip').forEach(c=>
      c.classList.toggle("active",c.dataset.v===sellStatus));
    document.querySelectorAll('#sellFilterSheet [data-grp="kat"] .chip').forEach(c=>
      c.classList.toggle("active",c.dataset.v===sellKat));
    if(typeof renderSell==="function")renderSell();
  }
  const title=document.getElementById("vardListTitle");
  if(title)title.textContent=sellStatus?(STATUS_NAMN[sellStatus]||sellStatus):
    sellKat?(KAT_NAMN[sellKat]||sellKat):"Värdera";
  const start=document.getElementById("vardStart"),lista=document.getElementById("vardListWrap");
  if(start)start.hidden=vardVisarListan;
  if(lista)lista.hidden=!vardVisarListan;
  if(!vardVisarListan)renderVardStart();
  window.scrollTo({top:0});
}
function renderVardStart(){
  const el=document.getElementById("vardStart");if(!el)return;
  if(vardVisarListan){el.hidden=true;return}
  el.hidden=false;
  const n=vardStatusSiffror();
  const vardera=n.pris+n.kolla+n.inget;
  const totalt=data.length;
  if(!vardera){
    /* Förstagångssidan: fotot bär. Två siffror, inte fyra - tre nollor i
       rad säger ingenting. Bryter ur vyns sidmarginal och lämnar plats åt
       flikraden i nederkanten. */
    el.innerHTML=`<div class="vs-intro">
      <img src="img/vardera-intro.jpg" alt="" aria-hidden="true">
      <span class="vs-scrim"></span>
      <div class="vs-intro-in">
        <span class="vs-eyebrow">Värdera</span>
        <h1>Vad är dina böcker värda idag?</h1>
        <p>Vi söker upp priser på andrahandsmarknaden för böckerna i din hylla — innan du bestämmer vad du ska göra med dem.</p>
        <div class="vs-tva">
          <div><b>${fmtN(totalt)}</b><span>böcker i hyllan</span></div>
          <div><b>0</b><span>värderade än</span></div>
        </div>
        <button class="btn vs-start" type="button" onclick="openVard()">Värdera dina böcker</button>
      </div>
    </div>`;
    return;
  }
  const topp=vardTopp(5);
  /* Rutorna är vägar in i listan. "Inte värderade än" är undantaget: de
     böckerna har ingen rad i sell_items och finns alltså inte i listan -
     där öppnas urvalsrutan med "Aldrig sökt" förvalt i stället för att
     visa en tom lista. */
  const kort=(tal,etikett,kl,handling)=>`<button class="vs-stat${kl?" "+kl:""}" type="button"
      ${tal?`onclick="${handling}"`:"disabled"}><b>${fmtN(tal)}</b><span>${etikett}</span></button>`;
  /* Övergripande summan på startsidan (Thomas 31/10, ersätter det tidigare
     beslutet "ingen summa i kronor på sidan" i claude/rapport-design-
     vardera-startsida-2026-10-30.md) - räknas på SAMTLIGA värderade böcker
     (vardTotal() utan filter, samma räkning som listans summeringskort
     använder på hela hyllan), och ritas om varje gång sidan renderas, så
     den ligger alltid i takt med sell_items - oavsett om en värdering
     tillkommer, ändras eller en bok försvinner från hyllan. Samma
     uppdelning som listans kort: summan rymmer bara kontrollerade priser,
     de okontrollerade står för sig (beslut 30/10, Thomas "bryt ut dem"). */
  const tot=vardTotal();
  el.innerHTML=`
    <div class="vard-banner"><img src="img/vardera-intro.jpg" alt=""><div class="vard-banner-scrim"></div></div>
    <div class="vs-head">
      <span class="vs-eyebrow">Värdera</span>
      <h1>Vad är dina böcker värda idag?</h1>
      <p>${fmtN(n.pris)} av ${fmtN(vardera)} sökta ${vardera===1?"bok har":"böcker har"} ett pris. Priser ändras — kör om en sökning för att se vad som hänt sedan sist.</p>
      <div class="vs-summa">
        <span class="kr">${fmtN(tot.summa)} kr</span>
        <span class="fine">Kontrollerat pris på ${fmtN(tot.antal)} av ${fmtN(tot.sokta)} värderade böcker${tot.okontrAntal?` · ${fmtN(tot.okontrSumma)} kr okontrollerat på ${fmtN(tot.okontrAntal)} till`:""}</span>
      </div>
    </div>
    <div class="vs-stats">
      ${kort(n.pris,"Pris finns","ok",`vardVisaListan(true,'','pris')`)}
      ${kort(n.kolla,"Kolla själv","wait",`vardVisaListan(true,'','kolla')`)}
      ${kort(n.inget,"Inget hittat","",`vardVisaListan(true,'','inget')`)}
      ${kort(n.osokt,"Inte sökta än","",`vardOppnaAldrig()`)}
    </div>
    <div class="vs-cta">
      <button class="btn btn-primary" type="button" onclick="openVard()">Värdera fler böcker</button>
      ${vardSenastKord()?`<p class="fine vs-senast">Senast körd ${esc(vardDatum(vardSenastKord()))}.</p>`:""}
    </div>
    <button class="link-btn vs-tilllistan" type="button" onclick="vardVisaListan(true,'')">Visa alla värderade böcker →</button>
    ${topp.length?`<p class="sub-h vs-subh">Mest värda just nu</p>
      <div class="vs-topp">${topp.map((x,i)=>{
        const okontrollerat=x.it.price_status==="automatiskt"||x.it.price_status==="osakert";
        return `<div class="vs-tr">
          <span class="vs-n">${i+1}</span>
          <span class="vs-stripe" style="background:${catColor(x.bok?x.bok.cat:"")}"></span>
          <span class="vs-tr-main">
            <span class="vs-tr-t">${esc(x.it.title||(x.bok&&x.bok.title)||"")}</span>
            ${x.bok&&x.bok.author?`<span class="vs-tr-by">${esc(x.bok.author)}</span>`:""}
          </span>
          <span class="vs-tr-p">${fmtN(x.pris)} kr${okontrollerat?`<small>okontrollerat</small>`:""}</span>
        </div>`}).join("")}</div>`:""}`;
}
/* Fix 31/10: "Senast körd" visade sell_meta.updated_date, en rad skriven för
   hand en enda gång (26 augusti) - prissok-funktionen skriver bara till
   sell_items, aldrig till sell_meta, så datumet ändrades aldrig sedan dess
   oavsett hur många sökrundor som faktiskt kördes. Räknar nu i stället ut
   det senaste av sell_items.searched_at/last_checked_at/created_at - den
   riktiga tidpunkten för senast körda sökning. SELL.updated/sell_meta kvar
   orört i databasen, bara inte använt för den här raden längre. */
function vardSenastKord(){
  let max=0;
  (SELL&&SELL.items||[]).forEach(it=>{
    const t=Date.parse(it.searched_at||it.last_checked_at||it.created_at||"");
    if(!isNaN(t)&&t>max)max=t;
  });
  return max?new Date(max).toISOString():"";
}
/* sell_meta.updated_date är ett datum, inte en tidpunkt - skriv ut det som
   datum i stället för att hitta på "i går kväll" som skissen föreslog. */
function vardDatum(d){
  try{
    const dt=new Date(d);
    if(isNaN(dt))return String(d);
    return dt.toLocaleDateString("sv-SE",{day:"numeric",month:"long"});
  }catch(e){return String(d)}
}
function renderSell(){
  const el=document.getElementById("sellList");if(!el||!SELL)return;
  const s=SELL;
  const emptyMsg=document.getElementById("sellEmptyMsg");
  if(!s.items.length){el.innerHTML="";document.getElementById("sellNote").textContent="";if(emptyMsg)emptyMsg.style.display="block";return}
  if(emptyMsg)emptyMsg.style.display="none";
  /* Nyare fält i första hand, gamla som fallback (se kommentar ovan).
     "Väntar på kontroll" har inget pris att sortera på - den ska sorteras
     sist (Design 29/10 g), inte först som 0 gjorde. */
  const val=it=>it.price_status==="vantar"?-1:
    (it.estimated_value!=null?it.estimated_value:(it.low!=null?it.low:(it.price_high!=null?it.price_high:(it.price_low!=null?it.price_low:0))));
  const isSure=it=>it.uncertainty?it.uncertainty==="lag":!!it.checked;
  /* Boken i katalogen slås upp här (inte bara i raden längre ner), eftersom
     kategorifiltret behöver den - sell_items har ingen egen kategori. */
  const bokFor=it=>(it.book_id&&data.find(x=>x.id===it.book_id))||
    (it.match_title&&(data.find(x=>x.title===it.match_title)||data.find(x=>x.title.startsWith(it.match_title))))||null;
  /* Sortering (30/10, utökad 2/11 med författare och senast värderad -
     Thomas: snabbknappar i vyn för namn/författare/pris/datum). Hetta
     rankas het > medel > låg; "stabil" och tomt faller till medel så att
     en rad utan hetta inte hamnar först. Böcker utan författare/datum
     sorteras sist i de respektive lägena i stället för att hamna först
     på en tom sträng/odefinierat tal. */
  const hettaRang=it=>({het:3,medel:2,stabil:2,lag:1})[it.heat_score||it.heat]||2;
  const forfOf=it=>{const b=bokFor(it);return b&&b.author?String(b.author).trim():""};
  let items=s.items.slice().sort(
    sellSort==="titel"?(a,b)=>String(a.title||"").localeCompare(String(b.title||""),"sv"):
    sellSort==="forfattare"?(a,b)=>{
      const fa=forfOf(a),fb=forfOf(b);
      if(!fa&&!fb)return String(a.title||"").localeCompare(String(b.title||""),"sv");
      if(!fa)return 1;if(!fb)return -1;
      return fa.localeCompare(fb,"sv")||String(a.title||"").localeCompare(String(b.title||""),"sv");
    }:
    sellSort==="datum"?(a,b)=>{
      const ta=a.searched_at?new Date(a.searched_at).getTime():NaN,tb=b.searched_at?new Date(b.searched_at).getTime():NaN;
      if(isNaN(ta)&&isNaN(tb))return String(a.title||"").localeCompare(String(b.title||""),"sv");
      if(isNaN(ta))return 1;if(isNaN(tb))return -1;
      return tb-ta;
    }:
    sellSort==="hetta"?(a,b)=>hettaRang(b)-hettaRang(a)||val(b)-val(a):
    (a,b)=>val(b)-val(a));
  if(sellQ){const nq=sellQ.toLowerCase();items=items.filter(it=>String(it.title||"").toLowerCase().includes(nq))}
  /* "okontr" är inte en egen kategori utan pris-kategorin minus de
     bekräftade - talet i totalkortet ska leda till exakt de raderna. */
  if(sellKat==="okontr")items=items.filter(vardOkontrollerat);
  /* En bok som precis fått ett manuellt pris byter kategori till "pris" och
     skulle annars försvinna direkt ur Kolla/Inget-listan (Thomas 31/10:
     "blir förvirrande"). Den får vara kvar i urvalet här - på sin vanliga
     sorterade plats, prissortering och allt - men ritas som ett kort med
     bara titel och flyttad-text i stället för en vanlig prisrad, se
     items.map nedan. */
  else if(sellKat)items=items.filter(it=>vardKategori(it)===sellKat||
    ((sellKat==="kolla"||sellKat==="inget")&&it.title&&sellNyssVarderade.includes(it.title)));
  if(sellStatus)items=items.filter(it=>it.price_status===sellStatus);
  if(sellUnc)items=items.filter(it=>(it.uncertainty||(isSure(it)?"lag":""))===sellUnc);
  if(sellHeat)items=items.filter(it=>(it.heat_score||it.heat)===sellHeat);
  if(sellCat)items=items.filter(it=>{const b=bokFor(it);return b&&b.cat===sellCat});
  /* Flyttade kort (Thomas 31/10): en bok som precis fått ett manuellt pris
     hålls kvar i urvalet av filtret ovan så den syns på sin vanliga plats
     (se items.map nedan), men den hör fortfarande till den gamla kategorin
     i allt annat - räknas aldrig med i totalkortets summa/antal eller i
     bredden på andra raders track-stapel, bara för att den råkar ligga i
     den här listan just nu. */
  const arFlyttad=it=>(sellKat==="kolla"||sellKat==="inget")&&it.title&&
    sellNyssVarderade.includes(it.title)&&vardKategori(it)==="pris";
  /* Filtreringarna ovan (sellQ/sellKat/sellStatus/sellUnc/sellHeat/sellCat)
     har redan körts här - filtreratUrval är exakt den mängd böcker som
     visas i listan nedanför, före sellLimit-avklippningen. Totalkortet
     ska räkna PÅ den mängden, inte alltid på hela hyllan (Thomas 31/10:
     "Den ska visa värdena på det filter som visas"). */
  const filtreratUrval=items.filter(it=>!arFlyttad(it));
  const aktivtFilter=!!(sellQ||sellKat||sellStatus||sellUnc||sellHeat||sellCat);
  const totalt=items.length;
  if(sellLimit>0)items=items.slice(0,sellLimit);
  sellSyncUI(totalt);
  const maxVal=Math.max(1,...items.filter(it=>!arFlyttad(it)).map(val));
  if(!items.length){
    el.innerHTML=`<div class="sell-empty-msg">${sellQ?`Inga träffar på ”${esc(sellQ)}”.`:"Inga böcker matchar filtret."}</div>`;
    document.getElementById("sellNote").textContent="";return;
  }
  if(!items.length){el.innerHTML=`<div class="sell-empty-msg">Inga böcker matchar filtret.</div>`;document.getElementById("sellNote").textContent="";return}
  /* Totalkortet räknas ur sell_items (vardTotal), inte ur den gamla
     sell_meta.summary. Inget prisintervall: ingen bok i databasen har
     både price_low och price_high satta, så en intervallrad hade varit
     en tom ruta. Rubriken speglar aktivt filter (status/kategori) -
     "Hela hyllan" bara när inget filter är valt. */
  const sumRubrik=sellStatus?(STATUS_NAMN[sellStatus]||sellStatus):
    sellKat?(KAT_NAMN[sellKat]||sellKat):
    aktivtFilter?"Filtrerat urval":"Hela hyllan";
  const tot=vardTotal(filtreratUrval);
  el.innerHTML=`<div class="card sell-sum"><span class="fine">${esc(sumRubrik)}</span>
      <span class="kr">${fmtN(tot.summa)} kr</span>
      <span class="fine">kontrollerat pris på ${fmtN(tot.antal)} av ${fmtN(tot.sokta)} sökta böcker</span>
      <span class="sell-sum-lankar">${tot.okontrAntal?`<button class="link-btn" type="button" onclick="vardVisaListan(true,'','okontr')">+ ${fmtN(tot.okontrSumma)} kr okontrollerat på ${fmtN(tot.okontrAntal)} böcker →</button>`:""}${!aktivtFilter&&tot.kolla?`<button class="link-btn" type="button" onclick="vardVisaListan(true,'','kolla')">${fmtN(tot.kolla)} utan pris — kolla själv →</button>`:""}${!aktivtFilter&&tot.ingen?`<button class="link-btn" type="button" onclick="vardVisaListan(true,'','inget')">${fmtN(tot.ingen)} utan pris att hämta →</button>`:""}</span>
      </div>`+
    `<div>`+items.map((it,i)=>{
      /* Flyttad-kort (Thomas 31/10): boken har precis fått ett manuellt
         pris och bytt kategori till "pris" (se filtret ovan som håller
         den kvar här i stället för att låta den försvinna tyst). Kortet
         ligger kvar på bokens vanliga sorterade plats, inte högst upp -
         det får gärna flytta sig om listan sorteras om, bara det följer
         med samma bok ("kör. den kan flytta så länge det andra kortet med
         infon läggs på samma ställe", Thomas 31/10). Rensas när man lämnar
         listan (vardVisaListan(false)) eller öppnar urvalsarket på nytt. */
      if(arFlyttad(it)){
        return `<div class="sell-row sr-flyttad" id="sr-${i}"><div class="sr-body">
          <div class="sell-flyttad"><span class="t">${esc(it.title)}</span>
          <span class="sell-flyttad-msg">Har flyttats till värderade böcker</span></div>
        </div></div>`;
      }
      const h=HEAT[it.heat_score||it.heat]||HEAT.kolla;
      /* Status från den nya prissökningen (Design 29/10): "ca"-prefix och
         dämpad färg på okontrollerat, tomt streck på väntar, spann utan
         medelvärde på varierande - tre samtidiga skillnader mot ett
         kontrollerat pris, enligt Designs princip e). */
      const auto=it.price_status==="automatiskt",vantar=it.price_status==="vantar",osakert=it.price_status==="osakert";
      /* manuellt (Design 31/10, skärm 3): ett pris Thomas själv skrivit in
         när prissökningen inte hittade något. Ska aldrig kunna förväxlas
         med ett pris prissökningen hittat och verifierat - egen badge,
         egen färg, och ingen hetta-etikett (hettan kommer ur en
         bedömning som aldrig kördes för den här raden). */
      const manuellt=it.price_status==="manuellt";
      /* Flödesrapporten 31/10, punkt 12: raden läste it.price_low direkt
         medan totalsumman (vardTotal, via vardPris) kunde falla tillbaka
         på ett annat fält (estimated_value eller price_high) för samma
         rad - radens "ca"-pris och dess bidrag till summan kunde alltså
         tyst visa olika tal. Nu läser raden samma funktion som summan. */
      const priceLabel=
        vantar?"–":
        osakert&&it.price_low!=null&&it.price_high!=null?`${fmtN(it.price_low)}–${fmtN(it.price_high)} kr`:
        auto?`ca ${fmtN(vardPris(it))} kr`:
        it.estimated_value!=null?`${fmtN(it.estimated_value)} kr`:shortPrice(it.price);
      const statusBadge=
        auto?`<span class="u" style="color:var(--ink-500)">Okontrollerat</span>`:
        vantar?`<span class="u" style="color:var(--ink-500)">Väntar på kontroll</span>`:
        manuellt?`<span class="u" style="color:var(--pink-600)">Manuellt tillagt</span>`:"";
      /* Kategorin avgör vad raden erbjuder. "Kolla själv" får länken
         SYNLIG på raden - förut låg den gömd inne i den fällda delen,
         bakom ett streck som inte bjöd in till något (Thomas 30/10). */
      const kat=vardKategori(it),lank=vardLank(it),kalla=kat==="pris"?vardKalla(it):"";
      /* book_id (satt en gång vid migreringen/när posten skapas) är den
         pålitliga kopplingen - före flytten matchades titelsträngen om
         vid varje visning, och "Står i:"-raden tappades tyst bort så fort
         en titel rättades i katalogen (flödesrapporten 2026-10-26, punkt
         4.3). match_title-fallbacken finns kvar för poster utan book_id. */
      const d=bokFor(it);
      const loc=d&&d.shelf?locLabel(d.shelf):"";
      const sources=(SELL_PRICES[it.id]||[]);
      const u=statusBadge||(it.uncertainty?`<span class="u ${esc(it.uncertainty)}">${it.uncertainty==="lag"?"Säkert pris":it.uncertainty==="hog"?"Osäkert pris":"Medel säkerhet"}</span>`:"");
      /* Kortrader (Design 31/10, krav 4): varje rad är nu ett eget kort
         (ram, rundade hörn, skugga, marginal - samma mönster som .sr i
         sökvyn) med en kategoristripe till vänster, samma som topp fem-
         listan på startsidan redan har men som saknades här. Hetta och
         statusmärke (u) delar inte längre rad med priset - de ligger på
         en egen rad under titeln, DIREKT synliga (inte bara när raden
         fälls ut), så två rader i samma kategori faktiskt går att skilja
         åt i en snabb svep (Design: "Nästan all information är identisk
         rad för rad" var huvudklagomålet). */
      return `<div class="sell-row sr-${kat}" id="sr-${i}">
        <span class="sr-stripe" style="background:${catColor(d?d.cat:"")}"></span>
        <div class="sr-body"><button class="sell-head" onclick="toggleSell(${i})">
          <span class="t">${esc(it.title)}</span><span class="p"${auto?' style="color:var(--ink-500)"':""}>${kat==="pris"?esc(priceLabel):kat==="kolla"?"<small>inget pris</small>":it.price_status==="ingen_begagnad"?"<small>inget begagnat</small>":"<small>inget hittat</small>"}</span>
          ${kat==="pris"&&kalla?`<span class="sr-kalla">${esc(kalla)}</span>`:""}
          <span class="track"><span style="width:${Math.round(Math.max(0,val(it))/maxVal*100)}%"></span></span></button>
        ${u||!manuellt?`<div class="sell-sub">${u}${manuellt?"":`<span class="h" style="color:${h[1]}">${h[0]}</span>`}</div>`:""}
        ${kat==="kolla"&&lank?`<a class="sr-oppna" href="${esc(lank.url)}" target="_blank" rel="noopener">Öppna på ${esc(lank.site)} →</a>`:""}
        ${(kat==="kolla"||kat==="inget")?`<div class="sell-manual">
            <div class="sell-manual-form">
              <input type="number" inputmode="decimal" min="0" step="1" placeholder="Pris i kr" id="smpInput-${i}" aria-label="Manuellt pris i kronor">
              <button type="button" class="btn btn-outline btn-sm" onclick="smpPaste(${i})">Klistra in</button>
              <button type="button" class="btn btn-primary btn-sm" onclick="smpSave(${i},${it.id})">Spara</button>
            </div>
          </div>`:""}
        <div class="sell-more">
          ${auto?`<p class="fine">Priset kan höra till en annan upplaga än din. Samma titel kan skilja flera hundra kronor mellan upplagor.</p>`:""}
          ${kat==="kolla"?`<p class="fine">Sidan hittades, men priset gick inte att läsa av automatiskt.</p>`:""}
          ${kat==="inget"&&it.price_status==="ingen_begagnad"?`<p class="fine">Boken finns på sajten, men inget begagnat exemplar är till salu just nu. Bara nypris fanns, och nypris räknas aldrig som värde här. Lagret ändras — sök om senare.</p>${vardLank(it)?`<p><a href="${esc(vardLank(it).url)}" target="_blank" rel="noopener">Öppna på ${esc(vardLank(it).site)}</a></p>`:""}`:
            kat==="inget"?`<p class="fine">Ingen av sajterna hade en sida för den här boken. Prova att söka om senare — utbudet ändras.</p>`:""}
          ${it.condition_note?`<p><b>Villkor:</b> ${esc(it.condition_note)}</p>`:""}
          ${!it.estimated_value&&!auto&&!vantar&&!osakert&&shortPrice(it.price)!==it.price?`<p><b>Pris:</b> ${esc(it.price)}</p>`:""}
          ${it.heat_reason?`<p>${esc(it.heat_reason)}</p>`:(it.why?`<p>${esc(it.why)}</p>`:"")}
          ${loc?`<p>Står i: ${esc(loc)}</p>`:""}
          ${sources.length?`<ul class="sell-sources">${sources.map(src=>`<li><span>${esc(SELL_SITES[src.site]||src.site)}</span><span>${src.price!=null?fmtN(src.price)+" kr":"?"}${src.url?` · <a href="${esc(src.url)}" target="_blank" rel="noopener">Öppna</a>`:""}</span></li>`).join("")}</ul>`:""}
          ${it.wanted_ad_url?`<p><a href="${esc(it.wanted_ad_url)}" target="_blank" rel="noopener">Någon söker efter den här boken</a></p>`:""}
          ${!sources.length&&it.url?`<a href="${esc(it.url)}" target="_blank" rel="noopener">Öppna på Studentapan</a>`:""}</div></div></div>`}).join("")+`</div>`;
  /* #sellNote visade tidigare sell_meta.summary.kommentar/note/updated_date -
     en handskriven kommentar från den allra första manuella sökrundan
     (26/8), statisk och orelaterad till vilket filter man faktiskt tittar
     på. Borttagen på Thomas begäran 31/10 - ett första steg innan den
     eventuellt görs om till något som faktiskt speglar listan som visas. */
  renderVardStart();
}
/* Kortpris till listan: första ledet, utan parentes. Hela priset visas när
   raden fälls ut. "359 kr (uppl 5) / 175 kr (uppl 4)" -> "359 kr". */
function shortPrice(p){return String(p||"").split(/\s\/\s|\s—\s/)[0].replace(/\s*\([^)]*\)/g,"").trim()||p}
function toggleSell(i){const r=document.getElementById("sr-"+i);if(r)r.classList.toggle("open")}
window.toggleSell=toggleSell;
/* Manuell prisinmatning (Design 31/10, skärm 3). Ligger direkt synlig på
   raden, bredvid länken ut till säljsidan - ingen egen modal. Fältet låg
   tidigare bakom en egen "+ Lägg till pris"-knapp (smpOpen), men formuläret
   visades ändå alltid (sell-manual-form saknade en [hidden]-regel i CSS:en,
   så display:flex vann över attributet) - knappen öppnade alltså inget och
   togs bort som redundant (Thomas 31/10). Urklippsknappen fyller bara
   FÄLTET, aldrig direkt i listan: ett felaktigt urklipp ska synas och kunna
   rättas innan Spara ("ett klick kvar, inte noll", Designs egen formulering). */
async function smpPaste(i){
  const inp=document.getElementById("smpInput-"+i);if(!inp)return;
  /* navigator.clipboard kan sakna behörighet eller inte finnas (öppen
     fråga i Design-underlaget) - faller då tyst tillbaka till ett tomt
     fält, inte ett felmeddelande. */
  try{
    if(!navigator.clipboard||!navigator.clipboard.readText)return;
    const txt=await navigator.clipboard.readText();
    const m=String(txt).match(/\d[\d\s]*(?:[.,]\d+)?/);
    if(m)inp.value=m[0].replace(/\s/g,"").replace(",",".");
  }catch(e){/* behörighet nekad - tyst, se ovan */}
}
window.smpPaste=smpPaste;
async function smpSave(i,id){
  const inp=document.getElementById("smpInput-"+i);if(!inp)return;
  const v=Number(String(inp.value).replace(",","."));
  if(!v||v<=0){alert("Ange ett pris i kronor.");return}
  const varde=Math.round(v);
  const {error}=await sb.from("sell_items").update({estimated_value:varde,price_status:"manuellt"}).eq("id",id);
  if(error){alert("Kunde inte spara priset: "+error.message);return}
  const it=(SELL&&SELL.items||[]).find(x=>x.id===id);
  if(it){
    it.estimated_value=varde;it.price_status="manuellt";
    if(it.title&&!sellNyssVarderade.includes(it.title))sellNyssVarderade.push(it.title);
  }
  renderSell();
  toast("Pris sparat");
}
window.smpSave=smpSave;
/* Håller filterknappen, pricken, kategorichipen och "Visar N böcker" i
   takt med filtren. Kallas från renderSell() med antalet träffar före
   antalsbegränsningen, så texten kan säga hur många som finns. */
function sellSyncUI(totalt){
  /* Sorteringens snabbknappar (2/11): tänd den som matchar sellSort, släck
     resten - annars kan "on" bli kvar på fel knapp efter en programmatisk
     ändring av sellSort (t.ex. om den nollställs någon annanstans). */
  document.querySelectorAll('#sellSortChips button[data-sort]').forEach(b=>
    b.classList.toggle("on",b.dataset.sort===(sellSort||"varde")));
  const aktiv=!!(sellUnc||sellHeat||sellCat||sellStatus||sellKat);
  /* Filterarket (Design 31/10) öppnas/stängs via sellFiltersOppna, precis
     som appens övriga bottensheet (.sheet/.scrim .open) - inte längre en
     hidden-togglad inline-panel. sellFiltersOppna sätts INTE om här
     (samma skäl som tidigare, Thomas 31/10): bara vid explicit knapptryck
     (sellFilterBtn/Visa böcker/Avbryt), aldrig vid varje omritning. */
  const sheet=document.getElementById("sellFilterSheet"),scrim=document.getElementById("sellFilterScrim");
  if(sheet)sheet.classList.toggle("open",sellFiltersOppna);
  if(scrim)scrim.classList.toggle("open",sellFiltersOppna);
  const btn=document.getElementById("sellFilterBtn");
  if(btn){btn.setAttribute("aria-expanded",sellFiltersOppna?"true":"false");btn.classList.toggle("on",aktiv)}
  const dot=document.getElementById("sellFilterDot");
  if(dot)dot.hidden=!aktiv;
  const visar=document.querySelector(".sell-visar");
  if(visar)visar.lastChild.textContent=sellLimit>0&&totalt>sellLimit?` av ${totalt} böcker`:" böcker";
  /* "Visa N böcker" i arkets fot räknas live medan man filtrerar (Design:
     "räknas live"), eftersom chipsen redan applicerar filtret direkt. */
  const applyBtn=document.getElementById("sellFilterApplyBtn");
  if(applyBtn)applyBtn.textContent=`Visa ${fmtN(totalt)} ${totalt===1?"bok":"böcker"}`;
  /* Kategorierna kommer ur katalogen, men bara de som faktiskt finns bland
     de värderade böckerna - annars står där kategorier som aldrig ger träff. */
  const cc=document.getElementById("sellCatChips");
  if(cc&&SELL){
    const kats=[...new Set((SELL.items||[]).map(it=>{
      const b=(it.book_id&&data.find(x=>x.id===it.book_id))||
        (it.match_title&&data.find(x=>x.title===it.match_title));
      return b&&b.cat}).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"sv"));
    const nytt=kats.map(c=>`<button class="hs-chip${c===sellCat?" on":""}" data-sc="${esc(c)}">${esc(c)}</button>`).join("");
    if(cc.dataset.sig!==nytt){
      cc.dataset.sig=nytt;cc.innerHTML=nytt;
      cc.querySelectorAll("[data-sc]").forEach(b=>b.addEventListener("click",()=>{
        sellCat=sellCat===b.dataset.sc?"":b.dataset.sc;renderSell()}));
    }
  }
}
document.querySelectorAll("#sellFilterSheet .chips").forEach(grp=>{
  grp.querySelectorAll(".chip").forEach(c=>c.addEventListener("click",()=>{
    grp.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));
    c.classList.add("active");
    const g=grp.dataset.grp;
    if(g==="unc")sellUnc=c.dataset.v;else if(g==="status")sellStatus=c.dataset.v;
    else if(g==="kat")sellKat=c.dataset.v;else sellHeat=c.dataset.v;
    renderSell();
  }));
});
/* Filterknappen öppnar arket och tar en ögonblicksbild av filtren, så
   "Avbryt" kan backa exakt - utan snapshot skulle Avbryt inte veta vad
   det ska återställa till (Design 31/10, skärm 2). */
document.getElementById("sellFilterBtn")?.addEventListener("click",()=>{
  sellFilterSnapshot={sellQ,sellStatus,sellUnc,sellHeat,sellCat,sellKat};
  sellFiltersOppna=true;renderSell();
});
function sellFilterStangArk(){sellFiltersOppna=false;renderSell()}
document.getElementById("sellFilterApplyBtn")?.addEventListener("click",sellFilterStangArk);
/* Avbryt: återställ exakt det filterläge som gällde när arket öppnades -
   inte bara stäng, annars "ångrar" knappen ingenting (Design 31/10). */
document.getElementById("sellFilterCancelBtn")?.addEventListener("click",()=>{
  if(sellFilterSnapshot){
    ({sellQ,sellStatus,sellUnc,sellHeat,sellCat,sellKat}=sellFilterSnapshot);
    const q=document.getElementById("sellQ");if(q)q.value=sellQ;
    document.querySelectorAll('#sellFilterSheet [data-grp="status"] .chip').forEach(c=>
      c.classList.toggle("active",c.dataset.v===sellStatus));
    document.querySelectorAll('#sellFilterSheet [data-grp="unc"] .chip').forEach(c=>
      c.classList.toggle("active",c.dataset.v===sellUnc));
    document.querySelectorAll('#sellFilterSheet [data-grp="heat"] .chip').forEach(c=>
      c.classList.toggle("active",c.dataset.v===sellHeat));
  }
  sellFiltersOppna=false;renderSell();
});
/* Rensa filter: nollställer alla grupper på en gång, arket stannar öppet
   (Design: "återställer alla grupper på en gång", inget nämnt om att
   arket ska stänga). */
document.getElementById("sellFilterClearBtn")?.addEventListener("click",()=>{
  sellQ=sellUnc=sellHeat=sellCat=sellStatus=sellKat="";
  const q=document.getElementById("sellQ");if(q)q.value="";
  document.querySelectorAll('#sellFilterSheet .chips .chip').forEach(c=>
    c.classList.toggle("active",c.dataset.v===""));
  renderSell();
});
document.getElementById("sellQ")?.addEventListener("input",e=>{sellQ=e.target.value;renderSell()});
document.getElementById("sellLimit")?.addEventListener("change",e=>{sellLimit=Number(e.target.value)||0;renderSell()});
/* Sorteringens snabbknappar (2/11) ersätter den gamla <select id="sellSort">.
   Delegerad klickhanterare, inte en per knapp, eftersom knapparna ligger
   fasta i markupen (till skillnad från kategorichipsen, som byggs om per
   bibliotek) - samma mönster hade fungerat lika bra här, men behövs inte. */
document.getElementById("sellSortChips")?.addEventListener("click",e=>{
  const b=e.target.closest("button[data-sort]");if(!b)return;
  sellSort=b.dataset.sort||"varde";renderSell();
});
document.getElementById("sellInfoBtn")?.addEventListener("click",()=>{
  const p=document.getElementById("sellInfoPanel");if(p)p.open=!p.open});
document.getElementById("sellClearBtn")?.addEventListener("click",async()=>{
  if(!confirm("Rensa hela värderingslistan? Det går inte att ångra - en ny värderingsrunda fyller listan igen."))return;
  const ids=(SELL&&SELL.items||[]).map(it=>it.id);
  if(!ids.length)return;
  const {error}=await sb.from("sell_items").delete().in("id",ids);
  if(error){alert("Kunde inte rensa listan: "+error.message);return}
  SELL={items:[],summary:null,note:"",updated:""};SELL_PRICES={};renderSell();
});
async function loadSell(){
  /* Flödesrapporten 31/10, punkt 11: loadManualBooks fick 401-återförsöket
     i PR 30/10 (session hinner inte förnyas innan frågan går iväg vid
     uppstart), men den här frågan missade samma fix. Resultatet: Värdera
     kunde visa "0 värderade" trots att dussintals rader fanns, utan
     felmeddelande, för att felet bara lästes av console.warn och aldrig
     gav ett nytt försök. Samma mönster som loadManualBooks: läs felet,
     förnya sessionen, försök igen (högst tre gånger). */
  let items=null,e1=null;
  for(let f=0;f<3;f++){
    ({data:items,error:e1}=await sb.from("sell_items").select("*").order("id"));
    if(!e1)break;
    console.warn("sell_items försök "+(f+1),e1);
    await new Promise(r=>setTimeout(r,600));
    try{
      if(f===0&&sb.auth.getSession)await sb.auth.getSession();
      else if(sb.auth.refreshSession)await sb.auth.refreshSession();
    }catch(e){console.warn("förnya session",e)}
  }
  if(e1){console.warn("sell_items",e1);toast("Kunde inte läsa in Värdera just nu. Ladda om appen.");return}
  const {data:metaRows,error:e2}=await sb.from("sell_meta").select("*").limit(1);
  if(e2)console.warn("sell_meta",e2);
  const ids=(items||[]).map(it=>it.id);
  SELL_PRICES={};
  if(ids.length){
    const {data:sources,error:e3}=await sb.from("sell_price_sources").select("*").in("sell_item_id",ids);
    if(e3)console.warn("sell_price_sources",e3);
    (sources||[]).forEach(src=>{(SELL_PRICES[src.sell_item_id]=SELL_PRICES[src.sell_item_id]||[]).push(src)});
  }
  const meta=(metaRows&&metaRows[0])||{};
  SELL={items:items||[],summary:meta.summary||null,note:meta.note||"",updated:meta.updated_date||""};
  renderSell();
}

/* ---------- Värdera böcker: urvalsark för automatisk prissökning (Tavily) ----------
   Filtrerar HELA biblioteket (data), inte den redan värderade listan -
   egna variabler (vardSel*), delar inte med sellCat/sellUnc/sellHeat
   (beslut 29/10 om separata filter). Statusar och fält bekräftade med
   Thomas och Design 29/10, se migrering 20261029163152 och
   supabase/functions/prissok. */
let vardSelStatus="",vardSelCats=new Set(),vardQ2="",vardAvbryt=false,vardLimit=0;
const vardSheet=document.getElementById("vardSheet"),vardScrim=document.getElementById("vardScrim");
function vardMatches(){
  return data.filter(d=>{
    const it=sellForBook(d),status=it?it.price_status:null;
    if(vardSelStatus==="aldrig"){if(status)return false}
    else if(vardSelStatus==="redan"){if(status!=="bekraftat"&&status!=="automatiskt"&&status!=="manuellt")return false}
    else if(vardSelStatus&&status!==vardSelStatus)return false;
    if(vardSelCats.size&&!vardSelCats.has(d.cat))return false;
    if(vardQ2){const nq=vardQ2.toLowerCase();
      if(!(String(d.title||"").toLowerCase().includes(nq)||String(d.author||"").toLowerCase().includes(nq)))return false}
    return true;
  });
}
/* Design 30/10, punkt 2-3: begränsar vardMatches() till vardLimit böcker,
   EFTER filtreringen, i en uttryckligen definierad och stabil ordning -
   annars är "de första 25" vad databasen råkar returnera, och nästa
   körning kan ge samma böcker igen. Allt i körvägen (räknare,
   bekräftelsedialog, körslinga) ska gå via den här, inte vardMatches(). */
function vardUrval(){
  const m=vardMatches().slice().sort((a,b)=>
    String(a.title||"").localeCompare(String(b.title||""),"sv")||(a.id-b.id));
  return vardLimit>0?m.slice(0,vardLimit):m;
}
function vardSyncCount(){
  const full=vardMatches(),u=vardUrval();
  /* Punkt 9: manuellt hör till samma skydd som bekraftat/automatiskt - se
     kommentaren vid redanSokt i prissok. */
  const redan=u.filter(d=>{const it=sellForBook(d);return it&&(it.price_status==="bekraftat"||it.price_status==="automatiskt"||it.price_status==="manuellt")}).length;
  const utanForf=u.filter(d=>!String(d.author||"").trim()).length;
  const begransat=vardLimit>0&&vardLimit<full.length;
  const rader=[begransat?`${u.length} av ${full.length} böcker`:`${u.length} böcker valda`];
  if(redan)rader.push(`${redan} redan värderade`);
  if(utanForf)rader.push(`${utanForf} saknar författare`);
  rader.push(`ca ${u.length} sökkrediter`);
  const el=document.getElementById("vardCount");if(el)el.textContent=rader.join(" · ");
  const btn=document.getElementById("vardRunBtn");
  if(btn){btn.disabled=!u.length;btn.textContent=u.length?`Värdera ${u.length} böcker`:"Värdera"}
  /* Förklaringsraden gäller bara "Aldrig sökt" - i andra lägen ger nästa
     körning samma böcker igen, och påståendet blir falskt. */
  const fine=document.getElementById("vardLimitFine");
  if(fine){
    const visa=vardLimit>0&&vardSelStatus==="aldrig";
    fine.style.display=visa?"":"none";
    if(visa)fine.textContent=`Nästa körning tar nästa ${vardLimit} av dem som inte sökts än.`;
  }
}
/* ---------- Prissökningens status (beslut 30/10) ----------
   Körningen levde tidigare bara inuti knapptrycket: stängde man arket
   fortsatte den osynligt och resultatet landade i ett ark som inte var
   öppet. Nu finns den som ett eget tillstånd, så att remsan kan visa den i
   hela appen och arket kan visa den igen om man öppnar det. */
let vardKor=null;   /* {klara,totalt,pagar} medan den går */
let vardKlar=null;  /* {text} tills notisen stängs */
function vardKorPagar(){return !!(vardKor&&vardKor.pagar)}

function renderKorRemsa(){
  const el=document.getElementById("korRemsa");if(!el)return;
  /* Syns inte när arket är öppet - då visar arket samma förlopp några
     centimeter ovanför, och två räknare ser ut som två sökningar. */
  const arketOppet=vardSheet&&vardSheet.classList.contains("open");
  const visa=(vardKorPagar()||vardKlar)&&!arketOppet;
  el.hidden=!visa;
  document.body.classList.toggle("har-remsa",!!visa);
  if(!visa){el.innerHTML="";return}
  if(vardKorPagar()){
    const p=vardKor.totalt?Math.round(vardKor.klara/vardKor.totalt*100):0;
    el.innerHTML=`<button class="kor-remsa-yta" type="button" onclick="vardOppnaKor()">
        <span class="kor-snurra" aria-hidden="true"></span>
        <span class="kor-txt"><b>Söker priser</b><small>${vardKor.klara} av ${vardKor.totalt}</small></span>
        <span class="kor-bar"><span style="width:${p}%"></span></span>
      </button>`;
  }else{
    el.innerHTML=`<button class="kor-remsa-yta klar" type="button" onclick="vardOppnaKlar()">
        <span class="kor-ikon" aria-hidden="true">${ic("circle-check")}</span>
        <span class="kor-txt"><b>Värderingen klar</b><small>${esc(vardKlar.text)}</small></span>
      </button>
      <button class="kor-stang" type="button" aria-label="Stäng" onclick="vardStangKlar()">${ic("x")}</button>`;
  }
}
/* Tryck på remsan under körning: tillbaka till arket och förloppet. */
/* "Inte värderade än": böckerna finns inte i värderingslistan, de har
   aldrig sökts. Urvalsrutan med "Aldrig sökt" förvalt är den enda
   meningsfulla destinationen. */
function vardOppnaAldrig(){
  openVard();
  if(vardKorPagar())return;
  vardSelStatus="aldrig";
  document.querySelectorAll("#vardStatusChips .chip").forEach(c=>
    c.classList.toggle("active",c.dataset.v==="aldrig"));
  vardSyncCount();
}
function vardOppnaKor(){go("salj");openVard()}
/* Tryck på klart-notisen: till Värdera, och notisen är avklarad. */
/* Notisen tar en till LISTAN, inte startsidan: go("salj") tvingar fram
   startsidan, så stod man redan där hände ingenting alls utom att remsan
   försvann - det såg ut som att knappen var trasig (Thomas 30/10). */
function vardOppnaKlar(){vardKlar=null;renderKorRemsa();go("salj");vardVisaListan(true,"")}
function vardStangKlar(){vardKlar=null;renderKorRemsa()}

/* Skrollbar rad, valda chips flyttade först (Design 29/10 b) - så arket
   aldrig blir högt oavsett hur många kategorier biblioteket har. */
function renderVardCats(){
  const cc=document.getElementById("vardCatChips");if(!cc)return;
  const kats=[...new Set(data.map(x=>x.cat))].filter(Boolean).sort((a,b)=>a.localeCompare(b,"sv"));
  /* Ligger still i bokstavsordning. Listan sorterade tidigare om sig så
     att valda chips hoppade först - men raden skrollar i sidled, så det
     valda gled iväg åt vänster under fingret och syntes inte längre
     (Thomas 30/10). Valet visas i stället som etiketter under raden. */
  cc.innerHTML=kats.map(c=>`<button class="hs-chip${vardSelCats.has(c)?" on":""}" data-vc="${esc(c)}">${esc(c)}</button>`).join("");
  cc.querySelectorAll("[data-vc]").forEach(b=>b.addEventListener("click",()=>{
    const c=b.dataset.vc;if(vardSelCats.has(c))vardSelCats.delete(c);else vardSelCats.add(c);
    renderVardCats();vardSyncCount();
  }));
  const valda=document.getElementById("vardValdaCats");
  if(valda){
    const lista=[...vardSelCats].sort((a,b)=>a.localeCompare(b,"sv"));
    valda.hidden=!lista.length;
    valda.innerHTML=lista.length?lista.map(c=>
      `<button class="vard-tagg" type="button" data-av="${esc(c)}">${esc(c)}<span aria-hidden="true">✕</span>
        <span class="sr-only">Ta bort ${esc(c)}</span></button>`).join("")+
      `<button class="vard-rensa" type="button" id="vardRensaCats">Rensa alla</button>`:"";
    valda.querySelectorAll("[data-av]").forEach(b=>b.addEventListener("click",()=>{
      vardSelCats.delete(b.dataset.av);renderVardCats();vardSyncCount();}));
    const r=document.getElementById("vardRensaCats");
    if(r)r.addEventListener("click",()=>{vardSelCats=new Set();renderVardCats();vardSyncCount()});
  }
}
function openVard(){
  /* Pågår en sökning ska arket visa den, inte nollställa filtren och
     erbjuda en andra körning ovanpå den första (granskning 30/10). */
  if(vardKorPagar()){
    vardSheet.classList.add("open");vardScrim.classList.add("open");
    document.getElementById("vardActions").style.display="none";
    document.getElementById("vardResult").style.display="none";
    document.getElementById("vardProgress").style.display="block";
    renderKorRemsa();
    return;
  }
  vardSelStatus="";vardSelCats=new Set();vardQ2="";
  /* vardLimit nollställs INTE här (beslut 30/10) - en kostnadsinställning
     som ska gälla omgång efter omgång tills man själv ändrar den, inte ett
     filter som börjar om varje gång arket öppnas. Chipen synkas istället
     mot det värde som redan gäller. */
  document.getElementById("vardQ").value="";
  document.querySelectorAll("#vardStatusChips .chip").forEach(c=>c.classList.toggle("active",c.dataset.v===""));
  document.querySelectorAll("#vardLimitChips .chip").forEach(c=>c.classList.toggle("active",+c.dataset.vl===vardLimit));
  document.getElementById("vardProgress").style.display="none";
  document.getElementById("vardResult").style.display="none";
  document.getElementById("vardActions").style.display="flex";
  renderVardCats();vardSyncCount();
  vardSheet.classList.add("open");vardScrim.classList.add("open");
  renderKorRemsa();
}
function closeVard(){vardSheet.classList.remove("open");vardScrim.classList.remove("open");renderKorRemsa()}
document.getElementById("vardOpenBtn")?.addEventListener("click",openVard);
document.getElementById("vardBackBtn")?.addEventListener("click",()=>vardVisaListan(false));
vardScrim?.addEventListener("click",closeVard);
document.getElementById("vardCancelBtn")?.addEventListener("click",closeVard);
document.getElementById("vardResultClose")?.addEventListener("click",closeVard);
document.getElementById("vardStopBtn")?.addEventListener("click",()=>{vardAvbryt=true});
/* Lämnar sökningen utan att stoppa den - remsan tar över och flikarna
   blir åtkomliga igen (scrimen låg ovanpå flikraden). */
document.getElementById("vardBgBtn")?.addEventListener("click",closeVard);
document.querySelectorAll("#vardStatusChips .chip").forEach(c=>c.addEventListener("click",()=>{
  document.querySelectorAll("#vardStatusChips .chip").forEach(x=>x.classList.remove("active"));
  c.classList.add("active");vardSelStatus=c.dataset.v;vardSyncCount();
}));
document.getElementById("vardQ")?.addEventListener("input",e=>{vardQ2=e.target.value;vardSyncCount()});
document.querySelectorAll("#vardLimitChips .chip").forEach(c=>c.addEventListener("click",()=>{
  document.querySelectorAll("#vardLimitChips .chip").forEach(x=>x.classList.remove("active"));
  c.classList.add("active");vardLimit=+c.dataset.vl;vardSyncCount();
}));
/* Körningen går i omgångar om 25 (edge-funktionens gräns per anrop) - osynligt
   för användaren, som bara ser en gemensam förloppsrad. En redan värderad bok
   (bekräftat ELLER okontrollerat) får bara sökas om efter en bekräftelsedialog
   - där sägs också att det gamla priset sparas i Historik (Bokdetalj). */
document.getElementById("vardRunBtn")?.addEventListener("click",async()=>{
  const m=vardUrval();if(!m.length)return;
  /* Ögonblicksbild av HELA (obegränsade) filterträffen, tagen INNAN
     körningen - för "N kvar att söka" (punkt 6). Får inte räknas om efter
     körningen: de just körda böckerna har då bytt status och kan ha
     fallit ur filtret (t.ex. "Aldrig sökt"), vilket skulle göra uträkningen
     oavsiktligt korrekt för just det filtret men fel för "Alla"/"Redan
     värderad" - där inget faller ur. */
  const totalFore=vardMatches().length;
  const redan=m.filter(d=>{const it=sellForBook(d);return it&&(it.price_status==="bekraftat"||it.price_status==="automatiskt"||it.price_status==="manuellt")});
  let confirmOverwrite=false;
  if(redan.length){
    const flera=m.length>1;
    const ok=await ask({title:"Redan värderade",
      text:`${redan.length===m.length?(flera?"Böckerna":"Boken"):"Några av böckerna"} du har valt har redan fått en värdering. Det gamla priset sparas i Historik. Är du säker?`,
      buttons:[{label:"Sök om",value:true,kind:"primary"},{label:"Avbryt",value:false}]});
    if(!ok)return;
    confirmOverwrite=true;
  }
  vardAvbryt=false;
  document.getElementById("vardActions").style.display="none";
  document.getElementById("vardProgress").style.display="block";
  document.getElementById("vardResult").style.display="none";
  const ids=m.map(d=>d.id);
  /* Körningen blir ett eget tillstånd här, inte bara en slinga i den här
     funktionen: remsan och arket läser den, och verGuard i index.html
     skjuter upp en automatisk omladdning medan den pågår. */
  vardKor={klara:0,totalt:ids.length,pagar:true};
  vardKlar=null;window.__vardKorPagar=true;renderKorRemsa();
  /* Flödesrapporten 31/10, punkt 8: ingen_begagnad fanns inte som nyckel
     här (status lades till 31/10 för "sidan hittad, bara nypris finns"),
     så de böckerna försvann tyst ur både lyckade och misslyckade antal -
     resultatraden summerade inte till antalet körda böcker. */
  const antal={automatiskt:0,vantar:0,osakert:0,ingen_traff:0,ingen_begagnad:0,skippad_skyddad:0,fel:0};
  let i=0;
  for(;i<ids.length;i+=25){
    if(vardAvbryt)break;
    const chunk=ids.slice(i,i+25);
    vardKor.klara=i;renderKorRemsa();
    document.getElementById("vardProgressBar").style.width=Math.round(i/ids.length*100)+"%";
    document.getElementById("vardProgressText").textContent=`Söker … ${i} av ${ids.length}`;
    try{
      const{data:res,error}=await sb.functions.invoke("prissok",{body:{book_ids:chunk,confirm_overwrite:confirmOverwrite}});
      if(error)throw error;
      (res&&res.resultat||[]).forEach(r=>{if(r.error)antal.fel++;else if(antal[r.status]!=null)antal[r.status]++});
    }catch(e){antal.fel+=chunk.length;console.warn("prissok",e)}
  }
  /* Antal faktiskt körda - loopvariabeln kan gå om ids.length på sista
     varvet när körningen gick klart normalt (inte avbruten), så den
     klipps mot ids.length. */
  const kortCount=Math.min(i,ids.length);
  document.getElementById("vardProgressBar").style.width="100%";
  document.getElementById("vardProgress").style.display="none";
  document.getElementById("vardResult").style.display="block";
  const delar=[];
  if(antal.automatiskt)delar.push(`${antal.automatiskt} okontrollerade priser`);
  if(antal.vantar)delar.push(`${antal.vantar} väntar på kontroll`);
  if(antal.osakert)delar.push(`${antal.osakert} varierande`);
  if(antal.ingen_traff)delar.push(`${antal.ingen_traff} inget hittat`);
  if(antal.ingen_begagnad)delar.push(`${antal.ingen_begagnad} bara nypris`);
  if(antal.skippad_skyddad)delar.push(`${antal.skippad_skyddad} hoppades över`);
  if(antal.fel)delar.push(`${antal.fel} fel`);
  /* Punkt 6: hur mycket som återstår i samma filterurval, bara när
     körningen var begränsad och något faktiskt återstår. */
  const kvar=totalFore-kortCount;
  let text=(vardAvbryt?"Avbruten. ":"")+(delar.join(", ")||"Inget hann sökas.");
  if(vardLimit>0&&kvar>0)text+=` ${kvar} kvar att söka.`;
  document.getElementById("vardResultText").textContent=text;
  /* Körningen är slut: remsan byter till klart-läget och ligger kvar tills
     den stängs eller trycks på. Blockerar inget. Arket är öppet om man
     stannade kvar - då visar det resultatrutan och remsan håller sig
     dold tills arket stängs. */
  vardKor=null;window.__vardKorPagar=false;
  vardKlar={text:(delar.join(", ")||(vardAvbryt?"Avbruten":"Inget nytt"))};
  renderKorRemsa();
  await loadSell();
});

/* ---------- Luckor ---------- */
let GAPS=[],gapState={},gapFilter="open";
async function loadGaps(){
  /* Efter Fas 2.5/2.6: luckdefinitionerna bor i public.gaps. Fältet
     heter `full_img` i tabellen; mappa till `full` for att inte behova
     rora alla lucklasare i UI:t. */
  const {data:gapsRows}=await sb.from("gaps").select("*");
  GAPS=(gapsRows||[]).map(g=>({
    id:g.id, shelf:g.shelf, cap:g.cap, crop:g.crop, full:g.full_img,
    reviewed:g.reviewed, auto:g.auto, note:g.note
  }));
  const {data:statusRows}=await sb.from("gap_status").select("*");
  if(statusRows)statusRows.forEach(r=>gapState[r.gap_id]={state:r.state,photo:r.photo_path,note:r.note,claude:r.claude_note});
  updateGapCount();renderGaps();
}
function gapStateOf(id){
  if(gapState[id]&&gapState[id].state)return gapState[id].state;
  const g=GAPS.find(x=>x.id===id);
  return (g&&g.auto)||"open";
}
/* ---------- Luckflödet: en lucka i taget ---------- */
let gapCur=null,gapText={},gapCat={},gapNewCat={},gapMsg="";
const gapSkipped=new Set();
const gapOpenList=()=>GAPS.filter(g=>gapStateOf(g.id)!=="done");
function updateGapCount(){
  const total=GAPS.length,open=gapOpenList().length,solved=total-open;
  const pct=total?Math.round(solved/total*100):0;
  const set=(id,t)=>{const el=document.getElementById(id);if(el)el.textContent=t};
  set("gapCount",open+" kvar");
  set("gapCardTxt",total?(open?`${solved} av ${total} olästa partier lösta. De som är kvar behöver närbild.`:`Alla ${total} olästa partier är lösta.`):"Inga luckor inlästa.");
  set("gapSolvedTxt",`${solved} / ${total} lösta`);
  ["gapCardProg","gapProg"].forEach(id=>{const el=document.getElementById(id);if(el)el.style.width=pct+"%"});
  const dot=document.getElementById("gearDot");if(dot)dot.classList.toggle("on",open>0);
}
function shelfDefaultCat(shelf){
  const cm={};data.filter(d=>d.shelf===shelf).forEach(d=>cm[d.cat]=(cm[d.cat]||0)+1);
  const top=Object.entries(cm).sort((a,b)=>b[1]-a[1])[0];return top?top[0]:"";
}
function renderGaps(){
  updateGapCount();
  const flow=document.getElementById("gapFlow"),all=document.getElementById("gapList");
  if(!flow)return;
  const open=gapOpenList();
  let g=GAPS.find(x=>x.id===gapCur);
  if(!g){g=open.find(x=>!gapSkipped.has(x.id));gapCur=g?g.id:null}
  const msg=gapMsg?`<span class="g-ok">${esc(gapMsg)}</span>`:"";
  if(!g){
    flow.innerHTML=msg+`<div class="g-done"><b>Alla luckor är genomgångna</b>
      <span>${open.length?`${open.length} hoppade luckor ligger kvar till nästa gång.`:"Nya böcker finns nu i katalogen."}</span>
      ${open.length?`<button class="btn btn-outline btn-sm" onclick="gapRestart()">Börja om</button>`:""}</div>`;
  }else{
    const st=gapStateOf(g.id),S=gapState[g.id]||{},ph=S.photo;
    const idx=open.findIndex(x=>x.id===g.id);
    const bc=g.shelf?g.shelf.split(":")[0]:"";
    if(!(g.id in gapCat))gapCat[g.id]=shelfDefaultCat(g.shelf);
    const added=gapAdded[g.id]||[];
    const stTag=st==="waiting"?`<span class="badge b-warning">${S.claude?"Avläst – kontrollera":"Foto skickat – väntar på avläsning"}</span>`
               :st==="done"?`<span class="badge b-success">Klar</span>`:"";
    flow.innerHTML=`<div class="gap-one">
      <div class="g-title"><b>${idx>=0?`Lucka ${idx+1} av ${open.length} · `:""}${esc(g.cap||locLabel(g.shelf))}</b><span>${esc(bcNames[bc]||"")}</span></div>
      <div class="g-full"><img src="${ph||g.full||g.crop}" alt="Hela hyllfotot" onclick="lbGap('${ph||g.full||g.crop}')"></div>
      <div class="g-crop"><img src="${g.crop}" alt="Utsnitt av luckan" onclick="lbGap('${g.crop}')">
        <div class="g-note">${stTag}${g.note?`<span>${esc(g.note)}</span>`:`<span class="muted">Ryggarna här gick inte att läsa på det stora fotot. En närbild brukar räcka.</span>`}
          ${S.claude?`<span class="g-claude">Avläsning: ${esc(S.claude)}</span>`:""}</div></div>
      ${S.claude?`<div class="note-edit" id="ne-gap-${g.id}" style="display:none">
          <textarea class="note-ta" id="nt-gap-${g.id}">${esc(S.claude)}</textarea>
          <div class="gap-actions" style="margin-top:.4rem"><button onclick="saveNote('gap','${g.id}',this)">Spara ändringar</button>
          <button class="ghost" onclick="toggleNote('gap','${g.id}')">Avbryt</button></div></div>`:""}
      <div class="g-tools">
        <label class="btn btn-outline btn-sm btn-ic">${ic("camera")}Fota närbild<input type="file" accept="image/*" hidden onchange="gapUpload('${g.id}',this)"></label>
        ${ph?`<button class="btn btn-outline btn-sm" onclick="runAnalys('gap','${g.id}',this)">Läs av fotot</button>`:""}
        ${S.claude?`<button class="btn btn-ghost btn-sm" onclick="toggleNote('gap','${g.id}')">Rätta avläsningen</button>`:""}
      </div>
      <div class="analys-box" id="ab-gap-${g.id}" style="display:none"></div>
      <span class="fine">Skriv in böckerna du ser — en rad per bok.</span>
      <textarea class="g-text" id="gt-${g.id}" rows="3" placeholder="Titel – Författare">${esc(gapText[g.id]||"")}</textarea>
      <div class="g-cat"><select class="inp" id="gc-${g.id}">${catOptions(gapCat[g.id])}</select>
        <input class="inp" id="gn-${g.id}" placeholder="Ny kategoris namn" value="${esc(gapNewCat[g.id]||"")}" style="display:${gapCat[g.id]==="__new"?"":"none"}"></div>
      ${added.length?`<div class="g-added"><span class="lbl">Inskrivna här</span><ul>${added.map(b=>`<li><span>${esc(b.title)}${b.author?" – "+esc(b.author):""}</span>
          <button onclick="gapDelBook('${g.id}',${b.id})" aria-label="Ta bort">✕</button></li>`).join("")}</ul></div>`:""}
      <div class="btn-row">
        ${st==="done"?`<button class="btn btn-outline" onclick="gapSet('${g.id}','open')">Öppna igen</button><button class="btn btn-ghost" onclick="gapSkip('${g.id}')">Nästa lucka</button>`
          :`<button class="btn btn-primary" onclick="gapNext('${g.id}',this)">Spara och nästa</button><button class="btn btn-ghost" onclick="gapSkip('${g.id}')">Hoppa över</button>`}
      </div>${msg}</div>`;
    const ta=document.getElementById("gt-"+g.id),sel=document.getElementById("gc-"+g.id),nc=document.getElementById("gn-"+g.id);
    ta.addEventListener("input",()=>gapText[g.id]=ta.value);
    sel.addEventListener("change",()=>{gapCat[g.id]=sel.value;nc.style.display=sel.value==="__new"?"":"none";if(sel.value==="__new")nc.focus()});
    nc.addEventListener("input",()=>gapNewCat[g.id]=nc.value);
  }
  if(all)all.innerHTML=GAPS.map(x=>{const st=gapStateOf(x.id);
    return `<button class="ga-row" onclick="gapGo('${x.id}')"><img src="${x.crop}" alt="" loading="lazy">
      <span>${esc(x.cap||"")}<small>${esc(bcNames[(x.shelf||"").split(":")[0]]||"")}</small></span>
      <span class="badge ${st==="done"?"b-success":st==="waiting"?"b-warning":"b-brand"}" style="flex:none">${st==="done"?"Klar":st==="waiting"?"Väntar":"Kvar"}</span></button>`}).join("");
}
function gapGo(id){gapCur=id;gapMsg="";renderGaps();scrollTo({top:0,behavior:"smooth"})}
function gapSkip(id){gapSkipped.add(id);gapCur=null;gapMsg="";renderGaps();scrollTo({top:0,behavior:"smooth"})}
function gapRestart(){gapSkipped.clear();gapCur=null;gapMsg="";renderGaps()}
/* "Titel – Författare", en per rad. Tankstreck, bindestreck med mellanslag
   runt, eller " av " skiljer titel från författare. */
function parseGapLines(txt){
  return (txt||"").split("\n").map(l=>l.trim()).filter(Boolean).map(l=>{
    const m=l.split(/\s[–—-]\s|\s+av\s+/i);
    return {title:m[0].trim(),author:(m.slice(1).join(" – ")||"").trim()};
  }).filter(r=>r.title);
}
let gapSkippedN=0;
async function gapNext(id,btn){
  gapSkippedN=0;
  if(!sbUser){alert("Logga in för att spara luckor.");return}
  const g=GAPS.find(x=>x.id===id);if(!g)return;
  let cat=gapCat[id]||"";
  if(cat==="__new")cat=(gapNewCat[id]||"").trim();
  const existing=new Set((gapAdded[id]||[]).map(x=>x.title.toLowerCase()));
  const rows=parseGapLines(gapText[id]).filter(r=>!existing.has(r.title.toLowerCase()));
  if(btn){btn.disabled=true;btn.textContent="Sparar…"}
  try{
    if(rows.length){
      const res=await insertBooks(rows.map(r=>({title:r.title,author:r.author,cat:cat||"Okategoriserad",shelf:g.shelf,gap_id:id,created_by:sbUser.id})));
      gapSkippedN=res.skipped.length;
      res.inserted.forEach(r=>(gapAdded[id]=gapAdded[id]||[]).push({id:r.id,title:r.title,author:r.author||"",cat:r.cat||""}));
      rows.length=res.inserted.length;
      buildShelfOptions();rebuildCatFilter();render();
    }
    gapText[id]="";
    gapMsg=(gapSkippedN?`${gapSkippedN} fanns redan och hoppades över. `:"")+(rows.length?`${rows.length} ${rows.length>1?"böcker":"bok"} tillagd${rows.length>1?"a":""} i ${g.cap||locLabel(g.shelf)}`:"Luckan markerad som löst");
    gapCur=null;
    await gapSet(id,"done");
    scrollTo({top:0,behavior:"smooth"});
  }catch(e){
    alert("Kunde inte spara: "+(e.message||e));
    if(btn){btn.disabled=false;btn.textContent="Spara och nästa"}
  }
}
async function gapDelBook(gid,rowId){
  if(!sbUser){alert("Logga in för att ändra.");return}
  const b=(gapAdded[gid]||[]).find(x=>x.id===rowId);if(!b)return;
  if(!confirm(`Ta bort "${b.title}" ur katalogen?`))return;
  const {error}=await sb.from("manual_books").delete().eq("id",rowId);
  if(error){alert("Kunde inte ta bort: "+error.message);return}
  gapAdded[gid]=(gapAdded[gid]||[]).filter(x=>x.id!==rowId);
  const k=data.findIndex(d=>d.id===rowId);if(k>=0)data.splice(k,1);
  render();renderGaps();
}
function catOptions(sel){
  const cats=[...new Set(data.map(d=>d.cat))].sort((a,b)=>a.localeCompare(b,"sv"));
  return `<option value="">Kategori…</option>`+cats.map(c=>`<option${c===sel?" selected":""}>${c}</option>`).join("")+`<option value="__new">➕ Ny kategori…</option>`;
}
async function gapSet(id,state,photo){
  if(!sbUser){alert("Logga in för att ändra luckor.");return}
  gapState[id]={state,photo:(photo||(gapState[id]&&gapState[id].photo)),
                claude:(gapState[id]&&gapState[id].claude)};
  await sb.from("gap_status").upsert({gap_id:id,state,photo_path:gapState[id].photo||null,updated_at:new Date().toISOString(),updated_by:sbUser.id});
  updateGapCount();renderGaps();
}
function shrinkToDataURL(file,maxW,quality){
  return new Promise((res,rej)=>{
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{
      const r=Math.min(1,maxW/img.width);
      const c=document.createElement("canvas");
      c.width=Math.round(img.width*r);c.height=Math.round(img.height*r);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg",quality));
    };
    img.onerror=e=>{URL.revokeObjectURL(url);rej(e)};
    img.src=url;
  });
}
async function gapUpload(id,input){
  if(!sbUser){alert("Logga in för att ladda upp foto.");return}
  const f=input.files[0];if(!f)return;
  const libId=await myLibraryId();
  if(!libId){alert("Kunde inte slå upp ditt bibliotek. Prova ladda om sidan.");return}
  const path=`${libId}/${id}-${Date.now()}.jpg`;
  const {error}=await sb.storage.from("gap-photos").upload(path,f,{upsert:true});
  if(error){alert("Kunde inte ladda upp: "+error.message);return}
  let dataUrl=null;
  try{dataUrl=await shrinkToDataURL(f,1100,0.62)}
  catch(e){
    console.warn("nedskalning misslyckades, sparar original",e);
    try{dataUrl=await new Promise((res,rej)=>{const rd=new FileReader();rd.onload=()=>res(rd.result);rd.onerror=rej;rd.readAsDataURL(f)})}
    catch(e2){console.warn("kunde inte läsa filen",e2)}
  }
  if(!dataUrl){alert("Varning: bilden kunde inte förberedas för avläsning. Prova igen eller välj bild ur biblioteket.");}
  /* photo_path sparas numera som sökväg i den privata lagringen, inte en
     publik länk - visningen använder ändå photo_data (nedskalade kopian)
     överallt, så fältet är bara en referens till originalet. */
  gapState[id]={state:"waiting",photo:path};
  await sb.from("gap_status").upsert({gap_id:id,state:"waiting",photo_path:path,
    photo_data:dataUrl,updated_at:new Date().toISOString(),updated_by:sbUser.id});
  updateGapCount();renderGaps();
  alert("Foto skickat! Luckan står kvar i listan.\n\nJag läser av bilden och fyller i böckerna – sedan kontrollerar du dem och trycker ✓ Klar.");
}
/* ---------- Hyllkoder ur fria etiketter ---------- */
/* "Vänster plan 3" -> 1:V3 · "Plan 2" -> 1:S2 · "Skrivbordet" -> 1:L1
   Returnerar null nar etiketten inte beskriver ett hyllplan alls - da ar det
   en los plats och koden tilldelas av nextSpotCode(). */
function guessShelfCode(bc,label){
  const raw=(label||"").trim();
  if(/^\d+:[VHSKL]\d+$/i.test(raw))return raw.toUpperCase();
  const t=raw.toLowerCase();
  const num=(t.match(/(\d+)/)||[])[1];
  if(!num)return null;
  if(/v[aä]nster|^v\b/.test(t))return bc+":V"+num;
  if(/h[oö]ger|^h\b/.test(t))return bc+":H"+num;
  if(/plan|hylla|rad|niv[aå]/.test(t))return bc+":S"+num;
  if(/^\d+$/.test(t))return bc+":S"+num;
  return null;
}
/* Los plats: aterbruka koden om platsen redan har en. Utan det far
   skrivbordet en ny kod vid varje avlasning, och bockerna sprids ut. */
function spotCodeFor(bc,label){
  const lbl=(label||"").trim().toLowerCase();
  if(lbl){
    const known=Object.keys(spotNames).find(c=>
      c.startsWith(bc+":L")&&(spotNames[c]||"").trim().toLowerCase()===lbl);
    if(known)return known;
  }
  let n=1;while(spotNames[bc+":L"+n])n++;
  return bc+":L"+n;
}
function nextSpotCode(bc){return spotCodeFor(bc,"")}

/* ---------- Granska avlasta bocker ---------- */
/* Ar boken redan katalogiserad? Jamfor normaliserat pa titel + forfattare.
   OBS: taeker bade de 737 ur filen och raderna ur databasen, eftersom bada
   ligger i `data` vid det har laget. Databasens unik-regel skyddar daremot
   bara manual_books - filens bocker ar oskyddade tills Fas 2 ar klar. */
function normTitle(s){return (s||"").toLowerCase().trim().replace(/\s+/g," ")}
/* Kort namn utan undertitlar och parenteser. Anvands for att jamfora bocker
   som star med undertiteln i ena avlasningen men inte den andra, och for att
   samma bok inte ska rakans som olika bara for att en parentes lagts till.
   Bade "Kommunikation i praktiken" och "Kommunikation i praktiken – ..."
   krymper till samma strang, och "En Garde!" krymper likadant som
   "Avancerat rollspel ... – En Garde!" om vi tittar pa bada halvorna. */
function baseTitle(s){
  let t=normTitle(s).replace(/\s*\([^)]*\)\s*/g," ").replace(/\s+/g," ").trim();
  const cut=t.split(/\s[–—-]\s|:\s/)[0].trim();
  return cut.length>=4?cut:t;
}
/* Halvorna kring ett tankstreck, i normaliserad form. "En Garde! – Avancerat
   rollspel" ger ["en garde!","avancerat rollspel"]. En bok raknas som kand om
   nagon halva matchar en befintlig titel. */
function titleParts(s){
  const t=normTitle(s).replace(/\s*\([^)]*\)\s*/g," ").replace(/\s+/g," ").trim();
  return t.split(/\s[–—-]\s|:\s/).map(x=>x.trim()).filter(x=>x.length>=4);
}
/* Efternamnet ur ett forfattarnamn - "Johan Egerkrans" -> "egerkrans".
   Anvands for att tolerera att avlasningen ibland tappar sista bokstaverna
   ("Johan Egerk") eller bara ger efternamnet. */
function authorKey(s){
  const t=normTitle(s).replace(/[.,]/g,"").trim();
  if(!t)return "";
  const parts=t.split(/\s+/);
  return parts[parts.length-1];
}
/* Ar tva forfattarnamn "samma nog"? Bagge tomma -> ja (kan inte saga emot).
   En prefix pa den andra pa minst tre tecken -> ja ("egerk" mot "egerkrans").
   Annars: samma efternamn ger ja. */
function authorMatch(a,b){
  const x=normTitle(a),y=normTitle(b);
  if(!x||!y)return true;
  if(x===y)return true;
  const short=x.length<y.length?x:y, long=x.length<y.length?y:x;
  if(short.length>=3&&long.startsWith(short))return true;
  const ka=authorKey(a), kb=authorKey(b);
  return ka&&kb&&ka===kb;
}
function knownBook(title,author,shelf){
  const t=normTitle(title);
  if(!t)return null;
  const parts=titleParts(title);
  const hit=data.find(d=>{
    if(!authorMatch(d.author,author))return false;
    if(normTitle(d.title)===t)return true;
    /* Nagon del av den nya titeln ska matcha nagon del av den gamla. */
    const dp=titleParts(d.title);
    return parts.some(p=>dp.includes(p));
  });
  if(!hit)return null;
  return {sameShelf:hit.shelf===shelf, where:locLabel(hit.shelf)};
}
let analysBooks={};   /* key -> {books, shelf, spotLabel, kind, id} */

function analysKey(kind,id){return kind+"-"+id}

function renderAnalys(kind,id){
  const key=analysKey(kind,id);
  const wrap=document.getElementById("ab-"+key);
  const st=analysBooks[key];
  if(!wrap||!st)return;
  const isSpot=/:L\d+$/.test(st.shelf||"");
  const kanda=st.books.filter(b=>knownBook(b.title,b.author,st.shelf)).length;
  wrap.innerHTML=`${st.src?`<div class="ab-photo">
      <img src="${st.src}" alt="Fotot som lästes av" style="transform:rotate(${st.rot||0}deg)"
           onclick="lbGap('${st.src}')" title="Klicka för att zooma">
      <button class="ghost ab-rot" onclick="analysRotate('${kind}','${id}')">↻ Vrid</button>
    </div>`:""}<div class="ab-list"><p class="gap-help">${st.books.length} böcker avlästa. Rätta det som blivit fel, stryk det som inte är en bok, och spara. Gulmarkerade rader var osäkra.${kanda?` <b>${kanda} finns redan i katalogen</b> och är förvalt bortvalda.`:""}</p>
    <div class="ab-place">
      <label>Hyllkod <input class="ab-code" value="${(st.shelf||"").replace(/"/g,'&quot;')}" onchange="analysSetCode('${kind}','${id}',this.value)"></label>
      ${isSpot?`<label>Hyllplanets namn <input class="ab-spot" value="${(st.spotLabel||"").replace(/"/g,'&quot;')}" onchange="analysSetSpot('${kind}','${id}',this.value)" placeholder="T.ex. Skrivbordet"></label>`:""}
    </div>
    <div class="ab-rows">${st.books.map((b,i)=>{
      const known=knownBook(b.title,b.author,st.shelf);
      return `<div class="ab-row${b.uncertain?" unsure":""}${known?" known":""}">
        <label class="ab-keep" title="${b.skip?"Sparas inte":"Sparas"}">
          <input type="checkbox" ${b.skip?"":"checked"} onchange="analysKeep('${kind}','${id}',${i},this.checked)"></label>
        <input class="ab-t" value="${(b.title||"").replace(/"/g,'&quot;')}" placeholder="Titel" onchange="analysEdit('${kind}','${id}',${i},'title',this.value)">
        <input class="ab-a" value="${(b.author||"").replace(/"/g,'&quot;')}" placeholder="Författare" onchange="analysEdit('${kind}','${id}',${i},'author',this.value)">
        <select class="ab-c" onchange="analysEdit('${kind}','${id}',${i},'cat',this.value)">${catOptions(b.cat)}</select>
        <button class="ab-x" title="Stryk raden helt" onclick="analysDrop('${kind}','${id}',${i})">✕</button>
        ${known?`<span class="ab-known">Finns redan${known.sameShelf?" här":" – "+known.where}</span>`:""}
      </div>`}).join("")}</div>
    <div class="gap-actions" style="margin-top:.5rem">
      <button onclick="analysSave('${kind}','${id}',this)">💾 Lägg in ${st.books.filter(b=>!b.skip&&(b.title||"").trim()).length} böcker</button>
      <button class="ghost" onclick="analysClose('${kind}','${id}')">Avbryt</button>
    </div></div>`;
  wrap.style.display="";
}
function analysEdit(kind,id,i,field,v){
  const st=analysBooks[analysKey(kind,id)];if(!st)return;
  st.books[i][field]=v;
  if(field==="title"||field==="author"){
    st.books[i].uncertain=false;
    /* En rattad titel kan gora en okand bok kand, eller tvartom. */
    st.books[i].skip=!!knownBook(st.books[i].title,st.books[i].author,st.shelf);
    renderAnalys(kind,id);
  }
}
function analysRotate(kind,id){
  const st=analysBooks[analysKey(kind,id)];if(!st)return;
  st.rot=((st.rot||0)+90)%360;renderAnalys(kind,id);
}
function analysKeep(kind,id,i,checked){
  const st=analysBooks[analysKey(kind,id)];if(!st)return;
  st.books[i].skip=!checked;renderAnalys(kind,id);
}
function analysDrop(kind,id,i){
  const st=analysBooks[analysKey(kind,id)];if(!st)return;
  st.books.splice(i,1);renderAnalys(kind,id);
}
function analysSetCode(kind,id,v){
  const st=analysBooks[analysKey(kind,id)];if(!st)return;
  st.shelf=(v||"").trim().toUpperCase();renderAnalys(kind,id);
}
function analysSetSpot(kind,id,v){
  const st=analysBooks[analysKey(kind,id)];if(!st)return;
  st.spotLabel=(v||"").trim();
}
function analysClose(kind,id){
  const w=document.getElementById("ab-"+analysKey(kind,id));
  if(w){w.style.display="none"}
}
/* Lägg in böcker utan att en enda dubblett fäller hela sparningen.
   Databasen tillåter samma titel + författare bara en gång per hyllkod
   (manual_books_unik_bok, normaliserat på gemener och trimmad text).
   Vi sorterar bort sådana rader i förväg, och skulle någon ändå slinka
   igenom sparar vi rad för rad och hoppar över just den. */
const bookKey=(t,a,sh)=>[(t||"").trim().toLowerCase(),(a||"").trim().toLowerCase(),sh||""].join("|");
async function insertBooks(payload){
  const have=new Set(data.filter(d=>d.shelf).map(d=>bookKey(d.title,d.author,d.shelf)));
  const fresh=[],skipped=[];
  payload.forEach(r=>{const k=bookKey(r.title,r.author,r.shelf);
    if(have.has(k)){skipped.push(r.title)}else{have.add(k);fresh.push(r)}});
  let inserted=[];
  if(fresh.length){
    const {data:ins,error}=await sb.from("manual_books").insert(fresh).select();
    if(!error)inserted=ins||[];
    else if(error.code==="23505"||/unik_bok|duplicate key/i.test(error.message||"")){
      for(const r of fresh){
        const {data:one,error:e1}=await sb.from("manual_books").insert(r).select();
        if(!e1)inserted=inserted.concat(one||[]);
        else if(e1.code==="23505"||/unik_bok|duplicate key/i.test(e1.message||""))skipped.push(r.title);
        else throw e1;
      }
    }else throw error;
  }
  inserted.forEach(r=>{
    data.push({id:r.id,title:r.title,author:r.author||"",cat:r.cat||"Okategoriserad",
               shelf:r.shelf,status:"hylla",lentTo:"",ts:null});
    if(r.description)BOOK_INFO[r.title]=r.description;
  });
  return {inserted,skipped};
}
const skippedTxt=sk=>sk.length?` ${sk.length} fanns redan i katalogen och hoppades över.`:"";
async function analysSave(kind,id,btn){
  const key=analysKey(kind,id),st=analysBooks[key];
  if(!st)return;
  if(!sbUser){alert("Logga in för att spara.");return}
  const shelf=(st.shelf||"").trim().toUpperCase();
  if(!/^\d+:[VHSKL]\d+$/.test(shelf)){
    alert("Hyllkoden ser inte rätt ut. Den ska se ut som 10:S3, 1:V2 eller 10:L1.");return;
  }
  const rows=st.books.filter(b=>!b.skip&&(b.title||"").trim());
  if(!rows.length){alert("Inga böcker är valda att läggas in.");return}
  const label=btn?btn.textContent:null;
  if(btn){btn.disabled=true;btn.textContent="Sparar…"}
  try{
    if(/:L\d+$/.test(shelf)&&st.spotLabel){
      await sb.from("spot_names").upsert({code:shelf,name:st.spotLabel});
      spotNames[shelf]=st.spotLabel;
    }
    const payload=rows.map(b=>({
      title:(b.title||"").trim(), author:(b.author||"").trim(),
      cat:(b.cat||"Okategoriserad"), shelf,
      description:(b.description||"").trim()||null,
      source:"claude", uncertain:!!b.uncertain, created_by:sbUser.id}));
    const {inserted:ins,skipped}=await insertBooks(payload);
    delete analysBooks[key];
    analysClose(kind,id);
    buildShelfOptions();rebuildCatFilter();render();
    if(kind==="gap")renderGaps();else await loadNewShelves();
    /* Uppmana bara till klarmarkering om hyllplanet inte redan är klart -
       ett klart hyllplan har ingen Klar-knapp, och då blir uppmaningen förvirrande. */
    const nsRow=kind==="shelf"?(window.__nsRows||[]).find(x=>String(x.id)===String(id)):null;
    const tail=kind!=="shelf"?"\n\nKontrollera dem i boklistan."
      :(nsRow&&nsRow.state==="done")?"\n\nHyllplanet är redan klarmarkerat, så du behöver inte göra något mer."
      :"\n\nKontrollera dem i boklistan och tryck Klar på hyllplanet när du är nöjd.";
    alert(`${ins.length} ${ins.length===1?"bok":"böcker"} inlagda på ${locLabel(shelf)}.${skippedTxt(skipped)}${tail}`);
  }catch(e){
    alert("Kunde inte spara: "+(e.message||e));
    if(btn){btn.disabled=false;btn.textContent=label}
  }
}

/* ---------- Analysera foto med Claude (edge function) ---------- */
const ANALYS_URL=SB_URL.replace(".supabase.co",".functions.supabase.co")+"/analysera";
/* opts.silent: körs utan att själv larma vid fel eller öppna granskningen
   vid lyckad avläsning - används av den automatiska analysen efter
   nsFinish() (se nsRunAnalysisBatch), som vill samla ihop resultaten för
   alla uppladdade foton innan nåt visas. Returnerar {ok, titles, error}
   så den som anropar tyst kan räkna böcker och lista titlar själv. */
async function runAnalys(kind,id,btn,opts){
  const silent=!!(opts&&opts.silent);
  if(!sbUser){if(!silent)alert("Logga in för att analysera.");return{ok:false,titles:[],error:"ej inloggad"}}
  const label=btn?btn.textContent:null;
  if(btn){btn.disabled=true;btn.textContent="🤖 Läser av…"}
  try{
    const {data:{session}}=await sb.auth.getSession();
    if(!session)throw new Error("Sessionen har gått ut – logga in igen.");
    const cats=[...new Set(data.map(d=>d.cat))].sort((a,b)=>a.localeCompare(b,"sv"));
    const res=await fetch(ANALYS_URL,{method:"POST",
      headers:{Authorization:"Bearer "+session.access_token,"content-type":"application/json"},
      body:JSON.stringify({kind,id:String(id),cats})});
    const out=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(out.error||("Analysen misslyckades ("+res.status+")"));
    /* Bockerna ar ett forslag. De sparas inte forran du granskat dem. */
    if(out.books&&out.books.length){
      const g=(kind==="gap")?GAPS.find(x=>x.id===id):null;
      const row=(kind==="shelf")?(window.__nsRows||[]).find(x=>String(x.id)===String(id)):null;
      const bc=g&&g.shelf?g.shelf.split(":")[0]:(row?row.bc:null);
      let shelf=g&&g.shelf?g.shelf:(row?(guessShelfCode(row.bc,row.shelf_code||row.label)):null);
      let spotLabel="";
      if(!shelf&&bc){
        spotLabel=(row&&row.label)||"";
        shelf=spotCodeFor(bc,spotLabel);
      }
      /* Bocker som redan star i katalogen valjs bort direkt - du far bocka i
         dem sjalv om du verkligen vill ha en till. */
      out.books.forEach(b=>{b.skip=!!knownBook(b.title,b.author,shelf||"")});
      /* Fotot foljer med sa att granskningen kan visa bild och lista bredvid
         varandra - utan bilden gar listan inte att kontrollera. */
      const src=(kind==="gap")
        ? ((gapState[id]&&gapState[id].photo)||(g&&(g.full||g.crop))||null)
        : (row?(row.photo_data||row.photo_url):null);
      analysBooks[analysKey(kind,id)]={books:out.books,shelf:shelf||"",spotLabel,kind,id,src,rot:0};
    }
    if(kind==="gap"){
      gapState[id]={state:"waiting",photo:(gapState[id]&&gapState[id].photo),claude:out.note};
      updateGapCount();renderGaps();
    }else{
      await loadNewShelves();
    }
    const titles=(out.books||[]).map(b=>b.title).filter(Boolean);
    if(!silent&&analysBooks[analysKey(kind,id)]){
      if(kind==="shelf")psOpen("analys",id);else renderAnalys(kind,id);
    }
    return{ok:true,titles,error:null};
  }catch(e){
    const msg=e.message||String(e);
    if(!silent)alert("Kunde inte analysera: "+msg);
    if(btn){btn.disabled=false;btn.textContent=label}
    return{ok:false,titles:[],error:msg};
  }
}
function toggleNote(kind,id){
  const box=document.getElementById("ne-"+kind+"-"+id);if(!box)return;
  box.style.display = box.style.display==="none" ? "" : "none";
}
async function saveNote(kind,id,btn){
  if(!sbUser){alert("Logga in för att spara.");return}
  const ta=document.getElementById("nt-"+kind+"-"+id);if(!ta)return;
  const text=ta.value.trim();
  const label=btn?btn.textContent:null;
  if(btn){btn.disabled=true;btn.textContent="Sparar…"}
  try{
    if(kind==="gap"){
      const {error}=await sb.from("gap_status")
        .upsert({gap_id:id,claude_note:text,updated_at:new Date().toISOString(),updated_by:sbUser.id});
      if(error)throw error;
      gapState[id]=Object.assign({},gapState[id],{claude:text});
      renderGaps();
    }else{
      const {error}=await sb.from("new_shelves").update({claude_note:text}).eq("id",Number(id));
      if(error)throw error;
      await loadNewShelves();
    }
  }catch(e){
    alert("Kunde inte spara: "+(e.message||e));
    if(btn){btn.disabled=false;btn.textContent=label}
  }
}
let gapAdded={};
/* books_public togs bort i PR 2 (läckte, och kunde skrivas till av vem som
   helst med anon-nyckeln). Den här funktionen anropas numera bara inifrån
   if(sbUser)-blocket längre ner i filen - utloggade användare fastnar på
   inloggningsskärmen och anropet görs aldrig för dem. */
async function loadManualBooks(){
  /* 30/10: hela boklistan kunde bli tom ("0 böcker", Värdera 0/0) fast
     databasen hade alla 800. Vid uppstarten förnyar Supabase-klienten
     inloggningstoken, och den här frågan gick iväg samtidigt med den gamla,
     utgångna token och fick 401. Felet lästes aldrig, så appen tolkade det
     som ett tomt bibliotek - utan försök nummer två och utan någon notis
     (hyllorna och bilderna kommer ur andra frågor som gick igenom).
     Nu: läs felet, förnya sessionen och försök igen (högst tre gånger),
     och säg till om det ändå inte går i stället för att visa nollor. */
  let rows=null,error=null;
  for(let f=0;f<3;f++){
    ({data:rows,error}=await sb.from("manual_books").select("*"));
    if(!error)break;
    console.warn("manual_books försök "+(f+1),error);
    await new Promise(r=>setTimeout(r,600));
    try{
      if(f===0&&sb.auth.getSession)await sb.auth.getSession();
      else if(sb.auth.refreshSession)await sb.auth.refreshSession();
    }catch(e){console.warn("förnya session",e)}
  }
  if(error){toast("Kunde inte läsa in böckerna just nu. Ladda om appen.");return}
  if(rows)rows.forEach(r=>{
    /* Bokens id är manual_books.id rakt av. Den gamla förskjutningen med en
       miljon (från tiden då böckerna låg i en fil) gör att databasens regler
       avvisar statusändringar: de kräver att book_id finns i manual_books. */
    data.push({id:r.id,title:r.title,author:r.author||"",cat:r.cat||"Okategoriserad",shelf:r.shelf,status:"hylla",lentTo:"",ts:null});
    if(r.description&&!BOOK_INFO[r.title])BOOK_INFO[r.title]=r.description;
    if(r.gap_id){(gapAdded[r.gap_id]=gapAdded[r.gap_id]||[]).push({id:r.id,title:r.title,author:r.author||"",cat:r.cat||""})}
  });
}
document.getElementById("openGaps").addEventListener("click",()=>{gapCur=null;gapMsg="";go("gaps")});
function lbSrc(src,cap){window.lbGap(src);lbCap.textContent=cap||""}
window.showPhoto=showPhoto;
window.lbGap=(src)=>{lb.classList.add("open");document.body.style.overflow="hidden";markFrac=null;scale=1;tx=0;ty=0;lbImg.style.transform="none";lbImg.src=src;lbCap.textContent="Lucka – scrolla för att zooma, dra för att flytta";lbImg.onload=()=>{measureBase();applyT()}};

/* ---------- Kategoriredigering ---------- */
let catRenames={};
async function loadCatEdits(){
  const [{data:rn},{data:bc}]=await Promise.all([
    sb.from("cat_renames").select("*"), sb.from("book_cat").select("*")]);
  if(rn)rn.forEach(r=>catRenames[r.old_name]=r.new_name);
  data.forEach(d=>{if(catRenames[d.cat])d.cat=catRenames[d.cat]});
  if(bc){const m={};bc.forEach(r=>m[r.book_id]=r.cat);
    data.forEach(d=>{if(m[d.id])d.cat=m[d.id]})}
  rebuildCatFilter();render();renderCatEditor();
}
function rebuildCatFilter(){
  const sel=$("#fCat"),cur=sel.value;
  sel.innerHTML='<option value="">Alla kategorier</option>'+
    [...new Set(data.map(d=>d.cat))].sort((a,b)=>a.localeCompare(b,"sv")).map(c=>`<option>${c}</option>`).join("");
  sel.value=cur;
}
function renderCatEditor(){
  const el=document.getElementById("catEditor");if(!el)return;
  const counts={};data.forEach(d=>counts[d.cat]=(counts[d.cat]||0)+1);
  const cats=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
  el.innerHTML=`<div class="cat-list">`+cats.map(c=>
    `<div class="cat-row"><input value="${c.replace(/"/g,'&quot;')}" data-old="${c.replace(/"/g,'&quot;')}"><span class="cat-n">${counts[c]}</span></div>`).join("")+`</div>`;
  el.querySelectorAll(".cat-row input").forEach(inp=>{
    inp.addEventListener("keydown",e=>{if(e.key==="Enter")inp.blur()});
    inp.addEventListener("blur",async()=>{
      const oldN=inp.dataset.old,newN=inp.value.trim();
      if(!newN||newN===oldN){inp.value=oldN;return}
      if(!sbUser){alert("Logga in för att ändra kategorier.");inp.value=oldN;return}
      data.forEach(d=>{if(d.cat===oldN)d.cat=newN});
      catRenames[oldN]=newN;
      await sb.from("cat_renames").upsert({old_name:oldN,new_name:newN,updated_at:new Date().toISOString()});
      rebuildCatFilter();render();renderCatEditor();
    })});
}
async function setBookCat(id,cat){
  if(!sbUser){alert("Logga in för att ändra kategori.");return}
  const d=data.find(x=>x.id===id);if(!d)return;
  d.cat=cat;
  await sb.from("book_cat").upsert({book_id:id,cat,updated_at:new Date().toISOString()});
  rebuildCatFilter();render();renderCatEditor();
}

/* ---------- Bokomslag ---------- */
let coverCache={};
try{coverCache=JSON.parse(localStorage.getItem("bokhyllan-covers")||"{}")}catch(e){}
let coverOverrides={};
async function loadCoverOverrides(){
  const {data:rows}=await sb.from("book_cover").select("*");
  if(rows)rows.forEach(r=>coverOverrides[r.book_id]=r.url);
}
async function findCover(d){
  /* coverOverrides sparar en sökväg i den privata lagringen (inte en
     publik länk) sedan "bildlagring-privat" - hämta en tidsbegränsad
     signerad länk varje gång, i stället för att spara den (den hade gått
     ut nästa gång man öppnade bokinfo). */
  if(coverOverrides[d.id]){
    const url=await signedPhotoUrl(coverOverrides[d.id],3600);
    if(url)return url;
  }
  const key=d.title+"|"+(d.author||"");
  if(key in coverCache)return coverCache[key];
  try{
    const q=encodeURIComponent(d.title+(d.author?" "+d.author:""));
    const r=await fetch(`https://openlibrary.org/search.json?q=${q}&limit=1&fields=cover_i`);
    const js=await r.json();
    const ci=js.docs&&js.docs[0]&&js.docs[0].cover_i;
    const url=ci?`https://covers.openlibrary.org/b/id/${ci}-M.jpg`:null;
    coverCache[key]=url;
    try{localStorage.setItem("bokhyllan-covers",JSON.stringify(coverCache))}catch(e){}
    return url;
  }catch(e){return null}
}
async function uploadCover(id,input){
  if(!sbUser){alert("Logga in för att ladda upp omslag.");return}
  const f=input.files[0];if(!f)return;
  const libId=await myLibraryId();
  if(!libId){alert("Kunde inte slå upp ditt bibliotek. Prova ladda om sidan.");return}
  const path=`${libId}/cover-${id}-${Date.now()}.jpg`;
  const {error}=await sb.storage.from("gap-photos").upload(path,f,{upsert:true});
  if(error){alert("Kunde inte ladda upp: "+error.message);return}
  coverOverrides[id]=path;
  await sb.from("book_cover").upsert({book_id:id,url:path});
  const slot=document.getElementById("ibCover");
  const shown=await signedPhotoUrl(path,3600);
  if(slot&&shown)slot.innerHTML=`<img src="${shown}" alt="Omslag">`;
}


/* ---------- Ny hylla (guide) ---------- */
let nsState=null;

function nextFreeBc(){
  const used=new Set([...Object.keys(bcNames),...data.map(d=>d.shelf.split(":")[0])].map(Number).filter(n=>!isNaN(n)));
  let n=1; while(used.has(n)) n++; return String(n);
}
function nsRender(){
  const el=document.getElementById("nsWizard");const cam=document.getElementById("nsCam");
  if(!el||!cam)return;
  if(!nsState){el.innerHTML="";el.classList.remove("open");cam.style.display="none";cam.innerHTML="";return}
  if(nsState.step===4){el.classList.remove("open");el.innerHTML="";cam.style.display="";nsRenderCam();return}
  cam.style.display="none";cam.innerHTML="";
  el.classList.add("open");
  const S=nsState;
  let html=`<div class="ns-head"><strong>${S.mode==="new"?"Ny hylla":"Nytt foto"}</strong>
    <button class="ns-x" onclick="nsCancel()">✕</button></div>`;

  if(S.step===1){
    html+=`<p class="ns-q">Vad vill du göra?</p>
      <div class="ns-choices">
        <button onclick="nsPick('new')">🆕 Lägg till en ny hylla<small>En bokhylla eller ett rum som inte finns i appen</small></button>
        <button onclick="nsPick('update')">🔄 Nytt foto av ett hyllplan som finns<small>Hyllplanet har ändrats sedan sist</small></button>
      </div>`;
  }
  else if(S.step===2&&S.mode==="new"){
    html+=`<p class="ns-q">Vad heter hyllan?</p>
      <input id="nsNameInp" class="ns-inp" placeholder="T.ex. Arbetsrummet" value="${(S.name||"").replace(/"/g,'&quot;')}">
      <p class="ns-hint">Får hyllnummer <strong>${S.bc}</strong> — används i hyllplankoderna, t.ex. <code>${S.bc}:V3</code>.</p>
      <div class="ns-nav"><button class="ghost" onclick="nsBack()">← Tillbaka</button>
        <button onclick="nsSaveName()">Nästa →</button></div>`;
  }
  else if(S.step===2&&S.mode==="update"){
    const places=Object.keys(bcNames).filter(b=>!bcHidden.has(b)).sort((a,b)=>Number(a)-Number(b));
    html+=`<p class="ns-q">Vilket hyllplan gäller det?</p>
      <select id="nsBcSel" class="ns-inp">${places.map(b=>`<option value="${b}">${bcParent[b]?esc(bcNames[topBc(b)]+" · "+shortName(b)):esc(bcNames[b])}</option>`).join("")}</select>
      <input id="nsCodeInp" class="ns-inp" placeholder="Hyllkod, t.ex. 1:V3 (valfritt)">
      <p class="ns-hint">Plan räknas nedifrån. Lämnar du koden tom listar jag ut den från fotot.</p>
      <div class="ns-nav"><button class="ghost" onclick="nsBack()">← Tillbaka</button>
        <button onclick="nsPickExisting()">Nästa →</button></div>`;
  }
  else if(S.step===3){
    html+=`<p class="ns-q">Hur är ${S.name} uppbyggd?</p>
      <div class="ns-choices">
        <button onclick="nsType('VH')">📚 Sektioner + hyllplan<small>Som Bokhylla 1–2: vänster och höger sektion, flera plan. Koder som <code>${S.bc}:V3</code></small></button>
        <button onclick="nsType('S')">🗄 Enkla hyllplan<small>Som Bokskåpet: bara hyllplan utan sektioner. Koder som <code>${S.bc}:S1</code></small></button>
      </div>
      <div class="ns-nav"><button class="ghost" onclick="nsBack()">← Tillbaka</button></div>`;
  }
  el.innerHTML=html;
}
/* Fotosteget (steg 4) — eget mörkt helskärmsläge enligt designöverlämningen
   2026-10-27 ("Fota hel hylla"): svart sökare med hörnmarkörer, två matchande
   runda knappar i huvudet (bakåt, info), gallerikapp till vänster om
   avtryckaren, numrerad miniatyrrad "Tagna foton" (max 10) och en bock för
   foton som innehåller flera hyllplan.

   Bocken (S.multi) ändrar ingenting i det här steget — den märker bara varje
   nytt foto med shot.multi, så att uppdelningssteget (gränser → klipp) kan
   köra dem i tur och ordning efter "Skicka". Beslut 27/10: fotandet ska
   aldrig avbrytas mitt i, därför sker justeringen efteråt och inte direkt
   efter avtryck. Är bocken av gäller dagens flöde oförändrat: 1 foto = 1
   hyllplan, hur många foton som helst i följd. */
const NS_TIPS_KEY="bokhyllan-camtips-dold";
const NS_MAX_SHOTS=10;
function nsTipsHidden(){try{return localStorage.getItem(NS_TIPS_KEY)==="1"}catch(e){return false}}
function nsRenderCam(){
  const cam=document.getElementById("nsCam");if(!cam)return;
  const S=nsState;
  const n=S.shots.filter(s=>s.dataUrl).length;
  const full=S.shots.length>=NS_MAX_SHOTS;
  if(S.tips===undefined)S.tips=!nsTipsHidden();
  cam.innerHTML=`
    <div class="ns-cam-bar">
      <button class="ns-cam-rnd" onclick="nsBack()" aria-label="Tillbaka">${ic("chevron-left")}</button>
      <button class="ns-cam-rnd" onclick="nsToggleTips()" aria-label="Så går det till">${ic("info")}</button>
    </div>
    <div class="ns-cam-stage">
      <div class="ns-cam-finder" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <p class="ns-cam-aim">Rikta kameran mot hyllan</p>
    </div>
    <div class="ns-cam-foot">
      ${S.shots.length?`<div class="ns-cam-strip" id="nsShots"></div>`:""}
      ${full?`<p class="ns-cam-hint">Fler foton får inte plats — skicka de ${NS_MAX_SHOTS} du tagit först.</p>`:""}
      <div class="ns-cam-row">
        <label class="ns-cam-mini${full?" off":""}" aria-label="Hämta bild från biblioteket">
          ${ic("image")}<em>Bibliotek</em>
          <input type="file" accept="image/*" ${full?"disabled":""} style="display:none" onchange="nsCamShot(this)"></label>
        <label class="ns-cam-shot${full?" off":""}" aria-label="Ta foto">${ic("camera")}
          <input type="file" accept="image/*" capture="environment" ${full?"disabled":""} style="display:none" onchange="nsCamShot(this)"></label>
        <button class="ns-cam-mini${S.multi?" on":""}" aria-pressed="${S.multi?"true":"false"}"
                onclick="nsToggleMulti(${S.multi?"false":"true"})" aria-label="Flera hyllplan på bilden">
          ${ic("align-justify")}<em>Flera plan</em></button>
      </div>
      ${n?`<button class="btn btn-primary ns-cam-send" onclick="nsFinish()">Skicka · ${n} foto${n>1?"n":""}</button>`:""}
      ${!sbUser?`<button class="ns-cam-login" onclick="nsTillInloggning()">Har du redan ett konto? Logga in</button>`:""}
    </div>
    ${S.tips?`<div class="ns-cam-sheet-scrim" onclick="nsCloseTips()"></div>
    <div class="ns-cam-sheet">
      <span class="grip"></span>
      <h3>Så går det till</h3>
      <ol class="ns-cam-steps">
        <li><b>Fota ett hyllplan i taget.</b> En trave eller en lös bok räknas också.</li>
        <li><b>Flera plan på samma bild?</b> Slå på <i>Flera plan</i> innan du fotar.</li>
        <li><b>Skicka när du är klar.</b> Appen läser av böckerna och du får granska.</li>
      </ol>
      <label class="ns-cam-again"><input type="checkbox" id="nsTipsNever"> Visa inte igen</label>
      <button class="btn btn-primary" onclick="nsCloseTips()">Jag fattar</button>
    </div>`:""}`;
  nsRenderShots();
}
function nsToggleTips(){nsState.tips=!nsState.tips;nsRenderCam()}
function nsCloseTips(){
  const never=document.getElementById("nsTipsNever");
  if(never&&never.checked){try{localStorage.setItem(NS_TIPS_KEY,"1")}catch(e){}}
  nsState.tips=false;nsRenderCam();
}
function nsToggleMulti(v){nsState.multi=!!v;nsRenderCam()}
async function nsCamShot(input){
  const file=input.files&&input.files[0];if(!file)return;
  input.value="";
  if(nsState.shots.length>=NS_MAX_SHOTS){nsRenderCam();return}
  const shot={label:nsState.shots.length?"":(nsState.defLabel||""),dataUrl:null,file,multi:!!nsState.multi};
  nsState.shots.push(shot);
  try{shot.dataUrl=await shrinkToDataURL(file,1100,0.62)}
  catch(e){
    try{shot.dataUrl=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
    catch(e2){alert("Kunde inte läsa bilden. Prova en annan.");nsState.shots.pop();nsRenderCam();return}
  }
  nsRenderCam();
  /* Sparas vid varje foto, inte bara när man backar eller går till
     inloggningen - stänger man appen rakt av finns ingen händelse att
     haka på, och då ska fotona ändå finnas kvar nästa gång (B3). */
  nsSparaFoton(nsState.shots);
}
/* Miniatyrraden: numrerad, horisontellt scrollbar. Ritas bara när det finns
   minst ett foto - nsRenderCam() bygger om hela foten, så den här
   funktionen gör inget om raden inte finns just nu. */
function nsRenderShots(){
  const wrap=document.getElementById("nsShots");if(!wrap)return;
  const S=nsState;
  wrap.innerHTML=S.shots.map((s,i)=>`
    <div class="ns-shot${s.dataUrl?" has":""}">
      <div class="ns-thumb">
        ${s.dataUrl?`<img src="${s.dataUrl}" alt="">`:`<span>📷</span>`}
        <span class="ns-num">${i+1}</span>
        ${s.multi?`<span class="ns-multi" title="Flera hyllplan">${ic("align-justify")}</span>`:""}
        <button class="ns-x" onclick="nsDelShot(${i})">✕</button>
      </div>
      <input class="ns-lbl" placeholder="${S.type==="VH"?"T.ex. Vänster plan 3":"T.ex. Hyllplan 2"}"
             value="${(s.label||"").replace(/"/g,'&quot;')}" onchange="nsShotLabel(${i},this.value)">
    </div>`).join("");
  const n=S.shots.filter(s=>s.dataUrl).length;
  const c=document.getElementById("nsCount");
  if(c)c.textContent=n?`(${n} foto${n>1?"n":""})`:"";
}
/* ---------- Tagna foton som överlever ett avbrott (B3, beslut 27/10) ----------
   Backar man ut ur guiden, går till inloggningen mitt i, eller stänger
   appen helt innan fotona skickats - då ska de ligga kvar till nästa
   gång, med frågan "Fortsätt med de N foton du tog?".

   IndexedDB, inte localStorage: tio nedskalade foton är flera megabyte
   och localStorage tar slut vid ~5 MB, delat med profilbilden som redan
   har en "kunde inte spara"-varning. Originalfilen sparas inte - bara den
   nedskalade kopian, som sedan får bli både analysunderlag och
   lagringsbild. Accepterat 27/10: alternativet vore att slänga fotona. */
const NS_FOTO_DB="bokhyllan-foton",NS_FOTO_STORE="shots";
function nsFotoDb(){
  return new Promise((res,rej)=>{
    if(!window.indexedDB){rej(new Error("ingen indexedDB"));return}
    const r=indexedDB.open(NS_FOTO_DB,1);
    r.onupgradeneeded=()=>{const db=r.result;
      if(!db.objectStoreNames.contains(NS_FOTO_STORE))db.createObjectStore(NS_FOTO_STORE)};
    r.onsuccess=()=>res(r.result);
    r.onerror=()=>rej(r.error);
  });
}
async function nsSparaFoton(shots){
  const spara=(shots||[]).filter(s=>s.dataUrl)
    .map(s=>({dataUrl:s.dataUrl,label:s.label||"",multi:!!s.multi}));
  try{
    const db=await nsFotoDb();
    await new Promise((res,rej)=>{
      const t=db.transaction(NS_FOTO_STORE,"readwrite");
      const st=t.objectStore(NS_FOTO_STORE);
      if(spara.length)st.put(spara,"pagaende");else st.delete("pagaende");
      t.oncomplete=res;t.onerror=()=>rej(t.error);
    });
    db.close();
  }catch(e){console.warn("kunde inte spara foton lokalt",e)}
}
async function nsHamtaFoton(){
  try{
    const db=await nsFotoDb();
    const rader=await new Promise((res,rej)=>{
      const t=db.transaction(NS_FOTO_STORE,"readonly");
      const q=t.objectStore(NS_FOTO_STORE).get("pagaende");
      q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error);
    });
    db.close();
    return Array.isArray(rader)?rader:[];
  }catch(e){console.warn("kunde inte läsa sparade foton",e);return[]}
}
async function nsRensaFoton(){try{await nsSparaFoton([])}catch(e){}}
/* Återskapar en fil ur den nedskalade kopian, så uppladdningen har något
   att lägga i lagringen. Originalet finns inte kvar - se kommentaren ovan. */
function nsFilFranDataUrl(dataUrl,namn){
  try{
    const m=/^data:(image\/[a-z+]+);base64,(.+)$/.exec(dataUrl);
    if(!m)return null;
    const bin=atob(m[2]);
    const buf=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
    return new File([buf],namn,{type:m[1]});
  }catch(e){return null}
}
/* Frågar om sparade foton ska återupptas. Ja lägger dem i kamerasteget,
   Nej slänger dem. Körs när guiden öppnas - efter inloggning, efter en
   back, eller när appen startas om. */
async function nsFragaSparade(){
  if(!nsState||nsState.shots.length)return;
  const sparade=await nsHamtaFoton();
  if(!sparade.length)return;
  const n=sparade.length;
  const svar=await ask({
    title:`Fortsätt med de ${n} foto${n>1?"n":""} du tog?`,
    text:"De ligger kvar sedan sist och är inte skickade än.",
    buttons:[{label:"Ja, fortsätt",value:"ja",kind:"primary"},{label:"Nej, släng",value:"nej"}]
  });
  /* Bara ett uttryckligt svar avgör fotonas öde. Stänger man dialogen
     genom att trycka utanför (ask() ger false) ligger de kvar och frågan
     kommer igen - att slänga någons foton på ett oavsiktligt tryck vore
     fel väg att gissa. */
  if(svar==="ja"){
    nsState.shots=sparade.map((s,i)=>({
      label:s.label||"",dataUrl:s.dataUrl,multi:!!s.multi,
      file:nsFilFranDataUrl(s.dataUrl,`hyllplan-${i+1}.jpg`)
    })).filter(s=>s.file);
    await nsRensaFoton();
  }else if(svar==="nej"){
    await nsRensaFoton();
  }
  nsRender();
}
/* Byte till inloggningen mitt i guiden: fotona sparas lokalt först, så de
   kan erbjudas igen efter lyckad inloggning (B3). */
async function nsTillInloggning(){
  if(nsState&&nsState.shots&&nsState.shots.length)await nsSparaFoton(nsState.shots);
  showLoginScreen();
}
function nsStartWizard(){nsState={step:1,mode:null,shots:[],bc:nextFreeBc(),origin:"hyllor"};nsRender();
  document.getElementById("nsWizard").scrollIntoView({behavior:"smooth",block:"nearest"})}
function nsCancel(){nsState=null;nsRender()}
/* Ett steg bakåt i guiden (B1). Den som kom in via "Kom igång" på
   startsidan hoppade direkt till kamerasteget och har aldrig sett
   stegen före - för henne leder bakåt ut till startsidan, inte in i
   Inställningar > Hyllor där kameraytan råkar bo. */
function nsBack(){
  if(!nsState)return;
  if(nsState.step===4&&nsState.origin==="hem"){nsLamnaGuiden();return}
  if(nsState.step===4&&nsState.mode==="update")nsState.step=2;
  else nsState.step=Math.max(1,nsState.step-1);
  nsRender();
}
/* Lämnar guiden och går till startsidan. Tagna foton sparas lokalt så de
   finns kvar nästa gång guiden öppnas (B3). */
async function nsLamnaGuiden(){
  if(nsState&&nsState.shots&&nsState.shots.length)await nsSparaFoton(nsState.shots);
  nsState=null;nsRender();
  go("hem");
}
function nsPick(mode){nsState.mode=mode;nsState.step=2;nsRender()}
function nsSaveName(){
  const v=(document.getElementById("nsNameInp").value||"").trim();
  if(!v){alert("Skriv ett namn på hyllan.");return}
  nsState.name=v;nsState.step=3;nsRender();
}
function nsPickExisting(){
  const bc=document.getElementById("nsBcSel").value;
  const code=(document.getElementById("nsCodeInp").value||"").trim();
  nsState.bc=bc;nsState.name=bcNames[bc];nsState.code=code;
  nsState.type=code&&/^\d+:[VH]/.test(code)?"VH":"S";
  /* Behåller redan tagna foton (B3, beslut 27/10): backar man ett steg
     och går fram igen ligger de kvar i miniatyrraden. Ett råkat tryck
     ska inte kosta fotandet. */
  nsState.step=4;nsState.defLabel=code||"";nsRender();
}
function nsType(t){nsState.type=t;nsState.step=4;
  nsState.defLabel="";nsRender()}
function nsDelShot(i){nsState.shots.splice(i,1);nsRenderCam();nsSparaFoton(nsState.shots)}
function nsShotLabel(i,v){nsState.shots[i].label=v}
/* Laddar upp ett hyllfoto: originalet till lagringen (om det går) och en
   nedskalad kopia i raden, som avläsningen använder. Returnerar raden. */
async function uploadShelfPhoto({bc,name,code,label,file,dataUrl,i}){
  let url=null;
  try{
    const libId=await myLibraryId();
    const path=libId?`${libId}/shelf-${bc}-${Date.now()}-${i||0}.jpg`:null;
    if(path){
      const {error}=await sb.storage.from("gap-photos").upload(path,file,{upsert:true});
      if(!error)url=path;
    }
  }catch(e){console.warn("storage",e)}
  const {data:rows,error}=await sb.from("new_shelves").insert({
    name, bc, shelf_code:code||null, label:label||null,
    photo_url:url, photo_data:dataUrl, state:"waiting", created_by:sbUser.id}).select();
  if(error)throw error;
  return (rows||[])[0]||null;
}
/* ---------- Dela ett foto i flera hyllplan (designhandoff 2026-10-27) ----------
   Körs efter "Skicka" i kamerasteget, för de foton som märkts med bocken
   "Flera plan" (shot.multi). Beslut 27/10: fotandet ska aldrig avbrytas
   mitt i, därför ligger justeringen här och inte direkt efter avtryck.

   Ett foto i taget: läs av -> justera gränserna -> klipp -> resultat.
   Resultatet ersätter det flaggade fotot med ett band per hyllplan, och
   varje band går sedan genom den vanliga kedjan som ett eget hyllplansfoto
   (projektplanens punkt 0) - egen rad i new_shelves, egen bild, egen
   "Byt bild"/"Ny bild" i hyllvyn.

   Del B1: gränserna är tills vidare en jämn uppdelning. Del B2 byter ut
   nsDelaForslag() mot den riktiga AI-funktionen, med tyst fallback till
   dagens flöde när anropet misslyckas eller bilden är vriden. */

/* Skiljer "användaren tryckte Ta om fotot" från "AI:n gav inget svar" -
   båda kom tidigare tillbaka som null och gick inte att skilja åt. */
const NS_DELA_AVBRUTEN=Symbol("avbruten");
const NS_DELA_MIN=5;      /* minsta höjd per hyllplan, i % av bildhöjden */
const NS_DELA_MAX=12;     /* tak för antal hyllplan i ett foto */

const HYLLPLAN_URL=SB_URL.replace(".supabase.co",".functions.supabase.co")+"/hyllplan";
/* Frågar AI:n var gränserna går. Returnerar {cuts, rotated} eller null om
   anropet inte gick igenom - appen faller då tillbaka på dagens flöde
   (fotot blir ett hyllplan) utan att visa något felmeddelande, precis som
   innan funktionen fanns. Samma sak om bilden är vriden 90 grader: då
   ligger hyllplanen inte vågrätt och gränser i procent av bildhöjden
   skulle klippa tvärs igenom bokryggarna. */
async function nsDelaForslag(shot){
  try{
    const {data:{session}}=await sb.auth.getSession();
    if(!session)return null;
    const res=await fetch(HYLLPLAN_URL,{method:"POST",
      headers:{Authorization:"Bearer "+session.access_token,"content-type":"application/json"},
      body:JSON.stringify({image:shot.dataUrl})});
    if(!res.ok)throw new Error("status "+res.status);
    const out=await res.json();
    if(out.rotated)return null;
    return Array.isArray(out.cuts)?out.cuts:null;
  }catch(e){
    console.warn("hyllplan",e);
    return null;
  }
}

/* Kör hela sekvensen för alla flaggade foton. Returnerar en ny shots-lista
   där varje flaggat foto bytts mot sina band. Avbryter användaren hamnar
   hon tillbaka i kamerasteget med fotona kvar (null returneras). */
async function nsDelaKor(shots){
  if(!shots.some(s=>s.multi))return shots;
  const ut=[];
  const flaggade=shots.filter(s=>s.multi).length;
  let nr=0;
  for(const shot of shots){
    if(!shot.multi){ut.push(shot);continue}
    nr++;
    const band=await nsDelaEttFoto(shot,nr,flaggade);
    if(!band)return null;
    band.forEach(b=>ut.push(b));
  }
  return ut;
}

function nsDelaOverlay(){
  let el=document.getElementById("nsDela");
  if(!el){el=document.createElement("div");el.id="nsDela";el.className="ns-dela";document.body.appendChild(el)}
  el.style.display="";
  return el;
}
function nsDelaStang(){
  const el=document.getElementById("nsDela");
  if(el){el.innerHTML="";el.style.display="none"}
}

/* Ett foto genom hela sekvensen. Returnerar en lista band-shots, eller
   null om användaren valde att ta om fotot. */
async function nsDelaEttFoto(shot,nr,av){
  let granser=await nsDelaLaserAv(shot,nr,av);
  if(granser===NS_DELA_AVBRUTEN)return null;
  /* Inget svar från AI:n, eller en vriden bild: gå vidare som idag, med
     fotot som ett enda hyllplan. Tyst - användaren har inte bett om
     uppdelningen på ett sätt som gör ett felmeddelande meningsfullt. */
  if(granser===null)return [{...shot,multi:false}];
  if(!granser.length){
    /* AI:n ser bara ett hyllplan. Beslut 27/10: inget sker automatiskt -
       användaren väljer själv (handoffen, "Specialfall"). */
    const val=await nsDelaEttPlan(shot);
    if(val==="om")return null;
    if(val==="fortsatt")return [{...shot,multi:false}];
    granser=[50];
  }
  /* "Ta om" på resultatsidan går tillbaka till justeringen med samma
     gränser - inte om till avläsningen, som vore att tappa bort det man
     just dragit. "Ta om fotot" i justeringen avbryter hela sändningen
     och lämnar fotona kvar i kamerasteget. */
  for(;;){
    const slutliga=await nsDelaJustera(shot,granser,nr,av);
    if(slutliga===null)return null;
    granser=slutliga;
    const band=await nsDelaKlipp(shot,slutliga);
    if(await nsDelaResultat(band))return band;
  }
}

/* Steg 1: "Läser av hyllan" - fotot i ram på svart, röd laserstråle som
   sveper, progressmätare. "Ta om fotot" går tillbaka till kameran. */
function nsDelaLaserAv(shot,nr,av){
  const el=nsDelaOverlay();
  el.innerHTML=`
    <div class="ns-dela-topp">${av>1?`Foto ${nr} av ${av}`:""}</div>
    <div class="ns-dela-mitt">
      <div class="ns-dela-ram" id="nsDelaRam">
        <img src="${shot.dataUrl}" alt="">
        <span class="ns-laser"></span>
      </div>
    </div>
    <div class="ns-dela-foot">
      <p class="ns-dela-txt">Letar efter hyllplanen …</p>
      <div class="ns-analys-bar"><span id="nsDelaBar" style="width:0%"></span></div>
      <button class="btn btn-ghost ns-dela-om" onclick="nsDelaAvbryt()">Ta om fotot</button>
    </div>`;
  nsDelaRamProportion(el,shot);
  const bar=document.getElementById("nsDelaBar");
  const t0=Date.now();
  const iv=setInterval(()=>{
    const g=Date.now()-t0;
    if(bar)bar.style.width=Math.min(97,g/1500*100)+"%";
  },60);
  return new Promise(res=>{
    nsDelaAvbrytFn=()=>{clearInterval(iv);res(NS_DELA_AVBRUTEN)};
    nsDelaForslag(shot).then(g=>{
      clearInterval(iv);
      if(bar)bar.style.width="100%";
      nsDelaAvbrytFn=null;
      res(g);
    });
  });
}
let nsDelaAvbrytFn=null;
function nsDelaAvbryt(){if(nsDelaAvbrytFn)nsDelaAvbrytFn()}

/* Ramen får bildens proportion, så gränser i procent av bildhöjden
   hamnar på rätt pixelrad utan brevlådekanter att räkna bort. */
function nsDelaRamProportion(el,shot){
  const ram=el.querySelector("#nsDelaRam");
  const img=ram&&ram.querySelector("img");
  if(!img)return;
  const satt=()=>{if(img.naturalWidth)ram.style.aspectRatio=img.naturalWidth+" / "+img.naturalHeight};
  if(img.complete)satt();else img.onload=satt;
}

/* Specialfall: AI:n hittade bara ett hyllplan. Kort bekräftelse med fotot
   i ram, tydlig primärknapp och två jämnstora sekundärknappar. Inget sker
   av sig självt - användaren väljer (handoff 2026-10-27). */
function nsDelaEttPlan(shot){
  const el=nsDelaOverlay();
  el.innerHTML=`
    <div class="ns-dela-topp"></div>
    <div class="ns-dela-mitt">
      <div class="ns-dela-ram" id="nsDelaRam"><img src="${shot.dataUrl}" alt=""></div>
    </div>
    <div class="ns-dela-foot">
      <p class="ns-dela-txt">1 hyllplan hittat</p>
      <button class="btn btn-primary" onclick="nsDelaVal('fortsatt')">Fortsätt till avläsning</button>
      <div class="ns-dela-tva">
        <button class="btn btn-outline" onclick="nsDelaVal('dela')">Dela upp ändå</button>
        <button class="btn btn-outline" onclick="nsDelaVal('om')">Ta om fotot</button>
      </div>
    </div>`;
  nsDelaRamProportion(el,shot);
  return new Promise(res=>{nsDelaValFn=res});
}
let nsDelaValFn=null;
function nsDelaVal(v){if(nsDelaValFn)nsDelaValFn(v)}

/* Steg 2: justera gränserna. Linjerna renderas från en lista y-% - hur
   många som helst. Hela linjen är gripbar (44px osynlig träffyta), och
   under dragning visas en lupp förskjuten från fingret. */
function nsDelaJustera(shot,granserIn,nr,av){
  const el=nsDelaOverlay();
  let granser=granserIn.slice().sort((a,b)=>a-b);
  const ursprung=granser.slice();
  let valt=-1;   /* gräns med synligt kryss */

  const rita=()=>{
    const plan=granser.length+1;
    el.innerHTML=`
      <div class="ns-dela-topp">${av>1?`Foto ${nr} av ${av}`:""}</div>
      <div class="ns-dela-mitt">
        <div class="ns-dela-ram" id="nsDelaRam">
          <img src="${shot.dataUrl}" alt="">
          ${nsDelaEtiketter(granser)}
          ${granser.map((y,i)=>`
            <div class="ns-grans${valt===i?" valt":""}" data-i="${i}" style="top:${y}%">
              <span class="ns-grans-linje"></span>
              <span class="ns-grans-pill">${valt===i?ic("x"):""}</span>
            </div>`).join("")}
          <div class="ns-lupp" id="nsLupp"></div>
        </div>
      </div>
      <div class="ns-dela-foot">
        <div class="ns-dela-verktyg">
          <button class="btn btn-ghost btn-sm" onclick="nsDelaLaggTill()"
            ${plan>=NS_DELA_MAX?"disabled":""}>${ic("plus")} Lägg till gräns</button>
          <button class="btn btn-ghost btn-sm" onclick="nsDelaAterstall()">${ic("rotate-cw")} Återställ</button>
        </div>
        <button class="btn btn-primary" onclick="nsDelaKlar()">Klipp och fortsätt · ${plan} hyllplan</button>
        <button class="btn btn-ghost ns-dela-om" onclick="nsDelaAvbryt()">Ta om fotot</button>
      </div>`;
    nsDelaRamProportion(el,shot);
    koppla();
  };

  const koppla=()=>{
    const ram=el.querySelector("#nsDelaRam");
    const lupp=el.querySelector("#nsLupp");
    if(!ram)return;
    ram.querySelectorAll(".ns-grans").forEach(g=>{
      const i=+g.dataset.i;
      g.addEventListener("pointerdown",e=>{
        e.preventDefault();
        g.setPointerCapture(e.pointerId);
        /* Dragningen räknas som en förflyttning från där fingret sattes
           ned, inte som "linjen hoppar dit fingret är" - annars flyttar
           även ett rent tryck på handtaget linjen. Först när fingret
           rört sig mer än några pixlar räknas det som ett drag; kortare
           än så är det ett tryck. */
        const startY=e.clientY,startVal=granser[i];
        let drog=false;
        const flytta=ev=>{
          const r=ram.getBoundingClientRect();
          if(Math.abs(ev.clientY-startY)>4)drog=true;
          if(!drog)return;
          let y=startVal+((ev.clientY-startY)/r.height)*100;
          /* Clampas mot grannarna med minsta planhöjd, så linjer aldrig
             passerar varandra eller skapar hårfina band. */
          const min=(i===0?0:granser[i-1])+NS_DELA_MIN;
          const max=(i===granser.length-1?100:granser[i+1])-NS_DELA_MIN;
          y=Math.max(min,Math.min(max,y));
          granser[i]=y;
          g.style.top=y+"%";
          nsDelaRitaEtiketter(ram,granser);
          nsDelaLupp(lupp,ram,y,ev.clientY-r.top);
        };
        const slapp=()=>{
          try{g.releasePointerCapture(e.pointerId)}catch(err){}
          g.removeEventListener("pointermove",flytta);
          g.removeEventListener("pointerup",slapp);
          g.removeEventListener("pointercancel",slapp);
          if(lupp)lupp.classList.remove("syns");
          if(drog){
            granser.sort((a,b)=>a-b);
          }else if(valt===i){
            /* Andra trycket på ett handtag med kryss tar bort gränsen och
               slår ihop planen. Borttagningen ligger här och inte som en
               klicklyssnare på krysset: omritningen vid pointerup hann
               plocka bort krysset innan klicket nådde fram. */
            granser.splice(i,1);valt=-1;
          }else{
            valt=i;
          }
          rita();
        };
        g.addEventListener("pointermove",flytta);
        g.addEventListener("pointerup",slapp);
        g.addEventListener("pointercancel",slapp);
      });
    });
  };

  rita();
  return new Promise(res=>{
    nsDelaAvbrytFn=()=>res(null);
    nsDelaKlarFn=()=>res(granser.slice().sort((a,b)=>a-b));
    nsDelaLaggTillFn=()=>{
      /* Ny gräns mitt i det största hyllplanet. */
      const kant=[0,...granser,100];
      let bast=0,storst=-1;
      for(let i=0;i<kant.length-1;i++){
        const h=kant[i+1]-kant[i];
        if(h>storst){storst=h;bast=i}
      }
      if(storst<NS_DELA_MIN*2)return;
      granser.push((kant[bast]+kant[bast+1])/2);
      granser.sort((a,b)=>a-b);valt=-1;rita();
    };
    nsDelaAterstallFn=()=>{granser=ursprung.slice();valt=-1;rita()};
  });
}
let nsDelaKlarFn=null,nsDelaLaggTillFn=null,nsDelaAterstallFn=null;
function nsDelaKlar(){if(nsDelaKlarFn)nsDelaKlarFn()}
function nsDelaLaggTill(){if(nsDelaLaggTillFn)nsDelaLaggTillFn()}
function nsDelaAterstall(){if(nsDelaAterstallFn)nsDelaAterstallFn()}

function nsDelaEtiketter(granser){
  const kant=[0,...granser,100];
  let h="";
  for(let i=0;i<kant.length-1;i++){
    h+=`<span class="ns-planetikett" style="top:${(kant[i]+kant[i+1])/2}%">Hyllplan ${i+1}</span>`;
  }
  return h;
}
/* Numrerar om etiketterna live under dragning, utan att rita om linjerna
   (en omritning mitt i ett drag tappar pekarfångsten). */
function nsDelaRitaEtiketter(ram,granser){
  ram.querySelectorAll(".ns-planetikett").forEach(e=>e.remove());
  ram.insertAdjacentHTML("beforeend",nsDelaEtiketter([...granser].sort((a,b)=>a-b)));
}

/* Luppen: förstorat utsnitt vid linjen, förskjutet uppåt eller nedåt så
   fingret inte skymmer just det man försöker träffa. */
function nsDelaLupp(lupp,ram,yProcent,yPixel){
  if(!lupp)return;
  const img=ram.querySelector("img");
  const b=ram.getBoundingClientRect();
  const z=2.4,storlek=132;
  lupp.classList.add("syns");
  lupp.style.backgroundImage=`url(${img.getAttribute("src")})`;
  lupp.style.backgroundSize=(b.width*z)+"px "+(b.height*z)+"px";
  const cx=b.width/2,cy=b.height*yProcent/100;
  lupp.style.backgroundPosition=`${-(cx*z-storlek/2)}px ${-(cy*z-storlek/2)}px`;
  lupp.style.left=(cx-storlek/2)+"px";
  /* Över fingret när linjen ligger i nedre halvan, annars under. */
  lupp.style.top=(yProcent>45?cy-storlek-28:cy+28)+"px";
}

/* Steg 3: klipp. Varje band blir en egen bild via canvas, med en riktig
   Blob - inte en kopia av helbilden - så lagringen får rätt bild per plan. */
async function nsDelaKlipp(shot,granser){
  const el=nsDelaOverlay();
  const kant=[0,...granser,100];
  el.innerHTML=`
    <div class="ns-dela-mitt">
      <div class="ns-dela-ram ns-viker" id="nsDelaRam">
        <img src="${shot.dataUrl}" alt="">
        ${granser.map(y=>`<div class="ns-grans" style="top:${y}%"><span class="ns-grans-linje"></span></div>`).join("")}
      </div>
    </div>
    <div class="ns-dela-foot"><p class="ns-dela-txt">Delar upp i ${kant.length-1} hyllplan</p></div>`;
  nsDelaRamProportion(el,shot);
  const img=await new Promise((res,rej)=>{
    const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=shot.dataUrl;
  });
  const band=[];
  for(let i=0;i<kant.length-1;i++){
    const y0=Math.round(img.height*kant[i]/100);
    const y1=Math.round(img.height*kant[i+1]/100);
    const h=Math.max(1,y1-y0);
    const c=document.createElement("canvas");
    c.width=img.width;c.height=h;
    c.getContext("2d").drawImage(img,0,y0,img.width,h,0,0,img.width,h);
    const dataUrl=c.toDataURL("image/jpeg",0.72);
    const blob=await new Promise(res=>c.toBlob(res,"image/jpeg",0.72));
    const fil=blob?new File([blob],`hyllplan-${i+1}.jpg`,{type:"image/jpeg"}):shot.file;
    band.push({label:`Hyllplan ${i+1}`,dataUrl,file:fil,multi:false});
  }
  await new Promise(r=>setTimeout(r,650));
  return band;
}

/* Steg 4: resultat. Mörk bakgrund, rutnät i två kolumner, bara rubrik per
   bild. Varje ruta motsvarar en egen rad i new_shelves (punkt 0). */
function nsDelaResultat(band){
  const el=nsDelaOverlay();
  el.innerHTML=`
    <div class="ns-dela-mitt">
      <div class="ns-dela-rutnat">
        ${band.map(b=>`<figure><img src="${b.dataUrl}" alt=""><figcaption>${esc(b.label)}</figcaption></figure>`).join("")}
      </div>
    </div>
    <div class="ns-dela-foot">
      <button class="btn btn-primary" onclick="nsDelaKlar()">Fortsätt · ${band.length} hyllplan</button>
      <button class="btn btn-ghost ns-dela-om" onclick="nsDelaAvbryt()">Ta om</button>
    </div>`;
  return new Promise(res=>{
    nsDelaKlarFn=()=>res(true);
    nsDelaAvbrytFn=()=>res(false);
  });
}

async function nsFinish(){
  if(!sbUser){alert("Logga in för att skicka hyllplanet.");return}
  const S=nsState;
  let shots=S.shots.filter(s=>s.dataUrl);
  if(!shots.length){alert("Lägg till minst ett foto först.");return}
  /* Foton märkta "Flera plan" delas upp först - ett i taget, med
     justering av gränserna - och ersätts av ett band per hyllplan.
     Avbryter användaren står kamerasteget kvar med fotona i behåll. */
  if(shots.some(s=>s.multi)){
    const delade=await nsDelaKor(shots);
    nsDelaStang();
    if(!delade)return;
    shots=delade;
    S.shots=delade;
  }
  const bc=S.bc;
  nsAvbrytTillHem=S.origin==="hem";
  const btn=document.querySelector("#nsCam .ns-cam-send");
  if(btn){btn.disabled=true;btn.style.opacity=".6";btn.textContent="Skickar…"}
  /* Overlayen tar över skärmen direkt - den ligger redan ovanpå kameran
     (z-index 91 mot 90), så den täcker allt utan att vi behöver vänta på
     att kameran döljs. Annars hinner Hyllor/Foton-listan blinka till
     under tiden det tar att ladda upp bilderna och ladda om listan
     (nsRender/buildShelfOptions/loadNewShelves nedan). */
  const nsOverlay=document.getElementById("nsAnalys");
  if(nsOverlay){nsOverlay.style.display="";nsOverlay.innerHTML=`<p class="ns-analys-hint">Laddar upp foto …</p>`}
  try{
    if(S.mode==="new"&&!bcNames[S.bc]){
      bcNames[S.bc]=S.name;
      await sb.from("bc_names").upsert({bc:S.bc,name:S.name},{onConflict:"library_id,bc"});
    }
    const rows=[];
    for(let i=0;i<shots.length;i++){
      const s=shots[i];
      const row=await uploadShelfPhoto({bc:S.bc,name:S.name,code:S.code||null,label:s.label||null,file:s.file,dataUrl:s.dataUrl,i});
      if(row)rows.push(row);
    }
    nsState=null;nsRender();
    await nsRensaFoton();
    buildShelfOptions();renderBcEditor();
    await loadNewShelves();
    await nsRunAnalysisBatch(rows.map(r=>r.id),bc);
  }catch(e){
    if(nsOverlay)nsOverlay.style.display="none";
    alert("Något gick fel: "+(e.message||e));
  }finally{
    const b2=document.querySelector("#nsWizard .ns-nav button:last-child");
    if(b2){b2.disabled=false;b2.style.opacity=""}
  }
}
/* ---------- Analys-overlay + Hylla-sidan efter nsFinish() ----------
   Körs automatiskt efter uppladdning: visar en overlay medan varje
   uppladdat foto analyseras tyst (runAnalys med silent:true), sen
   hyllans egen sida (designens steg 4 "Platsen", här "Hylla" - se
   docs/KARTA.md och begreppskommentaren i designpaketets flow.html:
   Hyllplan (ett foto) → Hylla (en samling hyllplan, t.ex.
   "Vardagsrummet") → Min Bokhylla (allt). Varje Hylla visas separat,
   aldrig ihopslagen med andra, exakt som hyllgrupperingen (bc/parent_bc)
   redan fungerar i resten av appen.

   Overlayen återskapar Analyze()/Spine() ur designpaketets flow.html:
   samma ryggbredder (22-40px), samma höjdcykel (150/138/126), samma
   färger (bokdatans spine-hex ur shared.jsx), samma scaleY-reveal, samma
   stora displaytal + progressbar. */
const NS_SPINE_COLORS=["#C2410C","#1F6F5C","#3B3BAF","#7A5230","#0F766E","#8C1D3F","#2F4858"];
const NS_SPINE_WIDTHS=[24,32,28,38,26,34,30,22,36,28,32,26];
/* Ljuskäglan vandrar i stället för att svepa fram och tillbaka: varje
   etapp får ett slumpat mål i både x- och y-led, en slumpad restid och en
   slumpad paus innan nästa. Längre etapper får längre tid, så farten
   håller sig lugn oavsett avstånd. Slutar av sig själv när elementet
   plockas bort (svaret har landat). Respekterar prefers-reduced-motion
   genom att röra sig långsammare och kortare. */
function nsKaglaVandra(kagla,ljus){
  if(!kagla&&!ljus)return;
  const lugnt=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const slump=(min,max)=>min+Math.random()*(max-min);
  const rad=(ljus||kagla).parentElement;
  let x=null,y=null,fx=0,fy=0,mx=0,my=0,t0=0,tid=1,vila=0;
  const mal=()=>{
    const b=rad?rad.clientWidth:320,h=rad?rad.clientHeight:150;
    const nx=slump(b*0.12,b*0.88),ny=slump(h*0.28,h*0.78);
    const avst=x===null?0:Math.hypot(nx-x,ny-y);
    tid=x===null?0.01:Math.min(lugnt?5:3.6,slump(lugnt?2:1.2,lugnt?2.9:2.1)+avst/(lugnt?160:235));
    fx=x===null?nx:x;fy=y===null?ny:y;mx=nx;my=ny;x=nx;y=ny;
    t0=performance.now();
    vila=slump(lugnt?500:120,lugnt?1300:780);
  };
  /* Mjuk start och mjukt stopp per etapp, sedan en paus där käglan står
     stilla innan nästa slumpade mål. Ritar varje bildruta i stället för
     CSS-övergång, eftersom masken styrs av egna css-variabler. */
  const ease=p=>p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
  mal();
  const rit=()=>{
    if(!rad||!rad.isConnected)return;
    if(!(kagla&&kagla.isConnected)&&!(ljus&&ljus.isConnected))return;
    const g=performance.now()-t0;
    const p=Math.min(1,g/(tid*1000));
    const px=fx+(mx-fx)*ease(p),py=fy+(my-fy)*ease(p);
    if(ljus){ljus.style.setProperty("--kx",px+"px");ljus.style.setProperty("--ky",py+"px")}
    if(kagla)kagla.style.transform=`translate(${px}px,${py}px)`;
    if(p>=1&&g>tid*1000+vila)mal();
    requestAnimationFrame(rit);
  };
  requestAnimationFrame(rit);
}
/* "Avbryt" på analyssteget (B1): det steget kör en bakgrundsprocess och
   har därför ingen tillbaka-pil. Avbrytningen stoppar avläsningen efter
   det foto som är igång och går vidare till hyllan. */
let nsAnalysAvbruten=false;
/* nsState är redan nollställt när analysen kör (nsFinish rensar det efter
   uppladdningen), så varifrån guiden startades måste sparas separat. */
let nsAvbrytTillHem=false;
function nsAvbrytAnalys(){
  nsAnalysAvbruten=true;
  const b=document.getElementById("nsAnalysAvbryt");
  if(b){b.disabled=true;b.textContent="Avbryter …"}
  const h=document.getElementById("nsAnalysHint");
  if(h)h.textContent="Avslutar avläsningen …";
}
async function nsRunAnalysisBatch(ids,bc){
  if(!ids||!ids.length){nsShowHylla(bc);return}
  const cam=document.getElementById("nsCam");if(cam)cam.style.display="none";
  const el=document.getElementById("nsAnalys");if(!el){nsShowHylla(bc,{failed:ids.length});return}
  el.style.display="";
  const spineN=NS_SPINE_WIDTHS.length;
  /* Två identiska bokrader ovanpå varandra: den undre nedsläckt, den övre
     i full färg men maskerad till en rund fläck. Ljuskäglan flyttar
     masken, så böckerna under den träder fram i stället för att
     överstrålas av ett vitt skimmer (fel i första versionen - ljuset låg
     ovanpå och gjorde raden ljusare men inte tydligare). */
  const radHtml=Array.from({length:spineN}).map((x,i)=>
    `<span class="ns-spine on" style="width:${NS_SPINE_WIDTHS[i]}px;height:${150-(i%3)*12}px;
      background:${NS_SPINE_COLORS[i%NS_SPINE_COLORS.length]}"></span>`).join("");
  el.innerHTML=`<div class="ns-analys-spines">
    <div class="ns-rad ns-rad-mork">${radHtml}</div>
    <div class="ns-rad ns-rad-ljus" id="nsRadLjus">${radHtml}</div>
    <span class="ns-kagla"></span></div>
    <div><div class="ns-analys-count" id="nsAnalysCount"></div>
    <p class="ns-analys-hint" id="nsAnalysHint">Läser av hyllan …</p></div>
    <div class="ns-analys-bar"><span id="nsAnalysBar" style="width:0%"></span></div>
    <button class="ns-analys-avbryt" id="nsAnalysAvbryt" onclick="nsAvbrytAnalys()">Avbryt</button>`;
  const spines=[...el.querySelectorAll(".ns-rad-mork .ns-spine")];
  const countEl=document.getElementById("nsAnalysCount");
  const hintEl=document.getElementById("nsAnalysHint");
  const barEl=document.getElementById("nsAnalysBar");
  const kaglaEl=el.querySelector(".ns-kagla");
  const ljusEl=document.getElementById("nsRadLjus");
  spines.forEach(sp=>sp.classList.add("vilar"));
  nsKaglaVandra(kaglaEl,ljusEl);
  /* Den riktiga avläsningen körs i bakgrunden medan ljuskäglan sveper.
     Ingen siffra visas under tiden: appen frågar AI:n en gång per foto och
     vet ingenting om antalet förrän svaret kommer. Den gamla versionen
     räknade upp i takt med tiden och kunde landa på 18 innan sanningen
     (4) kom - en siffra som mätte väntan, inte böcker. */
  nsAnalysAvbruten=false;
  const real=(async()=>{
    let total=0,titles=[],failed=0;
    for(const id of ids){
      if(nsAnalysAvbruten)break;
      const r=await runAnalys("shelf",id,null,{silent:true});
      if(r&&r.ok){total+=r.titles.length;titles=titles.concat(r.titles)}else failed++;
    }
    return{total,titles,failed};
  })();
  /* Stapeln är det enda som rör sig mot ett mål under väntan: en hyperbel
     som alltid stiger och aldrig når fram av sig själv - 96*t/(t+10000),
     ~9% vid 1s, ~25% vid 3,5s, ~64% vid 20s. Strikt monoton. */
  const started=Date.now();
  await new Promise(resolve=>{
    const t=setInterval(()=>{
      const gatt=Date.now()-started;
      if(barEl)barEl.style.width=(96*gatt/(gatt+10000))+"%";
      if(real.__done||nsAnalysAvbruten){clearInterval(t);resolve()}
    },100);
    real.then(()=>{real.__done=true});
  });
  /* Avbryter användaren lämnar vi avläsningen direkt. Vart man hamnar
     beror på var man kom ifrån (beslut 28/10): den som är inne i
     nyanvändarguiden för första gången går tillbaka till startsidan hon
     just kom från - att landa på hyllsidan, en vy hon aldrig sett, vore
     förvirrande. Den som startade guiden inifrån appen känner hyllsidan
     och får den.

     Inget raderas i något av fallen: fotona ligger kvar som egna
     hyllplan utan boklista och kan läsas av senare. En uppladdad bild är
     användarens arbete, inte skräp att städa bort. */
  if(nsAnalysAvbruten){
    el.style.display="none";
    if(nsAvbrytTillHem){nsAvbrytTillHem=false;go("hem");renderHome();return}
    nsShowHylla(bc,{avbruten:true});
    return;
  }
  const{total,titles,failed}=await real;
  /* Svaret har landat: käglan slocknar, siffran räknas upp från noll till
     det verkliga antalet och lika många ryggar tänds - blev det fler
     böcker än det finns ryggar tänds hela raden. */
  if(kaglaEl)kaglaEl.remove();
  if(ljusEl)ljusEl.remove();
  if(barEl)barEl.style.width="100%";
  const tandas=Math.min(spines.length,total);
  for(let i=0;i<tandas;i++)spines[i].classList.remove("vilar");
  if(hintEl)hintEl.textContent=total===1?"bok hittad":"böcker hittade";
  await new Promise(res=>{
    const steg=Math.max(1,Math.round(total/18));
    let n=0;
    if(!total){if(countEl)countEl.textContent="0";res();return}
    const t=setInterval(()=>{
      n=Math.min(total,n+steg);
      if(countEl)countEl.textContent=String(n);
      if(n>=total){clearInterval(t);res()}
    },45);
  });
  /* Står kvar en stund så man hinner läsa siffran innan hyllan tar över. */
  await new Promise(res=>setTimeout(res,2600));
  el.style.display="none";
  nsShowHylla(bc,{failed});
}
/* Hyllans egen sida (designens steg 4/6 "Platsen"/"Sparad plats",
   begreppsmässigt vår "Hylla") - visas direkt efter analysen, och är
   samma vy man når senare via openPlace()/renderPlace() för samma bc,
   bara med de här extra delarna påklistrade (kort + sparaformulär) som
   hör till just den här första landningen. Data (foton, antal, namn)
   kommer från placeList(), samma källa som Hem och Platser-vyn - ingen
   egen datahämtning här. */
let nsHyllaSenast=null;
function nsShowHylla(bc,opts){
  opts=opts||{};
  const el=document.getElementById("nsDone");if(!el)return;
  nsHyllaSenast={bc,opts};
  const top=topBc(String(bc));
  const p=placeList().find(x=>x.bc===top);
  const saved=!!(sbUser&&!sbUser.is_anonymous);
  const antal=p?p.photos.length:0;
  const total=p?p.count:0;
  const namn=p?p.name:(bcNames[top]||("Hylla "+top));
  /* Analysen sparar aldrig böcker direkt - den bara föreslår dem
     (analysBooks), och de landar i katalogen först när man granskat och
     tryckt "Lägg in" i oklarhetslistan (analysSave) - det är den separata
     rättningsprocessen Thomas bad om att behålla. Så "0 böcker" direkt
     efter analysen är korrekt, men sidan måste visa VARFÖR och låta en
     komma åt granskningen (psOpen) istället för att bara tiga om det. */
  const planer=(p?p.photos:[]).map(ph=>({ph,pending:(analysBooks[analysKey("shelf",ph.nsId)]||{books:[]}).books.length}));
  const pendingTotal=planer.reduce((s,x)=>s+x.pending,0);
  /* Sök/Värdera/Dela: sidorna de skulle leda till är inte byggda än
     (oavsett om hyllan är sparad eller inte), så korten visas gråade
     istället för aktiva - ett medvetet avsteg från designpaketet,
     godkänt av Thomas 2026-10-24. */
  const kan=[["search","Sök i hyllan","Hitta vilken bok som helst direkt"],
             ["tag","Värdera","Se vad böckerna är värda i dag"],
             ["link","Dela","Visa hyllan för vänner"]];
  el.className="ns-hylla"+(saved?" is-saved":"");
  el.innerHTML=`
    <div class="ns-hylla-head">
      <div class="ns-hylla-eyebrow">${saved?"Hylla":"Din hylla, digitalt"}</div>
      <h1 class="ns-hylla-name" id="nsHyllaName" title="Tryck för att byta namn">${esc(namn)}</h1>
      <div class="ns-hylla-sub">${antal} hyllplan · ${total} böcker${pendingTotal?` · ${pendingTotal} väntar på granskning`:""}${opts.failed?` · ${opts.failed} foto${opts.failed>1?"n":""} gick inte att läsa av`:""}${opts.avbruten?" · avläsningen avbröts":""}</div>
    </div>
    <div class="ns-hylla-planes">
      ${planer.map(({ph,pending})=>`<div class="ns-hylla-plane">
          <div class="ns-hylla-plane-img${pending?" has-pending":""}"${pending?` onclick="psOpen('analys',${ph.nsId})" role="button" tabindex="0"`:""}>${ph.thumb?`<img src="${ph.thumb}" alt="">`:""}</div>
          <div class="ns-hylla-plane-cap">${esc(ph.cap||"")}${pending?` · ${pending} bok${pending===1?"":"er"} väntar på granskning`:""}</div>
        </div>`).join("")}
      <button class="ns-hylla-add" type="button" onclick="nsAddHyllplan('${top}')">${ic("plus")}Lägg till ett hyllplan</button>
    </div>
    <div class="ns-hylla-cards">
      ${kan.map(([icn,t,s])=>`<div class="ns-hylla-card is-locked" aria-disabled="true">
          <span class="ns-hylla-card-ic">${ic(icn)}</span>
          <span class="ns-hylla-card-txt"><b>${t}</b><small>${s}</small></span>
          <span class="ns-hylla-card-chev">${ic("chevron-right")}</span>
        </div>`).join("")}
    </div>
    ${saved?`<div class="ns-hylla-savedbar"><span class="ns-hylla-savedbar-ic">${ic("check")}</span><span>Hyllan är sparad på ditt konto</span></div>`
      :`<div class="ns-hylla-cta">
          <button class="btn btn-primary" type="button" id="nsHyllaSaveBtn">Spara hyllan</button>
          <p class="fine" style="text-align:center">Hyllan finns bara i den här telefonen tills du sparar den.</p>
        </div>`}
    <div class="ns-hylla-foot">
      ${saved?`<button class="btn btn-primary" id="nsDoneHome" type="button" style="width:100%;margin-bottom:10px">Till Hem</button>`:""}
      <button class="btn-outline" id="nsDoneOut" type="button">Logga ut</button>
    </div>`;
  el.style.display="";
  /* Namnbyte direkt på sidan - samma mönster som bc-name-fältet i
     Inställningar → Hyllor (renderBcEditor): klick → textfält →
     bekräftelsedialog → placeSave(). */
  el.querySelector("#nsHyllaName").addEventListener("click",function(){
    const h1=this;
    const inp=document.createElement("input");inp.type="text";inp.value=bcNames[top]||namn;inp.className="ns-hylla-name-input";
    h1.replaceWith(inp);inp.focus();inp.select();
    let done=false;
    const commit=async()=>{if(done)return;done=true;const n=inp.value.trim();
      if(n&&n!==bcNames[top]){
        if(!sbUser){alert("Logga in för att byta namn.");nsShowHylla(bc,opts);return}
        const ok=await ask({title:"Byta namn?",text:`"${bcNames[top]||namn}" byter namn till "${n}".`,buttons:[{label:"Byt namn",value:true,kind:"primary"},{label:"Avbryt",value:false}]});
        if(ok&&await placeSave([{bc:top,name:n}])){bcNames[top]=n;toast("Namnet är bytt");renderHome();buildShelfOptions();renderBcEditor()}
      }
      nsShowHylla(bc,opts)};
    inp.addEventListener("keydown",e=>{if(e.key==="Enter")inp.blur();if(e.key==="Escape"){done=true;nsShowHylla(bc,opts)}});
    inp.addEventListener("blur",commit)});
  if(!saved){
    el.querySelector("#nsHyllaSaveBtn").onclick=()=>nsShowAccount(bc,opts);
  }
  /* Väg ut ur den sparade hyllsidan: lagret ligger över hela appen (z-index 91)
     och göms annars bara av nsShowAccount/nsAddHyllplan. */
  const homeBtn=el.querySelector("#nsDoneHome");
  if(homeBtn)homeBtn.onclick=()=>{el.style.display="none";nsHyllaSenast=null;go("hem");renderHome()};
  el.querySelector("#nsDoneOut").onclick=async()=>{
    const varning=saved?"Logga ut?":"Det tillfälliga biblioteket försvinner för gott om du loggar ut utan att först spara hyllan ovan. Logga ut ändå?";
    if(!confirm(varning))return;
    await sb.auth.signOut();location.reload();
  };
}
/* Steg 5 - Konto (designens flow.html, Account-komponenten). Eget steg i
   flödet, inte ett infällt formulär på hyllans sida - nås bara via
   "Spara hyllan"-knappen i nsShowHylla. Samma kontouppgradering som
   tidigare (anonym session -> riktigt konto via sb.auth.updateUser),
   ingen parallell lösning. */
function nsShowAccount(bc,opts){
  opts=opts||{};
  const done=document.getElementById("nsDone");if(done)done.style.display="none";
  const el=document.getElementById("nsAccount");if(!el)return;
  const top=topBc(String(bc));
  const p=placeList().find(x=>x.bc===top);
  const thumb=p&&p.photos[0]?p.photos[0].thumb:null;
  /* Samma bokrygg-silhuetter som Analys-animationen (nsRunAnalysisBatch)
     används som fallback i fotorutan när inget foto finns än - matchar
     designens Account-komponent, som visar BOOKS.slice(0,6) istället för
     tom yta. */
  const spineFallback=`<div class="ns-account-spines">${Array.from({length:6}).map((x,i)=>
    `<span class="ns-spine on" style="width:${NS_SPINE_WIDTHS[i]}px;height:${74-(i%3)*10}px;
      background:${NS_SPINE_COLORS[i%NS_SPINE_COLORS.length]}"></span>`).join("")}</div>`;
  el.innerHTML=`
    <button class="ns-account-back" type="button" id="nsAccountBack" aria-label="Tillbaka">${ic("chevron-left")}</button>
    <div class="ns-account-photo">${thumb?`<img src="${thumb}" alt="">`:spineFallback}</div>
    <h2 class="ns-account-title">Spara hyllan</h2>
    <div class="ns-account-form">
      <input id="nsAccEmail" type="email" placeholder="E-post" autocomplete="username">
      <input id="nsAccPass" type="password" placeholder="Lösenord" autocomplete="new-password">
      <button class="btn btn-primary" type="button" id="nsAccGo">Fortsätt</button>
      <span class="err" id="nsAccErr"></span>
    </div>
    <p class="ns-account-terms">Genom att fortsätta godkänner du villkoren.</p>`;
  el.style.display="";
  el.querySelector("#nsAccountBack").onclick=()=>{el.style.display="none";nsShowHylla(bc,opts)};
  const doSave=async()=>{
    const email=el.querySelector("#nsAccEmail").value.trim(),pass=el.querySelector("#nsAccPass").value;
    const errEl=el.querySelector("#nsAccErr");errEl.textContent="";
    if(!email||pass.length<6){errEl.textContent="Fyll i e-post och ett lösenord på minst 6 tecken.";return}
    const btn=el.querySelector("#nsAccGo");btn.disabled=true;btn.textContent="Sparar…";
    const {data:res,error}=await sb.auth.updateUser({email,password:pass});
    if(error){errEl.textContent=error.message||"Kunde inte skapa kontot.";btn.disabled=false;btn.textContent="Fortsätt";return}
    sbUser=res.user;renderAuth();toast("Kontot är skapat - hyllan är sparad.");
    el.style.display="none";
    nsShowHylla(bc,opts);
  };
  el.querySelector("#nsAccGo").onclick=doSave;
  el.querySelector("#nsAccPass").addEventListener("keydown",e=>{if(e.key==="Enter")doSave()});
}
/* Snabbväg för "+ Lägg till ett hyllplan" på Hylla-sidan: hoppar direkt
   till kamerasteget (steg 4 i nsRender) för samma bc, utan att gå via
   namn/typ-stegen i den vanliga guiden - det är redan samma hylla. */
function nsAddHyllplan(bc){
  const done=document.getElementById("nsDone");if(done)done.style.display="none";
  openSet("platser");
  nsState={step:4,mode:"update",bc:String(bc),name:bcNames[bc]||("Hylla "+bc),code:"",type:"S",shots:[],defLabel:""};
  nsRender();
}
/* Inskickade hyllfoton. Bara de som inte är klarmarkerade syns i listan;
   klara ligger hopfällda längst ner, så att de ändå går att läsa av igen
   (t.ex. när en bok saknades) eller öppna på nytt. */
let nsDoneOpen=false,nsRepOpen=false;
const NS_KEEP_DAYS=30;
/* Dagar kvar innan ett klarmarkerat foto försvinner ur listan. Saknar raden
   tidpunkt (klarmarkerad innan done_at fanns) räknas den som gammal. */
function nsDaysLeft(r){
  if(!r.done_at)return 0;
  return Math.ceil(NS_KEEP_DAYS-(Date.now()-new Date(r.done_at).getTime())/864e5);
}
/* ---------- Hyllor → Foton: kort per inskickat foto ---------- */
let nsOpenId=null,nsMsg=null; /* nsMsg: {text, undo:id|null} */
let nsRot={};try{nsRot=JSON.parse(localStorage.getItem("bokhyllan-rot")||"{}")}catch(e){}
const rotCss=id=>{const r=nsRot[id]||0;return `rotate(${r}deg) scale(${r%180?0.62:1})`};
function nsRotate(id){nsRot[id]=((nsRot[id]||0)+90)%360;try{localStorage.setItem("bokhyllan-rot",JSON.stringify(nsRot))}catch(e){}
  document.querySelectorAll(`[data-rot="${id}"]`).forEach(img=>img.style.transform=rotCss(id))}
function nsItem(r){
  const thumb=r.photo_data||r.photo_url,code=shelfCodeForRow(r);
  const books=code?data.filter(d=>d.shelf===code):[];
  const meta=books.length?`${books.length} ${books.length===1?"bok":"böcker"}`:(r.claude_note?"Avläst – inga böcker än":"Väntar på avläsning");
  const open=nsOpenId===r.id,done=r.state==="done";
  return `<div class="pc${open?" open":""}" id="pc-${r.id}">
    <button class="pc-head" onclick="nsToggle(${r.id})">
      ${thumb?`<img src="${thumb}" alt="">`:`<span class="pc-noimg"></span>`}
      <span class="pc-t"><b>${esc(nsCap(r))}</b><span class="pc-meta"><span>${meta}</span>${code?`<span class="chip-code">${code}</span>`:""}</span>
        ${done?`<span class="pc-meta">Försvinner ur listan om ${nsDaysLeft(r)} ${nsDaysLeft(r)===1?"dag":"dagar"}</span>`:""}</span>
      <span class="pc-chev">${ic("chevron-down")}</span></button>
    ${open?`<div class="pc-body">
      <div class="pc-photo">${thumb?`<img src="${thumb}" alt="" data-rot="${r.id}" style="transform:${rotCss(r.id)}" onclick="lbGap('${thumb}')">`:""}
        <button class="pc-rot" onclick="nsRotate(${r.id})">${ic("rotate-cw")}Vrid</button></div>
      ${books.length?`<div class="pc-books"><span class="pc-count"><span class="mono">${books.length}</span> böcker i katalogen</span>
        ${books.map(d=>`<div class="pc-bk"><span style="background:${catColor(d.cat)}"></span><b>${esc(d.title)}</b><small>${esc(d.cat)}</small></div>`).join("")}</div>`
        :`<span class="pc-empty">Inga böcker inlagda här ännu. Tryck Analysera.</span>`}
    </div>`:""}
    <div class="pc-acts">
      <button onclick="nsToggle(${r.id})">${ic(open?"eye-off":"eye")}${open?"Dölj":"Visa"}</button>
      <button onclick="nsAnalyse(${r.id},this)" ${r.photo_data?"":"disabled"}>${ic("scan-text")}Analysera</button>
      <button onclick="psOpen('ratta',${r.id})" ${code?"":"disabled"}>${ic("pencil")}Rätta</button>
      ${done?`<button class="pc-done" onclick="nsReopen(${r.id})">${ic("rotate-cw")}Öppna igen</button>`
             :`<button class="pc-done" onclick="nsDone(${r.id})">${ic("circle-check")}Klar</button>`}
    </div></div>`;
}
function nsToggle(id){nsOpenId=nsOpenId===id?null:id;renderNsList()}
function renderNsMsg(){
  const el=document.getElementById("plMsg");if(!el)return;
  el.innerHTML=nsMsg?`<div class="pl-msg">${ic("circle-check")}<span>${esc(nsMsg.text)}</span>${nsMsg.undo!=null?`<button onclick="nsUndo()">Ångra</button>`:""}</div>`:"";
}
function nsUndo(){if(nsMsg&&nsMsg.undo!=null){const id=nsMsg.undo;nsMsg=null;nsReopen(id,true)}}
async function loadNewShelves(){
  const {data:rows}=await sb.from("new_shelves").select("*").order("created_at",{ascending:false});
  window.__nsRows=rows||[];
  syncShelfPhotos(rows);
  renderNsList();
}
function renderNsList(){
  const rows=window.__nsRows||[];
  const el=document.getElementById("nsList");if(!el)return;
  renderNsMsg();
  const total=rows.length,nDone=rows.filter(r=>r.state==="done").length;
  const dt=document.getElementById("plDoneTxt");if(dt)dt.textContent=total?`${nDone} / ${total} klara`:"";
  const pg=document.getElementById("plProg");if(pg)pg.style.width=(total?Math.round(nDone/total*100):0)+"%";
  if(!rows.length){el.innerHTML=`<div class="empty">Inga inskickade foton än.</div>`;return}
  const byTime=rows.slice().sort((a,b)=>String(a.created_at||"").localeCompare(String(b.created_at||""))||(a.id-b.id));
  const open=byTime.filter(r=>r.state!=="done"),done=byTime.filter(r=>r.state==="done"&&nsDaysLeft(r)>0);
  /* Grupper per hylla (sammanslagna hyllor samlas under sin förälder). */
  const groups=[];open.forEach(r=>{const top=topBc(String(r.bc));let g=groups.find(x=>x.bc===top);
    if(!g){g={bc:top,rows:[]};groups.push(g)}g.rows.push(r)});
  el.innerHTML=(groups.length?groups.map(g=>`<div class="pl-group"><div class="pl-gh"><b>${esc(bcNames[g.bc]||("Hylla "+g.bc))}</b><span class="mono">${g.rows.length} kvar</span></div>
      ${g.rows.map(nsItem).join("")}</div>`).join("")
      :`<div class="empty">Alla foton är klara.</div>`)+
    (done.length?`<details class="ns-done"${nsDoneOpen?" open":""}><summary>Klarmarkerade (${done.length}) · ligger kvar i ${NS_KEEP_DAYS} dagar</summary>${done.map(nsItem).join("")}</details>`:"");
  const rep=PH.filter(x=>x.replaced&&x.replacedAt&&(Date.now()-x.replacedAt)<NS_KEEP_DAYS*864e5)
    .sort((a,b)=>b.replacedAt-a.replacedAt);
  if(rep.length)el.insertAdjacentHTML("beforeend",`<details class="ns-done ns-replaced"${nsRepOpen?" open":""}>
    <summary>Ersatta foton (${rep.length}) · ligger kvar i ${NS_KEEP_DAYS} dagar</summary>
    <p class="fine">Fotona har ersatts av nyare foton av samma hyllplan. Vill du ha tillbaka ett gammalt foto: öppna det nya igen under Klarmarkerade.</p>
    ${rep.map(x=>{const left=Math.ceil(NS_KEEP_DAYS-(Date.now()-x.replacedAt)/864e5);
      return `<div class="ns-item"><div class="ns-head-row">
        <img class="ns-thumb-img" src="${x.thumb}" alt="" onclick="showPhoto(${x.fi})">
        <div class="ns-titles"><span>${esc(bcNames[x.bc]||"")} · ${esc(x.cap)}</span>
          <div class="ns-note">Ersatt ${new Date(x.replacedAt).toLocaleDateString("sv-SE")}${x.replacedBy?` av "${esc(x.replacedBy.cap)}"`:""}</div>
          <div class="ns-note">Försvinner ur listan om ${left} ${left===1?"dag":"dagar"}</div></div></div>
        <div class="ns-item-acts"><button class="ghost" onclick="showPhoto(${x.fi})">Visa</button></div></div>`}).join("")}</details>`);
  const det=el.querySelector(".ns-done:not(.ns-replaced)");if(det)det.addEventListener("toggle",()=>nsDoneOpen=det.open);
  const rdet=el.querySelector(".ns-replaced");if(rdet)rdet.addEventListener("toggle",()=>nsRepOpen=rdet.open);
}
/* Foton som laddats upp via "Ny hylla" bor i databasen, inte i photos.json.
   Lägg in dem i fotolistan så att hyllvyn visar dem. Den nedskalade
   kopian (photo_data) används - originalet i lagringen kan vara flera MB. */
/* Ett foto ersätts när ett NYARE, klarmarkerat foto täcker alla dess hyllplan.
   Fotona ur repot räknas som äldst. Det ersatta fotot försvinner ur
   hyllvyn och ligger i 30 dagar under "Ersatta foton" i Hyllor.
   Tidpunkten är när det nya fotot klarmarkerades; saknas den (klart innan
   done_at fanns) räknas ersättningen som gammal. */
function markReplaced(){
  PH.forEach(x=>{x.replaced=false;x.replacedAt=0;x.replacedBy=null});
  PH.forEach(x=>{
    if(!x.shelves.length)return;
    const newer=PH.filter(y=>y!==x&&y.db&&y.done&&y.shelves.length&&(!x.db||y.createdAt>x.createdAt)&&y.shelves.some(c=>x.shelves.includes(c)));
    const covered=new Set(newer.flatMap(y=>y.shelves));
    if(!newer.length||!x.shelves.every(c=>covered.has(c)))return;
    x.replaced=true;
    x.replacedAt=Math.max(...newer.map(y=>y.doneAt||0));
    x.replacedBy=newer.find(y=>y.doneAt===x.replacedAt)||newer[0];
  });
}
/* Sortering i hyllvyn: översta planet först, vänster före höger, lösa
   hyllplan sist - samma ordning som fotona i photos.json har. */
function photoKey(ph,members){
  const codes=ph.shelves.length?ph.shelves:[ph.bc+":L0"];
  const loose=codes.every(c=>/:L\d+$/.test(c)||c==="4:K3");
  const plan=Math.max(...codes.map(c=>+(c.match(/(\d+)$/)||[0,0])[1]));
  const sec={V:0,H:1,S:2,K:2,L:3}[(codes[0].split(":")[1]||"S")[0]]??2;
  return [members.indexOf(ph.bc),loose?1:0,-plan,sec,ph.db?1:0,ph.db?ph.createdAt:ph.fi];
}
function cmpKey(a,b){for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]<b[i]?-1:1;return 0}
/* Analysera: finns en avläsning som inte sparats öppnas den direkt, annars
   läses fotot av först. */
async function nsAnalyse(id,btn){
  if(analysBooks[analysKey("shelf",id)]){psOpen("analys",id);return}
  if(btn){btn.disabled=true;btn.lastChild.textContent="Läser av…"}
  await runAnalys("shelf",id,null);
  if(btn&&document.body.contains(btn)){btn.disabled=false;btn.lastChild.textContent="Analysera"}
}
/* ---------- Analysera / Rätta: helskärmsvy ---------- */
let PS=null; /* {mode,id,rows,code,spot,showEx} */
function psCats(){return [...new Set(data.map(d=>d.cat).concat(["Okategoriserad"]))].sort((a,b)=>a.localeCompare(b,"sv"))}
function psOpen(mode,id){
  const r=(window.__nsRows||[]).find(x=>x.id===id);if(!r)return;
  if(!sbUser){alert("Logga in först.");return}
  const code=shelfCodeForRow(r)||"";
  let rows=[];
  if(mode==="analys"){
    const st=analysBooks[analysKey("shelf",id)];if(!st)return;
    rows=st.books.map((b,i)=>{const kn=knownBook(b.title,b.author,st.shelf);
      return {k:"a"+i,title:b.title||"",author:b.author||"",cat:b.cat||"Okategoriserad",description:b.description||"",
        checked:!kn,exists:!!kn,unsure:!!b.uncertain,note:kn?(kn.sameShelf?"Finns redan här":"Finns redan – "+kn.where):""}});
    PS={mode,id,rows,code:st.shelf||code,spot:st.spotLabel||"",showEx:false};
  }else{
    rows=data.filter(d=>d.shelf===code).map(d=>({k:"e"+d.id,bookId:d.id,orig:{title:d.title,author:d.author||"",cat:d.cat},
      title:d.title,author:d.author||"",cat:d.cat,checked:true,exists:false}));
    PS={mode,id,rows,code,spot:"",showEx:false};
  }
  renderPS();document.body.classList.add("ps-lock");
}
function psClose(){PS=null;const el=document.getElementById("psView");if(el)el.remove();document.body.classList.remove("ps-lock")}
function renderPS(){
  if(!PS)return;
  let el=document.getElementById("psView");
  if(!el){el=document.createElement("div");el.id="psView";el.className="ps";document.body.appendChild(el)}
  const r=(window.__nsRows||[]).find(x=>x.id===PS.id)||{};
  const img=r.photo_data||r.photo_url||"",isA=PS.mode==="analys";
  const newRows=PS.rows.filter(x=>!x.exists),exRows=PS.rows.filter(x=>x.exists);
  const sel=PS.rows.filter(x=>x.checked&&x.title.trim()).length,unsure=PS.rows.filter(x=>x.unsure).length;
  const cats=psCats();
  const row=(x,compact)=>{const i=PS.rows.indexOf(x);
    return `<div class="ps-row${x.unsure?" unsure":""}${x.exists&&!x.checked?" dim":""}">
      <div class="ps-r1"><button class="ps-cb${x.checked?" on":""}" onclick="psSet(${i},'checked',${!x.checked})" aria-label="Välj">${ic("check")}</button>
        <input class="ps-title" value="${esc(x.title)}" placeholder="Titel" oninput="psSet(${i},'title',this.value,1)">
        <button class="ps-x" onclick="psDel(${i})" aria-label="Ta bort">${ic("x")}</button></div>
      ${compact?"":`<div class="ps-r2"><input value="${esc(x.author)}" placeholder="Författare" oninput="psSet(${i},'author',this.value,1)">
        <select onchange="psSet(${i},'cat',this.value,1)">${(cats.includes(x.cat)?cats:[x.cat].concat(cats)).map(c=>`<option${c===x.cat?" selected":""}>${esc(c)}</option>`).join("")}</select></div>`}
      ${x.unsure?`<span class="ps-note warn">Osäker avläsning – kontrollera</span>`:x.note?`<span class="ps-note">${esc(x.note)}</span>`:""}</div>`};
  const isSpot=/:L\d+$/.test(PS.code);
  el.innerHTML=`<div class="ps-top"><button class="ps-cancel" onclick="psClose()">Avbryt</button>
      <div class="ps-ttl"><b>${isA?"Analysera":"Rätta"}</b><span>${esc(nsCap(r))}</span></div><span></span></div>
    <div class="ps-scroll">
      <div class="ps-photo">${img?`<img src="${img}" alt="" data-rot="${PS.id}" style="transform:${rotCss(PS.id)}" onclick="lbGap('${img}')">`:""}
        <button class="pc-rot" onclick="nsRotate(${PS.id})">${ic("rotate-cw")}Vrid</button></div>
      ${isA?`<div class="ps-chips"><span><b class="mono">${PS.rows.length}</b>avlästa</span>${unsure?`<span class="warn"><b class="mono">${unsure}</b>osäker</span>`:""}${exRows.length?`<span class="ex"><b class="mono">${exRows.length}</b>finns redan</span>`:""}</div>
        <p class="fine ps-help">Rätta det som blivit fel och stryk det som inte är en bok. Orange rader var osäkra. Böcker som redan finns i katalogen är bortvalda.</p>`
        :`<p class="fine ps-help">Böckerna på hyllan. Ändra det som är fel. Kryssa ur eller tryck ✕ för att ta bort en bok ur katalogen.</p>`}
      <div class="ps-code"><span>Hyllkod</span><input value="${esc(PS.code)}" oninput="PS.code=this.value.trim().toUpperCase()" ${isA?"":"disabled"}>
        ${isA&&isSpot?`<input class="ps-spot" value="${esc(PS.spot)}" placeholder="Hyllplanets namn" oninput="PS.spot=this.value">`:""}</div>
      <div class="ps-rows">${newRows.map(x=>row(x)).join("")||(isA?"":`<p class="fine">Inga böcker på den här hyllan än.</p>`)}</div>
      ${exRows.length?`<div class="ps-ex"><button class="ps-exh" onclick="PS.showEx=!PS.showEx;renderPS()"><span><b class="mono">${exRows.length}</b> finns redan i katalogen</span><span class="pc-chev${PS.showEx?" up":""}">${ic("chevron-down")}</span></button>
        ${PS.showEx?`<div class="ps-rows">${exRows.map(x=>row(x,true)).join("")}</div>`:""}</div>`:""}
      <button class="ps-add" onclick="psAdd()">${ic("plus")}Lägg till bok</button>
    </div>
    <div class="ps-bar"><button class="ps-save${isA&&!sel?" off":""}" onclick="psSave(this)" ${isA&&!sel?"disabled":""}>${ic("check")}${isA?(sel?`Lägg in ${sel} ${sel===1?"bok":"böcker"}`:"Inget valt"):"Spara ändringar"}</button></div>`;
}
/* Ändringar i fält ritar inte om vyn (då tappar fältet fokus) - bara knappen. */
function psSet(i,f,v,quiet){if(!PS||!PS.rows[i])return;PS.rows[i][f]=v;if(f==="title"||f==="author")PS.rows[i].unsure=false;
  if(!quiet)renderPS();else psUpdateBar()}
function psUpdateBar(){
  const b=document.querySelector("#psView .ps-save");if(!b||!PS)return;
  const sel=PS.rows.filter(x=>x.checked&&x.title.trim()).length;
  if(PS.mode==="analys"){b.disabled=!sel;b.classList.toggle("off",!sel);b.lastChild.textContent=sel?`Lägg in ${sel} ${sel===1?"bok":"böcker"}`:"Inget valt"}
}
/* Ta bort en rad. I Rätta blir en befintlig bok markerad för radering
   (bekräftas när du sparar); nya rader stryks bara. */
function psDel(i){if(!PS||!PS.rows[i])return;const x=PS.rows[i];
  if(x.bookId)PS.deleted=(PS.deleted||[]).concat([x]);
  PS.rows.splice(i,1);renderPS()}
function psAdd(){if(!PS)return;PS.rows.push({k:"m"+Date.now(),title:"",author:"",cat:"Okategoriserad",checked:true,exists:false});renderPS();
  const ins=document.querySelectorAll("#psView .ps-rows .ps-title");const last=ins[ins.length-1];if(last)last.focus()}
async function psSave(btn){
  if(!PS||!sbUser)return;
  const r=(window.__nsRows||[]).find(x=>x.id===PS.id)||{};
  if(btn){btn.disabled=true}
  try{
    if(PS.mode==="analys"){
      const shelf=(PS.code||"").trim().toUpperCase();
      if(!/^\d+:[VHSKL]\d+$/.test(shelf)){alert("Hyllkoden ser inte rätt ut. Den ska se ut som 10:S3, 1:V2 eller 10:L1.");if(btn)btn.disabled=false;return}
      if(/:L\d+$/.test(shelf)&&PS.spot.trim()){await sb.from("spot_names").upsert({code:shelf,name:PS.spot.trim()});spotNames[shelf]=PS.spot.trim()}
      const rows=PS.rows.filter(x=>x.checked&&x.title.trim());
      const {inserted,skipped}=await insertBooks(rows.map(x=>({title:x.title.trim(),author:x.author.trim(),cat:x.cat||"Okategoriserad",shelf,
        description:(x.description||"").trim()||null,source:"claude",uncertain:!!x.unsure,created_by:sbUser.id})));
      delete analysBooks[analysKey("shelf",PS.id)];
      nsMsg={text:`${inserted.length} ${inserted.length===1?"bok inlagd":"böcker inlagda"} i ${nsCap(r)}.${skipped.length?` ${skipped.length} fanns redan.`:""}`,undo:null};
    }else{
      const removed=(PS.deleted||[]).concat(PS.rows.filter(x=>x.bookId&&!x.checked));
      const added=PS.rows.filter(x=>!x.bookId&&x.checked&&x.title.trim());
      const changed=PS.rows.filter(x=>x.bookId&&x.checked&&x.orig&&(x.title.trim()!==x.orig.title||x.author.trim()!==x.orig.author||x.cat!==x.orig.cat));
      if(!removed.length&&!added.length&&!changed.length){psClose();return}
      if(removed.length){
        const ok=await ask({title:"Ta bort böcker?",text:`${removed.length} ${removed.length===1?"bok tas":"böcker tas"} bort ur katalogen: ${removed.map(x=>x.orig.title).slice(0,5).join(", ")}${removed.length>5?" …":""}. Det går inte att ångra.`,
          buttons:[{label:"Ja, spara",value:true,kind:"danger"},{label:"Avbryt",value:false}]});
        if(!ok){if(btn)btn.disabled=false;return}
      }
      for(const x of changed){
        const {error}=await sb.from("manual_books").update({title:x.title.trim(),author:x.author.trim(),cat:x.cat}).eq("id",x.bookId);
        if(error)throw new Error(`"${x.title}": ${error.message}`);
        if(x.cat!==x.orig.cat)await sb.from("book_cat").upsert({book_id:x.bookId,cat:x.cat,updated_at:new Date().toISOString()});
        const d=data.find(d=>d.id===x.bookId);if(d)Object.assign(d,{title:x.title.trim(),author:x.author.trim(),cat:x.cat});
      }
      for(const x of removed){
        const {error}=await sb.from("manual_books").delete().eq("id",x.bookId);
        if(error)throw new Error(`"${x.orig.title}": ${error.message}`);
        const k=data.findIndex(d=>d.id===x.bookId);if(k>=0)data.splice(k,1);
      }
      let ins=[];
      if(added.length)ins=(await insertBooks(added.map(x=>({title:x.title.trim(),author:x.author.trim(),cat:x.cat||"Okategoriserad",shelf:PS.code,created_by:sbUser.id})))).inserted;
      const parts=[changed.length&&`${changed.length} ändrade`,removed.length&&`${removed.length} borttagna`,ins.length&&`${ins.length} tillagda`].filter(Boolean);
      nsMsg={text:`Ändringarna i ${nsCap(r)} är sparade (${parts.join(", ")}).`,undo:null};
    }
    const doneId=PS.mode==="analys"&&psFromPlace===PS.id?PS.id:null;
    nsOpenId=PS.id;psClose();
    buildShelfOptions();rebuildCatFilter();render();renderNsList();
    /* Ligger hyllsidan kvar över appen ska den visa de nya antalen, inte
       "väntar på granskning" för böcker som nu är inlagda. */
    {const nd=document.getElementById("nsDone");if(nd&&nd.style.display!=="none"&&nsHyllaSenast)nsShowHylla(nsHyllaSenast.bc,nsHyllaSenast.opts)}
    if(doneId!=null){psFromPlace=null;
      const ok=await ask({title:"Klarmarkera fotot?",text:"Då räknas hyllplanet som klart"+(PH.some(x=>x.nsId===doneId&&x.shelves.length)?", och fotot ersätter ett äldre foto av samma hyllplan.":"."),
        buttons:[{label:"Klarmarkera",value:true,kind:"primary"},{label:"Senare",value:false}]});
      if(ok){await nsDone(doneId);if(curView==="place")renderPlace()}}
  }catch(e){alert("Kunde inte spara: "+(e.message||e));if(btn)btn.disabled=false}
}
window.psClose=psClose;window.psSet=psSet;window.psDel=psDel;window.psAdd=psAdd;window.psSave=psSave;window.renderPS=renderPS;
Object.defineProperty(window,"PS",{get:()=>PS,configurable:true});

/* Läsbart namn på ett inskickat foto. Står hyllkoden som etikett ("1:V3")
   blir det "Vänster · plan 3". */
function nsCap(r){
  const lbl=(r.label||"").trim(),code=shelfCodeForRow(r);
  return /^\d+:[VHSKL]\d+$/i.test(lbl)&&code?locLabel(code).split(" · ").slice(1).join(" · ").replace(/^./,c=>c.toUpperCase()):(lbl||"Foto");
}
function syncShelfPhotos(rows){
  for(let i=PH.length-1;i>=0;i--)if(PH[i].db)PH.splice(i,1);
  (rows||[]).slice().sort((a,b)=>String(a.created_at||"").localeCompare(String(b.created_at||""))||(a.id-b.id)).forEach(r=>{
    const src=r.photo_data||r.photo_url;if(!src||!r.bc)return;
    const code=shelfCodeForRow(r);
    const codes=r.shelf_code&&r.shelf_code.includes(",")?r.shelf_code.split(",").map(x=>x.trim()).filter(Boolean):(code?[code]:[]);
    const cap=nsCap(r);
    PH.push({bc:String(r.bc),cap,src,thumb:src,shelves:codes,fi:PH.length,db:true,
      nsId:r.id,done:r.state==="done",doneAt:r.done_at?new Date(r.done_at).getTime():0,createdAt:new Date(r.created_at||0).getTime()});
  });
  markReplaced();
  rebuildFlatFromPH();
  renderHome();if(curView==="place")renderPlace();
}
/* Vilken hyllkod hor det har fotot till? Forst den gissade koden ur
   etiketten, annars en los plats vars namn matchar etiketten. */
function shelfCodeForRow(r){
  /* Ett foto kan täcka flera hyllor ("6:S2,6:S1"); då gäller den första
     som standard vid avläsning, och alla vid ersättning av äldre foton. */
  if(r.shelf_code&&r.shelf_code.includes(","))return r.shelf_code.split(",")[0].trim();
  const guess=guessShelfCode(r.bc,r.shelf_code||r.label);
  if(guess)return guess;
  const lbl=(r.label||"").trim().toLowerCase();
  const hit=Object.keys(spotNames).find(c=>
    c.startsWith(r.bc+":L")&&(spotNames[c]||"").trim().toLowerCase()===lbl);
  return hit||null;
}

/* Visa: fotot och bockerna som star dar, bredvid varandra. Att bara oppna
   bilden racker inte - man vill jamfora den mot listan. */
let nsViewOpen={};
function nsView(id){
  const r=(window.__nsRows||[]).find(x=>x.id===id);if(!r)return;
  const src=r.photo_data||r.photo_url;if(!src)return;
  const wrap=document.getElementById("ab-shelf-"+id);if(!wrap)return;
  if(nsViewOpen[id]){nsViewOpen[id]=false;wrap.style.display="none";wrap.innerHTML="";return}
  /* En pagaende granskning far inte skrivas over. */
  if(analysBooks[analysKey("shelf",id)]){renderAnalys("shelf",id);return}
  nsViewOpen[id]=true;
  const code=shelfCodeForRow(r);
  const list=code?data.filter(d=>d.shelf===code):[];
  nsRot[id]=nsRot[id]||0;
  wrap.innerHTML=`<div class="ab-photo">
      <img src="${src}" alt="${r.name}" style="transform:rotate(${nsRot[id]}deg)"
           onclick="lbGap('${src}')" title="Klicka för att zooma">
      <button class="ghost ab-rot" onclick="nsViewRotate(${id})">↻ Vrid</button>
    </div>
    <div class="ab-list">
      <p class="gap-help">${code?`${locLabel(code)} — <b>${list.length} böcker</b> i katalogen.`
        :"Det här hyllplanet har ingen hyllkod ännu. Läs av fotot så får det en."}</p>
      ${list.length?`<ul class="ns-booklist">${list.map(d=>
        `<li><a class="var-link" onclick="showInfo(${d.id})">${d.title.replace(/'/g,"’")}</a>
         <span class="bk-cat">${d.cat}</span></li>`).join("")}</ul>`
        :(code?`<p class="gap-help">Inga böcker inlagda här ännu. Tryck Analysera.</p>`:"")}
      <div class="gap-actions"><button class="ghost" onclick="nsView(${id})">Stäng</button></div>
    </div>`;
  wrap.style.display="";
}
function nsViewRotate(id){nsRot[id]=((nsRot[id]||0)+90)%360;nsViewOpen[id]=false;nsView(id)}
async function nsSetState(id,state){
  if(!sbUser){alert("Logga in först.");return false}
  const {error}=await sb.from("new_shelves").update({state,done_at:state==="done"?new Date().toISOString():null}).eq("id",id);
  if(error){alert("Kunde inte spara: "+error.message);return false}
  await loadNewShelves();return true;
}
async function nsDone(id){
  const r=(window.__nsRows||[]).find(x=>x.id===id);
  if(nsOpenId===id)nsOpenId=null;
  nsMsg={text:`${r?nsCap(r):"Fotot"} (${r?(bcNames[topBc(String(r.bc))]||r.name):""}) är klar.`,undo:id};
  if(!await nsSetState(id,"done"))nsMsg=null;
}
async function nsReopen(id,quiet){
  const r=(window.__nsRows||[]).find(x=>x.id===id);
  if(await nsSetState(id,"waiting")){if(!quiet)nsMsg={text:`${r?nsCap(r):"Fotot"} är öppnad igen.`,undo:null};renderNsMsg()}
}
const nsBtn=document.getElementById("nsStart");
if(nsBtn)nsBtn.addEventListener("click",nsStartWizard);
window.nsPick=nsPick;window.nsBack=nsBack;window.nsCancel=nsCancel;window.nsSaveName=nsSaveName;
window.nsPickExisting=nsPickExisting;window.nsType=nsType;window.nsCamShot=nsCamShot;window.nsToggleTips=nsToggleTips;
window.nsAvbrytAnalys=nsAvbrytAnalys;window.nsTillInloggning=nsTillInloggning;window.nsDelaVal=nsDelaVal;window.nsDelaAvbryt=nsDelaAvbryt;window.nsDelaKlar=nsDelaKlar;
window.nsDelaLaggTill=nsDelaLaggTill;window.nsDelaAterstall=nsDelaAterstall;
window.nsCloseTips=nsCloseTips;window.nsToggleMulti=nsToggleMulti;
window.nsDelShot=nsDelShot;window.nsShotLabel=nsShotLabel;
window.nsFinish=nsFinish;window.nsToggle=nsToggle;window.nsRotate=nsRotate;window.nsUndo=nsUndo;window.nsAnalyse=nsAnalyse;window.psOpen=psOpen;window.vardVisaListan=vardVisaListan;window.vardOppnaAldrig=vardOppnaAldrig;window.vardOppnaKor=vardOppnaKor;window.vardOppnaKlar=vardOppnaKlar;window.vardStangKlar=vardStangKlar;window.openVard=openVard;window.ibSetTab=ibSetTab;window.ibAndra=ibAndra;window.nsView=nsView;window.nsViewRotate=nsViewRotate;window.nsDone=nsDone;window.nsReopen=nsReopen;
window.nsAddHyllplan=nsAddHyllplan;window.nsShowHylla=nsShowHylla;

/* ---------- Dela ----------
   Den gamla "skicka ett textmeddelande om biblioteket"-genvägen (#shareBtn/
   #copyLink i Delade-fliken) utgår här - Delade-fliken är ombyggd för
   Delning v1:s riktiga länkar med faktisk läsbehörighet (se delaSkapaBtn/
   DELA V1 nedan), som ersätter den. navigator.share-knappen för att dela
   själva APPEN (Inställningar > "Dela appen", #shareAppBtn) är en annan
   funktion och påverkas inte. */
window.__lt=()=>renderCatUI();window.__lt();

if(sbUser){
  for(const [name,fn] of [["manualBooks",loadManualBooks],["statuses",loadStatuses],["gaps",loadGaps],["catEdits",loadCatEdits],["covers",loadCoverOverrides],["newShelves",loadNewShelves]]){
    try{await fn()}catch(e){console.warn(name+" misslyckades:",e)}
  }
  /* Fynd 30/10: "Kategori" kunde visas helt tom i Värdera-arket, med
     "0 böcker valda" trots ett bibliotek fullt av kategoriserade böcker.
     Orsak: loadManualBooks() (ovan) är async och data (den globala
     katalogen renderVardCats/vardMatches läser) är fortfarande tom om
     man hinner trycka "Välj böcker" innan den raden är klar - t.ex.
     direkt efter en sidomladdning (versionskollen i index.html gör en
     automatisk sådan vid ny version). Ingen felbanner visas (felet
     fångas tyst av try/catch ovan, och det är egentligen inget fel -
     bara en kapplöpning). Om arket redan hann öppnas för tomt: rita om
     det nu när katalogen äntligen finns. */
  if(vardSheet&&vardSheet.classList.contains("open")){renderVardCats();vardSyncCount()}
}
})();
