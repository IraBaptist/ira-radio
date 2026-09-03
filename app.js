'use strict';

const STORAGE_KEY = 'ira_radio_game_center_v1';
const APP_VERSION = '1.6.0 FINAL';
const IRA_ORANGE = '#e66b16';
const NEUTRAL_DARK = '#111111';
const NEUTRAL_INACTIVE = '#707070';
const DEFAULT_PUBLISH_KEY = 'IRA-RADIO-2026-8f3a1d';

const DEFAULT_SCHEDULE = [
  {week:1,date:'2026-08-28',time:'7:30 PM',opponent:'Roby Lions',site:'Away',district:false,result:'Loss 65-38'},
  {week:2,date:'2026-09-04',time:'7:30 PM',opponent:'Jayton Jaybirds',site:'Home',district:false},
  {week:3,date:'2026-09-11',time:'7:30 PM',opponent:'Garden City Bearkats',site:'Away',district:false},
  {week:4,date:'2026-09-18',time:'7:00 PM',opponent:'Abilene Christian Panthers',site:'Home',district:false},
  {week:5,date:'2026-09-25',time:'7:30 PM',opponent:'Meadow Broncos',site:'Away',district:false},
  {week:6,date:'',time:'',opponent:'OPEN / BYE',site:'',district:false},
  {week:7,date:'2026-10-09',time:'7:30 PM',opponent:'Sands Mustangs',site:'Home',district:true},
  {week:8,date:'2026-10-16',time:'7:00 PM',opponent:'Klondike Cougars',site:'Away',district:true},
  {week:9,date:'2026-10-23',time:'7:30 PM',opponent:"O'Donnell Eagles",site:'Home',district:true},
  {week:10,date:'2026-10-30',time:'7:00 PM',opponent:'Borden County Coyotes',site:'Away',district:true},
  {week:11,date:'2026-11-06',time:'7:00 PM',opponent:'Westbrook Wildcats',site:'Home',district:true}
];

const OPPONENT_DEFAULT_COLORS = {
  'Roby Lions':'#b91c1c',
  'Jayton Jaybirds':'#111111',
  'Garden City Bearkats':'#111111',
  'Abilene Christian Panthers':'#111111',
  'Meadow Broncos':'#111111',
  'Sands Mustangs':'#111111',
  'Klondike Cougars':'#111111',
  "O'Donnell Eagles":'#111111',
  'Borden County Coyotes':'#111111',
  'Westbrook Wildcats':'#111111'
};

const VERIFIED_PREGAME_FALLBACK = {
  2:{
    opponent:{name:'Jayton Jaybirds',rank:5,leagueRank:5,rating:332.92,record:'1-0',coach:'Josh Stanaland'},
    projection:'Current SixManFootball ratings: Jayton 332.92; Ira 282.54. Use Refresh Pregame Research for any published matchup projection/spread.',
    commonOpponents:'No meaningful 2026 common-opponent result yet after Week 1.',
    results:['Jayton beat Robert Lee 71-26 in Week 1.','Ira lost at Roby 65-38 in Week 1.'],
    webNotes:['Jayton enters Week 2 ranked #5 overall on SixManFootball.','Jayton is the defending 2025 state champion after a 15-0 season.','Jayton has a 31-game winning streak entering Week 2.','The 2026 preview notes four returning All-State seniors and a strong junior class.'],
    verifiedAsOf:'2026-09-03'
  }
};

