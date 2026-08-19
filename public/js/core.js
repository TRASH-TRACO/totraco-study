
// ══════════════════════════════════════════
// 과목 관리
// ══════════════════════════════════════════
// SUBJECTS: 과목 설정의 원본 (런타임에 수정 가능)
// id: 내부 키 (영문), name: 표시 이름, color: CSS 변수명,
// cols: 문제 유형 [{key, label, cssClass}]
// dataKey: data.json 및 백업에서 사용하는 키
// idbKey: IndexedDB 저장 키

// 공개 서비스이므로 기본 과목을 주지 않는다. 사용자가 직접 등록한다.
const DEFAULT_SUBJECTS = [];

// 새 과목의 기본 문제 유형 (과목 추가 시 최소 1개는 있어야 그리드가 성립)
const DEFAULT_COLS = [{key:'p',label:'문제',cls:'si'}];

let SUBJECTS = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));

// 앱 제목(사용자가 무슨 공부를 하는지). 설정값이며 동기화 blob에 포함된다.
let appTitle = '학습 일지';
function renderAppTitle(){
  const el=document.getElementById('hdr-title');
  if(el) el.textContent=appTitle;
  document.title=appTitle;
}
function editAppTitle(){
  const el=document.getElementById('hdr-title');
  if(!el) return;
  el.contentEditable='true';
  el.focus();
  const r=document.createRange();r.selectNodeContents(el);
  const sel=getSelection();sel.removeAllRanges();sel.addRange(r);
}
async function commitAppTitle(){
  const el=document.getElementById('hdr-title');
  if(!el) return;
  el.contentEditable='false';
  const v=(el.textContent||'').trim()||'학습 일지';
  const changed=v!==appTitle;
  appTitle=v;el.textContent=v;document.title=v;
  if(changed){
    try{await idbSet('app_title',appTitle);}catch(_){}
    if(window.CloudSync&&typeof window.CloudSync.schedulePush==='function') window.CloudSync.schedulePush();
  }
}
window.editAppTitle=editAppTitle;
window.commitAppTitle=commitAppTitle;

// 다크/라이트 테마. data-theme 미설정이면 시스템 설정을 따른다.
function currentTheme(){
  const attr=document.documentElement.getAttribute('data-theme');
  if(attr) return attr;
  return matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';
}
// 테마 아이콘 — 이모지 대신 SVG로 그려 헤더 톤을 맞춘다
const ICON_SUN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const ICON_MOON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
function applyThemeIcon(){
  const b=document.getElementById('theme-toggle');
  if(b) b.innerHTML=currentTheme()==='dark'?ICON_SUN:ICON_MOON;
}
function toggleTheme(){
  const next=currentTheme()==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',next);
  try{localStorage.setItem('theme',next);}catch(_){}
  applyThemeIcon();
}
window.toggleTheme=toggleTheme;
matchMedia('(prefers-color-scheme:dark)').addEventListener?.('change',applyThemeIcon);

// ══════════════════════════════════════════
// 진입 게이트 · 온보딩
// ══════════════════════════════════════════

/** 등록된 과목이 있으면 현재 선택 과목들을 첫 과목으로 맞춘다. */
function ensureCurSubjects(){
  const first=SUBJECTS[0]?SUBJECTS[0].id:null;
  const ids=SUBJECTS.map(s=>s.id);
  if(!ids.includes(curEdSubj))   curEdSubj=first;
  if(!ids.includes(curRandSubj)) curRandSubj=first;
  if(curSubj!=='all'&&!ids.includes(curSubj)) curSubj=first;
}

/** 어느 과목이든 등록된 문제가 하나라도 있는가 */
function hasAnyProblems(){
  return SUBJECTS.some(s=>(DATA[s.id]||[]).length>0);
}
/**
 * 일차가 배정된 문제가 하나라도 있는가 (= 회독 시작됨).
 * 문제는 [문제번호, 일차] 쌍으로 저장되므로 일차가 1 이상인 항목을 찾는다.
 */
