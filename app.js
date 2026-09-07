(() => {
'use strict';
const VERSION='2.0.0';
const STORAGE_KEY='ira_simple_scoreboard_v2';
const DEFAULT_PUBLISH_KEY='IRA-RADIO-2026-8f3a1d';
const IRA_COLOR='#f58220';
const defaultState=()=>({
  version:VERSION,
  iraScore:0,
  opponentScore:0,
  opponentName:'Opponent',
  opponentColor:'#1f5fbf',
  possession:'',
  updates:[],
  settings:{publishKey:DEFAULT_PUBLISH_KEY}
});
let state=load();
let publishTimer=null;
let editingId=null;
let pendingDeleteId=null;

function safeScore(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.round(n)):0}
function normalizeHex(v){const s=String(v||'').trim();return /^#[0-9a-fA-F]{6}$/.test(s)?s:'#1f5fbf'}
function uid(){return 'u_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)}
function nowIso(){return new Date().toISOString()}
function load(){try{const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(!raw)return defaultState();return {...defaultState(),...raw,iraScore:safeScore(raw.iraScore),opponentScore:safeScore(raw.opponentScore),opponentColor:normalizeHex(raw.opponentColor),updates:Array.isArray(raw.updates)?raw.updates:[]}}catch{return defaultState()}}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function effectiveApi(){return String(window.IRA_PUBLIC_API_URL||'').trim()}
function publishKey(){return String(state.settings?.publishKey||DEFAULT_PUBLISH_KEY).trim()}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmtTime(iso){try{return new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date(iso))}catch{return ''}}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),1600)}

function setState(mutator,message='Saved'){
  mutator(state);
  state.iraScore=safeScore(state.iraScore);
  state.opponentScore=safeScore(state.opponentScore);
  state.opponentName=String(state.opponentName||'Opponent').trim().slice(0,40)||'Opponent';
  state.opponentColor=normalizeHex(state.opponentColor);
  persist();render();schedulePublish();if(message)toast(message);
}

function render(){
  document.documentElement.style.setProperty('--opp',state.opponentColor);
  document.getElementById('iraScore').value=state.iraScore;
  document.getElementById('opponentScore').value=state.opponentScore;
  document.getElementById('opponentName').value=state.opponentName;
  document.getElementById('opponentColor').value=state.opponentColor;
  document.getElementById('iraPossession').classList.toggle('active',state.possession==='ira');
  document.getElementById('opponentPossession').classList.toggle('active',state.possession==='opponent');
  document.getElementById('opponentPossession').textContent=`🏈 ${state.opponentName.toUpperCase()} HAS THE BALL`;
  const list=[...state.updates].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  document.getElementById('updatesList').innerHTML=list.length?list.map(u=>`<article class="update-item" data-id="${esc(u.id)}"><div class="update-meta"><strong>${esc(u.text.split(/\n/)[0].slice(0,50)||'Update')}</strong><span class="update-time">${esc(fmtTime(u.createdAt))}</span></div><div class="update-text">${esc(u.text)}</div><div class="update-actions"><button type="button" class="edit-btn" data-edit="${esc(u.id)}">Edit</button><button type="button" class="delete-btn" data-delete="${esc(u.id)}">Delete</button></div></article>`).join(''):'<div class="empty">No updates posted yet.</div>';
}

function payload(){return {
  version:20,
  updated:nowIso(),
  simpleScoreboard:true,
  game:{
    iraScore:safeScore(state.iraScore),
    oppScore:safeScore(state.opponentScore),
    opponent:state.opponentName,
    opponentColor:state.opponentColor,
    possession:state.possession,
    updates:[...state.updates].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).map(u=>({id:u.id,text:u.text,createdAt:u.createdAt,editedAt:u.editedAt||''}))
  }
}}