function uid(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4)}
function clone(v){return JSON.parse(JSON.stringify(v))}
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmtDate(d){if(!d)return 'Open week';return new Date(d+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}
function nowIso(){return new Date().toISOString()}
function num(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback}
function safeScore(v){return Math.max(0,num(v,0))}
function otherTeam(t){return t==='ira'?'opp':'ira'}

function initialState(){return {
  version:6,
  selectedWeek:2,
  settings:{syncUrl:'',publishKey:DEFAULT_PUBLISH_KEY,listenUrl:''},
  teamInfo:{name:'Ira Bulldogs',rank:30,leagueRank:30,rating:282.54,league:'UIL Division I',district:'District 5',coach:'Jess Wall',stadium:'Ira Bulldogs Field',colors:'Black and Orange',updated:null},
  schedule:clone(DEFAULT_SCHEDULE),
  games:{},
  rosters:{ira:[]},
  pregameData:{},
  playerUse:{ira:{},opp:{}}
}}

function gameKeyForWeek(w){return `2026-w${Number(w)}`}
function currentSchedule(){return state.schedule.find(x=>Number(x.week)===Number(state.selectedWeek))||state.schedule[0]}
function gameKey(){return gameKeyForWeek(state.selectedWeek)}

function newGameFromSchedule(s){return {
  week:Number(s.week), opponent:s.opponent, date:s.date, time:s.time, site:s.site, district:!!s.district,
  quarter:1, periodStatus:'', clock:'10:00', down:1, toGo:15, ballOn:'Own 20', possession:'ira',
  iraScore:0, oppScore:0, plays:[], events:[], undoStack:[],
  notes:'', publicUpdate:'', publicUpdateDraft:'', pendingPhase:null, pendingTeam:null, final:false,
  coinTossWinner:'', coinTossDecision:'', opponentDisplayColor:'', opponentRoster:[], created:nowIso()
}}

function migrateState(saved){
  const base=initialState();
  if(!saved||typeof saved!=='object')return base;
  const out={...base,...saved};
  out.settings={...base.settings,...(saved.settings||{})};
  out.teamInfo={...base.teamInfo,...(saved.teamInfo||{})};
  out.schedule=Array.isArray(saved.schedule)&&saved.schedule.length?clone(saved.schedule):clone(base.schedule);
  // Do not trust stale hard-coded ranks from old builds. They must come from fresh sync/research.
  out.schedule=out.schedule.map(s=>({...s,rank:null}));
  // Preserve the known Week 1 result if old state omitted it.
  const w1=out.schedule.find(x=>Number(x.week)===1);if(w1&&!w1.result)w1.result='Loss 65-38';
  out.rosters={ira:Array.isArray(saved.rosters?.ira)?clone(saved.rosters.ira):[]};
  // Old pregame caches were proven unreliable; start clean and use verified/fresh data only.
  out.pregameData={};
  out.games={};
  for(const [k,raw] of Object.entries(saved.games||{})){
    const schedule=out.schedule.find(x=>Number(x.week)===Number(raw.week))||{week:raw.week,opponent:raw.opponent,date:raw.date,time:raw.time,site:raw.site};
    const g={...newGameFromSchedule(schedule),...clone(raw)};
    g.iraScore=safeScore(g.iraScore);g.oppScore=safeScore(g.oppScore);
    g.plays=Array.isArray(g.plays)?g.plays:[];g.events=Array.isArray(g.events)?g.events:[];g.undoStack=[];
    // Opponent roster is per-game. Never blindly copy the old global opponent roster into a different opponent.
    g.opponentRoster=Array.isArray(raw.opponentRoster)?clone(raw.opponentRoster):[];
    out.games[k]=g;
  }
  out.version=6;
  return out;
}

function load(){try{return migrateState(JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'))}catch{return initialState()}}
let state=load();
let talkingIndex=0;
let publishTimer=null;
let scoreEditTeam='ira';
let editingRoster=null;

function ensureGame(){const s=currentSchedule();const k=gameKey();if(!state.games[k])state.games[k]=newGameFromSchedule(s);const g=state.games[k];g.opponent=s.opponent;g.date=s.date;g.time=s.time;g.site=s.site;g.district=!!s.district;g.iraScore=safeScore(g.iraScore);g.oppScore=safeScore(g.oppScore);g.plays=Array.isArray(g.plays)?g.plays:[];g.events=Array.isArray(g.events)?g.events:[];g.undoStack=Array.isArray(g.undoStack)?g.undoStack:[];g.opponentRoster=Array.isArray(g.opponentRoster)?g.opponentRoster:[];return g}
function currentOpponentRoster(){return ensureGame().opponentRoster}
function rosterFor(team){return team==='ira'?(state.rosters.ira||[]):currentOpponentRoster()}
function playerName(team,id){const p=rosterFor(team).find(x=>x.id===id);return p?`#${p.number} ${p.name}`:'Unassigned'}
function teamLabel(team){return team==='ira'?'Ira Bulldogs':(ensureGame().opponent||'Opponent')}
function teamShort(team){return team==='ira'?'Ira':(ensureGame().opponent||'Opponent')}

function effectiveSyncUrl(){return String(state.settings.syncUrl||window.IRA_PUBLIC_API_URL||'').trim()}
function effectivePublishKey(){return String(state.settings.publishKey||DEFAULT_PUBLISH_KEY).trim()}

function save(msg='Saved locally',{render=true,publish=true}={}){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  if(typeof document!=='undefined'){const e=document.getElementById('saveState');if(e)e.textContent=msg}
  if(render&&typeof document!=='undefined')renderAll();
  if(publish)schedulePublish();
}
function toast(msg){if(typeof document==='undefined')return;const el=document.getElementById('toast');if(!el)return;el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}

function ballParts(v){const m=String(v||'Own 20').match(/(Own|Opp)\s*(\d+)/i);return {side:m&&/^opp/i.test(m[1])?'Opp':'Own',yard:m?Math.max(1,Math.min(40,num(m[2],20))):20}}
function offenseCoordinate(v){const b=ballParts(v);return b.side==='Own'?b.yard:80-b.yard}
function ballFromCoordinate(c){c=Math.max(1,Math.min(79,num(c,20)));return c<=40?`Own ${c}`:`Opp ${80-c}`}
function distanceToGoal(v){return Math.max(1,80-offenseCoordinate(v))}
function moveBall(v,gain){return ballFromCoordinate(offenseCoordinate(v)+num(gain,0))}
function flipPerspective(v){const b=ballParts(v);return `${b.side==='Own'?'Opp':'Own'} ${b.yard}`}
function goalToGo(g){return distanceToGoal(g.ballOn)<15}
function normalizeSeries(g){g.down=Math.max(1,Math.min(4,num(g.down,1)));if(goalToGo(g))g.toGo='Goal';else if(String(g.toGo).toLowerCase()==='goal'||num(g.toGo,0)<=0)g.toGo=15}
function newSeries(g){g.down=1;g.toGo=goalToGo(g)?'Goal':15}
function toGoNumber(g){return String(g.toGo).toLowerCase()==='goal'?distanceToGoal(g.ballOn):Math.max(1,num(g.toGo,15))}
function downText(g){return `${ordinal(g.down)} & ${String(g.toGo).toLowerCase()==='goal'?'Goal':g.toGo} • ${g.ballOn}`}
function ordinal(n){return ({1:'1st',2:'2nd',3:'3rd',4:'4th'})[num(n,1)]||`${n}th`}

function gameSnapshot(g){
  const c=clone(g);delete c.undoStack;return c
}
function restoreGameSnapshot(g,snapshot){
  const stack=g.undoStack||[];
  for(const k of Object.keys(g))delete g[k];
  Object.assign(g,clone(snapshot));
  g.undoStack=stack;
  g.iraScore=safeScore(g.iraScore);g.oppScore=safeScore(g.oppScore);
}
function commitAction(label,mutator,{publish=true}={}){
  const g=ensureGame();const before=gameSnapshot(g),priorStack=clone(g.undoStack||[]);
  try{
    mutator(g);
    g.iraScore=safeScore(g.iraScore);g.oppScore=safeScore(g.oppScore);normalizeSeries(g);
    g.undoStack.push({label,at:nowIso(),before});
    if(g.undoStack.length>60)g.undoStack.shift();
    save('Saved locally',{render:true,publish});
    return true;
  }catch(err){restoreGameSnapshot(g,before);g.undoStack=priorStack;console.error(err);toast('Action was not saved');return false}
}
function undoLastGameAction(){const g=ensureGame();const item=g.undoStack.pop();if(!item){toast('No committed action to undo');return false}restoreGameSnapshot(g,item.before);save('Undo complete');toast(`Undid: ${item.label}`);return true}

function addEvent(g,type,text,extra={}){const e={id:uid(),at:nowIso(),type,text,...extra};g.events.push(e);return e}
function addPlay(g,p){p.id=p.id||uid();p.at=p.at||nowIso();g.plays.push(p);addEvent(g,'play',publicPlayText(p),{playId:p.id,team:p.team});return p}

function playerStatBlank(){return {rushAtt:0,rushYds:0,rushTD:0,passAtt:0,passComp:0,passYds:0,passTD:0,int:0,rec:0,recYds:0,recTD:0,points:0,tackles:0,sacks:0,defInt:0,fumbleRec:0}}
function blankTeamStats(){return {rushAtt:0,rushYds:0,passAtt:0,passComp:0,passYds:0,firstDowns:0,turnovers:0,plays:0,score:0,players:{}}}
function calc(){
  const g=ensureGame(),teams={ira:blankTeamStats(),opp:blankTeamStats()};
  const pstat=(team,id)=>{if(!id)return null;if(!teams[team].players[id])teams[team].players[id]=playerStatBlank();return teams[team].players[id]};
  for(const p of g.plays){
    const t=teams[p.team],def=teams[otherTeam(p.team)];if(!t)continue;
    if(['run','pass','sack'].includes(p.type))t.plays++;
    if(p.type==='run'){
      t.rushAtt++;t.rushYds+=num(p.yards);const r=pstat(p.team,p.runner);if(r){r.rushAtt++;r.rushYds+=num(p.yards)}
      if(p.firstDown)t.firstDowns++;if(p.touchdown&&r){r.rushTD++;r.points+=6}
      if(p.fumble&&p.recoveryTeam===otherTeam(p.team)){t.turnovers++;if(p.recoveredBy){const d=pstat(otherTeam(p.team),p.recoveredBy);if(d)d.fumbleRec++}}
    }
    if(p.type==='pass'){
      t.passAtt++;const qb=pstat(p.team,p.passer);if(qb)qb.passAtt++;
      if(p.complete){t.passComp++;t.passYds+=num(p.yards);if(qb){qb.passComp++;qb.passYds+=num(p.yards)}const rec=pstat(p.team,p.receiver);if(rec){rec.rec++;rec.recYds+=num(p.yards)}if(p.firstDown)t.firstDowns++;if(p.touchdown){if(qb)qb.passTD++;if(rec){rec.recTD++;rec.points+=6}}}
      if(p.interception){t.turnovers++;if(qb)qb.int++;if(p.interceptedBy){const d=pstat(otherTeam(p.team),p.interceptedBy);if(d)d.defInt++}}
      if(p.fumble&&p.recoveryTeam===otherTeam(p.team)){t.turnovers++;if(p.recoveredBy){const d=pstat(otherTeam(p.team),p.recoveredBy);if(d)d.fumbleRec++}}
    }
    if(p.type==='sack'){t.passAtt++;t.passYds+=num(p.yards);const qb=pstat(p.team,p.passer);if(qb){qb.passAtt++;qb.passYds+=num(p.yards)}if(p.sackedBy){const d=pstat(otherTeam(p.team),p.sackedBy);if(d)d.sacks++}}
    if(p.type==='turnover'){t.turnovers++;if(p.defender){const d=pstat(otherTeam(p.team),p.defender);if(d){if(/interception/i.test(p.turnoverType||''))d.defInt++;if(/fumble/i.test(p.turnoverType||''))d.fumbleRec++}}}
    if(p.type==='score'){const ps=pstat(p.team,p.scorer);if(ps)ps.points+=num(p.points)}
    for(const id of p.tacklers||[]){const d=pstat(otherTeam(p.team),id);if(d)d.tackles++}
  }
  teams.ira.score=safeScore(g.iraScore);teams.opp.score=safeScore(g.oppScore);
  return teams
}

function uneditedForTeam(team){
  const g=ensureGame();return g.plays.filter(p=>p.team===team&&(
    (p.type==='run'&&!p.runner)||
    (p.type==='pass'&&(!p.passer||(p.complete&&!p.receiver)))||
    (p.type==='sack'&&!p.passer)
  ))
}

function broadcastNotes(st=calc()){
  const g=ensureGame(),out=[];
  const diff=safeScore(g.iraScore)-safeScore(g.oppScore);
  if(diff>0)out.push(`Ira leads ${g.iraScore}-${g.oppScore}, a ${diff}-point margin.`);else if(diff<0)out.push(`${g.opponent} leads ${g.oppScore}-${g.iraScore}, a ${Math.abs(diff)}-point margin.`);else out.push(`The game is tied ${g.iraScore}-${g.oppScore}.`);
  out.push(`Ira offense: ${st.ira.rushAtt} rushes for ${st.ira.rushYds} yards; passing ${st.ira.passComp}/${st.ira.passAtt} for ${st.ira.passYds}.`);
  out.push(`${g.opponent}: ${st.opp.rushAtt} rushes for ${st.opp.rushYds} yards; passing ${st.opp.passComp}/${st.opp.passAtt} for ${st.opp.passYds}.`);
  const iraTotal=st.ira.rushYds+st.ira.passYds,oppTotal=st.opp.rushYds+st.opp.passYds;
  out.push(`Total offense: Ira ${iraTotal}, ${g.opponent} ${oppTotal}. Turnovers: Ira ${st.ira.turnovers}, ${g.opponent} ${st.opp.turnovers}.`);
  const iu=uneditedForTeam('ira').length,ou=uneditedForTeam('opp').length;if(iu||ou)out.push(`Stat cleanup: ${iu} Ira and ${ou} ${g.opponent} play${ou===1?'':'s'} still need player attribution.`);
  return out
}

function teamDefaultOpponentColor(){return OPPONENT_DEFAULT_COLORS[ensureGame().opponent]||NEUTRAL_DARK}
function opponentColor(){const g=ensureGame();return g.opponentDisplayColor||teamDefaultOpponentColor()}
function teamAccent(team){return team==='ira'?IRA_ORANGE:opponentColor()}
function contrastFor(hex){const s=String(hex||'').replace('#','');if(s.length!==6)return '#fff';const r=parseInt(s.slice(0,2),16),g=parseInt(s.slice(2,4),16),b=parseInt(s.slice(4,6),16);return (r*299+g*587+b*114)/1000>155?'#111':'#fff'}
function applyAccent(root,team){if(!root)return;root.style.setProperty('--team-accent',teamAccent(team));root.style.setProperty('--team-accent-text',contrastFor(teamAccent(team)))}

function playerOptions(team,selected=''){return `<option value="">Unassigned</option>`+rosterFor(team).slice().sort((a,b)=>num(a.number)-num(b.number)).map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>#${esc(p.number)} ${esc(p.name)}</option>`).join('')}
function quickYards(values=[-10,-5,0,3,5,10,15,20]){return `<div class="quick-yards">${values.map(v=>`<button type="button" data-yard="${v}">${v>0?'+':''}${v}</button>`).join('')}</div>`}
function yardOptions(min=-30,max=50,selected=0){let x='';for(let i=min;i<=max;i++)x+=`<option value="${i}" ${i===selected?'selected':''}>${i>0?'+':''}${i}</option>`;return x}
function defenderCheckboxes(team){const rows=rosterFor(team);return rows.length?rows.map(p=>`<label class="check-pill"><input type="checkbox" name="tackler" value="${p.id}"> #${esc(p.number)} ${esc(p.name)}</label>`).join(''):'<span class="muted small">No defenders added for this team.</span>'}

function publicPlayText(p){
  const team=p.team==='ira'?'Ira':teamShort('opp');
  if(p.type==='run')return `${team} run ${num(p.yards)>=0?'+':''}${num(p.yards)}${p.touchdown?' TD':''}${p.fumble?' fumble':''}`;
  if(p.type==='pass'){if(p.interception)return `${team} pass intercepted`;if(!p.complete)return `${team} incomplete pass`;return `${team} pass ${num(p.yards)>=0?'+':''}${num(p.yards)}${p.touchdown?' TD':''}${p.fumble?' fumble':''}`}
  if(p.type==='sack')return `${team} sacked ${Math.abs(num(p.yards))} yards`;
  if(p.type==='penalty')return `${p.penaltyStatus==='declined'?'Penalty declined':p.penaltyStatus==='offsetting'?'Offsetting penalties':`Penalty ${num(p.yards)>0?'+':''}${num(p.yards)}`}`;
  if(p.type==='turnover')return `${team} turnover`;
  if(p.type==='score')return `${team} ${p.description||`${p.points} points`}`;
  return p.description||p.type
}
function latestPublicPlay(g=ensureGame()){const p=g.plays[g.plays.length-1];return p?publicPlayText(p):''}
function describePlay(p){
  let s=publicPlayText(p);if(p.type==='run'&&p.runner)s+=` — ${playerName(p.team,p.runner)}`;
  if(p.type==='pass'){if(p.passer)s+=` — ${playerName(p.team,p.passer)}`;if(p.complete&&p.receiver)s+=` to ${playerName(p.team,p.receiver)}`;if(p.interception&&p.interceptedBy)s+=` by ${playerName(otherTeam(p.team),p.interceptedBy)}`}
  if(p.note)s+=` — ${p.note}`;return s
}

function applyGainAndDown(g,yards,{turnover=false,touchdown=false}={}){
  const startToGo=toGoNumber(g),gain=num(yards);
  if(touchdown){g.ballOn='Opp 1';return}
  g.ballOn=moveBall(g.ballOn,gain);
  if(turnover)return;
  if(gain>=startToGo){newSeries(g);return}
  g.down=num(g.down,1)+1;
  if(String(g.toGo).toLowerCase()!=='goal')g.toGo=Math.max(1,startToGo-gain);
  if(g.down>4){changePossessionCore(g,otherTeam(g.possession),true);newSeries(g)}else normalizeSeries(g)
}
function changePossessionCore(g,newTeam,flip=true){if(newTeam===g.possession)return false;if(flip)g.ballOn=flipPerspective(g.ballOn);g.possession=newTeam;newSeries(g);return true}

function scoreTouchdown(g,team){if(team==='ira')g.iraScore+=6;else g.oppScore+=6;g.pendingPhase='conversion';g.pendingTeam=team}
function setKickoffReady(g,team){g.pendingPhase='kickoff';g.pendingTeam=team}

function applyPlayData(data){
  return commitAction(`Play: ${data.type}`,g=>{
    const team=g.possession,def=otherTeam(team),startBall=g.ballOn;
    if(data.type==='run'){
      const result=data.result||'normal';const td=result==='td';const yards=td?distanceToGoal(startBall):num(data.yards);
      const p={type:'run',team,runner:data.runner||'',yards,touchdown:td,firstDown:td||yards>=toGoNumber(g),fumble:result==='fumble',recoveryTeam:data.recoveryTeam||'',recoveredBy:data.recoveredBy||'',tacklers:data.tacklers||[],note:data.note||''};
      addPlay(g,p);
      if(td){scoreTouchdown(g,team);return}
      applyGainAndDown(g,yards);
      if(p.fumble&&p.recoveryTeam===def){changePossessionCore(g,def,true)}
    } else if(data.type==='pass'){
      const result=data.result||'complete';
      if(result==='sack'){
        const loss=-Math.abs(num(data.yards,5));const p={type:'sack',team,passer:data.passer||'',yards:loss,sackedBy:data.sackedBy||'',tacklers:data.tacklers||[],note:data.note||''};addPlay(g,p);applyGainAndDown(g,loss);return
      }
      if(result==='int'){
        const yards=num(data.yards,0),ret=num(data.returnYards,0);const p={type:'pass',team,passer:data.passer||'',complete:false,interception:true,yards,returnYards:ret,interceptedBy:data.interceptedBy||'',note:data.note||''};addPlay(g,p);g.ballOn=moveBall(g.ballOn,yards);changePossessionCore(g,def,true);if(ret)g.ballOn=moveBall(g.ballOn,ret);normalizeSeries(g);return
      }
      if(result==='incomplete'){
        addPlay(g,{type:'pass',team,passer:data.passer||'',receiver:'',complete:false,yards:0,note:data.note||''});g.down++;if(g.down>4)changePossessionCore(g,def,true);return
      }
      const td=result==='td';const yards=td?distanceToGoal(startBall):num(data.yards);const fumble=result==='fumble';
      const p={type:'pass',team,passer:data.passer||'',receiver:data.receiver||'',complete:true,yards,touchdown:td,firstDown:td||yards>=toGoNumber(g),fumble,recoveryTeam:data.recoveryTeam||'',recoveredBy:data.recoveredBy||'',tacklers:data.tacklers||[],note:data.note||''};addPlay(g,p);
      if(td){scoreTouchdown(g,team);return}
      applyGainAndDown(g,yards);if(fumble&&p.recoveryTeam===def)changePossessionCore(g,def,true)
    } else if(data.type==='penalty'){
      const status=data.penaltyStatus||'accepted';const p={type:'penalty',team,penalty:data.penalty||'Penalty',penaltyStatus:status,yards:status==='accepted'?num(data.yards):0,penaltyPlayer:data.penaltyPlayer||'',note:data.note||''};addPlay(g,p);
      if(status==='accepted'){g.ballOn=moveBall(g.ballOn,p.yards);if(String(g.toGo).toLowerCase()!=='goal')g.toGo=Math.max(1,toGoNumber(g)-p.yards);normalizeSeries(g)}
    } else if(data.type==='turnover'){
      addPlay(g,{type:'turnover',team,turnoverType:data.turnoverType||'Turnover',defender:data.defender||'',note:data.note||''});changePossessionCore(g,def,true)
    } else if(data.type==='score'){
      const scoreType=data.scoreType||'4';let points=scoreType==='manual'?Math.max(0,num(data.manualPoints)):num(scoreType);let scoringTeam=team;
      if(String(scoreType)==='2')scoringTeam=def;
      if(scoringTeam==='ira')g.iraScore+=points;else g.oppScore+=points;
      const desc=String(scoreType)==='2'?'Safety':String(scoreType)==='4'?'Field Goal':(data.description||`${points}-point score`);
      addPlay(g,{type:'score',team:scoringTeam,points,scorer:data.scorer||'',description:desc,note:data.note||''});setKickoffReady(g,scoringTeam)
    } else if(data.type==='possession'){
      const newTeam=data.driveTeam||team;g.possession=newTeam;g.ballOn=`${data.ballSide==='Opp'?'Opp':'Own'} ${Math.max(1,Math.min(40,num(data.ballYard,20)))}`;newSeries(g);addEvent(g,'possession',`${teamShort(newTeam)} new drive`,{team:newTeam})
    }
  })
}

function openPlay(type){
  const g=ensureGame(),team=g.possession,def=otherTeam(team),d=document.getElementById('playDialog'),fields=document.getElementById('playFormFields');
  const titles={run:'Run',pass:'Pass',penalty:'Penalty',turnover:'Other Turnover',score:'Other Score',possession:'New Drive'};
  document.getElementById('playDialogTitle').textContent=titles[type]||type;document.getElementById('playDialogEyebrow').textContent=`${teamLabel(team).toUpperCase()} OFFENSE`;
  let html=`<input type="hidden" name="type" value="${type}"><input type="hidden" name="team" value="${team}">`;
  if(type==='run')html+=`<div class="form-grid"><label>Ball carrier<select name="runner">${playerOptions(team)}</select></label></div><input type="hidden" name="result" value="normal"><div class="kicker">RESULT</div><div class="result-buttons"><button type="button" data-result="normal" class="selected">NORMAL</button><button type="button" data-result="td">TD</button><button type="button" data-result="fumble">FUMBLE</button></div><div id="runYards"><div class="kicker">YARDS GAINED / LOST</div>${quickYards()}<label>Other<select class="yards-input" name="yards">${yardOptions(-30,50,0)}</select></label></div><div id="runExtra"></div><div class="defense-box"><div class="kicker">${esc(teamLabel(def).toUpperCase())} DEFENSE — OPTIONAL TACKLE</div><div class="tackler-picks">${defenderCheckboxes(def)}</div></div>`;
  if(type==='pass')html+=`<div class="form-grid"><label>Passer<select name="passer">${playerOptions(team)}</select></label><label>Receiver<select name="receiver">${playerOptions(team)}</select></label></div><input type="hidden" name="result" value="complete"><div class="kicker">RESULT</div><div class="result-buttons"><button type="button" data-result="complete" class="selected">COMPLETE</button><button type="button" data-result="incomplete">INCOMPLETE</button><button type="button" data-result="int">INTERCEPTED</button><button type="button" data-result="sack">SACK</button><button type="button" data-result="fumble">FUMBLE</button><button type="button" data-result="td">TD</button></div><div id="passYards"><div class="kicker">YARDS</div>${quickYards([-5,0,5,10,15,20,30])}<label>Other<select class="yards-input" name="yards">${yardOptions(-20,60,0)}</select></label></div><div id="passExtra"></div><div class="defense-box" id="passTackleBox"><div class="kicker">${esc(teamLabel(def).toUpperCase())} DEFENSE — OPTIONAL TACKLE</div><div class="tackler-picks">${defenderCheckboxes(def)}</div></div>`;
  if(type==='penalty')html+=`<div class="form-grid"><label>Penalty<input name="penalty" placeholder="Holding, offsides…"></label><label>Player (optional)<select name="penaltyPlayer">${playerOptions(team)}</select></label></div><input type="hidden" name="penaltyStatus" value="accepted"><div class="kicker">STATUS</div><div class="result-buttons"><button type="button" data-penalty-status="accepted" class="selected">ACCEPTED</button><button type="button" data-penalty-status="declined">DECLINED</button><button type="button" data-penalty-status="offsetting">OFFSETTING</button></div><div id="penaltyYards"><div class="kicker">YARDAGE — RELATIVE TO OFFENSE</div>${quickYards([-15,-10,-5,0,5,10,15])}<input type="hidden" class="yards-input" name="yards" value="0"></div><p class="muted small">Declined and offsetting penalties change nothing on the field.</p>`;
  if(type==='turnover')html+=`<label>What happened?<input name="turnoverType" placeholder="Bad snap, unusual turnover…"></label><label>Defender credit (optional)<select name="defender">${playerOptions(def)}</select></label>`;
  if(type==='score')html+=`<div class="form-grid"><label>Scorer<select name="scorer">${playerOptions(team)}</select></label><label>Score type<select name="scoreType"><option value="4">Field Goal • 4</option><option value="2">Safety • 2</option><option value="manual">Other / Manual</option></select></label><label>Manual points<input name="manualPoints" type="number" inputmode="numeric" value="0"></label></div>`;
  if(type==='possession'){const bp=ballParts(g.ballOn);html+=`<p class="muted">Catch-up tool: set possession and field position without recreating missed plays.</p><div class="result-buttons"><button type="button" data-drive-team="ira" class="${team==='ira'?'selected':''}">IRA BULLDOGS</button><button type="button" data-drive-team="opp" class="${team==='opp'?'selected':''}">${esc(g.opponent.toUpperCase())}</button></div><input type="hidden" name="driveTeam" value="${team}"><div class="form-grid"><label>Ball side<select name="ballSide"><option ${bp.side==='Own'?'selected':''}>Own</option><option ${bp.side==='Opp'?'selected':''}>Opp</option></select></label><label>Yard line<input name="ballYard" type="number" min="1" max="40" value="${bp.yard}"></label></div>`}
  html+=`<label style="display:grid;gap:6px;margin-top:12px">Radio note (optional)<input name="note" placeholder="Optional private play note…"></label>`;
  fields.innerHTML=html;applyAccent(d.querySelector('.dialog-card'),team);

  const setResult=(result)=>{
    fields.querySelector('[name=result]').value=result;fields.querySelectorAll('[data-result]').forEach(b=>b.classList.toggle('selected',b.dataset.result===result));
    if(type==='run'){
      document.getElementById('runYards').style.display=result==='td'?'none':'';
      document.getElementById('runExtra').innerHTML=result==='fumble'?recoveryHtml(team,def):result==='td'?`<div class="broadcast-note"><strong>TD yardage will be ${distanceToGoal(g.ballOn)} yards automatically.</strong></div>`:'';
    }
    if(type==='pass'){
      const yardsBox=document.getElementById('passYards');yardsBox.style.display=['incomplete','int','sack','td'].includes(result)?'none':'';
      const extra=document.getElementById('passExtra');
      if(result==='int')extra.innerHTML=`<div class="form-grid"><label>Pass distance to interception<select name="yards">${yardOptions(-20,60,0)}</select></label><label>INT return yards<select name="returnYards">${yardOptions(-20,60,0)}</select></label></div><label>Intercepted by<select name="interceptedBy">${playerOptions(def)}</select></label>`;
      else if(result==='sack')extra.innerHTML=`<div class="kicker">YARDS LOST</div>${quickYards([3,5,7,10,12,15])}<input type="hidden" class="yards-input" name="yards" value="5"><label>Sacked by<select name="sackedBy">${playerOptions(def)}</select></label>`;
      else if(result==='fumble')extra.innerHTML=recoveryHtml(team,def);
      else if(result==='td')extra.innerHTML=`<div class="broadcast-note"><strong>TD yardage will be ${distanceToGoal(g.ballOn)} yards automatically.</strong></div>`;
      else extra.innerHTML='';
    }
    wireDynamicButtons(fields)
  };
  fields.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>setResult(b.dataset.result));
  fields.querySelectorAll('[data-penalty-status]').forEach(b=>b.onclick=()=>{fields.querySelector('[name=penaltyStatus]').value=b.dataset.penaltyStatus;fields.querySelectorAll('[data-penalty-status]').forEach(x=>x.classList.toggle('selected',x===b));document.getElementById('penaltyYards').style.display=b.dataset.penaltyStatus==='accepted'?'':'none'});
  fields.querySelectorAll('[data-drive-team]').forEach(b=>b.onclick=()=>{fields.querySelector('[name=driveTeam]').value=b.dataset.driveTeam;fields.querySelectorAll('[data-drive-team]').forEach(x=>x.classList.toggle('selected',x===b));applyAccent(d.querySelector('.dialog-card'),b.dataset.driveTeam)});
  wireDynamicButtons(fields);d.showModal()
}

function recoveryHtml(off,def){return `<div class="defense-box"><div class="kicker">FUMBLE RECOVERY</div><input type="hidden" name="recoveryTeam" value="${def}"><div class="result-buttons"><button type="button" data-recovery-team="${off}">${esc(teamShort(off))}</button><button type="button" data-recovery-team="${def}" class="selected">${esc(teamShort(def))}</button></div><label>Who recovered?<select name="recoveredBy">${playerOptions(def)}</select></label></div>`}
function wireDynamicButtons(root){
  root.querySelectorAll('[data-yard]').forEach(b=>b.onclick=()=>{const target=root.querySelector('.yards-input');if(target)target.value=b.dataset.yard;root.querySelectorAll('[data-yard]').forEach(x=>x.classList.toggle('selected',x===b))});
  root.querySelectorAll('[data-recovery-team]').forEach(b=>b.onclick=()=>{const team=b.dataset.recoveryTeam;root.querySelector('[name=recoveryTeam]').value=team;root.querySelectorAll('[data-recovery-team]').forEach(x=>x.classList.toggle('selected',x===b));const sel=root.querySelector('[name=recoveredBy]');if(sel)sel.innerHTML=playerOptions(team)})
}

function formDataToPlay(form){
  const fd=new FormData(form),o={};for(const [k,v] of fd.entries()){if(k==='tackler')continue;o[k]=v}o.tacklers=fd.getAll('tackler');return o
}

function openScoreDialog(team){scoreEditTeam=team==='opp'?'opp':'ira';const g=ensureGame();document.getElementById('scoreDialogTitle').textContent=`${teamShort(scoreEditTeam)} Score`;document.getElementById('exactScoreInput').value=scoreEditTeam==='ira'?g.iraScore:g.oppScore;mountClockPicker('scoreClockMount','scoreClock',g.clock);applyAccent(document.querySelector('#scoreDialog .dialog-card'),scoreEditTeam);document.getElementById('scoreDialog').showModal()}
function updateQuickScore(delta){commitAction('Score change',g=>{const key=scoreEditTeam==='ira'?'iraScore':'oppScore';g[key]=Math.max(0,safeScore(g[key])+num(delta));const c=readClockPicker('scoreClock');if(c)g.clock=c;addEvent(g,'score',`${teamShort(scoreEditTeam)} score changed`,{team:scoreEditTeam})});document.getElementById('scoreDialog').close()}
function setExactScore(){const exact=Math.max(0,num(document.getElementById('exactScoreInput').value));commitAction('Score correction',g=>{const key=scoreEditTeam==='ira'?'iraScore':'oppScore';g[key]=exact;const c=readClockPicker('scoreClock');if(c)g.clock=c;addEvent(g,'scoreCorrection',`${teamShort(scoreEditTeam)} score set to ${exact}`,{team:scoreEditTeam})});document.getElementById('scoreDialog').close()}

function mountClockPicker(mountId,prefix,value){const m=document.getElementById(mountId);if(!m)return;const parts=String(value||'10:00').split(':'),min=Math.max(0,Math.min(10,num(parts[0],10))),sec=Math.max(0,Math.min(59,num(parts[1],0)));m.innerHTML=`<div class="clock-picker"><label>Minutes<select id="${prefix}Min">${Array.from({length:11},(_,i)=>`<option ${i===min?'selected':''}>${i}</option>`).join('')}</select></label><span>:</span><label>Seconds<select id="${prefix}Sec">${Array.from({length:60},(_,i)=>`<option ${i===sec?'selected':''}>${String(i).padStart(2,'0')}</option>`).join('')}</select></label></div>`}
function readClockPicker(prefix){const m=document.getElementById(prefix+'Min'),s=document.getElementById(prefix+'Sec');return m&&s?`${m.value}:${String(s.value).padStart(2,'0')}`:''}
function openClockDialog(){mountClockPicker('clockPickerMount','mainClock',ensureGame().clock);document.getElementById('clockDialog').showModal()}
function saveClock(){const c=readClockPicker('mainClock');if(!c)return;commitAction('Clock correction',g=>{g.clock=c;addEvent(g,'clock',`Clock ${c}`)});document.getElementById('clockDialog').close()}

function periodLabel(g=ensureGame()){if(g.final)return 'FINAL';if(g.periodStatus==='halftime')return 'HALFTIME';return num(g.quarter)>=5?'OT':`Q${num(g.quarter,1)}`}
function openQuarterCorrection(){const g=ensureGame(),d=document.getElementById('flowDialog'),m=document.getElementById('flowMount');const options=[['1','QUARTER 1'],['2','QUARTER 2'],['H','HALFTIME'],['3','QUARTER 3'],['4','QUARTER 4'],['5','OVERTIME']];m.innerHTML=`<div class="eyebrow">GAME PERIOD</div><h2>Set game period</h2><div class="big-choice-grid">${options.map(([v,l])=>`<button data-period="${v}" class="${(v==='H'&&g.periodStatus==='halftime')||(v!=='H'&&num(g.quarter)===num(v)&&g.periodStatus!=='halftime')?'selected':''}">${l}</button>`).join('')}</div>`;applyAccent(d.querySelector('.dialog-card'),g.possession);d.showModal();m.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{commitAction('Period correction',gg=>{if(b.dataset.period==='H')gg.periodStatus='halftime';else{gg.periodStatus='';gg.quarter=num(b.dataset.period)}});d.close()})}

function pendingFlowButton(g){if(g.pendingPhase==='conversion')return `<button id="pendingFlowBtn" class="pending-flow">PAT / CONVERSION READY</button>`;if(g.pendingPhase==='kickoff')return `<button id="pendingFlowBtn" class="pending-flow">KICKOFF READY</button>`;return ''}
function openPendingFlow(){const g=ensureGame(),d=document.getElementById('flowDialog'),m=document.getElementById('flowMount'),team=g.pendingTeam||g.possession;applyAccent(d.querySelector('.dialog-card'),team);if(g.pendingPhase==='conversion')m.innerHTML=`<div class="eyebrow">AFTER TOUCHDOWN</div><h2>${esc(teamShort(team))} conversion</h2><div class="big-choice-grid"><button data-conv="1">1-PT RUN/PASS</button><button data-conv="2">2-PT KICK</button><button data-conv="0">NO GOOD / SKIP</button></div>`;else m.innerHTML=`<div class="eyebrow">KICKOFF</div><h2>${esc(teamShort(team))} kicking</h2><div class="big-choice-grid"><button data-kick="normal">NORMAL KICK</button><button data-kick="onside">ONSIDE</button></div>`;d.showModal();m.querySelectorAll('[data-conv]').forEach(b=>b.onclick=()=>{const pts=num(b.dataset.conv);commitAction('Conversion',gg=>{if(pts){if(team==='ira')gg.iraScore+=pts;else gg.oppScore+=pts;addPlay(gg,{type:'score',team,points:pts,description:pts===2?'2-point kick good':'1-point conversion good'})}gg.pendingPhase='kickoff';gg.pendingTeam=team});d.close()});m.querySelectorAll('[data-kick]').forEach(b=>b.onclick=()=>openKickoffDetail(team,b.dataset.kick))}
function openKickoffDetail(kickingTeam,kind){const d=document.getElementById('flowDialog'),m=document.getElementById('flowMount'),receiving=otherTeam(kickingTeam);m.innerHTML=`<div class="eyebrow">${kind==='onside'?'ONSIDE':'NORMAL'} KICK</div><h2>Who recovered?</h2><div class="result-buttons"><button data-kickrecover="${receiving}" class="selected">${esc(teamShort(receiving))}</button><button data-kickrecover="${kickingTeam}">${esc(teamShort(kickingTeam))}</button></div><input type="hidden" id="kickRecoverTeam" value="${receiving}"><label>Starting field position<select id="kickSide"><option>Own</option><option>Opp</option></select> <input id="kickYard" type="number" min="1" max="40" value="20"></label><button id="saveKickoff" style="margin-top:12px">SAVE KICKOFF</button>`;applyAccent(d.querySelector('.dialog-card'),receiving);m.querySelectorAll('[data-kickrecover]').forEach(b=>b.onclick=()=>{m.querySelectorAll('[data-kickrecover]').forEach(x=>x.classList.toggle('selected',x===b));document.getElementById('kickRecoverTeam').value=b.dataset.kickrecover;applyAccent(d.querySelector('.dialog-card'),b.dataset.kickrecover)});document.getElementById('saveKickoff').onclick=()=>{const rec=document.getElementById('kickRecoverTeam').value;commitAction('Kickoff',g=>{g.possession=rec;g.ballOn=`${document.getElementById('kickSide').value} ${Math.max(1,Math.min(40,num(document.getElementById('kickYard').value,20)))}`;newSeries(g);g.pendingPhase=null;g.pendingTeam=null;addEvent(g,'kickoff',`${teamShort(rec)} ball at ${g.ballOn}`,{team:rec})});d.close()}}

function scoreDifferentialHtml(g){const d=safeScore(g.iraScore)-safeScore(g.oppScore),a=Math.abs(d);if(!a)return '<div class="score-diff tied">TIED</div>';const leader=d>0?'IRA':String(g.opponent).toUpperCase(),warn=a>=45?'<span class="mercy mercy45">45-POINT MARGIN</span>':a>=40?'<span class="mercy mercy40">40-POINT WARNING</span>':'';return `<div class="score-diff">${esc(leader)} +${a} ${warn}</div>`}

function eventLogHtml(g){const rows=[...g.events].slice(-25).reverse();return rows.length?rows.map(e=>`<div class="event-row"><span>${new Date(e.at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</span><strong>${esc(e.text)}</strong></div>`).join(''):'<p class="muted">No events yet.</p>'}
function generatedRadioNotesHtml(){return broadcastNotes().map(n=>`<div class="broadcast-note">${esc(n)}</div>`).join('')}

function renderLive(){
  const g=ensureGame(),st=calc(),bp=ballParts(g.ballOn);const el=document.getElementById('live');if(!el)return;
  el.innerHTML=`<div class="grid live-layout"><div class="card hero"><div class="eyebrow">LIVE GAME • WEEK ${g.week}</div><div class="scoreboard"><button class="score-team" data-score-team="ira"><div class="team-name">IRA</div><div class="team-score">${g.iraScore}</div></button><div class="score-center"><button id="periodBtn" class="console-quarter">${periodLabel(g)}</button><button id="clockDisplayBtn" class="console-clock clock-direct">${esc(g.clock)}</button>${scoreDifferentialHtml(g)}</div><button class="score-team" data-score-team="opp"><div class="team-name">${esc(g.opponent)}</div><div class="team-score">${g.oppScore}</div></button></div>${pendingFlowButton(g)}</div>
  <div class="card offense-card ${g.possession==='ira'?'ira-offense':'opp-offense'}" style="--opp-color:${esc(opponentColor())}"><div class="offense-banner">${g.possession==='ira'?'IRA OFFENSE':esc(g.opponent.toUpperCase())+' OFFENSE'}</div><div class="possession"><button data-pos="ira" class="${g.possession==='ira'?'active':''}">Ira Ball</button><button data-pos="opp" class="${g.possession==='opp'?'active':''}">${esc(g.opponent)} Ball</button></div><div class="game-meta"><label>Down<select id="downSel">${[1,2,3,4].map(x=>`<option ${g.down===x?'selected':''}>${x}</option>`).join('')}</select></label><label>To Go<select id="toGoSel">${toGoOptions(g.toGo)}</select></label><label>Ball Side<select id="ballSideSel"><option ${bp.side==='Own'?'selected':''}>Own</option><option ${bp.side==='Opp'?'selected':''}>Opp</option></select></label><label>Yard Line<input id="ballYardInput" type="number" min="1" max="40" value="${bp.yard}"></label></div><div class="current-situation"><strong>${esc(downText(g))}</strong></div><div class="live-controls"><button data-play="run">RUN</button><button data-play="pass">PASS</button><button data-play="penalty">PENALTY</button><button data-play="turnover">TURNOVER</button><button data-play="score">OTHER SCORE</button><button data-play="possession">NEW DRIVE / CATCH UP</button><button class="dark" id="undoBtn">UNDO LAST</button></div></div>
  <div class="card"><div class="eyebrow">GENERATED RADIO NOTES</div><h2>On-Air Talking Points</h2>${generatedRadioNotesHtml()}</div>
  <div class="card"><h2>My Notes</h2><textarea id="radioNotes" placeholder="Private notes for the broadcast…">${esc(g.notes||'')}</textarea><div class="inline"><button id="saveRadioNotes">SAVE NOTE</button><span id="notesSaved" class="muted small">Saved</span></div></div>
  <div class="card"><h2>Latest Public Update</h2><textarea id="publicUpdate">${esc(g.publicUpdateDraft||'')}</textarea><div class="inline"><button id="sendPublicUpdate">SEND UPDATE</button><button id="clearPublicUpdate" class="ghost">Clear Draft</button><span id="publicUpdateStatus" class="muted small">${g.publicUpdate?'Live update sent':'No live update'}</span></div></div>
  <details class="card"><summary><strong>Event Log / Catch Up</strong></summary>${eventLogHtml(g)}</details>
  <div class="card"><h2>Recorded Team Stats</h2><div class="stat-strip desktop-stat-strip"><div class="stat-box"><strong>${st.ira.rushAtt}/${st.ira.rushYds}</strong><span>Rush att/yds</span></div><div class="stat-box"><strong>${st.ira.passComp}/${st.ira.passAtt}</strong><span>Passing C/A</span></div><div class="stat-box"><strong>${st.ira.passYds}</strong><span>Pass yds</span></div><div class="stat-box"><strong>${st.ira.rushYds+st.ira.passYds}</strong><span>Total yds</span></div></div></div></div>`;
  applyAccent(el.querySelector('.offense-card'),g.possession);
  el.querySelectorAll('[data-score-team]').forEach(b=>b.onclick=()=>openScoreDialog(b.dataset.scoreTeam));document.getElementById('periodBtn').onclick=openQuarterCorrection;document.getElementById('clockDisplayBtn').onclick=openClockDialog;document.getElementById('undoBtn').onclick=undoLastGameAction;el.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>openPlay(b.dataset.play));
  el.querySelectorAll('[data-pos]').forEach(b=>b.onclick=()=>commitAction('Possession correction',gg=>{changePossessionCore(gg,b.dataset.pos,true);addEvent(gg,'possession',`${teamShort(b.dataset.pos)} ball`,{team:b.dataset.pos})}));
  document.getElementById('downSel').onchange=e=>commitAction('Down correction',gg=>{gg.down=num(e.target.value)});document.getElementById('toGoSel').onchange=e=>commitAction('Distance correction',gg=>{gg.toGo=e.target.value});
  const setBall=()=>commitAction('Field position correction',gg=>{gg.ballOn=`${document.getElementById('ballSideSel').value} ${Math.max(1,Math.min(40,num(document.getElementById('ballYardInput').value,20)))}`});document.getElementById('ballSideSel').onchange=setBall;document.getElementById('ballYardInput').onchange=setBall;
  if(document.getElementById('pendingFlowBtn'))document.getElementById('pendingFlowBtn').onclick=openPendingFlow;
  const notes=document.getElementById('radioNotes');notes.oninput=()=>{g.notes=notes.value;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));document.getElementById('notesSaved').textContent='Unsaved changes'};document.getElementById('saveRadioNotes').onclick=()=>{g.notes=notes.value;save('Note saved',{render:false});document.getElementById('notesSaved').textContent='Saved';toast('Radio note saved')};
  const pub=document.getElementById('publicUpdate');pub.oninput=()=>{g.publicUpdateDraft=pub.value;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));document.getElementById('publicUpdateStatus').textContent='Draft not sent'};document.getElementById('sendPublicUpdate').onclick=()=>{g.publicUpdateDraft=pub.value;g.publicUpdate=pub.value.trim();addEvent(g,'publicUpdate',g.publicUpdate?`Public update: ${g.publicUpdate}`:'Public update cleared');save();toast('Public update sent')};document.getElementById('clearPublicUpdate').onclick=()=>{pub.value='';g.publicUpdateDraft='';localStorage.setItem(STORAGE_KEY,JSON.stringify(state));document.getElementById('publicUpdateStatus').textContent='Draft cleared — live unchanged'}
}
function toGoOptions(v){let out='';for(let i=1;i<=40;i++)out+=`<option value="${i}" ${String(v)===String(i)?'selected':''}>${i}</option>`;out+=`<option value="Goal" ${String(v).toLowerCase()==='goal'?'selected':''}>Goal</option>`;return out}