function hasAnyAssigned(){
  return SUBJECTS.some(s=>
    (DATA[s.id]||[]).some(ch=>
      s.cols.some(c=>(ch[c.key]||[]).some(p=>Array.isArray(p)&&p[1]>=1))));
}

/** 진입 모드 게이트: 선택 이력이 없으면 로그인/비로그인 선택 화면을 띄운다. */
function applyEntryGate(){
  const g=document.getElementById('gate');
  if(!g) return;
  let mode=null;
  try{ mode=localStorage.getItem('entryMode'); }catch(_){}
  g.style.display = mode ? 'none' : 'flex';
}
function chooseEntry(mode){
  try{ localStorage.setItem('entryMode',mode); }catch(_){}
  const g=document.getElementById('gate');
  if(g) g.style.display='none';
  if(mode==='cloud' && typeof window.onSyncChipClick==='function') window.onSyncChipClick();
}
window.chooseEntry=chooseEntry;

/** 온보딩 배너 — 실제 데이터 상태로 단계 완료를 판정한다. */
function refreshOnboarding(){
  const box=document.getElementById('onboard');
  if(!box) return;
  let done=false;
  try{ done=localStorage.getItem('onboarded')==='1'; }catch(_){}

  const steps=[
    {label:'과목을 등록하세요',        ok:SUBJECTS.length>0},
    {label:'과목에 문제를 등록하세요', ok:hasAnyProblems()},
    {label:'회독을 시작하세요',        ok:hasAnyAssigned()},
  ];
  const allOk=steps.every(s=>s.ok);
  if(allOk&&!done){ try{ localStorage.setItem('onboarded','1'); }catch(_){} done=true; }

  if(done||allOk){ box.style.display='none'; return; }
  box.style.display='block';
  box.innerHTML='<div class="ob-title">시작해볼까요?</div>'+
    '<ol class="ob-steps">'+steps.map(s=>
      `<li class="${s.ok?'ok':''}">${s.ok?'✓':''} ${escapeHtml(s.label)}</li>`).join('')+'</ol>';
}
window.refreshOnboarding=refreshOnboarding;

/** 학습 화면이 비어 있을 때 안내를 띄운다. */
function updateEmptyStates(){
  const el=document.getElementById('study-empty');
  if(!el) return;
  const empty=!hasAnyProblems();
  el.style.display=empty?'block':'none';
  const body=document.getElementById('study-body');
  if(body) body.style.display=empty?'none':'';
}
window.updateEmptyStates=updateEmptyStates;

// 사용 가능한 색상 팔레트
// hex를 흰색 쪽으로 t(0~1)만큼 섞는다 — 팔레트 tint/border 자동 생성용
function mixHex(hex, t){
  const n=parseInt(hex.slice(1),16), r=n>>16, g=(n>>8)&255, b=n&255;
  const m=v=>Math.round(v+(255-v)*t);
  return '#'+((1<<24)+(m(r)<<16)+(m(g)<<8)+m(b)).toString(16).slice(1);
}
// 과목 색상 팔레트 — id는 CSS 변수명·저장값으로 쓰이니 기존 6종(fin/cost/tax/gib/jing/beol)은 유지.
// bg(연한 배경)·bd(테두리)는 c에서 자동 생성(정규화 루프).
const COLOR_PALETTE = [
  {id:'fin',label:'빨강',c:'#d44c47'},   {id:'coral',label:'코랄',c:'#e2664a'},
  {id:'orange',label:'주황',c:'#e2822e'},{id:'gib',label:'호박',c:'#d08c3a'},
  {id:'amber',label:'앰버',c:'#c99a2e'}, {id:'yellow',label:'노랑',c:'#b8992a'},
  {id:'olive',label:'올리브',c:'#7a8450'},{id:'lime',label:'라임',c:'#6f9e34'},
  {id:'cost',label:'초록',c:'#448361'},  {id:'emerald',label:'에메랄드',c:'#2f9e6a'},
  {id:'teal',label:'틸',c:'#2f9c8f'},    {id:'jing',label:'청록',c:'#3a8da0'},
  {id:'cyan',label:'시안',c:'#3592b5'},  {id:'sky',label:'하늘',c:'#4a90d9'},
  {id:'navy',label:'남색',c:'#3d5a80'},  {id:'blue',label:'파랑',c:'#4263c4'},
  {id:'indigo',label:'인디고',c:'#5b57c9'},{id:'violet',label:'바이올렛',c:'#7c5cd0'},
  {id:'tax',label:'보라',c:'#9065b0'},   {id:'fuchsia',label:'자홍',c:'#b453c0'},
  {id:'beol',label:'자주',c:'#8a6b8a'},  {id:'pink',label:'핑크',c:'#d95f9c'},
  {id:'rose',label:'로즈',c:'#e0577c'},  {id:'brown',label:'브라운',c:'#9c6b4a'},
  {id:'slate',label:'슬레이트',c:'#5e6b7a'},{id:'gray',label:'회색',c:'#6b7280'},
];
// bg/bd 자동 채우기
COLOR_PALETTE.forEach(cp=>{ if(!cp.bg)cp.bg=mixHex(cp.c,0.90); if(!cp.bd)cp.bd=mixHex(cp.c,0.55); });

