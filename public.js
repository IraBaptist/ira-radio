(() => {
'use strict';
const API=String(window.IRA_PUBLIC_API_URL||'').trim();
let lastSuccess=0;
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function score(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.round(n)):0}
function color(v){return /^#[0-9a-fA-F]{6}$/.test(String(v||''))?String(v):'#1f5fbf'}
function fmtTime(iso){try{return new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date(iso))}catch{return ''}}
function badge(text){document.getElementById('connectionBadge').textContent=text}
function renderResponse(resp){
  const data=resp?.data;
  if(!resp?.ok||!data?.game){document.getElementById('publicApp').innerHTML='<section class="waiting"><h2>Ira Bulldogs Scoreboard</h2><p>Waiting for the radio booth to publish the game.</p></section>';badge('Waiting for update');return}
  const g=data.game;
  const opp=String(g.opponent||'Opponent').trim()||'Opponent';
  const oppColor=color(g.opponentColor);
  document.documentElement.style.setProperty('--opp',oppColor);
  const updates=Array.isArray(g.updates)?[...g.updates].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))):[];
  const feed=updates.length?updates.map(u=>`<article class="update"><div class="update-text">${esc(u.text)}</div><div class="update-time">${esc(fmtTime(u.createdAt))}${u.editedAt?' · edited':''}</div></article>`).join(''):'<div class="empty-feed">No game updates posted yet.</div>';
  document.getElementById('publicApp').innerHTML=`<section class="score-wrap"><div class="score-row"><div class="team ira"><div class="team-name">IRA BULLDOGS</div><div class="score">${score(g.iraScore)}</div><div class="ball ${g.possession==='ira'?'':'empty'}">🏈 HAS THE BALL</div></div><div class="team opponent"><div class="team-name">${esc(opp.toUpperCase())}</div><div class="score">${score(g.oppScore)}</div><div class="ball ${g.possession==='opponent'?'':'empty'}">🏈 HAS THE BALL</div></div></div></section><section class="updates">${feed}</section>`;
  lastSuccess=Date.now();badge('Live · updates automatically');
}
function jsonp(){
  if(!API){document.getElementById('publicApp').innerHTML='<section class="waiting"><h2>Scoreboard setup needed</h2><p>The public API URL is missing from config.js.</p></section>';badge('Setup needed');return}
  const cb='iraSimplePublic_'+Date.now()+'_'+Math.floor(Math.random()*1e6);const s=document.createElement('script');
  window[cb]=d=>{cleanup();renderResponse(d)};function cleanup(){try{delete window[cb]}catch{}s.remove()}
  s.onerror=()=>{cleanup();badge(lastSuccess?'Connection interrupted · showing last update':'Connection issue')};
  s.src=API+(API.includes('?')?'&':'?')+'action=public&callback='+encodeURIComponent(cb)+'&_='+Date.now();document.body.appendChild(s);
  setTimeout(()=>{if(window[cb]){cleanup();badge(lastSuccess?'Connection slow · showing last update':'Connection slow')}},7000);
}
jsonp();setInterval(jsonp,5000);
window.__IRA_PUBLIC_TEST={renderResponse,score,color};
})();