function comparisonTable(st){const g=ensureGame(),iu=uneditedForTeam('ira').length,ou=uneditedForTeam('opp').length;const rows=[['Score',st.ira.score,st.opp.score],['Rushing',`${st.ira.rushAtt} att / ${st.ira.rushYds} yds`,`${st.opp.rushAtt} att / ${st.opp.rushYds} yds`],['Passing',`${st.ira.passComp}/${st.ira.passAtt} / ${st.ira.passYds} yds`,`${st.opp.passComp}/${st.opp.passAtt} / ${st.opp.passYds} yds`],['Total yards',st.ira.rushYds+st.ira.passYds,st.opp.rushYds+st.opp.passYds],['First downs',st.ira.firstDowns,st.opp.firstDowns],['Turnovers',st.ira.turnovers,st.opp.turnovers],['Plays entered',st.ira.plays,st.opp.plays]];return `<div class="table-wrap"><table><thead><tr><th>Stat</th><th class="num">Ira Bulldogs</th><th class="num">${esc(g.opponent)}</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r[0]}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td></tr>`).join('')}<tr class="unedited-row"><td><strong>Unedited stats</strong></td><td class="num"><button class="ghost" data-unedited="ira">${iu} • Edit</button></td><td class="num"><button class="ghost" data-unedited="opp">${ou} • Edit</button></td></tr></tbody></table></div>`}
function teamPlayerTable(team,players){const rows=Object.entries(players||{}).map(([id,x])=>({id,...x})).sort((a,b)=>(b.rushYds+b.passYds+b.recYds+b.points+b.tackles*5)-(a.rushYds+a.passYds+a.recYds+a.points+a.tackles*5));if(!rows.length)return '<p class="muted">No individual player stats assigned yet.</p>';return `<div class="table-wrap"><table><thead><tr><th>Player</th><th>Rush</th><th>Pass</th><th>Rec</th><th>TD</th><th>Tkl</th><th>INT</th><th>FR</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(playerName(team,x.id))}</td><td>${x.rushAtt||0}-${x.rushYds||0}</td><td>${x.passComp||0}/${x.passAtt||0}-${x.passYds||0}</td><td>${x.rec||0}-${x.recYds||0}</td><td>${(x.rushTD||0)+(x.passTD||0)+(x.recTD||0)}</td><td>${x.tackles||0}</td><td>${x.defInt||0}</td><td>${x.fumbleRec||0}</td></tr>`).join('')}</tbody></table></div>`}
function renderStats(){const el=document.getElementById('stats');if(!el)return;const g=ensureGame(),st=calc();el.innerHTML=`<div class="card hero"><div class="eyebrow">RADIO BOOTH</div><h2>Live Stats — IRA ${g.iraScore}, ${esc(g.opponent)} ${g.oppScore}</h2></div><div class="grid two" style="margin-top:16px"><div class="card"><h2>Game Comparison</h2>${comparisonTable(st)}</div><div class="card"><h2>Ira Bulldog Player Stats</h2>${teamPlayerTable('ira',st.ira.players)}</div><div class="card"><h2>${esc(g.opponent)} Player Stats</h2>${teamPlayerTable('opp',st.opp.players)}</div><div class="card"><h2>Generated Radio Notes</h2>${generatedRadioNotesHtml()}</div></div>`;el.querySelectorAll('[data-unedited]').forEach(b=>b.onclick=()=>openUneditedStats(b.dataset.unedited))}