// 과목 색 CSS 변수 이름 — 반드시 --subj- 접두사를 붙인다.
// 과목 id는 팔레트 색 id(fin/cost/tax/gib/jing/beol)와 겹칠 수 있어서(문제집 불러오기는 색 id를
// 그대로 과목 id로 쓴다) 접두사가 없으면 updateSubjectCSS()가 style.css의 전역 토큰(--cost 등)을
// 덮어써 버린다. 그러면 그 토큰을 쓰는 완료 타일·유형 칩 색이 과목 색을 따라가 버린다.
function subjVarName(id,suffix){ return '--subj-'+id+(suffix?'-'+suffix:''); }
function subjVar(id,suffix,fallback){ return 'var('+subjVarName(id,suffix)+(fallback?','+fallback:'')+')'; }

// 유형 프리셋
const COL_PRESETS = [
  {label:'이론만',cols:[{key:'t',label:'이론',cls:'th'}]},
  {label:'이론+기본+심화',cols:[{key:'t',label:'이론',cls:'th'},{key:'b',label:'기본',cls:'ba'},{key:'a',label:'심화',cls:'av'}]},
  {label:'이론+계산',cols:[{key:'th',label:'이론',cls:'th'},{key:'ca',label:'계산',cls:'ca'}]},
  {label:'단일(문제)',cols:[{key:'p',label:'문제',cls:'si'}]},
];

let subjEditRows = [];

// ══════════════════════════════════════════
// 데이터
// ══════════════════════════════════════════
let DATA={},DEFAULTS={};
// 남은 문제 조정으로 완료 문제를 "완료된 문제" 버킷(일차 0)에 몰아넣기 전의 원래 배치를
// 과목별로 스냅샷해 둔다. { subjId: { "ci|colKey|num": 원래일차 } }
// 전체/과목 진도를 미완료로 초기화하면 이 스냅샷의 "문제별 순서"대로 되돌린다(일차 숫자는 달라도 순서 보존).
let PLAN_SNAPSHOT={};
async function savePlanSnapshot(){
  try{ await idbSet('plan_snapshot', PLAN_SNAPSHOT); }catch(_){}
  window.CloudSync?.schedulePush();
}
/** 스냅샷의 원래 순서(원래일차→ci→num)대로 과목 문제 일차를 다시 매긴다. 되돌릴 게 없으면 false. */
function restorePlanOrder(subjId){
  const snap = PLAN_SNAPSHOT[subjId];
  const data = DATA[subjId];
  if(!snap || !data) return false;
  // 스냅샷 키를 원래 순서(원래일차→ci→num)로 정렬 → 그대로 일차 복원
  data.forEach((ch,ci)=>{
    Object.keys(ch).forEach(col=>{
      if(col==='ch'||!Array.isArray(ch[col]))return;
      ch[col]=ch[col].map(pair=>{
        const od = snap[`${ci}|${col}|${pair[0]}`];
        return od!==undefined ? [pair[0], od, pair[2]] : pair;
      });
    });
  });
  return true;
}
// Legacy aliases (동적 시스템과 기존 코드 브릿지)
function syncLegacy(){
  FD=DATA.fin||[];CD=DATA.cost||[];TAXD=DATA.tax||[];GIBD=DATA.gib||[];JINGD=DATA.jing||[];BEOLD=DATA.beol||[];
  DF=DEFAULTS.fin||[];DC=DEFAULTS.cost||[];DTAX=DEFAULTS.tax||[];DGIB=DEFAULTS.gib||[];DJING=DEFAULTS.jing||[];DBEOL=DEFAULTS.beol||[];
}
let DF=[],DC=[],DTAX=[],DGIB=[],DJING=[],DBEOL=[];