function schedulePublish(){clearTimeout(publishTimer);publishTimer=setTimeout(()=>publishPublic(false),350)}
function jsonp(url,params={}){return new Promise((resolve,reject)=>{const cb='iraSimple_'+Date.now()+'_'+Math.floor(Math.random()*1e6);const s=document.createElement('script');const q=new URLSearchParams({...params,callback:cb});window[cb]=d=>{cleanup();resolve(d)};function cleanup(){try{delete window[cb]}catch{}s.remove()}s.onerror=()=>{cleanup();reject(new Error('Connection failed'))};s.src=url+(url.includes('?')?'&':'?')+q.toString();document.body.appendChild(s);setTimeout(()=>{if(window[cb]){cleanup();reject(new Error('Timed out'))}},7000)})}
async function publishPublic(showToast=true){
  const url=effectiveApi(),key=publishKey(),status=document.getElementById('publicStatus');
  if(!url||!key){status.textContent='Public: setup needed';if(showToast)toast('Public connection is not configured');return false}
  if(!navigator.onLine){status.textContent='Public: offline';if(showToast)toast('Offline — changes remain saved here');return false}
  try{
    status.textContent='Public: sending…';
    const p=payload();
    const body=new URLSearchParams({action:'publish',key,payload:JSON.stringify(p)});
    await fetch(url,{method:'POST',mode:'no-cors',body});
    let verified=false;
    try{await new Promise(r=>setTimeout(r,300));const chk=await jsonp(url,{action:'public',_:Date.now()});const d=chk?.data?.game;verified=!!(chk?.ok&&d&&safeScore(d.iraScore)===p.game.iraScore&&safeScore(d.oppScore)===p.game.oppScore&&String(d.opponent||'')===p.game.opponent&&String(d.possession||'')===p.game.possession&&Array.isArray(d.updates)&&d.updates.length===p.game.updates.length)}catch{}
    status.textContent=verified?'Public: updated':'Public: sent';
    if(showToast)toast(verified?'Public scoreboard updated':'Update sent');
    return true;
  }catch(e){console.error(e);status.textContent='Public: send failed';if(showToast)toast('Could not send public update');return false}
}

function addUpdate(){const input=document.getElementById('newUpdate');const text=input.value.trim();if(!text){toast('Type an update first');input.focus();return}setState(s=>s.updates.push({id:uid(),text:text.slice(0,280),createdAt:nowIso(),editedAt:''}),'Update posted');input.value='';updateCharCount()}
function openEdit(id){const u=state.updates.find(x=>x.id===id);if(!u)return;editingId=id;document.getElementById('editUpdateText').value=u.text;document.getElementById('editDialog').showModal()}
function saveEdit(){if(!editingId)return;const text=document.getElementById('editUpdateText').value.trim();if(!text){toast('Update cannot be blank');return}const id=editingId;setState(s=>{const u=s.updates.find(x=>x.id===id);if(u){u.text=text.slice(0,280);u.editedAt=nowIso()}} ,'Update edited');editingId=null}
function askDelete(id){const u=state.updates.find(x=>x.id===id);if(!u)return;pendingDeleteId=id;document.getElementById('confirmTitle').textContent='Delete this update?';document.getElementById('confirmText').textContent=u.text;document.getElementById('confirmYes').textContent='Delete';document.getElementById('confirmDialog').showModal()}
function doDelete(){if(!pendingDeleteId)return;const id=pendingDeleteId;setState(s=>{s.updates=s.updates.filter(x=>x.id!==id)},'Update deleted');pendingDeleteId=null}
function resetBoard(){pendingDeleteId='__RESET__';document.getElementById('confirmTitle').textContent='Reset scoreboard?';document.getElementById('confirmText').textContent='This clears both scores, possession, and all posted updates. The opponent name and color will stay.';document.getElementById('confirmYes').textContent='Reset';document.getElementById('confirmDialog').showModal()}
function confirmAction(){if(pendingDeleteId==='__RESET__'){setState(s=>{s.iraScore=0;s.opponentScore=0;s.possession='';s.updates=[]},'Scoreboard reset');pendingDeleteId=null}else doDelete()}
function updateCharCount(){const t=document.getElementById('newUpdate').value;document.getElementById('charCount').textContent=`${t.length} / 280`}