function openUneditedStats(team){const d=document.getElementById('flowDialog'),m=document.getElementById('flowMount'),rows=uneditedForTeam(team);m.innerHTML=`<div class="eyebrow">STAT CLEANUP</div><h2>${esc(teamLabel(team))} — Unedited Stats</h2>${rows.length?rows.map(p=>`<div class="roster-row"><div><strong>${esc(describePlay(p))}</strong><div class="small muted">Team totals already include this play. Editing only assigns player credit.</div></div><button data-edit-play="${p.id}">Edit</button></div>`).join(''):'<p class="muted">All entered offensive plays have player attribution.</p>'}`;applyAccent(d.querySelector('.dialog-card'),team);d.showModal();m.querySelectorAll('[data-edit-play]').forEach(b=>b.onclick=()=>openAttributionEditor(b.dataset.editPlay))}
function openAttributionEditor(playId){const g=ensureGame(),p=g.plays.find(x=>x.id===playId);if(!p)return;const d=document.getElementById('flowDialog'),m=document.getElementById('flowMount');let fields='';if(p.type==='run')fields=`<label>Ball carrier<select id="editRunner">${playerOptions(p.team,p.runner||'')}</select></label>`;if(p.type==='pass')fields=`<label>Passer<select id="editPasser">${playerOptions(p.team,p.passer||'')}</select></label>${p.complete?`<label>Receiver<select id="editReceiver">${playerOptions(p.team,p.receiver||'')}</select></label>`:''}`;if(p.type==='sack')fields=`<label>Passer<select id="editPasser">${playerOptions(p.team,p.passer||'')}</select></label>`;m.innerHTML=`<div class="eyebrow">EDIT PLAYER CREDIT</div><h2>${esc(describePlay(p))}</h2><p class="muted">Yards and team stats will not change.</p>${fields}<button id="saveAttribution" style="margin-top:12px">SAVE PLAYER CREDIT</button>`;applyAccent(d.querySelector('.dialog-card'),p.team);document.getElementById('saveAttribution').onclick=()=>{if(p.type==='run')p.runner=document.getElementById('editRunner').value;if(p.type==='pass'){p.passer=document.getElementById('editPasser').value;if(p.complete)p.receiver=document.getElementById('editReceiver').value}if(p.type==='sack')p.passer=document.getElementById('editPasser').value;save('Player credit updated');d.close();toast('Player credit updated')};d.showModal()}