let FD=JSON.parse(JSON.stringify(DF));
let CD=JSON.parse(JSON.stringify(DC));
let TAXD=JSON.parse(JSON.stringify(DTAX));
let GIBD=JSON.parse(JSON.stringify(DGIB));
let JINGD=JSON.parse(JSON.stringify(DJING));
let BEOLD=JSON.parse(JSON.stringify(DBEOL));

// ══════════════════════════════════════════
// IndexedDB 래퍼 (localStorage 대체)
// ══════════════════════════════════════════
const IDB_NAME='semuasa_db', IDB_VER=1, IDB_STORE='kv';
let _idb=null;

function openIDB(){
  return new Promise((res,rej)=>{
    if(_idb){res(_idb);return;}
    const req=indexedDB.open(IDB_NAME,IDB_VER);
    req.onupgradeneeded=e=>{e.target.result.createObjectStore(IDB_STORE);};
    req.onsuccess=e=>{_idb=e.target.result;res(_idb);};
    req.onerror=e=>rej(e);
  });
}
async function idbGet(key){
  const db=await openIDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(IDB_STORE,'readonly');
    const req=tx.objectStore(IDB_STORE).get(key);
    req.onsuccess=()=>res(req.result??null);
    req.onerror=e=>rej(e);
  });
}
async function idbSet(key,val){
  const db=await openIDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(IDB_STORE,'readwrite');
    tx.objectStore(IDB_STORE).put(val,key);
    tx.oncomplete=()=>res();
    tx.onerror=e=>rej(e);
  });
}
async function idbDel(key){
  const db=await openIDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(IDB_STORE,'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete=()=>res();
    tx.onerror=e=>rej(e);
  });
}
// 이 기기의 앱 데이터 전체 삭제 (로그아웃 시 "데이터 지우기"용)
async function idbClear(){
  const db=await openIDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(IDB_STORE,'readwrite');
    tx.objectStore(IDB_STORE).clear();
    tx.oncomplete=()=>res();
    tx.onerror=e=>rej(e);
  });
}

// ── 상태 저장/로드 (IndexedDB) ──
async function saveState(){
  try{
    await idbSet('ts6',S);
  }catch(e){
    // fallback: localStorage
    try{localStorage.setItem('ts6',JSON.stringify(S));}catch(_){}
  }
  window.CloudSync?.schedulePush();
}
async function loadState(){
  try{
    const s=await idbGet('ts6'); if(s)S=s;
  }catch(e){
    // fallback: localStorage
    try{const s=localStorage.getItem('ts6');if(s)S=JSON.parse(s);}catch(_){}
  }
}
async function loadData(){
  // 사용자 수정 데이터(IndexedDB)는 항상 우선 적용
  let loaded=0;
  try{
    for(const s of SUBJECTS){
      const v=await idbGet(s.idbKey);
      if(v&&Array.isArray(v)&&v.length){DATA[s.id]=v;loaded++;}
    }
  }catch(e){
    try{
      for(const s of SUBJECTS){
        const raw=localStorage.getItem(s.idbKey);
        if(raw){const p=JSON.parse(raw);if(Array.isArray(p)&&p.length){DATA[s.id]=p;loaded++;}}
      }
    }catch(_){}
  }
  if(loaded>0)console.log('💾 저장된 데이터 로드:', loaded+'개 과목');
  syncLegacy();
}
function simpleHash(str){
  let h=0;for(let i=0;i<str.length;i++){h=((h<<5)-h)+str.charCodeAt(i);h|=0;}return String(h);
}
async function saveAllSubjData(){
  let saved=0;
  try{
    for(const s of SUBJECTS){
      await idbSet(s.idbKey, DATA[s.id]||[]);
      saved++;
    }
  }catch(e){
    try{
      for(const s of SUBJECTS){
        localStorage.setItem(s.idbKey, JSON.stringify(DATA[s.id]||[]));
        saved++;
      }
    }catch(_){}
  }
  console.log('💾 저장 완료:', saved+'개 과목');
  window.CloudSync?.schedulePush();
}

