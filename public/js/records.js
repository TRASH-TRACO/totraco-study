// ══════════════════════════════════════════
// 문제 고유 ID(pid) + 풀이 날짜 기록(LOG)
// ══════════════════════════════════════════
// 문제 튜플은 [번호, 일차, pid] 형태. pid는 문제를 추가·수정·재배정해도 바뀌지 않는
// 고유값이라, "언제 이 문제를 풀었는지" 기록을 문제 편집과 무관하게 유지할 수 있다.
// LOG[pid] = { subj, ci, type, num, ch, dates:['YYYY-MM-DD', ...] }
//   dates: 완료 체크한 날짜들(회독을 거치며 여러 날이 쌓일 수 있다). 캘린더는 이걸 날짜별로 뒤집어 보여준다.
let LOG={};
// 하루 한 줄 기록 — DAYNOTES['YYYY-MM-DD'] = '메모(20자 이내)'
const DAYNOTE_MAX=20;
let DAYNOTES={};
let _pidSeq=0;
function newPid(){
  _pidSeq=(_pidSeq+1)&0xffff;
  return 'p'+Date.now().toString(36)+_pidSeq.toString(36)+Math.random().toString(36).slice(2,5);
}
// 로컬 날짜 기준 YYYY-MM-DD (UTC로 밀리면 사용자 달력과 하루 어긋날 수 있어 로컬로 계산)
function todayStr(d){
  const t=d||new Date();
  const y=t.getFullYear(),m=String(t.getMonth()+1).padStart(2,'0'),day=String(t.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+day;
}
/** 모든 문제 튜플에 pid가 있도록 채운다. 하나라도 새로 채웠으면 true. */
function ensurePids(){
  let changed=false;
  SUBJECTS.forEach(s=>{
    const data=DATA[s.id]||[];
    data.forEach(ch=>{
      s.cols.forEach(col=>{
        const arr=ch[col.key];
        if(!Array.isArray(arr))return;
        arr.forEach(p=>{
          if(Array.isArray(p)&&(p.length<3||!p[2])){p[2]=newPid();changed=true;}
        });
      });
    });
  });
  return changed;
}
/** subj·ci·type·num 으로 살아있는 문제 튜플을 찾는다. 없으면 null. */
function findProb(subj,ci,type,num){
  const data=DATA[subj];if(!data)return null;
  const ch=data[ci];if(!ch)return null;
  const s=SUBJECTS.find(x=>x.id===subj);if(!s)return null;
  const col=s.cols.find(c=>colKeyToType(subj,c.key)===type);if(!col)return null;
  const arr=ch[col.key]||[];
  return arr.find(p=>(Array.isArray(p)?p[0]:p)===num)||null;
}
function pidOf(subj,ci,type,num){const p=findProb(subj,ci,type,num);return p&&Array.isArray(p)?p[2]:null;}

/** 완료 토글 시 풀이 날짜를 기록/해제한다. done=true면 오늘 날짜 추가, false면 오늘 기록 제거. */
function recordSolve(subj,ci,type,num,done){
  const p=findProb(subj,ci,type,num);
  if(!p||!Array.isArray(p))return;
  let pid=p[2];
  if(!pid){pid=p[2]=newPid();}
  const today=todayStr();
  if(done){
    let e=LOG[pid];
    if(!e){e={subj,ci,type,num,ch:'',dates:[]};LOG[pid]=e;}
    // 메타는 최신 위치·이름으로 갱신(장 이름이 바뀌었을 수 있다)
    e.subj=subj;e.ci=ci;e.type=type;e.num=num;
    e.ch=(DATA[subj]&&DATA[subj][ci]&&DATA[subj][ci].ch)||e.ch||'';
    if(!e.dates.includes(today))e.dates.push(today);
  }else{
    const e=LOG[pid];
    if(e){
      e.dates=e.dates.filter(d=>d!==today);
      if(!e.dates.length)delete LOG[pid];
    }
  }
}
async function saveLog(){
  try{ await idbSet('study_log',LOG); }
  catch(_){ try{ localStorage.setItem('study_log',JSON.stringify(LOG)); }catch(__){} }
  window.CloudSync?.schedulePush();
}
async function loadLog(){
  try{ const v=await idbGet('study_log'); if(v&&typeof v==='object')LOG=v; }
  catch(_){ try{ const s=localStorage.getItem('study_log'); if(s)LOG=JSON.parse(s); }catch(__){} }
}
async function saveDayNotes(){
  try{ await idbSet('day_notes',DAYNOTES); }
  catch(_){ try{ localStorage.setItem('day_notes',JSON.stringify(DAYNOTES)); }catch(__){} }
  window.CloudSync?.schedulePush();
}
async function loadDayNotes(){
  try{ const v=await idbGet('day_notes'); if(v&&typeof v==='object')DAYNOTES=v; }
  catch(_){ try{ const s=localStorage.getItem('day_notes'); if(s)DAYNOTES=JSON.parse(s); }catch(__){} }
}
// 하루 기록 병합 — 날짜별 단일 문자열이라 합집합이 아니라 "빈 값이 덮어쓰지 못하게" 한다.
// 양쪽 다 값이 있으면 들어온(원격) 쪽을 우선. 빈 incoming은 로컬 기록을 지우지 않는다.
function mergeNotesInto(localNotes, incoming){
  const out={...(localNotes||{})};
  const inc=incoming||{};
  Object.keys(inc).forEach(ds=>{ const v=(inc[ds]||'').trim(); if(v)out[ds]=inc[ds]; });
  return out;
}

// ══════════════════════════════════════════
// 틀린 문제 다시 풀기 (재수강)
// ══════════════════════════════════════════
// 원본(DATA/S)과 분리해 관리한다 — 같은 문제가 두 일차에 들어가도 완료 표시가 안 엉키게.
//  RETRIES: [{ rid, subj, ci, type, num, pid, day, done }]  각자 고유 rid + 독립 완료(done)
//  WRONG:   { pid: true }  이번 회차 '오답' 표시(빨강)
//  RETRY_BASE: { subj: { pid: 원래일차 } }  재수강 삽입으로 밀리기 전 정규 일차 스냅샷(복원용)
const RETRY_OFFSET=7;   // 며칠 뒤에 다시 풀지
let RETRIES=[], WRONG={}, RETRY_BASE={};
let _ridSeq=0;
function newRid(){ _ridSeq=(_ridSeq+1)&0xffff; return 'r'+Date.now().toString(36)+_ridSeq.toString(36)+Math.random().toString(36).slice(2,4); }

async function saveRetries(){
  try{ await idbSet('retries',RETRIES); await idbSet('wrong',WRONG); await idbSet('retry_base',RETRY_BASE); }
  catch(_){ try{ localStorage.setItem('retries',JSON.stringify(RETRIES)); localStorage.setItem('wrong',JSON.stringify(WRONG)); localStorage.setItem('retry_base',JSON.stringify(RETRY_BASE)); }catch(__){} }
  window.CloudSync?.schedulePush();
}
async function loadRetries(){
  try{
    const r=await idbGet('retries'); if(Array.isArray(r))RETRIES=r;
    const w=await idbGet('wrong'); if(w&&typeof w==='object')WRONG=w;
    const b=await idbGet('retry_base'); if(b&&typeof b==='object')RETRY_BASE=b;
  }catch(_){
    try{
      const r=localStorage.getItem('retries'); if(r)RETRIES=JSON.parse(r);
      const w=localStorage.getItem('wrong'); if(w)WRONG=JSON.parse(w);
      const b=localStorage.getItem('retry_base'); if(b)RETRY_BASE=JSON.parse(b);
    }catch(__){}
  }
}
// 재수강으로 완료한 날짜 표식 — 캘린더에서 '다시 풀기'로 구분해 보여주기 위한 이력.
// { "pid|YYYY-MM-DD": true } · 이력이라 다음 회차에도 유지(clearAllRetries가 건드리지 않음).
let RETRY_DONE={};
async function saveRetryDone(){
  try{ await idbSet('retry_done',RETRY_DONE); }
  catch(_){ try{ localStorage.setItem('retry_done',JSON.stringify(RETRY_DONE)); }catch(__){} }
  window.CloudSync?.schedulePush();
}
async function loadRetryDone(){
  try{ const v=await idbGet('retry_done'); if(v&&typeof v==='object')RETRY_DONE=v; }
  catch(_){ try{ const s=localStorage.getItem('retry_done'); if(s)RETRY_DONE=JSON.parse(s); }catch(__){} }
}

// 오답 표시
function isWrong(subj,ci,type,num){ const pid=pidOf(subj,ci,type,num); return !!(pid&&WRONG[pid]); }
function toggleWrong(subj,ci,type,num){
  const pid=pidOf(subj,ci,type,num); if(!pid)return;
  if(WRONG[pid])delete WRONG[pid]; else WRONG[pid]=true;
  saveRetries();
}

// 재수강 예약 여부
function isRetryScheduled(subj,ci,type,num){
  return RETRIES.some(r=>r.subj===subj&&r.ci===ci&&r.type===type&&r.num===num);
}
// 과목의 정규 일차 스냅샷(재수강 삽입 전) — 최초 1회만
function snapshotRetryBase(subj){
  if(RETRY_BASE[subj])return;
  const sdef=SUBJECTS.find(s=>s.id===subj); if(!sdef)return;
  const base={};
  (DATA[subj]||[]).forEach(ch=>sdef.cols.forEach(col=>{
    (ch[col.key]||[]).forEach(p=>{ if(Array.isArray(p)&&p[2])base[p[2]]=p[1]; });
  }));
  RETRY_BASE[subj]=base;
}
// base에서 정규 일차를 되돌린 뒤, 예약된 재수강을 일차 오름차순으로 삽입한다.
// 삽입한 일차의 마지막 문제를 다음 일차로 밀고, 그 일차의 마지막도 또 다음으로 …
// 끝까지 한 칸씩 연쇄 이동(맨 끝은 새 일차 생성). → 각 일차의 문항 수가 유지된다.
function applyRetrySchedule(subj){
  const base=RETRY_BASE[subj]; const data=DATA[subj]; const sdef=SUBJECTS.find(s=>s.id===subj);
  if(!base||!data||!sdef)return;
  // 1) 정규 일차를 base로 복원
  data.forEach(ch=>sdef.cols.forEach(col=>{
    (ch[col.key]||[]).forEach(p=>{ if(Array.isArray(p)&&base[p[2]]!==undefined)p[1]=base[p[2]]; });
  }));
  // 헬퍼: 일차 d의 정규 문제들(ci,num 순), exclPid 제외
  function dayRegs(d,exclPid){
    const out=[];
    data.forEach((ch,ci)=>sdef.cols.forEach(col=>{
      (ch[col.key]||[]).forEach(p=>{ if(Array.isArray(p)&&p[1]===d&&p[2]!==exclPid)out.push({p,key:ci*100000+p[0]}); });
    }));
    out.sort((a,b)=>a.key-b.key);
    return out.map(x=>x.p);
  }
  function curMax(){ let m=0; data.forEach(ch=>sdef.cols.forEach(col=>(ch[col.key]||[]).forEach(p=>{ if(Array.isArray(p)&&p[1]>m)m=p[1]; }))); return m; }
  // 2) 재수강을 일차 오름차순으로 각각 삽입 + 끝까지 연쇄 이동
  const rs=RETRIES.filter(r=>r.subj===subj).sort((a,b)=>a.day-b.day||(a.rid<b.rid?-1:1));
  rs.forEach(r=>{
    const T=r.day;
    const first=dayRegs(T,null);
    if(!first.length)return;              // T에 정규 문제가 없으면 밀 것 없음
    let carry=first[first.length-1];      // T의 마지막을 밀어냄
    carry[1]=T+1;
    const maxD=curMax();
    let d=T+1;
    while(d<=maxD){
      const regs=dayRegs(d,carry[2]);     // 이 일차의 원래 문제들(방금 밀려온 carry 제외)
      if(!regs.length)break;              // 원래 비어있던 칸 → carry 안착, 연쇄 종료
      const last=regs[regs.length-1];
      last[1]=d+1;                        // 이 일차의 마지막을 다음 일차로
      carry=last; d++;
    }
  });
}
// 완료 버킷 등 실제 일차가 없는 경우, "현재 진행 위치"(첫 미완료 일차)를 기준일차로 삼는다.
function frontDayOf(subj){
  const dm=MAPS[subj]||{}; const max=MAXS[subj]||0;
  for(let d=1;d<=max;d++){
    const ps=dm[d]||[];
    if(ps.some(p=>!dn(p.subj,p.ci,p.type,p.num)))return d;
    if(RETRIES.some(r=>r.subj===subj&&r.day===d&&!r.done))return d;
  }
  return Math.max(1,max);
}
function scheduleRetry(subj,ci,type,num,fromDay){
  if(isRetryScheduled(subj,ci,type,num))return;
  if(!(fromDay>=1))fromDay=frontDayOf(subj);   // 완료 버킷(일차 0)이면 현재 진행 위치 기준으로
  snapshotRetryBase(subj);
  RETRIES.push({rid:newRid(),subj,ci,type,num,pid:pidOf(subj,ci,type,num),day:fromDay+RETRY_OFFSET,done:false});
  applyRetrySchedule(subj);
}
function unscheduleRetry(subj,ci,type,num){
  const before=RETRIES.length;
  RETRIES=RETRIES.filter(r=>!(r.subj===subj&&r.ci===ci&&r.type===type&&r.num===num));
  if(RETRIES.length===before)return;
  applyRetrySchedule(subj);
  if(!RETRIES.some(r=>r.subj===subj))delete RETRY_BASE[subj];   // 다 지웠으면 스냅샷 정리(이미 base로 복원됨)
}
function toggleRetryDone(rid){
  const r=RETRIES.find(x=>x.rid===rid); if(!r)return;
  r.done=!r.done;
  recordSolve(r.subj,r.ci,r.type,r.num,r.done);   // 재수강 완료도 그날 풀이로 캘린더에 기록
  // 그날 그 문제 완료가 '다시 풀기'였음을 표식 → 캘린더에서 구분 표시
  const pid=r.pid||pidOf(r.subj,r.ci,r.type,r.num);
  if(pid){ const key=pid+'|'+todayStr(); if(r.done)RETRY_DONE[key]=true; else delete RETRY_DONE[key]; }
  saveRetries();saveLog();saveRetryDone();
}
// 특정 일차/과목의 재수강들
function retriesForDay(day){ return RETRIES.filter(r=>r.day===day&&(curSubj==='all'||r.subj===curSubj)); }
function maxRetryDay(){ let m=0; RETRIES.forEach(r=>{ if((curSubj==='all'||r.subj===curSubj)&&r.day>m)m=r.day; }); return m; }
// 재수강 정리 — base로 정규 일차 복원 후 제거
function clearRetriesForSubj(subj){
  const base=RETRY_BASE[subj], sdef=SUBJECTS.find(s=>s.id===subj), data=DATA[subj];
  if(base&&sdef&&data){
    data.forEach(ch=>sdef.cols.forEach(col=>{
      (ch[col.key]||[]).forEach(p=>{ if(Array.isArray(p)&&base[p[2]]!==undefined)p[1]=base[p[2]]; });
    }));
  }
  RETRIES=RETRIES.filter(r=>r.subj!==subj);
  Object.keys(WRONG).forEach(pid=>{ /* pid는 과목 정보가 없어 그대로 둔다 — clearAllRetries에서 일괄 정리 */ });
  delete RETRY_BASE[subj];
}
async function clearAllRetries(){
  SUBJECTS.forEach(s=>{ if(RETRY_BASE[s.id])clearRetriesForSubj(s.id); });
  RETRIES=[]; WRONG={}; RETRY_BASE={};
  await saveRetries(); await saveAllSubjData();
}
// 원본 문제의 완료를 해제하면 그 문제의 오답·다시풀기 예약도 함께 해제한다.
// 바뀐 게 있으면 true(호출 측이 저장·재렌더).
function clearRetryAndWrong(subj,ci,type,num){
  let changed=false;
  const pid=pidOf(subj,ci,type,num);
  if(pid&&WRONG[pid]){ delete WRONG[pid]; changed=true; }
  if(isRetryScheduled(subj,ci,type,num)){ unscheduleRetry(subj,ci,type,num); changed=true; }
  return changed;
}
/** LOG를 날짜별로 뒤집어 { 'YYYY-MM-DD': [ {pid,subj,ci,type,num,ch} ] } 로 만든다. */
function buildDateIndex(){
  const byDate={};
  Object.keys(LOG).forEach(pid=>{
    const e=LOG[pid];if(!e||!Array.isArray(e.dates))return;
    e.dates.forEach(d=>{
      if(!byDate[d])byDate[d]=[];
      byDate[d].push({pid,subj:e.subj,ci:e.ci,type:e.type,num:e.num,ch:e.ch,retry:!!RETRY_DONE[pid+'|'+d]});
    });
  });
  return byDate;
}
// 풀이 이력은 누적(append-only)이라 어느 방향으로도 줄어들면 안 된다.
// 로컬과 들어온 기록을 pid별 날짜 "합집합"으로 병합한다 — 빈 기록이 내려와도 기존 이력이 살아남는다.
function mergeLogInto(localLog, incoming){
  const out={};
  const pids=new Set([...Object.keys(localLog||{}),...Object.keys(incoming||{})]);
  pids.forEach(pid=>{
    const a=(localLog||{})[pid], b=(incoming||{})[pid];
    if(a&&b){
      const dates=Array.from(new Set([...(a.dates||[]),...(b.dates||[])])).sort();
      out[pid]={...a,...b,dates};   // 메타는 들어온 쪽 우선, 날짜는 합집합
    }else{
      out[pid]=a||b;
    }
  });
  return out;
}

// XSS 방지 헬퍼
function escapeHtml(str){
  const d=document.createElement('div');d.textContent=str;return d.innerHTML;
}

const CC={theory:'th',basic:'ba',adv:'av',single:'si',calc:'ca'};
const TL={theory:'이론',basic:'기본',adv:'심화',calc:'계산'};
const SUBJ_NAME={fin:'재무회계',cost:'원가회계',tax:'세법',gib:'국기법',jing:'국징법',beol:'조처법',all:'전체'};
const SUBJ_COLOR={fin:'var(--fin)',cost:'var(--cost)',tax:'var(--tax)',gib:'var(--gib)',jing:'var(--jing)',beol:'var(--beol)'};