function leadersTableFor(team,players){const rows=Object.entries(players||{}).map(([id,x])=>({id,...x})).sort((a,b)=>(b.rushYds+b.recYds+b.passYds+b.tackles*5)-(a.rushYds+a.recYds+a.passYds+a.tackles*5)).slice(0,8);if(!rows.length)return '<p class="muted">No individual player stats entered yet.</p>';return `<div class="table-wrap"><table><thead><tr><th>Player</th><th class="num">Rush</th><th class="num">Pass</th><th class="num">Rec</th><th class="num">TD</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(playerName(team,x.id))}</td><td class="num">${x.rushAtt||0}-${x.rushYds||0}</td><td class="num">${x.passComp||0}/${x.passAtt||0}-${x.passYds||0}</td><td class="num">${x.rec||0}-${x.recYds||0}</td><td class="num">${(x.rushTD||0)+(x.passTD||0)+(x.recTD||0)}</td></tr>`).join('')}</tbody></table></div>`}
function secondHalfReceiver(g){if(!g.coinTossWinner)return '';const other=otherTeam(g.coinTossWinner),d=String(g.coinTossDecision||'').toLowerCase();if(d==='receive')return other;if(d==='defer'||d==='kick')return g.coinTossWinner;return ''}
function renderHalftime(){const el=document.getElementById('halftime');if(!el)return;const g=ensureGame(),st=calc(),recv=secondHalfReceiver(g),recvText=recv?`${teamShort(recv)} will receive the second-half kickoff`:'Second-half receiver not determined — confirm coin toss';el.innerHTML=`<div class="card hero"><div class="eyebrow">HALFTIME SHOW</div><h2>IRA ${g.iraScore} — ${g.oppScore} ${esc(g.opponent)}</h2><div class="halftime-kickoff">🏈 ${esc(recvText)}</div></div><div class="grid two" style="margin-top:16px"><div class="card"><h2>First-Half Team Comparison</h2>${comparisonTable(st)}</div><div class="card"><h2>Ira Leaders</h2>${leadersTableFor('ira',st.ira.players)}</div><div class="card"><h2>${esc(g.opponent)} Leaders</h2>${leadersTableFor('opp',st.opp.players)}</div><div class="card"><h2>First-Half Story</h2>${generatedRadioNotesHtml()}</div></div>`;el.querySelectorAll('[data-unedited]').forEach(b=>b.onclick=()=>openUneditedStats(b.dataset.unedited))}

function researchCard(s){const cached=(state.pregameData||{})[s.week]||{},fallback=VERIFIED_PREGAME_FALLBACK[s.week]||{},pd=Object.keys(cached).length?cached:fallback,o=pd.opponent||{},fresh=cached.updated?new Date(cached.updated):null,age=fresh?Date.now()-fresh.getTime():Infinity,isFresh=!!fallback.verifiedAsOf||age<12*60*60*1000;const rank=o.rank?`#${o.rank}`:'—';return `<div class="card"><div class="inline"><div><div class="eyebrow">OPPONENT RESEARCH</div><h2>${esc(s.opponent)}</h2></div><button id="researchBtn">Refresh Pregame Research</button></div>${!isFresh?'<div class="broadcast-note"><strong>Pregame data is not verified fresh.</strong> Refresh before using it on air.</div>':''}<div class="summary-grid research-summary"><div class="summary-item"><span class="kicker">Overall rank</span><strong>${rank}</strong></div><div class="summary-item"><span class="kicker">Rating</span><strong>${o.rating||'—'}</strong></div><div class="summary-item"><span class="kicker">Record</span><strong>${esc(o.record||'—')}</strong></div><div class="summary-item"><span class="kicker">Coach</span><strong>${esc(o.coach||'—')}</strong></div></div><h3>Projection / Numbers to Know</h3><p>${esc(pd.projection||'Unavailable until refreshed from the current source.')}</p><h3>Common Opponents</h3><p>${esc(pd.commonOpponents||'No verified comparison cached.')}</p><h3>Recent Results</h3>${(pd.results||[]).length?pd.results.slice(0,5).map(x=>`<div class="broadcast-note">${esc(x)}</div>`).join(''):'<p class="muted">No verified recent results cached.</p>'}<h3>Players / Storylines to Watch</h3>${(pd.webNotes||[]).length?pd.webNotes.slice(0,6).map(x=>`<div class="broadcast-note">${esc(x)}</div>`).join(''):'<p class="muted">No verified player/storyline notes cached.</p>'}<p class="small muted">${pd.updated?'Last refreshed '+new Date(pd.updated).toLocaleString():'Not refreshed yet.'}</p></div>`}
function talkingPoints(){const s=currentSchedule(),g=ensureGame(),pts=[];const prev=state.schedule.find(x=>Number(x.week)===Number(s.week)-1);if(prev?.result)pts.push(`Last week: Ira ${prev.result.toLowerCase()} against ${prev.opponent}.`);pts.push(`Tonight: Ira Bulldogs vs ${s.opponent}, ${s.site.toLowerCase()||'scheduled'} at ${s.time||'TBA'}.`);const pd=Object.keys((state.pregameData||{})[s.week]||{}).length?(state.pregameData||{})[s.week]:(VERIFIED_PREGAME_FALLBACK[s.week]||{});for(const n of pd.webNotes||[])pts.push(n);if(g.coinTossWinner)pts.push(`${teamShort(g.coinTossWinner)} won the toss and chose to ${String(g.coinTossDecision||'').toLowerCase()}.`);return pts}
function renderPregame(){const el=document.getElementById('pregame');if(!el)return;const s=currentSchedule(),g=ensureGame(),tp=talkingPoints(),rows=state.schedule.map(x=>`<div class="schedule-row ${Number(x.week)===Number(state.selectedWeek)?'current':''}" data-week="${x.week}"><div><strong>Wk ${x.week}</strong><div class="small muted">${fmtDate(x.date)}</div></div><div><strong>${esc(x.opponent)}</strong><div class="small muted">${esc(x.time||'')}</div></div><div>${x.result?`<span class="pill">${esc(x.result)}</span>`:''}</div><div>${esc(x.site)}${x.district?' • District':''}</div></div>`).join('');el.innerHTML=`<div class="card hero"><div class="hero-row"><div><div class="eyebrow">WEEK ${s.week} • PREGAME</div><h2>IRA BULLDOGS vs ${esc(s.opponent)}</h2><div class="matchup-meta"><span class="pill">${fmtDate(s.date)} ${esc(s.time)}</span><span class="pill">${esc(s.site)}</span>${s.district?'<span class="pill">DISTRICT</span>':''}</div></div><div><div class="kicker">Ira rank</div><div style="font-size:1.35rem;font-weight:900">${state.teamInfo.rank?'#'+state.teamInfo.rank:'Refresh to verify'}</div></div></div></div><div class="grid two" style="margin-top:16px"><div class="card"><div class="inline"><h2>2026 Schedule</h2><button id="syncBtn">Refresh Schedule</button></div><div class="schedule-list">${rows}</div></div><div class="grid">${researchCard(s)}<div class="card"><h2>Game Setup</h2><label>Coin toss winner<select id="coinWinner"><option value="">Not entered</option><option value="ira" ${g.coinTossWinner==='ira'?'selected':''}>Ira</option><option value="opp" ${g.coinTossWinner==='opp'?'selected':''}>${esc(g.opponent)}</option></select></label><label>Decision<select id="coinDecision"><option value="">Not entered</option>${['Receive','Defer','Kick','Defend'].map(x=>`<option ${g.coinTossDecision===x?'selected':''}>${x}</option>`).join('')}</select></label><button id="saveCoinToss">SAVE COIN TOSS</button><div class="kicker" style="margin-top:16px">OPPONENT ACTIVE COLOR</div><p class="small muted">Inactive buttons are gray. Ira active is orange. Opponent active uses this color.</p><input id="oppColorPick" type="color" value="${esc(opponentColor())}"><div class="inline"><button id="saveOppColor">Choose Different Color</button><button id="resetOppColor" class="ghost">Use Team Default</button></div><div class="small muted">Team default: ${esc(teamDefaultOpponentColor())}</div></div><div class="card"><h2>Broadcast Talking Point</h2><div class="talking-point">${esc(tp[talkingIndex%Math.max(1,tp.length)]||'Refresh pregame research for current talking points.')}</div><button id="nextTalkingBtn">Next Talking Point</button></div></div></div>`;el.querySelectorAll('[data-week]').forEach(x=>x.onclick=()=>{state.selectedWeek=num(x.dataset.week);ensureGame();save()});document.getElementById('syncBtn').onclick=syncSixMan;document.getElementById('researchBtn').onclick=refreshResearch;document.getElementById('nextTalkingBtn').onclick=()=>{talkingIndex++;renderPregame()};document.getElementById('saveCoinToss').onclick=()=>{g.coinTossWinner=document.getElementById('coinWinner').value;g.coinTossDecision=document.getElementById('coinDecision').value;save();toast('Coin toss saved')};document.getElementById('saveOppColor').onclick=()=>{g.opponentDisplayColor=document.getElementById('oppColorPick').value;save();toast('Opponent color saved')};document.getElementById('resetOppColor').onclick=()=>{g.opponentDisplayColor='';save();toast('Opponent color reset')}
}