async function loadSubjectsConfig(){
  try{
    const cfg = await idbGet('subjects_config');
    if(cfg && Array.isArray(cfg) && cfg.length) SUBJECTS = cfg;
  }catch(e){
    try{
      const cfg = localStorage.getItem('subjects_config');
      if(cfg){const p=JSON.parse(cfg);if(Array.isArray(p)&&p.length)SUBJECTS=p;}
    }catch(_){}
  }
  updateSubjectCSS();
}

// rebuildUI: 과목 변경 후 전체 UI 재구성
function rebuildUI(){
  syncLegacy();
  buildMaps();
  renderStudyTabs();
  renderProgressCards();
  renderFooterBtns();
  buildDG();
  updateProgress();
  if(curView==='chap')renderChaps();
}

// 학습 탭의 과목 탭 동적 생성
function renderStudyTabs(){
  const con = document.getElementById('study-subj-tabs');
  if(!con)return;
  con.innerHTML='';
  SUBJECTS.forEach(s=>{
    const el=document.createElement('div');el.className='st';el.id='st-'+s.id;
    el.onclick=()=>goSubj(s.id);
    el.innerHTML=s.name+' <span class="sbadge" id="b-'+s.id+'">0%</span>';
    con.appendChild(el);
  });
  const all=document.createElement('div');all.className='st';all.id='st-all';
  all.onclick=()=>goSubj('all');
  all.innerHTML='전체 <span class="sbadge" id="b-all">0%</span>';
  con.appendChild(all);
  // 현재 선택 반영
  goSubj(curSubj);
}

// 진도 카드 동적 생성
function renderProgressCards(){
  const con = document.getElementById('prog-cards-con');
  if(!con)return;
  con.innerHTML='';
  // curSubj가 'all'이면 모든 과목, 아니면 선택된 과목만
  const subjs = curSubj==='all' ? SUBJECTS : SUBJECTS.filter(s=>s.id===curSubj);
  subjs.forEach(s=>{
    const card=document.createElement('div');card.className='prog-card';
    card.innerHTML='<div class="prog-card-label">'+escapeHtml(s.name)+'</div>'
      +'<div class="prog-card-pct" id="lbl-'+s.id+'" style="color:'+subjVar(s.id)+'">0%</div>'
      +'<div class="prog-track"><div class="prog-fill" id="bar-'+s.id+'" style="width:0%;background:'+subjVar(s.id)+'"></div></div>';
    con.appendChild(card);
  });
}

// 푸터 초기화 버튼 동적 생성
function renderFooterBtns(){
  const con = document.getElementById('footer-reset-btns');
  if(!con)return;
  con.innerHTML='';
  SUBJECTS.forEach(s=>{
    const btn=document.createElement('button');btn.className='fbtn';
    btn.title=s.name+' 진도 초기화';
    btn.textContent='🔄 '+s.name.replace(/회계|세$|법$/,'').slice(0,3);
    btn.onclick=()=>resetSubj(s.id);
    con.appendChild(btn);
  });
}

