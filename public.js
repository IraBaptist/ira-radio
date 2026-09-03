const API=(window.IRA_PUBLIC_API_URL||'').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function qlabel(q){return Number(q)>=5?'OT':`Q${Number(q)||1}`}
function setBadge(text,cls=''){const e=document.getElementById('connectionBadge');e.textContent=text;e.className='connection-badge '+cls}
function render(d){
  if(!d||!d.ok||!d.data){document.getElementById('publicApp').innerHTML='<div class="card setup-card"><h2>No live game published yet</h2><p class="muted">The scoreboard will appear when the radio booth publishes the game.</p></div>';setBadge('Waiting','stale');return}
  const x=d.data,g=x.game||{},age=(Date.now()-new Date(x.updated).getTime())/1000,period=g.quarterLabel||qlabel(g.quarter),status=g.final?'FINAL':`${period} • ${esc(g.clock||'')}`;
  setBadge(age<45?'LIVE':'Last update '+Math.max(1,Math.round(age/60))+'m ago',age<45?'live':'stale');
  const possession=!g.final?(g.possession==='ira'?'🏈 IRA BULLDOGS BALL':`🏈 ${esc(String(g.opponent||'OPPONENT').toUpperCase())} BALL`):'';
  const update=String(g.latestUpdate||'').trim();
  document.getElementById('publicApp').innerHTML=`
    <section class="public-scoreboard card">
      <div class="public-statusline">${status}</div>
      <div class="public-score">
        <div class="public-team-block"><div class="public-team">IRA BULLDOGS</div><div class="public-score-number">${Number(g.iraScore||0)}</div></div>
        <div class="score-dash">–</div>
        <div class="public-team-block"><div class="public-team">${esc(g.opponent||'Opponent')}</div><div class="public-score-number">${Number(g.oppScore||0)}</div></div>
      </div>
      ${possession?`<div class="public-possession">${possession}</div>`:''}
      ${x.listenUrl?`<a class="listen-btn" href="${esc(x.listenUrl)}" target="_blank" rel="noopener">▶ Listen Live</a>`:''}
    </section>
    <section class="card public-update-card">
      <div class="eyebrow">LATEST UPDATE</div>
      <div class="latest-update">${update?esc(update):'Score and game status are live. Additional radio updates will appear here when sent from the booth.'}</div>
    </section>`;
}
function jsonp(){
  if(!API){document.getElementById('publicApp').innerHTML='<div class="card setup-card"><h2>Public scoreboard is ready</h2><p>Connect the deployed Google Apps Script URL in <code>config.js</code>.</p></div>';setBadge('Setup needed','stale');return}
  const cb='iraPublic_'+Date.now()+'_'+Math.floor(Math.random()*10000);let script;
  window[cb]=d=>{try{render(d)}finally{delete window[cb];script.remove()}};
  script=document.createElement('script');script.src=API+(API.includes('?')?'&':'?')+'action=public&callback='+encodeURIComponent(cb)+'&_='+Date.now();script.onerror=()=>{setBadge('Connection issue','stale');delete window[cb];script.remove()};document.body.appendChild(script);
}
jsonp();setInterval(jsonp,12000);