async function syncSixMan(){const url=effectiveSyncUrl();if(!url){toast('Sync URL unavailable');return}const b=document.getElementById('syncBtn');if(b){b.disabled=true;b.textContent='Refreshing…'}try{const x=await fetch(url+(url.includes('?')?'&':'?')+'action=team&_='+Date.now());if(!x.ok)throw new Error('sync');const data=await x.json();if(Array.isArray(data.schedule)&&data.schedule.length>=8){state.schedule=data.schedule.map(s=>({...s,rank:null}));const w1=state.schedule.find(x=>Number(x.week)===1);if(w1&&!w1.result)w1.result='Loss 65-38'}if(data.teamInfo)state.teamInfo={...state.teamInfo,...data.teamInfo,updated:nowIso()};save('Schedule refreshed');toast('Schedule refreshed')}catch(e){console.error(e);toast('Schedule refresh failed — cached schedule kept')}finally{renderPregame()}}
async function refreshResearch(){const url=effectiveSyncUrl(),s=currentSchedule();if(!url){toast('Sync URL unavailable');return}const b=document.getElementById('researchBtn');if(b){b.disabled=true;b.textContent='Refreshing…'}try{const x=await jsonp(url,{action:'research',opponent:s.opponent,week:s.week,_:Date.now()});if(!x?.ok||!x.data)throw new Error(x?.error||'research');if(x.data.opponent&&x.data.opponent.name&&String(x.data.opponent.name).toLowerCase()!==String(s.opponent).toLowerCase())throw new Error('Opponent mismatch');state.pregameData[s.week]={...x.data,updated:nowIso()};save('Pregame research refreshed');toast('Pregame research refreshed')}catch(e){console.error(e);toast('Pregame research unavailable — old data not trusted')}finally{renderPregame()}}