function wire(){
  document.querySelectorAll('[data-score]').forEach(b=>b.addEventListener('click',()=>{const [team,d]=b.dataset.score.split(':');const delta=Number(d);setState(s=>{if(team==='ira')s.iraScore=safeScore(s.iraScore+delta);else s.opponentScore=safeScore(s.opponentScore+delta)},'Score updated')}));
  document.getElementById('iraScore').addEventListener('change',e=>setState(s=>s.iraScore=safeScore(e.target.value),'Ira score saved'));
  document.getElementById('opponentScore').addEventListener('change',e=>setState(s=>s.opponentScore=safeScore(e.target.value),'Opponent score saved'));
  document.getElementById('iraPossession').addEventListener('click',()=>setState(s=>s.possession='ira','Ira possession'));
  document.getElementById('opponentPossession').addEventListener('click',()=>setState(s=>s.possession='opponent',`${state.opponentName} possession`));
  document.getElementById('clearPossession').addEventListener('click',()=>setState(s=>s.possession='','Possession cleared'));
  document.getElementById('applyOpponent').addEventListener('click',()=>{const name=document.getElementById('opponentName').value;const color=document.getElementById('opponentColor').value;setState(s=>{s.opponentName=name;s.opponentColor=color},'Opponent display saved')});
  document.getElementById('opponentName').addEventListener('change',()=>document.getElementById('applyOpponent').click());
  document.getElementById('opponentColor').addEventListener('change',()=>document.getElementById('applyOpponent').click());
  document.querySelectorAll('[data-color]').forEach(b=>b.addEventListener('click',()=>{document.getElementById('opponentColor').value=b.dataset.color;document.getElementById('applyOpponent').click()}));
  document.getElementById('postUpdate').addEventListener('click',addUpdate);
  document.getElementById('newUpdate').addEventListener('input',updateCharCount);
  document.getElementById('newUpdate').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();addUpdate()}});
  document.getElementById('updatesList').addEventListener('click',e=>{const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(edit)openEdit(edit.dataset.edit);if(del)askDelete(del.dataset.delete)});
  document.getElementById('editForm').addEventListener('submit',e=>{e.preventDefault();if(e.submitter?.id==='saveEdit'){const text=document.getElementById('editUpdateText').value.trim();if(!text){toast('Update cannot be blank');return}saveEdit();document.getElementById('editDialog').close()}else{editingId=null;document.getElementById('editDialog').close()}});
  document.getElementById('confirmDialog').addEventListener('close',()=>{if(document.getElementById('confirmDialog').returnValue==='default')confirmAction();else pendingDeleteId=null});
  document.getElementById('publishNow').addEventListener('click',()=>publishPublic(true));
  document.getElementById('resetGame').addEventListener('click',resetBoard);
  window.addEventListener('online',()=>publishPublic(false));
}

function selfTest(){
  const t=defaultState();
  t.iraScore=6;t.opponentScore=8;t.opponentName='Jayton Jaybirds';t.opponentColor='#112233';t.possession='ira';
  t.updates=[{id:'a',text:'Older',createdAt:'2026-09-07T20:00:00.000Z'},{id:'b',text:'Newest',createdAt:'2026-09-07T20:01:00.000Z'}];
  const checks=[];
  checks.push(['score sanitation',safeScore(-2)===0&&safeScore('7')===7]);
  checks.push(['hex color',normalizeHex('#abcdef')==='#abcdef'&&normalizeHex('orange')==='#1f5fbf']);
  const old=state;state=t;const p=payload();state=old;
  checks.push(['payload scores',p.game.iraScore===6&&p.game.oppScore===8]);
  checks.push(['payload opponent',p.game.opponent==='Jayton Jaybirds'&&p.game.opponentColor==='#112233']);
  checks.push(['payload possession',p.game.possession==='ira']);
  checks.push(['newest first',p.game.updates[0].text==='Newest'&&p.game.updates[1].text==='Older']);
  checks.push(['manual feed only',Object.keys(p.game).sort().join(',')==='iraScore,oppScore,opponent,opponentColor,possession,updates']);
  return checks;
}

wire();render();updateCharCount();publishPublic(false);
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js?v=2000',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{})}
window.__IRA_SIMPLE_TEST={defaultState,safeScore,normalizeHex,payload,selfTest,getState:()=>JSON.parse(JSON.stringify(state))};
})();