async function saveSubjData(){
  try{await idbSet('cfd',FD);await idbSet('ccd',CD);await idbSet('ctaxd',TAXD);await idbSet('cgibd',GIBD);await idbSet('cjingd',JINGD);await idbSet('cbeold',BEOLD);}
  catch(e){try{localStorage.setItem('cfd',JSON.stringify(FD));localStorage.setItem('ccd',JSON.stringify(CD));localStorage.setItem('ctaxd',JSON.stringify(TAXD));localStorage.setItem('cgibd',JSON.stringify(GIBD));localStorage.setItem('cjingd',JSON.stringify(JINGD));localStorage.setItem('cbeold',JSON.stringify(BEOLD));}catch(_){}}
  window.CloudSync?.schedulePush();
}

// ══════════════════════════════════════════
// 맵 (동적 — SUBJECTS 기반)
// ══════════════════════════════════════════
let MAPS={}, MAXS={}, adm={};
// Legacy aliases (기존 코드 호환용 — buildMaps에서 갱신)
let fdm={},cdm={},taxdm={},gibdm={},jingdm={},beoldm={},fmax=0,cmax=0,taxmax=0,gibmax=0,jingmax=0,beolmax=0;

// 미뤄둔 문제 버킷의 일차 값(센티넬). 완료 버킷(일차 0)의 정반대 — 맨 뒤에 쌓인다.
const POSTPONE_DAY = 9000;
function buildMaps(){
  MAPS={};MAXS={};adm={};
  // 각 과목별로 dayMap 생성
  SUBJECTS.forEach(s=>{
    const dayMap={};let max=0;
    const data=DATA[s.id]||[];
    data.forEach((ch,ci)=>{
      s.cols.forEach(col=>{
        const typeName=colKeyToType(s.id,col.key);
        (ch[col.key]||[]).forEach(p=>{
          const[num,day]=p;
          if(!dayMap[day])dayMap[day]=[];
          dayMap[day].push({ci,ch:ch.ch,subj:s.id,type:typeName,num});
          if(day!==POSTPONE_DAY && day>max)max=day;   // 미뤄둔 문제는 최대 일차에 안 셈
        });
      });
    });
    MAPS[s.id]=dayMap;
    MAXS[s.id]=max;
  });
  // 전체 맵
  const allMax=Math.max(0,...Object.values(MAXS));
  // 완료된 문제 버킷(일차 0)·미뤄둔 문제 버킷도 합쳐 전체 뷰에서 보이게 한다
  adm[0]=[];
  SUBJECTS.forEach(s=>{ if(MAPS[s.id]&&MAPS[s.id][0])adm[0].push(...MAPS[s.id][0]); });
  adm[POSTPONE_DAY]=[];
  SUBJECTS.forEach(s=>{ if(MAPS[s.id]&&MAPS[s.id][POSTPONE_DAY])adm[POSTPONE_DAY].push(...MAPS[s.id][POSTPONE_DAY]); });
  for(let d=1;d<=allMax;d++){
    adm[d]=[];
    SUBJECTS.forEach(s=>{
      if(MAPS[s.id]&&MAPS[s.id][d])adm[d].push(...MAPS[s.id][d]);
    });
  }
  // Legacy alias 갱신
  fdm=MAPS.fin||{};cdm=MAPS.cost||{};taxdm=MAPS.tax||{};
  gibdm=MAPS.gib||{};jingdm=MAPS.jing||{};beoldm=MAPS.beol||{};
  fmax=MAXS.fin||0;cmax=MAXS.cost||0;taxmax=MAXS.tax||0;
  gibmax=MAXS.gib||0;jingmax=MAXS.jing||0;beolmax=MAXS.beol||0;
}

// ══════════════════════════════════════════
// 상태
// ══════════════════════════════════════════
let S={};
// 과목은 사용자가 등록하므로 초기값이 없다. ensureCurSubjects()가 첫 과목으로 채운다.
let curDay=null,curView='day',curSubj=null,curNav='study';
let curEdSubj=null,curEdMode='grid',edRows=[];

function gk(s,ci,t,n){return s+'|'+ci+'|'+t+'|'+n;}
function dn(s,ci,t,n){return!!S[gk(s,ci,t,n)];}