function rosterEditor(team){const rows=rosterFor(team).slice().sort((a,b)=>num(a.number)-num(b.number)).map(p=>`<div class="roster-row"><div class="jersey">#${esc(p.number)}</div><div><strong>${esc(p.name)}</strong><div class="small muted">${esc(p.position||'')}</div></div><div class="player-actions"><button class="ghost" data-editroster="${team}:${p.id}">Edit</button><button class="ghost" data-delroster="${team}:${p.id}">Delete</button></div></div>`).join('');return `<div class="form-grid" style="grid-template-columns:90px 1fr 130px"><label>#<input id="${team}Num" inputmode="numeric"></label><label>Name<input id="${team}Name" placeholder="First Last"></label><label>Position<input id="${team}Pos" placeholder="RB/QB/E"></label></div><button data-addroster="${team}" style="margin:10px 0 14px">Add Player</button><div class="roster-list">${rows||'<p class="muted">No players added yet.</p>'}</div>`}
function addRoster(team){const numVal=document.getElementById(team+'Num').value.trim(),name=document.getElementById(team+'Name').value.trim(),position=document.getElementById(team+'Pos').value.trim();if(!numVal||!name){toast('Enter jersey number and name');return}rosterFor(team).push({id:uid(),number:numVal,name,position});save();toast('Player added')}
function renderRosters(){const el=document.getElementById('roster');if(!el)return;const g=ensureGame();el.innerHTML=`<div class="grid two"><div class="card"><h2>Ira Roster</h2><p class="small muted">Season roster — stays from week to week.</p>${rosterEditor('ira')}</div><div class="card"><h2>${esc(g.opponent)} Roster</h2><p class="small muted">This roster belongs only to Week ${g.week}. Changing weeks loads that opponent's roster.</p>${rosterEditor('opp')}</div></div>`;el.querySelectorAll('[data-addroster]').forEach(b=>b.onclick=()=>addRoster(b.dataset.addroster));el.querySelectorAll('[data-delroster]').forEach(b=>b.onclick=()=>{const [team,id]=b.dataset.delroster.split(':');const arr=rosterFor(team),i=arr.findIndex(p=>p.id===id);if(i>=0)arr.splice(i,1);save()});el.querySelectorAll('[data-editroster]').forEach(b=>b.onclick=()=>openRosterEdit(...b.dataset.editroster.split(':')))}
function openRosterEdit(team,id){const p=rosterFor(team).find(x=>x.id===id);if(!p)return;editingRoster={team,id};document.getElementById('editRosterNum').value=p.number;document.getElementById('editRosterName').value=p.name;document.getElementById('editRosterPos').value=p.position||'';document.getElementById('rosterDialog').showModal()}
function saveRosterEdit(){if(!editingRoster)return;const p=rosterFor(editingRoster.team).find(x=>x.id===editingRoster.id);if(!p)return;p.number=document.getElementById('editRosterNum').value.trim();p.name=document.getElementById('editRosterName').value.trim();p.position=document.getElementById('editRosterPos').value.trim();save();document.getElementById('rosterDialog').close();toast('Player updated')}

function standoutPlayers(players){return Object.entries(players||{}).map(([id,x])=>({id,...x,impact:(x.rushYds||0)+(x.recYds||0)+(x.passYds||0)*.55+(x.points||0)*8+(x.tackles||0)*4+(x.defInt||0)*30+(x.fumbleRec||0)*20})).sort((a,b)=>b.impact-a.impact).filter(x=>x.impact>0).slice(0,3)}
function standoutText(team,x){const bits=[];if(x.rushAtt)bits.push(`${x.rushAtt} carries, ${x.rushYds} yds`);if(x.passAtt)bits.push(`${x.passComp}/${x.passAtt}, ${x.passYds} pass yds`);if(x.rec)bits.push(`${x.rec} catches, ${x.recYds} yds`);const td=(x.rushTD||0)+(x.passTD||0)+(x.recTD||0);if(td)bits.push(`${td} TD`);if(x.tackles)bits.push(`${x.tackles} tackles`);if(x.defInt)bits.push(`${x.defInt} INT`);return `<div class="broadcast-note"><strong>${esc(playerName(team,x.id))}</strong> — ${esc(bits.join(' • '))}</div>`}
function nextGameCard(next){if(!next)return '<p class="muted">No later regular-season game.</p>';const pd=(state.pregameData||{})[next.week]||{},o=pd.opponent||{};return `<h3>${esc(next.opponent)}</h3><p><strong>${fmtDate(next.date)} • ${esc(next.time)} • ${esc(next.site)}</strong></p><div class="summary-grid"><div class="summary-item"><span class="kicker">Rank</span><strong>${o.rank?'#'+o.rank:'Refresh in Pregame'}</strong></div><div class="summary-item"><span class="kicker">Projection</span><strong>${esc(pd.projection||'Refresh in Pregame')}</strong></div></div>`}
function renderPostgame(){const el=document.getElementById('postgame');if(!el)return;const g=ensureGame(),st=calc(),next=state.schedule.find(x=>Number(x.week)>Number(g.week)&&x.opponent!=='OPEN / BYE'),ira=standoutPlayers(st.ira.players),opp=standoutPlayers(st.opp.players);el.innerHTML=`<div class="card hero"><div class="eyebrow">${g.final?'FINAL':'POSTGAME'}</div><h2>IRA ${g.iraScore} — ${g.oppScore} ${esc(g.opponent)}</h2><div class="inline"><button id="finalBtn">${g.final?'Reopen Game':'FINALIZE GAME'}</button>${g.final&&next?'<button id="nextGameBtn">START NEXT GAME</button>':''}</div></div><div class="grid two" style="margin-top:16px"><div class="card"><h2>By the Numbers</h2>${comparisonTable(st)}</div><div class="card"><h2>Players of the Game — Suggestions</h2><h3>Ira</h3>${ira.map(x=>standoutText('ira',x)).join('')||'<p class="muted">No assigned stats.</p>'}<h3>${esc(g.opponent)}</h3>${opp.map(x=>standoutText('opp',x)).join('')||'<p class="muted">No assigned stats.</p>'}</div><div class="card"><div class="eyebrow">NEXT GAME PREVIEW</div>${nextGameCard(next)}</div></div>`;el.querySelectorAll('[data-unedited]').forEach(b=>b.onclick=()=>openUneditedStats(b.dataset.unedited));document.getElementById('finalBtn').onclick=()=>commitAction(g.final?'Reopen game':'Finalize game',gg=>{gg.final=!gg.final});const n=document.getElementById('nextGameBtn');if(n)n.onclick=()=>{state.selectedWeek=next.week;ensureGame();save();document.querySelector('[data-view=pregame]').click()}}

function cloudState(){return {version:state.version,selectedWeek:state.selectedWeek,games:state.games,rosters:state.rosters,settings:{listenUrl:state.settings.listenUrl||''},teamInfo:state.teamInfo,schedule:state.schedule,pregameData:state.pregameData,cloudUpdated:nowIso()}}
function publicPayload(){const g=ensureGame();return {version:8,updated:nowIso(),broadcasterState:cloudState(),team:{name:'Ira Bulldogs',rank:state.teamInfo.rank},game:{week:g.week,opponent:g.opponent,date:g.date,time:g.time,site:g.site,quarter:g.quarter,quarterLabel:periodLabel(g),periodStatus:g.periodStatus||'',clock:g.clock,possession:g.possession,iraScore:safeScore(g.iraScore),oppScore:safeScore(g.oppScore),final:!!g.final,down:g.down,toGo:g.toGo,ballOn:g.ballOn,latestPlay:latestPublicPlay(g),latestUpdate:g.publicUpdate||''},listenUrl:state.settings.listenUrl||''}}
function schedulePublish(){if(typeof document==='undefined'||window.__IRA_TEST_MODE)return;clearTimeout(publishTimer);publishTimer=setTimeout(publishPublic,700)}
async function publishPublic(){const url=effectiveSyncUrl(),key=effectivePublishKey(),status=document.getElementById('publicStatus');if(!url||!key){if(status)status.textContent='Public: setup needed';return}if(!navigator.onLine){if(status)status.textContent='Public: queued offline';return}try{if(status)status.textContent='Public: syncing…';const payload=publicPayload(),body=new URLSearchParams({action:'publish',key,payload:JSON.stringify(payload)});await fetch(url,{method:'POST',mode:'no-cors',body});let verified=false;try{await new Promise(r=>setTimeout(r,350));const chk=await jsonp(url,{action:'public',_:Date.now()}),d=chk?.data;verified=!!(chk?.ok&&d&&safeScore(d.game?.iraScore)===payload.game.iraScore&&safeScore(d.game?.oppScore)===payload.game.oppScore&&String(d.game?.latestPlay||'')===String(payload.game.latestPlay||'')&&String(d.game?.latestUpdate||'')===String(payload.game.latestUpdate||'')&&String(d.game?.possession||'')===String(payload.game.possession||''))}catch{}if(status)status.textContent=verified?'Public: updated':'Public: sent'}catch(e){console.error(e);if(status)status.textContent='Public: queued'}}
function jsonp(url,params={}){return new Promise((resolve,reject)=>{const cb='iraCloud_'+Date.now()+'_'+Math.random().toString(36).slice(2),script=document.createElement('script'),cleanup=()=>{try{delete window[cb]}catch{}script.remove()},timer=setTimeout(()=>{cleanup();reject(new Error('timeout'))},12000);window[cb]=data=>{clearTimeout(timer);cleanup();resolve(data)};const q=new URLSearchParams({...params,callback:cb});script.src=url+(url.includes('?')?'&':'?')+q;script.onerror=()=>{clearTimeout(timer);cleanup();reject(new Error('request'))};document.head.appendChild(script)})}
async function loadCloudGame(){const url=effectiveSyncUrl(),key=effectivePublishKey();if(!url||!key){toast('Cloud URL unavailable');return}try{const x=await jsonp(url,{action:'state',key,_:Date.now()});if(!x?.ok||!x.data)throw new Error('No cloud state');const keep={...state.settings,syncUrl:state.settings.syncUrl||''};state=migrateState(x.data);state.settings={...state.settings,...keep};ensureGame();save('Loaded from cloud');toast('Cloud game restored')}catch(e){console.error(e);toast('Could not load cloud game')}}

function renderAll(){renderPregame();renderLive();renderStats();renderHalftime();renderPostgame();renderRosters()}
function bindStaticUi(){
  document.querySelectorAll('.tabs button').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('active',x===btn));document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===btn.dataset.view));renderAll()});
  document.getElementById('playForm').addEventListener('submit',e=>{e.preventDefault();if(e.submitter&&e.submitter.value==='cancel'){document.getElementById('playDialog').close();return}const data=formDataToPlay(e.currentTarget);applyPlayData(data);document.getElementById('playDialog').close()});
  document.querySelectorAll('[data-score-add]').forEach(b=>b.onclick=()=>updateQuickScore(b.dataset.scoreAdd));document.getElementById('setExactScoreBtn').onclick=setExactScore;document.getElementById('saveClockBtn').onclick=saveClock;document.getElementById('saveRosterEdit').onclick=saveRosterEdit;
  document.getElementById('settingsBtn').onclick=()=>{document.getElementById('syncUrlInput').value=state.settings.syncUrl||'';document.getElementById('publishKeyInput').value=state.settings.publishKey||'';document.getElementById('listenUrlInput').value=state.settings.listenUrl||'';document.getElementById('settingsDialog').showModal()};
  document.getElementById('saveSettingsBtn').onclick=()=>{state.settings.syncUrl=document.getElementById('syncUrlInput').value.trim();state.settings.publishKey=document.getElementById('publishKeyInput').value.trim()||DEFAULT_PUBLISH_KEY;state.settings.listenUrl=document.getElementById('listenUrlInput').value.trim();save();toast('Settings saved')};
  const reset=document.getElementById('resetTestBtn');if(reset)reset.onclick=()=>{if(!confirm('Reset only this week’s game data? Rosters and settings stay.'))return;const s=currentSchedule(),old=ensureGame(),oppRoster=clone(old.opponentRoster||[]),color=old.opponentDisplayColor||'';state.games[gameKey()]={...newGameFromSchedule(s),opponentRoster:oppRoster,opponentDisplayColor:color};save('Game reset');document.getElementById('settingsDialog').close();toast('Current week reset')};
  window.addEventListener('online',schedulePublish)
}

function runInternalRegressionTests(){
  const results=[];const assert=(name,cond,detail='')=>results.push({name,pass:!!cond,detail});
  const original=clone(state);
  try{
    state=initialState();state.selectedWeek=2;const g=ensureGame();g.ballOn='Opp 17';g.down=2;g.toGo=8;g.possession='ira';
    applyPlayData({type:'run',result:'td',runner:'',yards:0,tacklers:[]});let st=calc();assert('TD auto yardage',g.plays[0].yards===17,JSON.stringify(g.plays[0]));assert('TD team rushing stats',st.ira.rushAtt===1&&st.ira.rushYds===17);assert('TD score',g.iraScore===6);
    undoLastGameAction();st=calc();assert('Undo restores score',g.iraScore===0);assert('Undo removes stats',st.ira.rushAtt===0&&st.ira.rushYds===0);assert('Undo restores field',g.ballOn==='Opp 17'&&g.down===2&&String(g.toGo)==='8');
    commitAction('score1',gg=>gg.iraScore+=6);commitAction('score2',gg=>gg.oppScore+=6);undoLastGameAction();undoLastGameAction();assert('Double undo never undefined',Number.isFinite(g.iraScore)&&Number.isFinite(g.oppScore)&&g.iraScore===0&&g.oppScore===0,`${g.iraScore}/${g.oppScore}`);
    g.ballOn='Own 15';g.down=4;g.toGo=10;g.possession='ira';applyPlayData({type:'pass',result:'int',yards:0,passer:'',interceptedBy:''});assert('INT possession flips',g.possession==='opp');assert('INT perspective flips',g.ballOn==='Opp 15',g.ballOn);assert('INT new series',g.down===1&&String(g.toGo)==='15',`${g.down}/${g.toGo}`);
    const before=gameSnapshot(g);applyPlayData({type:'penalty',penaltyStatus:'declined',penalty:'Holding',yards:-10});assert('Declined penalty no field change',g.ballOn===before.ballOn&&g.down===before.down&&String(g.toGo)===String(before.toGo));
    g.possession='ira';const iraBefore=g.iraScore,oppBefore=g.oppScore;applyPlayData({type:'score',scoreType:'2',manualPoints:0,scorer:''});assert('Safety awards defense',g.iraScore===iraBefore&&g.oppScore===oppBefore+2,`${g.iraScore}/${g.oppScore}`);undoLastGameAction();
    g.possession='ira';g.ballOn='Own 30';g.down=2;g.toGo=8;applyPlayData({type:'run',result:'fumble',yards:5,recoveryTeam:'opp',recoveredBy:''});assert('Fumble recovery flips possession',g.possession==='opp');assert('Fumble field perspective',g.ballOn==='Opp 35',g.ballOn);undoLastGameAction();
    const teamStatsBefore=calc().opp.passYds;g.possession='opp';g.ballOn='Own 20';g.down=1;g.toGo=15;applyPlayData({type:'pass',result:'complete',yards:12,passer:'',receiver:''});st=calc();assert('Unassigned pass counts team stats',st.opp.passAtt>=1&&st.opp.passComp>=1&&st.opp.passYds===teamStatsBefore+12);assert('Unedited catches unassigned pass',uneditedForTeam('opp').length>=1);
    state.rosters.ira=[{id:'i1',number:'1',name:'Ira One'}];g.opponentRoster=[{id:'j1',number:'2',name:'Jayton One'}];state.selectedWeek=1;const w1g=ensureGame();assert('Ira roster persists across weeks',rosterFor('ira').some(p=>p.id==='i1'));assert('Opponent roster is game-specific',rosterFor('opp').every(p=>p.id!=='j1'));
    assert('Scores always numeric',Object.values(state.games).every(x=>Number.isFinite(safeScore(x.iraScore))&&Number.isFinite(safeScore(x.oppScore))));
  } finally {state=original;ensureGame()}
  return results
}

if(typeof window!=='undefined')window.__IRA_TEST_API={getState:()=>state,setState:s=>{state=migrateState(s);ensureGame()},ensureGame,calc,uneditedForTeam,applyPlayData,undoLastGameAction,gameSnapshot,runInternalRegressionTests,publicPayload,flipPerspective,distanceToGoal};

function init(){ensureGame();bindStaticUi();renderAll();const badge=document.getElementById('buildVersion');if(badge)badge.textContent=`V${APP_VERSION}`;if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=1600',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{}))}
if(typeof window!=='undefined'&&!window.__IRA_TEST_MODE) init();
