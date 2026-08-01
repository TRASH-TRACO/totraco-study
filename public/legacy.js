
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
const COLOR_PALETTE = [
  {id:'fin',label:'빨강',c:'#d44c47',bg:'#fdf3f2',bd:'#f5c8c6'},
  {id:'cost',label:'초록',c:'#448361',bg:'#f1f8f4',bd:'#b8d9c4'},
  {id:'tax',label:'보라',c:'#9065b0',bg:'#f6f3fb',bd:'#d9c8eb'},
  {id:'gib',label:'갈색',c:'#d08c3a',bg:'#fdf6ee',bd:'#e8cfa0'},
  {id:'jing',label:'청록',c:'#3a8da0',bg:'#eef7f9',bd:'#a0d4e0'},
  {id:'beol',label:'자주',c:'#8a6b8a',bg:'#f5f0f5',bd:'#d0b8d0'},
  {id:'navy',label:'남색',c:'#3d5a80',bg:'#eef1f6',bd:'#a0b4cc'},
  {id:'coral',label:'코랄',c:'#cf6953',bg:'#fdf0ed',bd:'#e8b4a8'},
  {id:'olive',label:'올리브',c:'#7a8450',bg:'#f4f5ee',bd:'#c4ca9e'},
  {id:'slate',label:'슬레이트',c:'#5e6b7a',bg:'#eff1f3',bd:'#b0b8c4'},
];

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
        return od!==undefined ? [pair[0], od] : pair;
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
      +'<div class="prog-card-pct" id="lbl-'+s.id+'" style="color:var(--'+s.id+')">0%</div>'
      +'<div class="prog-track"><div class="prog-fill" id="bar-'+s.id+'" style="width:0%;background:var(--'+s.id+')"></div></div>';
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
          if(day>max)max=day;
        });
      });
    });
    MAPS[s.id]=dayMap;
    MAXS[s.id]=max;
  });
  // 전체 맵
  const allMax=Math.max(0,...Object.values(MAXS));
  // 완료된 문제 버킷(일차 0)도 합쳐 전체 뷰에서 보이게 한다
  adm[0]=[];
  SUBJECTS.forEach(s=>{ if(MAPS[s.id]&&MAPS[s.id][0])adm[0].push(...MAPS[s.id][0]); });
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

// XSS 방지 헬퍼
function escapeHtml(str){
  const d=document.createElement('div');d.textContent=str;return d.innerHTML;
}

const CC={theory:'th',basic:'ba',adv:'av',single:'si',calc:'ca'};
const TL={theory:'이론',basic:'기본',adv:'심화',calc:'계산'};
const SUBJ_NAME={fin:'재무회계',cost:'원가회계',tax:'세법',gib:'국기법',jing:'국징법',beol:'조처법',all:'전체'};
const SUBJ_COLOR={fin:'var(--fin)',cost:'var(--cost)',tax:'var(--tax)',gib:'var(--gib)',jing:'var(--jing)',beol:'var(--beol)'};

// ══════════════════════════════════════════
// 칩
// ══════════════════════════════════════════
function makeChip(subj,ci,type,num,day,cls){
  const el=document.createElement('div');
  el.className='chip '+(cls||CC[type]||'si');
  if(dn(subj,ci,type,num))el.classList.add('done');
  el.dataset.subj=subj;el.dataset.ci=ci;el.dataset.type=type;el.dataset.num=num;
  el.innerHTML=num+'번'+(day?'<sup class="chip-day">'+day+'일</sup>':'');
  const cst=document.createElement('div');cst.className='cst';
  cst.textContent='✓';
  el.appendChild(cst);

  el.addEventListener('click',()=>{S[gk(subj,ci,type,num)]=!S[gk(subj,ci,type,num)];saveState();refreshChip(el,subj,ci,type,num);refreshDPMeta(curDay);updateProgress();updateDBtns();});
  return el;
}
function refreshChip(el,subj,ci,type,num){
  el.classList.toggle('done',dn(subj,ci,type,num));
  const cst=el.querySelector('.cst');
  if(cst){cst.style.display=dn(subj,ci,type,num)?'flex':'none';}
}

// ══════════════════════════════════════════
// 네비
// ══════════════════════════════════════════
function goNav(n){
  curNav=n;
  ['study','setup'].forEach(id=>{
    document.getElementById('nt-'+id).classList.toggle('on',id===n);
    document.getElementById('nav-'+id).style.display=id===n?'block':'none';
  });
  if(n==='setup'){
    ensureCurSubjects();
    renderSubjGrid(true);   // 과목 목록
    renderEd();             // 선택 과목의 문제 등록
    renderAssignInfo();  // 회독 배정
    applyEdSection();
    refreshOnboarding();
  }
  updateEmptyStates();
}
function goSubj(s){
  curSubj=s;
  // 모든 탭 초기화
  [...SUBJECTS.map(sub=>sub.id),'all'].forEach(id=>{
    const el=document.getElementById('st-'+id);
    if(!el)return;
    el.className='st';
    el.style.color='';el.style.background='';el.style.borderColor='';
    if(id===s){
      if(id==='all'){el.classList.add('aa');}
      else{
        // 동적 색상 적용
        el.style.color='var(--'+id+')';
        el.style.background='var(--'+id+'-bg)';
        el.style.borderColor='var(--'+id+'-border)';
      }
    }
  });
  curDay=null;const dp=document.getElementById('dpanel');dp.classList.remove('on');dp.innerHTML='';
  renderProgressCards();updateProgress();
  buildDG();if(curView==='chap')renderChaps();
}
function goView(v){
  curView=v;
  document.getElementById('view-day').style.display=v==='day'?'block':'none';
  document.getElementById('view-chap').style.display=v==='chap'?'block':'none';
  document.getElementById('btn-day').classList.toggle('on',v==='day');
  document.getElementById('btn-chap').classList.toggle('on',v==='chap');
  if(v==='chap')renderChaps();
}

// ══════════════════════════════════════════
// 일차 그리드
// ══════════════════════════════════════════
function getDM(){return curSubj==='all'?adm:(MAPS[curSubj]||{});}
function getMax(){return curSubj==='all'?Math.max(0,...Object.values(MAXS)):(MAXS[curSubj]||0);}

function buildDG(){
  const g=document.getElementById('dg');g.innerHTML='';
  const max=getMax(),isTax=curSubj==='tax',dm=getDM();
  // 완료된 문제 버킷(일차 0) — 남은 문제 조정으로 완료 문제를 몰아둔 경우 맨 앞에 표시
  const bucket=dm[0]||[];
  if(bucket.length){
    const b=document.createElement('button');b.className='db done-bucket';b.id='db0';
    b.innerHTML=`<span>✓ 완료된 문제</span><span class="dbadge">✓</span>`;
    b.onclick=()=>selDay(0);g.appendChild(b);
  }
  for(let d=1;d<=max;d++){
    const b=document.createElement('button');b.className='db';b.id='db'+d;
    if(isTax){
      b.classList.add('tax-mode');
      const ps=dm[d]||[];
      b.innerHTML=`<span class="db-day">${d}일</span><span class="db-th">이론 ${ps.filter(p=>p.type==='theory').length}</span><span class="db-ca">계산 ${ps.filter(p=>p.type==='calc').length}</span><span class="dbadge">✓</span>`;
    } else {
      b.innerHTML=`<span>${d}일</span><span class="dbadge">✓</span>`;
    }
    b.onclick=()=>selDay(d);g.appendChild(b);
  }
  updateDBtns();
}
function updateDBtns(){
  const dm=getDM(),max=getMax();
  // 완료된 문제 버킷 타일
  const b0=document.getElementById('db0');
  if(b0){
    const ps=dm[0]||[];const dk=ps.filter(p=>dn(p.subj,p.ci,p.type,p.num)).length;
    b0.className='db done-bucket';
    if(curDay===0)b0.classList.add('sel');
    if(ps.length>0&&dk===ps.length)b0.classList.add('full');
    else if(dk>0)b0.classList.add('part');
  }
  for(let d=1;d<=max;d++){
    const b=document.getElementById('db'+d);if(!b)continue;
    const ps=dm[d]||[];const dk=ps.filter(p=>dn(p.subj,p.ci,p.type,p.num)).length;
    b.className='db'+(curSubj==='tax'?' tax-mode':'');
    if(d===curDay)b.classList.add('sel');
    if(ps.length>0&&dk===ps.length)b.classList.add('full');
    else if(dk>0)b.classList.add('part');
  }
}
function selDay(day){curDay=day;updateDBtns();const dp=document.getElementById('dpanel');dp.classList.add('on');renderDP(day);}

function renderDP(day){
  const dp=document.getElementById('dpanel');dp.innerHTML='';
  const dm=getDM();const ps=dm[day]||[];
  if(!ps.length){dp.innerHTML='<div class="noprob">이 일차에 배정된 문제가 없어요</div>';return;}
  const dk=ps.filter(p=>dn(p.subj,p.ci,p.type,p.num)).length;
  const allD=ps.length>0&&dk===ps.length;
  // 헤더
  const hdr=document.createElement('div');hdr.className='dpanel-hdr';
  const titleEl=document.createElement('div');titleEl.className='dpanel-title';titleEl.textContent=day===0?'완료된 문제':day+'일차';
  const metaEl=document.createElement('div');metaEl.style.display='flex';metaEl.style.alignItems='center';metaEl.style.gap='10px';
  const subEl=document.createElement('div');subEl.className='dpanel-meta';subEl.id='dp-sub';subEl.textContent=ps.length+'문제 · '+dk+'개 완료';
  const abtn=document.createElement('button');abtn.className='toggle-all-btn '+(allD?'ad':'nd');abtn.textContent=allD?'전체 해제':'전체 완료';abtn.id='all-btn';abtn.onclick=()=>toggleAll(day);
  metaEl.appendChild(subEl);metaEl.appendChild(abtn);hdr.appendChild(titleEl);hdr.appendChild(metaEl);dp.appendChild(hdr);
  const tip=document.createElement('div');tip.className='dpanel-tip';tip.textContent='클릭: 완료 토글';dp.appendChild(tip);
  // 내용
  const body=document.createElement('div');body.style.padding='12px 16px';
  const subjs=curSubj==='all'?SUBJECTS.map(s=>s.id):[curSubj];
  subjs.forEach(subj=>{
    const sp=ps.filter(p=>p.subj===subj);if(!sp.length)return;
    if(curSubj==='all'){
      const sd=document.createElement('div');sd.className='subj-divider';
      const dot=document.createElement('div');dot.className='subj-dot';dot.style.background=SUBJ_COLOR[subj]||'var(--text3)';
      const nm=document.createElement('span');nm.style.cssText='font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--text3)';nm.textContent=SUBJ_NAME[subj];
      sd.appendChild(dot);sd.appendChild(nm);body.appendChild(sd);
    }
    // 세법: 부가가치세·법인세·소득세 섹션 구분
    if(subj==='tax'){
      const taxGroupDefs=[{prefix:'부-',label:'부가가치세'},{prefix:'법-',label:'법인세'},{prefix:'소-',label:'소득세'}];
      taxGroupDefs.forEach(({prefix,label})=>{
        const gsp=sp.filter(p=>{const ch=TAXD[p.ci]?.ch||'';return ch.startsWith(prefix);});
        if(!gsp.length)return;
        const gh=document.createElement('div');
        gh.style.cssText='display:flex;align-items:center;gap:6px;padding:10px 0 6px;font-size:11px;font-weight:600;letter-spacing:.05em;color:var(--tax);';
        const dot=document.createElement('div');dot.style.cssText='width:5px;height:5px;border-radius:50%;background:var(--tax);opacity:.6;';
        const nm2=document.createElement('span');nm2.textContent=label;
        const line=document.createElement('div');line.style.cssText='flex:1;height:1px;background:var(--tax-border);';
        gh.appendChild(dot);gh.appendChild(nm2);gh.appendChild(line);body.appendChild(gh);
        renderDPChunks(body,gsp,subj);
      });
      return;
    }
    renderDPChunks(body,sp,subj);
  });
  dp.appendChild(body);
}
function renderDPChunks(body,sp,subj){
    const byCI={},order=[];
    sp.forEach(p=>{if(!byCI[p.ci]){byCI[p.ci]={ch:p.ch,ci:p.ci,g:{}};order.push(p.ci);}if(!byCI[p.ci].g[p.type])byCI[p.ci].g[p.type]=[];byCI[p.ci].g[p.type].push(p.num);});
    [...new Set(order)].sort((a,b)=>a-b).forEach(ci=>{
      const info=byCI[ci];
      const dispCh=subj==='tax'?taxDisplayName(info.ch):info.ch;
      const block=document.createElement('div');block.className='ch-block';
      const inner=document.createElement('div');inner.className='ch-block-inner';
      const nm=document.createElement('div');nm.className='ch-name';
      const nmT=document.createElement('span');nmT.className='ch-name-text';nmT.textContent=dispCh;nm.appendChild(nmT);inner.appendChild(nm);
      const groups=document.createElement('div');groups.className='ch-groups';
      // 동적: 해당 과목의 col 정의에서 type+label 페어 추출
      const subjDef=SUBJECTS.find(x=>x.id===subj);
      const typeDefs=subjDef?subjDef.cols.map(c=>({type:colKeyToType(subj,c.key),label:c.label||c.key,cls:c.cls})):[{type:'theory',label:'이론',cls:'th'}];
      typeDefs.forEach(({type:tp,label:lblText,cls})=>{
        const nums=info.g[tp];if(!nums||!nums.length)return;
        const grp=document.createElement('div');grp.className='ch-group';
        if(tp!=='single'){const lbl=document.createElement('div');lbl.className='type-label '+(cls||CC[tp]||'');lbl.textContent=lblText;grp.appendChild(lbl);}
        const row=document.createElement('div');row.className='chip-row';
        nums.forEach(num=>row.appendChild(makeChip(subj,ci,tp,num,null,cls)));
        grp.appendChild(row);groups.appendChild(grp);
      });
      inner.appendChild(groups);block.appendChild(inner);body.appendChild(block);
    });
}

function refreshDPMeta(day){
  if(!day)return;
  const ps=(getDM()[day])||[];const dk=ps.filter(p=>dn(p.subj,p.ci,p.type,p.num)).length;
  const allD=ps.length>0&&dk===ps.length;
  const sub=document.getElementById('dp-sub');if(sub)sub.textContent=ps.length+'문제 · '+dk+'개 완료';
  const btn=document.getElementById('all-btn');if(btn){btn.className='toggle-all-btn '+(allD?'ad':'nd');btn.textContent=allD?'전체 해제':'전체 완료';}
}
function toggleAll(day){
  const ps=(getDM()[day])||[];const allD=ps.length>0&&ps.every(p=>dn(p.subj,p.ci,p.type,p.num));
  ps.forEach(p=>{S[gk(p.subj,p.ci,p.type,p.num)]=!allD;const chip=document.querySelector(`#dpanel .chip[data-subj="${p.subj}"][data-ci="${p.ci}"][data-type="${p.type}"][data-num="${p.num}"]`);if(chip)refreshChip(chip,p.subj,p.ci,p.type,p.num);});
  saveState();refreshDPMeta(day);updateProgress();updateDBtns();
}

// ══════════════════════════════════════════
// 장별 뷰
// ══════════════════════════════════════════
function renderChaps(){
  const con=document.getElementById('chap-con');con.innerHTML='';
  const targetSubjs=curSubj==='all'?SUBJECTS:SUBJECTS.filter(s=>s.id===curSubj);
  targetSubjs.forEach(s=>{
    const data=DATA[s.id]||[];
    if(curSubj==='all'){
      const h=document.createElement('div');h.className='subj-hdr';
      const dot=document.createElement('div');dot.className='subj-dot';dot.style.background='var(--'+s.id+')';
      const nm=document.createElement('span');nm.textContent=s.name;
      h.appendChild(dot);h.appendChild(nm);con.appendChild(h);
    }
    // 세법 특화: 부-/법-/소- 그룹 렌더링
    if(s.id==='tax'){
      const taxGroups=[{prefix:'부-',label:'부가가치세'},{prefix:'법-',label:'법인세'},{prefix:'소-',label:'소득세'}];
      let hasGroup=false;
      taxGroups.forEach(({prefix,label})=>{
        const indices=[];
        data.forEach((ch,ci)=>{if((ch.ch||'').startsWith(prefix))indices.push(ci);});
        if(!indices.length)return;
        hasGroup=true;
        const gh=document.createElement('div');
        gh.style.cssText='display:flex;align-items:center;gap:6px;padding:10px 0 6px;font-size:11px;font-weight:600;letter-spacing:.05em;color:var(--tax);';
        const dot=document.createElement('div');dot.style.cssText='width:5px;height:5px;border-radius:50%;background:var(--tax);opacity:.6;';
        const nm=document.createElement('span');nm.textContent=label;
        const line=document.createElement('div');line.style.cssText='flex:1;height:1px;background:var(--tax-border);';
        gh.appendChild(dot);gh.appendChild(nm);gh.appendChild(line);con.appendChild(gh);
        indices.forEach(ci=>addChapRow(con,data[ci],ci,s.id));
      });
      if(!hasGroup)data.forEach((ch,ci)=>addChapRow(con,ch,ci,s.id));
    }else{
      data.forEach((ch,ci)=>addChapRow(con,ch,ci,s.id));
    }
  });
}
function taxDisplayName(ch){return ch.replace(/^(부|법|소)-/,'');}
function addChapRow(con,ch,ci,subj){
  const subjDef=SUBJECTS.find(x=>x.id===subj);
  if(!subjDef)return;
  const isTax=subj==='tax';
  // 동적: 모든 col을 순회하며 dk/tot 계산
  let dk=0,tot=0;
  subjDef.cols.forEach(col=>{
    const tp=colKeyToType(subj,col.key);
    (ch[col.key]||[]).forEach(p=>{
      tot++;
      if(dn(subj,ci,tp,p[0]))dk++;
    });
  });
  const pct=tot>0?Math.round(dk/tot*100):0;
  const barColor=subj==='fin'?'linear-gradient(90deg,var(--theory),var(--basic))':(SUBJ_COLOR[subj]||'var(--'+subj+')');
  const row=document.createElement('div');row.className='cr exp';
  const dispName=isTax?taxDisplayName(ch.ch):ch.ch;
  row.innerHTML=`<div class="ch-hdr"><div class="ch-nm">${escapeHtml(dispName)}</div><div class="ch-bw"><div class="ch-bl"><span>${dk}/${tot}</span><span>${pct}%</span></div><div class="ch-bt"><div class="ch-bf" id="fcb${subj}${ci}" style="width:${pct}%;background:${barColor}"></div></div></div><div class="ch-tog">▾</div></div>`;
  row.addEventListener('click',()=>row.classList.toggle('exp'));
  const pp=document.createElement('div');pp.className='pp';
  // 동적 typeDefs
  subjDef.cols.forEach(col=>{
    const probs=ch[col.key]||[];
    if(!probs.length)return;
    const tp=colKeyToType(subj,col.key);
    const tl=document.createElement('div');tl.className='ps-t';tl.textContent=col.label||col.key;pp.appendChild(tl);
    const pc=document.createElement('div');pc.className='pchips';
    probs.forEach(p=>{const c=makeChip(subj,ci,tp,p[0],p[1],col.cls);c.addEventListener('click',()=>setTimeout(()=>updateProgress(),0));pc.appendChild(c);});
    pp.appendChild(pc);
  });
  con.appendChild(row);con.appendChild(pp);
}

// ══════════════════════════════════════════
// 진도
// ══════════════════════════════════════════
function cntSubj(data,subj,keyMap){
  let d=0,t=0;
  if(subj==='tax'){data.forEach((ch,ci)=>{[['th','theory'],['ca','calc']].forEach(([k,tp])=>{(ch[k]||[]).forEach(p=>{t++;if(dn(subj,ci,tp,p[0]))d++;});});});}
  else if(keyMap){data.forEach((ch,ci)=>{keyMap.forEach(([k,tp])=>{ch[k].forEach(p=>{t++;if(dn(subj,ci,tp,p[0]))d++;});});});}
  else{data.forEach((ch,ci)=>{ch.p.forEach(p=>{t++;if(dn(subj,ci,'single',p[0]))d++;});});}
  return[d,t];
}
function updateProgress(){
  // 동적 과목별 진도 계산
  let totalD=0, totalT=0;
  const results={};
  SUBJECTS.forEach(s=>{
    const data=DATA[s.id]||[];
    let d=0, t=0;
    data.forEach((ch,ci)=>{
      s.cols.forEach(col=>{
        (ch[col.key]||[]).forEach(p=>{
          t++;
          // type 매핑: 첫번째 col이 'theory'/'single'/'basic'/'adv'/'calc' 중 어느 것에 해당하는지는 cls로 추정
          // 단순화: 진도 키는 cls 기반
          const typeName = colKeyToType(s.id, col.key);
          if(dn(s.id,ci,typeName,p[0]))d++;
        });
      });
    });
    results[s.id]={d,t};
    totalD+=d;totalT+=t;
  });

  const pct=(a,b)=>b>0?Math.round(a/b*100):0;
  SUBJECTS.forEach(s=>{
    const r=results[s.id];
    const b=document.getElementById('bar-'+s.id);
    const l=document.getElementById('lbl-'+s.id);
    const bb=document.getElementById('b-'+s.id);
    if(b)b.style.width=pct(r.d,r.t)+'%';
    if(l)l.textContent=pct(r.d,r.t)+'%';
    if(bb)bb.textContent=pct(r.d,r.t)+'%';
  });
  const barTotal=document.getElementById('bar-total');
  if(barTotal)barTotal.style.width=pct(totalD,totalT)+'%';
  const pctTotal=document.getElementById('pct-total');
  if(pctTotal)pctTotal.textContent=pct(totalD,totalT)+'%';
  const footCount=document.getElementById('foot-count');
  if(footCount)footCount.textContent=`${totalD} / ${totalT} 문제`;
  const bAll=document.getElementById('b-all');
  if(bAll)bAll.textContent=pct(totalD,totalT)+'%';
}

// 컬럼 key → 진도 type 매핑 (기존 진도 데이터와 호환)
function colKeyToType(subjId, colKey){
  // 기본 매핑 (재무회계: t→theory, b→basic, a→adv 등)
  const map={t:'theory',b:'basic',a:'adv',th:'theory',ca:'calc',p:'single'};
  return map[colKey]||colKey;
}

// ══════════════════════════════════════════
// 에디터
// ══════════════════════════════════════════
function getEdCols(subjId){
  const s=SUBJECTS.find(x=>x.id===subjId);
  if(!s)return[{key:'ch',label:'장',type:'ch'}];
  const cols=[{key:'ch',label:'장',type:'ch'}];
  s.cols.forEach(c=>{cols.push({key:c.key,label:c.label+'\n문제번호',type:'prob',color:'tb-'+c.cls});});
  return cols;
}
function getRandCols(subjId){
  const s=SUBJECTS.find(x=>x.id===subjId);
  if(!s)return[{key:'ch',label:'장 이름',type:'ch'}];
  const cols=[{key:'ch',label:'장 이름',type:'ch'}];
  s.cols.forEach(c=>{cols.push({key:c.key,label:c.label,type:'prob',color:'tb-'+c.cls});});
  return cols;
}
function getCurData(){return DATA[curEdSubj]||[];}
function getDefData(){return DEFAULTS[curEdSubj]||[];}
/**
 * 문제 등록은 번호만 다룬다. 일차는 아래 "회독 배정"이 정하므로 화면에 드러내지 않는다.
 * 저장 시 기존 일차를 잃지 않도록 edRowsToData()가 번호를 기준으로 되살린다.
 */
function probsToText(arr){return(arr||[]).map(p=>Array.isArray(p)?p[0]:p).join(', ');}
function textToProbs(str){
  if(!str||!str.trim())return[];
  return str.split(/[,，\s]+/).map(s=>s.trim()).filter(Boolean).map(s=>{
    const m=s.match(/^(\d+)(?:\s*[\(（](\d+)[\)）])?$/);  // 예전 "번호(일차)" 형식도 받아준다
    if(!m)throw new Error('"'+s+'" — 숫자만 입력하세요');
    return[parseInt(m[1]), m[2]?parseInt(m[2]):0];
  });
}
function buildEdRows(){
  const data=getCurData(),cols=getEdCols(curEdSubj);
  edRows=data.map(row=>{const r={};cols.forEach(c=>{r[c.key]=c.type==='ch'?row[c.key]||'':probsToText(row[c.key]||[]);});return r;});
}
function edRowsToData(){
  const cols=getEdCols(curEdSubj);
  const old=getCurData();
  return edRows.map((r,ri)=>{
    const obj={};
    cols.forEach(c=>{
      if(c.type==='ch'){obj[c.key]=r[c.key];return;}
      // 화면에는 번호만 있으므로, 같은 장·같은 번호의 기존 일차를 되살린다
      const prev=new Map(((old[ri]||{})[c.key]||[]).map(p=>[p[0],p[1]]));
      obj[c.key]=textToProbs(r[c.key]).map(([num,day])=>[num, day||prev.get(num)||0]);
    });
    return obj;
  });
}

// 그리드 붙여넣기
function handleGridPaste(e,startRi,startCi){
  const raw=e.clipboardData.getData('text');
  const cols=getEdCols(curEdSubj);
  const hasStructure=/[\t\r\n]/.test(raw.trim());
  if(!hasStructure)return;
  e.preventDefault();
  const rows=raw.replace(/\r\n/g,'\n').replace(/\r/g,'\n').trimEnd().split('\n').map(line=>line.split('\t').map(cell=>cell.trim()));
  const neededRows=startRi+rows.length;
  while(edRows.length<neededRows){const r={};cols.forEach(c=>r[c.key]=c.type==='ch'?'새 장':'');edRows.push(r);}
  let changed=false;
  rows.forEach((cells,dr)=>{cells.forEach((val,dc)=>{const ri=startRi+dr,ci=startCi+dc;if(ci>=cols.length)return;const col=cols[ci];if(!col)return;edRows[ri][col.key]=val;changed=true;});});
  if(changed){renderEdGrid();setTimeout(()=>{const el=document.querySelector(`[data-ri="${startRi}"][data-ci="${startCi}"]`);if(el)el.focus();showToast(`✅ ${rows.length}행 × ${rows[0].length}열 붙여넣기 완료`);},50);}
}

function renderEdGrid(){
  const wrap=document.getElementById('ss-wrap');wrap.innerHTML='';
  const cols=getEdCols(curEdSubj);
  const tbl=document.createElement('table');tbl.className='ss-table';
  const thead=document.createElement('thead');const htr=document.createElement('tr');
  const thN=document.createElement('th');thN.style.minWidth='36px';thN.textContent='#';htr.appendChild(thN);
  cols.forEach((c,ci)=>{
    const th=document.createElement('th');th.className=c.type==='ch'?'ch-col':'prob-col';
    if(c.color){const sp=document.createElement('span');sp.className='type-badge '+c.color;sp.textContent=c.label.split('\n')[0];th.innerHTML='';th.appendChild(sp);const sub=c.label.split('\n')[1];if(sub){th.appendChild(document.createElement('br'));th.appendChild(document.createTextNode(sub));}}
    else th.innerHTML=c.label.replace('\n','<br>');
    htr.appendChild(th);
  });
  const thD=document.createElement('th');thD.textContent='삭제';thD.style.minWidth='44px';htr.appendChild(thD);
  thead.appendChild(htr);tbl.appendChild(thead);
  const tbody=document.createElement('tbody');
  edRows.forEach((row,ri)=>{
    const tr=document.createElement('tr');tr.id='edr'+ri;
    const tdN=document.createElement('td');tdN.className='row-num';tdN.textContent=ri+1;tdN.onclick=()=>tr.classList.toggle('sel-row');
    const insB=document.createElement('button');insB.className='ins-btn';insB.textContent='+행';insB.title='아래에 행 삽입';insB.onclick=e=>{e.stopPropagation();insEdRow(ri);};
    tdN.appendChild(insB);tr.appendChild(tdN);
    cols.forEach((c,ci)=>{
      const td=document.createElement('td');
      if(c.type==='ch'){
        td.className='cell-ch';
        const inp=document.createElement('input');inp.value=row[c.key];inp.dataset.ri=ri;inp.dataset.ci=ci;
        inp.addEventListener('input',()=>edRows[ri][c.key]=inp.value);
        inp.addEventListener('paste',e=>{const raw=e.clipboardData.getData('text');if(/[\t\n]/.test(raw))handleGridPaste(e,ri,ci);});
        td.appendChild(inp);
      } else {
        td.className='cell-prob';
        const ta=document.createElement('textarea');ta.value=row[c.key];
        ta.rows=Math.max(2,Math.ceil(((row[c.key]||'').split(',').length||1)/3));
        ta.placeholder='예) 1(3), 5(1), 9(8)';ta.dataset.ri=ri;ta.dataset.ci=ci;
        ta.addEventListener('input',()=>{edRows[ri][c.key]=ta.value;ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';});
        ta.addEventListener('paste',e=>{
          const raw=e.clipboardData.getData('text');
          if(/[\t\n]/.test(raw)){
            if(!/\t/.test(raw)){
              e.preventDefault();
              const cleaned=raw.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').map(s=>s.trim()).filter(Boolean).join(', ');
              const s=ta.selectionStart,en=ta.selectionEnd,cur=ta.value;
              ta.value=cur.slice(0,s)+cleaned+cur.slice(en);ta.selectionStart=ta.selectionEnd=s+cleaned.length;
              edRows[ri][c.key]=ta.value;ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';
            } else handleGridPaste(e,ri,ci);
          }
        });
        ta.style.height='auto';td.appendChild(ta);
      }
      tr.appendChild(td);
    });
    const tdD=document.createElement('td');const delB=document.createElement('button');delB.className='row-del';delB.title='행 삭제';delB.textContent='✕';
    delB.onclick=()=>{if(confirm((row.ch||ri+1+'행')+' 삭제?')){edRows.splice(ri,1);renderEdGrid();}};
    tdD.appendChild(delB);tr.appendChild(tdD);tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);wrap.appendChild(tbl);
  setTimeout(()=>{wrap.querySelectorAll('textarea').forEach(ta=>{ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';});},0);
}

function addEdRow(){
  const cols=getEdCols(curEdSubj);const r={};cols.forEach(c=>r[c.key]=c.type==='ch'?'새 장':'');
  edRows.push(r);renderEdGrid();
  setTimeout(()=>{const rows=document.querySelectorAll('#ss-wrap tbody tr');if(rows.length)rows[rows.length-1].scrollIntoView({behavior:'smooth'});},50);
}
function insEdRow(afterIdx){
  const cols=getEdCols(curEdSubj);const r={};cols.forEach(c=>r[c.key]=c.type==='ch'?'새 장':'');
  edRows.splice(afterIdx+1,0,r);renderEdGrid();
  setTimeout(()=>{const row=document.querySelector('#edr'+(afterIdx+1));if(row)row.scrollIntoView({behavior:'smooth',block:'nearest'});},50);
}

// 붙여넣기 모드
function renderPastePanel(){
  const allCols=[{key:'ch',label:'장',type:'ch',color:''},...getEdCols(curEdSubj).filter(c=>c.type==='prob')];
  const probCols=getEdCols(curEdSubj).filter(c=>c.type==='prob');
  document.getElementById('paste-hint').innerHTML=
    '엑셀에서 <b>열(세로) 하나씩</b> 복사(Ctrl+C) → 해당 칸에 붙여넣기(Ctrl+V)<br>'+
    '줄바꿈 = 행(장) 구분 · 탭 구분자는 쉼표로 자동 변환';
  const colsDiv=document.getElementById('paste-cols');colsDiv.innerHTML='';
  colsDiv.style.cssText='display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));';
  allCols.forEach(c=>{
    const wrap=document.createElement('div');
    const lbl=document.createElement('div');lbl.className='paste-lbl '+(c.color||'');
    lbl.style.cssText=c.type==='ch'?'background:var(--bg3);color:var(--text2)':'';
    lbl.textContent=c.label.split('\n')[0];
    const ta=document.createElement('textarea');ta.className='paste-ta';ta.id='paste-col-'+c.key;ta.rows=10;
    ta.placeholder=c.type==='ch'?'장 이름 열 복사 후 붙여넣기\n예:\n4장\n6장\n...':'문제번호 열 복사 후 붙여넣기\n예:\n1, 2, 3\n4, 5\n...';
    ta.value=edRows.map(r=>r[c.key]||'').join('\n');
    ta.addEventListener('paste',e=>{
      e.preventDefault();
      const raw=e.clipboardData.getData('text');
      const cleaned=raw.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').map(line=>line.replace(/\t+/g,', ').replace(/,\s*,/g,',').trim()).join('\n').replace(/^[\n]+|[\n]+$/g,'');
      const s=ta.selectionStart,en=ta.selectionEnd,cur=ta.value;
      ta.value=cur.slice(0,s)+cleaned+cur.slice(en);ta.selectionStart=ta.selectionEnd=s+cleaned.length;
      ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';
    });
    ta.addEventListener('input',()=>{ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';});
    wrap.appendChild(lbl);wrap.appendChild(ta);colsDiv.appendChild(wrap);
  });
}

function previewPaste(){
  const probCols=getEdCols(curEdSubj).filter(c=>c.type==='prob');
  const chLines=(document.getElementById('paste-col-ch')?.value||'').split('\n').map(l=>l.trim()).filter(Boolean);
  if(!chLines.length){showToast('먼저 데이터를 붙여넣어 주세요');return;}
  const newRows=[];let err=null;
  for(let i=0;i<chLines.length;i++){
    const r={ch:chLines[i]};
    probCols.forEach(c=>{const lines=(document.getElementById('paste-col-'+c.key)?.value||'').split('\n');r[c.key]=(lines[i]||'').trim();});
    try{probCols.forEach(c=>textToProbs(r[c.key]));newRows.push(r);}
    catch(e){err='행 '+(i+1)+': '+e.message;break;}
  }
  const pv=document.getElementById('paste-preview');
  if(err){pv.innerHTML=`<div style="background:var(--fin-bg);border:1px solid var(--fin-border);border-radius:var(--r);padding:10px 14px;font-size:12px;color:var(--fin);margin-bottom:10px;">❌ ${err}</div>`;return;}
  const cols=getEdCols(curEdSubj);
  let html='<div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--r);margin-bottom:10px;"><table class="ss-table"><thead><tr>';
  html+='<th>#</th>'+cols.map(c=>'<th>'+c.label.replace('\n','<br>')+'</th>').join('')+'</tr></thead><tbody>';
  newRows.forEach((r,i)=>{
    html+=`<tr><td class="row-num">${i+1}</td>`;
    cols.forEach(c=>{
      if(c.type==='ch')html+=`<td style="padding:7px 10px;font-size:12px">${escapeHtml(r[c.key])}</td>`;
      else{const arr=textToProbs(r[c.key]||'');html+=`<td style="padding:7px 10px">${arr.map(p=>`<span class="prob-chip-inline">${p[0]}번<sup style="opacity:.5;font-size:9px">${p[1]}일</sup></span>`).join('')}</td>`;}
    });
    html+='</tr>';
  });
  html+=`</tbody></table></div><button class="rbtn pri" onclick="applyPaste()">✅ 적용하기</button>`;
  pv.innerHTML=html;
}
function applyPaste(){
  const probCols=getEdCols(curEdSubj).filter(c=>c.type==='prob');
  const chLines=(document.getElementById('paste-col-ch')?.value||'').split('\n').map(l=>l.trim()).filter(Boolean);
  const newRows=[];
  chLines.forEach((ch,i)=>{if(!ch)return;const r={ch};probCols.forEach(c=>{const lines=(document.getElementById('paste-col-'+c.key)?.value||'').split('\n');r[c.key]=(lines[i]||'').trim();});newRows.push(r);});
  edRows=newRows;goEdMode('grid');showToast(`✅ ${newRows.length}개 장이 그리드에 반영됐어요`);
}

function goEdSubj(s){
  curEdSubj=s;
  // 과목 설정 화면에서는 문제 등록과 회독 시작이 같은 과목을 가리켜야 한다
  curRandSubj=s;
  document.querySelectorAll('.ed-subj-tabs .ed-stab').forEach(el=>{
    el.classList.toggle('on',el.dataset.subj===s);
  });
  buildEdRows();if(curEdMode==='grid')renderEdGrid();else renderPastePanel();
  document.getElementById('paste-preview').innerHTML='';document.getElementById('ed-st').textContent='';
  renderAssignInfo();
  applyEdSection();
}
function goEdMode(m){
  curEdMode=m;
  document.getElementById('emt-grid').classList.toggle('on',m==='grid');
  document.getElementById('emt-paste').classList.toggle('on',m==='paste');
  document.getElementById('ed-grid-area').style.display=m==='grid'?'block':'none';
  document.getElementById('ed-paste-area').style.display=m==='paste'?'block':'none';
  document.getElementById('ed-hint').textContent=m==='grid'?'셀 클릭해서 수정 · 행번호 hover → 행 삽입':'열 단위로 복사해서 붙여넣기';
  document.getElementById('paste-preview').innerHTML='';
  if(m==='paste')renderPastePanel();else renderEdGrid();
}
/** 과목의 문제 수와 일차가 배정된 수 */
function subjCounts(s){
  let total=0,assigned=0;
  (DATA[s.id]||[]).forEach(ch=>s.cols.forEach(c=>(ch[c.key]||[]).forEach(p=>{
    total++; if(Array.isArray(p)&&p[1]>=1) assigned++;
  })));
  return {total,assigned};
}

/**
 * 과목 탭. 문제 등록과 회독 배정이 같은 과목을 가리키므로 두 곳에 같이 그린다.
 * 회독 배정 쪽에는 배정 현황(배정/전체)을 뱃지로 붙여 과목별로 한눈에 보이게 한다.
 */
function renderEdSubjTabs(){
  const con=document.getElementById('ed-subj-tabs-con');
  if(!con)return;
  con.innerHTML='';
  SUBJECTS.forEach(s=>{
    const btn=document.createElement('button');
    btn.className='ed-stab';btn.dataset.subj=s.id;
    // 선택 시 그 과목의 색을 그대로 쓴다 — 고정 액센트와 부딪히지 않게
    btn.style.setProperty('--stab-c','var(--'+s.id+', var(--text2))');
    const dot=document.createElement('span');
    dot.className='stab-dot';
    btn.appendChild(dot);
    btn.appendChild(document.createTextNode(s.name));
    // 배정 현황(배정/전체)을 함께 보여 과목별 진행 상태를 한눈에
    const {total,assigned}=subjCounts(s);
    const b=document.createElement('span');
    b.className='stab-count'+(total&&assigned===total?' done':'');
    b.textContent=total?`${assigned}/${total}`:'0';
    btn.appendChild(b);
    if(s.id===curEdSubj)btn.classList.add('on');
    btn.onclick=()=>goEdSubj(s.id);
    con.appendChild(btn);
  });
}
function renderEd(){renderEdSubjTabs();buildEdRows();if(curEdMode==='grid')renderEdGrid();else renderPastePanel();document.getElementById('ed-st').textContent='';}

async function saveEd(){
  const st=document.getElementById('ed-st');
  try{
    const data=edRowsToData();
    DATA[curEdSubj]=data;
    syncLegacy();
    await saveAllSubjData();
    buildMaps();buildDG();updateProgress();curDay=null;
    const dp=document.getElementById('dpanel');dp.classList.remove('on');dp.innerHTML='';
    st.className='ed-st ok';st.textContent='✓ 저장 완료 ('+data.length+'개 장)';
    refreshOnboarding();updateEmptyStates();applyEdSection();
    showToast('저장됐어요');
  }catch(e){st.className='ed-st err';st.textContent='❌ '+e.message;}
}
async function resetEdDef(){
  if(!confirm('기본 데이터로 복원할까요?'))return;
  DATA[curEdSubj]=JSON.parse(JSON.stringify(DEFAULTS[curEdSubj]||[]));
  syncLegacy();
  await saveAllSubjData();
  buildMaps();buildDG();updateProgress();buildEdRows();renderEdGrid();
  document.getElementById('ed-st').className='ed-st ok';
  document.getElementById('ed-st').textContent='✓ 복원 완료';
}

// 데이터 편집 — 전체 TSV 복사
function copyEdAll(){
  const data=getCurData();
  if(!data||!data.length){showToast('데이터가 없어요');return;}
  const subjDef=SUBJECTS.find(s=>s.id===curEdSubj);
  if(!subjDef)return;
  const lines=data.map(ch=>{
    const cells=[ch.ch||''];
    subjDef.cols.forEach(col=>{
      const probs=ch[col.key]||[];
      cells.push(probs.map(p=>p[0]+'('+p[1]+')').join(', '));
    });
    return cells.join('\t');
  });
  copyText(lines.join('\n'),'전체 TSV 복사 완료');
}

// 데이터 편집 — 미완료 문제만 TSV 복사
function copyEdUndone(){
  const data=getCurData();
  if(!data||!data.length){showToast('데이터가 없어요');return;}
  const subjDef=SUBJECTS.find(s=>s.id===curEdSubj);
  if(!subjDef)return;
  const lines=[];
  data.forEach((ch,ci)=>{
    const cells=[ch.ch||''];
    let hasUndone=false;
    subjDef.cols.forEach(col=>{
      const tp=colKeyToType(curEdSubj,col.key);
      const undone=(ch[col.key]||[]).filter(p=>!dn(curEdSubj,ci,tp,p[0]));
      if(undone.length)hasUndone=true;
      cells.push(undone.map(p=>p[0]+'('+p[1]+')').join(', '));
    });
    if(hasUndone)lines.push(cells.join('\t'));
  });
  if(!lines.length){showToast('🎉 모두 완료! 미완료 문제가 없어요');return;}
  copyText(lines.join('\n'),'미완료 TSV 복사 완료 ('+lines.length+'개 장)');
}

// 데이터 편집 — 완료 문제만 TSV 복사
function copyEdDone(){
  const data=getCurData();
  if(!data||!data.length){showToast('데이터가 없어요');return;}
  const subjDef=SUBJECTS.find(s=>s.id===curEdSubj);
  if(!subjDef)return;
  const lines=[];
  data.forEach((ch,ci)=>{
    const cells=[ch.ch||''];
    let hasDone=false;
    subjDef.cols.forEach(col=>{
      const tp=colKeyToType(curEdSubj,col.key);
      const done=(ch[col.key]||[]).filter(p=>dn(curEdSubj,ci,tp,p[0]));
      if(done.length)hasDone=true;
      cells.push(done.map(p=>p[0]+'('+p[1]+')').join(', '));
    });
    if(hasDone)lines.push(cells.join('\t'));
  });
  if(!lines.length){showToast('완료된 문제가 없어요');return;}
  copyText(lines.join('\n'),'완료 TSV 복사 완료 ('+lines.length+'개 장)');
}

// ══════════════════════════════════════════
// 스냅샷 / 버전 · 클라우드 동기화 공용
// ══════════════════════════════════════════
// 현재 상태 전체를 덩어리 하나로 (버전 스냅샷 · 클라우드 업로드 공용)
function buildBlob(){
  const data={version:4,date:new Date().toISOString(),progress:S,subjects:SUBJECTS,title:appTitle,userName,planSnapshot:PLAN_SNAPSHOT};
  SUBJECTS.forEach(s=>{data[s.dataKey]=DATA[s.id]||[];});
  return data;
}
// ── 버전 관리 (로컬 스냅샷) ──────────────────
// 버전은 이 기기(IndexedDB)에만 저장됩니다. 클라우드 동기화 payload(buildBlob)에는
// 포함하지 않아 문서 용량·변경 감지에 영향을 주지 않습니다.
const VERSION_LIMIT = 20;
const VERSIONS_KEY = 'versions';
const AUTO_LABEL = '되돌리기 전 자동 저장';

async function loadVersions(){
  try{ const v = await idbGet(VERSIONS_KEY); return Array.isArray(v) ? v : []; }
  catch(_){
    try{ const s = localStorage.getItem(VERSIONS_KEY); return s ? JSON.parse(s) : []; }
    catch(__){ return []; }
  }
}
async function saveVersions(arr){
  try{ await idbSet(VERSIONS_KEY, arr); }
  catch(_){ try{ localStorage.setItem(VERSIONS_KEY, JSON.stringify(arr)); }catch(__){} }
}

// 현재 상태를 버전으로 저장 (buildBlob은 참조를 담으므로 깊은 복사)
async function createVersion(label){
  const snapshot = JSON.parse(JSON.stringify(buildBlob()));
  const versions = await loadVersions();
  versions.unshift({
    id: Date.now() + '_' + Math.random().toString(36).slice(2,7),
    label: (label||'').trim(),
    date: new Date().toISOString(),
    progress: Object.keys(S).length,
    subjects: SUBJECTS.length,
    blob: snapshot
  });
  while(versions.length > VERSION_LIMIT) versions.pop();  // 오래된 것부터 제거
  await saveVersions(versions);
  return versions;
}

async function createVersionFromInput(){
  const input = document.getElementById('version-label');
  const label = input ? input.value : '';
  await createVersion(label);
  if(input) input.value = '';
  await renderVersionList();
  showToast('💾 현재 버전 저장 완료');
}

async function restoreVersion(id){
  const versions = await loadVersions();
  const v = versions.find(x=>x.id===id);
  if(!v){showToast('버전을 찾을 수 없어요');return;}
  if(!confirm(`이 버전으로 되돌릴까요?\n${fmtVersionDate(v.date)}${v.label?' · '+v.label:''}\n\n지금 상태는 자동으로 백업됩니다.`))return;
  try{
    await createVersion(AUTO_LABEL);  // 되돌리기 전 현재 상태 자동 저장 (실수 방지)
    const data = validateBlob(JSON.parse(JSON.stringify(v.blob)));
    await applyBlob(data);
    await renderVersionList();
    showToast('✅ 버전 복원 완료');
  }catch(err){ alert('복원 실패: '+err.message); }
}

async function deleteVersion(id){
  const versions = await loadVersions();
  const v = versions.find(x=>x.id===id);
  if(!v)return;
  if(!confirm(`이 버전을 삭제할까요?\n${fmtVersionDate(v.date)}${v.label?' · '+v.label:''}`))return;
  await saveVersions(versions.filter(x=>x.id!==id));
  await renderVersionList();
  showToast('🗑 버전 삭제됨');
}

function fmtVersionDate(iso){
  const d = new Date(iso), p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}.${p(d.getMonth()+1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function renderVersionList(){
  const con = document.getElementById('version-list');
  if(!con)return;
  const versions = await loadVersions();
  if(!versions.length){
    con.innerHTML = '<div style="text-align:center;color:var(--text3);font-size:12px;padding:24px 0;line-height:1.7;">아직 저장된 버전이 없어요.<br>위 “💾 지금 저장”으로 현재 상태를 남겨보세요.</div>';
    return;
  }
  let html = '<div style="display:flex;flex-direction:column;gap:6px;">';
  versions.forEach(v=>{
    const auto = v.label===AUTO_LABEL;
    html += `<div style="display:flex;align-items:center;gap:8px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);padding:8px 12px;">`;
    html += `<div style="flex:1;min-width:0;">`;
    html += `<div style="font-size:12px;font-weight:600;color:var(--text);">${fmtVersionDate(v.date)}${auto?' <span style="font-weight:400;color:var(--text3);">· 자동</span>':''}</div>`;
    if(v.label && !auto) html += `<div style="font-size:11px;color:var(--text2);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(v.label)}</div>`;
    html += `<div style="font-size:10px;color:var(--text3);margin-top:2px;font-family:'JetBrains Mono',monospace;">진도 ${v.progress||0} · 과목 ${v.subjects||0}</div>`;
    html += `</div>`;
    html += `<button class="rbtn sec" style="font-size:11px;padding:4px 10px;flex:none;" onclick="restoreVersion('${v.id}')">복원</button>`;
    html += `<button class="rbtn sec" style="font-size:11px;padding:4px 8px;flex:none;" onclick="deleteVersion('${v.id}')" title="삭제">🗑</button>`;
    html += `</div>`;
  });
  html += '</div>';
  con.innerHTML = html;
}

function openVersionModal(){
  document.getElementById('version-modal').style.display='flex';
  renderVersionList();
}
function closeVersionModal(){
  document.getElementById('version-modal').style.display='none';
}
// 덩어리 검증 — 문제가 있으면 throw (버전 복원 · 클라우드 다운로드 공용)
function validateBlob(data){
  if(!data.version||typeof data.version!=='number')throw new Error('올바른 백업 파일이 아니에요');
  if(data.progress&&typeof data.progress!=='object')throw new Error('진도 데이터 형식 오류');
  if(data.subjects&&!Array.isArray(data.subjects))throw new Error('과목 설정 형식 오류');
  // legacy 키 검증 (호환성)
  if(data.finData&&!Array.isArray(data.finData))throw new Error('재무회계 데이터 형식 오류');
  if(data.costData&&!Array.isArray(data.costData))throw new Error('원가회계 데이터 형식 오류');
  if(data.taxData&&!Array.isArray(data.taxData))throw new Error('세법 데이터 형식 오류');
  return data;
}

// 덩어리를 현재 상태에 적용하고 UI 전체를 재구성 (버전 복원 · 클라우드 다운로드 공용)
// 호출 전에 validateBlob()으로 검증되어 있어야 합니다.
async function applyBlob(data){
  const hasSubjects=data.subjects&&Array.isArray(data.subjects)&&data.subjects.length;

  // 0) 앱 제목 복원
  if(typeof data.title==='string'&&data.title.trim()){
    appTitle=data.title.trim();
    try{await idbSet('app_title',appTitle);}catch(_){}
    renderAppTitle();
  }

  // 0-1) 사용자 이름 복원
  if(typeof data.userName==='string'){
    userName=data.userName;
    try{await idbSet('user_name',userName);}catch(_){}
    if(typeof window.__refreshUserLabel==='function') window.__refreshUserLabel();
  }

  // 0-2) 남은 문제 조정 스냅샷 복원
  if(data.planSnapshot&&typeof data.planSnapshot==='object'){
    PLAN_SNAPSHOT=data.planSnapshot;
    try{await idbSet('plan_snapshot',PLAN_SNAPSHOT);}catch(_){}
  }

  // 1) 기존 IndexedDB 정리 — 백업에 없는 과목 데이터 삭제
  if(hasSubjects){
    const oldIds=SUBJECTS.map(s=>s.id);
    const newIds=data.subjects.map(s=>s.id);
    const removed=oldIds.filter(id=>!newIds.includes(id));
    for(const rid of removed){
      const old=SUBJECTS.find(s=>s.id===rid);
      if(old){
        try{await idbDel(old.idbKey);}catch(_){}
        try{localStorage.removeItem(old.idbKey);}catch(_){}
      }
      delete DATA[rid];delete DEFAULTS[rid];
    }
    // 새 과목 설정 적용
    SUBJECTS=JSON.parse(JSON.stringify(data.subjects));
    await idbSet('subjects_config',SUBJECTS);
    updateSubjectCSS();
  }

  // 2) 진도 복원
  S=data.progress||{};

  // 3) 데이터 복원 — SUBJECTS 기준으로 dataKey 매핑
  SUBJECTS.forEach(s=>{
    if(Array.isArray(data[s.dataKey])){
      DATA[s.id]=data[s.dataKey];
      // DEFAULTS는 유지 (data.json 기준)
    }
  });
  syncLegacy();

  // 4) 저장
  await saveState();
  await saveAllSubjData();

  // 5) UI 전체 재구성
  buildMaps();
  renderStudyTabs();renderProgressCards();renderFooterBtns();
  buildDG();updateProgress();
  curDay=null;
  const dp=document.getElementById('dpanel');dp.classList.remove('on');dp.innerHTML='';
  if(curView==='chap')renderChaps();
  if(curNav==='data')renderEd();
  if(curNav==='subj')renderSubjGrid(true);
  document.getElementById('hdr-sub-names').textContent=SUBJECTS.map(s=>s.name).join(' · ');
}

// ══════════════════════════════════════════
// 기타
// ══════════════════════════════════════════
/** 미완료로 초기화한 과목들의 원래 순서(스냅샷)를 복원하고 저장. 복원한 게 있으면 true. */
async function restoreAfterReset(subjIds){
  let restored=false;
  subjIds.forEach(id=>{ if(restorePlanOrder(id))restored=true; });
  if(restored){ syncLegacy(); await saveAllSubjData(); await savePlanSnapshot(); }
  return restored;
}
async function newRound(){
  if(!confirm('모든 문제를 미완료로 초기화할까요?'))return;
  S={};await saveState();
  // 완료 묶음(완료된 문제)을 원래 순서대로 되돌린다
  await restoreAfterReset(SUBJECTS.map(s=>s.id));
  curDay=null;
  const dp=document.getElementById('dpanel');dp.classList.remove('on');dp.innerHTML='';
  buildMaps();buildDG();if(curView==='chap')renderChaps();updateProgress();
}
async function resetAll(){
  if(!confirm('전체 진도를 초기화할까요?'))return;
  S={};await saveState();
  await restoreAfterReset(SUBJECTS.map(s=>s.id));
  curDay=null;
  const dp=document.getElementById('dpanel');dp.classList.remove('on');dp.innerHTML='';
  buildMaps();buildDG();if(curView==='chap')renderChaps();updateProgress();
}
async function resetSubj(subj){
  const names={};
  SUBJECTS.forEach(s=>{names[s.id]=s.name;});
  const name=names[subj];
  if(!confirm(name+' 진도를 초기화할까요?'))return;
  const prefix=subj+'|';
  Object.keys(S).forEach(k=>{if(k.startsWith(prefix))delete S[k];});
  await saveState();
  await restoreAfterReset([subj]);
  curDay=null;
  const dp=document.getElementById('dpanel');dp.classList.remove('on');dp.innerHTML='';
  buildMaps();buildDG();if(curView==='chap')renderChaps();updateProgress();
  showToast('✅ '+name+' 진도 초기화 완료');
}

// ══════════════════════════════════════════
// 랜덤 배정
// ══════════════════════════════════════════
let curRandSubj=null;

// RAND_COLS는 getRandCols() 동적 함수로 대체됨




// ── 알고리즘: 균등 + 같은 장 분산 (인접 일차까지 고려) ──
// 점수 기반 그리디: 각 문제를 배치할 때
//  - 같은 일차에 같은 장 있음 → 큰 페널티
//  - 인접 일차(±1)에 같은 장 있음 → 중간 페널티
//  - ±2 일차에 같은 장 → 작은 페널티
//  - 일차 채워진 정도 → 선호도(덜 찬 곳 우선)
function parseNums(str){
  if(!str||!str.trim())return[];
  return str.split(/[,，\s]+/).map(s=>s.trim()).filter(Boolean).map(s=>{const n=parseInt(s);return isNaN(n)?null:n;}).filter(n=>n!==null);
}

/**
 * 회독 배정 — 저장된 문제에 일차를 매긴다.
 * mode: 'random'  같은 장이 한 일차에 몰리지 않게 흩어 배정
 *       'order'   장·번호 순서대로 앞에서부터 균등하게
 * 진도(S)는 건드리지 않으므로 완료 체크는 그대로 유지된다.
 */
async function runAssign(mode){
  const subj=SUBJECTS.find(s=>s.id===curEdSubj);
  if(!subj){showToast('과목을 먼저 등록해주세요');return;}
  const data=DATA[subj.id]||[];

  // 완료한 문제가 하나라도 있으면 한 번 더 확인 (다시 배정하면 일차가 새로 짜인다)
  const anyDone=data.some((ch,ci)=>subj.cols.some(c=>
    (ch[c.key]||[]).some(p=>dn(subj.id,ci,colKeyToType(subj.id,c.key),Array.isArray(p)?p[0]:p))));
  if(anyDone && !confirm(`${subj.name}에 이미 완료한 문제가 있어요.\n다시 배정하면 모든 문제의 일차가 새로 짜입니다.\n(완료 체크 자체는 그대로 유지돼요)\n\n계속할까요?`)) return;

  // 새 배정은 원래 순서를 새로 정의하므로, 남은 문제 조정용 스냅샷은 초기화
  if(PLAN_SNAPSHOT[subj.id]){ delete PLAN_SNAPSHOT[subj.id]; savePlanSnapshot(); }

  // 저장된 문제 수집
  const pool=[];
  data.forEach((ch,ci)=>subj.cols.forEach(c=>{
    (ch[c.key]||[]).forEach(p=>{
      const num=Array.isArray(p)?p[0]:p;
      pool.push({ci,key:c.key,num});
    });
  }));
  if(!pool.length){showToast('먼저 문제를 등록해주세요');return;}

  const days=Math.max(1,Math.min(365,parseInt(document.getElementById('rand-days').value)||1));
  const total=pool.length;
  const perDay=Math.floor(total/days),extra=total%days;
  const buckets=[];
  for(let d=0;d<days;d++)buckets.push({day:d+1,cap:perDay+(d<extra?1:0),items:[],chCounts:{}});

  if(mode==='order'){
    // 장 순서 → 번호 순서. 용량만큼 차례로 채운다.
    const ordered=[...pool].sort((a,b)=>a.ci-b.ci||a.num-b.num);
    let bi=0;
    ordered.forEach(p=>{
      while(buckets[bi].items.length>=buckets[bi].cap&&bi<buckets.length-1)bi++;
      buckets[bi].items.push(p);
    });
  }else{
    // 같은 장 몰림 방지: 장별 큐를 라운드로빈으로 돌며 점수가 낮은 일차에 넣는다
    const byCh={};pool.forEach(p=>{(byCh[p.ci]=byCh[p.ci]||[]).push(p);});
    Object.values(byCh).forEach(arr=>{
      for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
    });
    const score=(b,ci,idx)=>{
      if(b.items.length>=b.cap)return Infinity;
      let s=(b.chCounts[ci]||0)*1000;
      [[1,300],[2,80],[3,20]].forEach(([off,pen])=>{
        const pv=buckets[idx-off],nx=buckets[idx+off];
        if(pv&&pv.chCounts[ci])s+=pen*pv.chCounts[ci];
        if(nx&&nx.chCounts[ci])s+=pen*nx.chCounts[ci];
      });
      return s+b.items.length*2;
    };
    const queues=Object.entries(byCh)
      .sort((a,b)=>b[1].length-a[1].length)          // 많은 장부터 (분산 효과 ↑)
      .map(([ci,arr])=>({ci:+ci,queue:arr}));
    while(queues.some(q=>q.queue.length)){
      for(const q of queues){
        if(!q.queue.length)continue;
        const prob=q.queue.shift();
        let best=Infinity,cands=[];
        buckets.forEach((b,idx)=>{
          const sc=score(b,q.ci,idx);
          if(sc<best){best=sc;cands=[idx];}else if(sc===best)cands.push(idx);
        });
        if(!cands.length)continue;
        const pick=buckets[cands[Math.floor(Math.random()*cands.length)]];
        pick.items.push(prob);
        pick.chCounts[q.ci]=(pick.chCounts[q.ci]||0)+1;
      }
    }
  }

  // 일차를 DATA에 기록
  const dayOf=new Map();
  buckets.forEach(b=>b.items.forEach(p=>dayOf.set(p.ci+'|'+p.key+'|'+p.num,b.day)));
  data.forEach((ch,ci)=>subj.cols.forEach(c=>{
    ch[c.key]=(ch[c.key]||[]).map(p=>{
      const num=Array.isArray(p)?p[0]:p;
      return [num, dayOf.get(ci+'|'+c.key+'|'+num)||0];
    });
  }));

  syncLegacy();
  await saveAllSubjData();
  buildMaps();buildDG();updateProgress();
  renderStudyTabs();renderProgressCards();
  buildEdRows();if(curNav==='setup'&&curEdMode==='grid')renderEdGrid();
  refreshOnboarding();updateEmptyStates();renderAssignInfo();applyEdSection();
  if(window.CloudSync&&window.CloudSync.schedulePush)window.CloudSync.schedulePush();
  showToast(`${total}문제를 ${days}일에 배정했어요`);
}
window.runAssign=runAssign;

/** 배정 섹션 상단 요약 + 일차별 분포 미리보기 */
function renderAssignInfo(){
  renderEdSubjTabs();   // 배정 뱃지(배정/전체)를 최신 상태로
  const sum=document.getElementById('assign-summary');
  if(!sum) return;
  const subj=SUBJECTS.find(s=>s.id===curEdSubj);
  const data=subj?(DATA[subj.id]||[]):[];
  let total=0;const perDay={};
  data.forEach(ch=>(subj?subj.cols:[]).forEach(c=>(ch[c.key]||[]).forEach(p=>{
    total++;const d=Array.isArray(p)?p[1]:0;if(d>=1)perDay[d]=(perDay[d]||0)+1;
  })));
  const assigned=Object.values(perDay).reduce((a,b)=>a+b,0);

  sum.textContent = !subj ? '과목을 먼저 등록해주세요.'
    : total===0 ? '이 과목에 등록된 문제가 없습니다. 위에서 문제를 먼저 저장하세요.'
    : assigned===0 ? `${subj.name} · 문제 ${total}개 — 아직 일차가 배정되지 않았습니다.`
    : `${subj.name} · 문제 ${total}개 중 ${assigned}개가 ${Object.keys(perDay).length}일에 배정돼 있습니다.`;

  // 일차별로 어떤 장의 몇 번 문제가 들어갔는지 미리 보여준다
  const box=document.getElementById('assign-preview');
  if(!box) return;
  const byDay={};   // day → [{ch, label, nums[]}]
  data.forEach(ch=>(subj?subj.cols:[]).forEach(c=>{
    (ch[c.key]||[]).forEach(p=>{
      if(!Array.isArray(p)||p[1]<1)return;
      const d=p[1];
      const list=(byDay[d]=byDay[d]||[]);
      let g=list.find(x=>x.ch===ch.ch&&x.key===c.key);
      if(!g){g={ch:ch.ch,key:c.key,label:c.label,cls:c.cls,nums:[]};list.push(g);}
      g.nums.push(p[0]);
    });
  }));
  const days=Object.keys(byDay).map(Number).sort((a,b)=>a-b);
  if(!days.length){box.style.display='none';box.innerHTML='';return;}

  const multiType=(subj?subj.cols.length:0)>1;
  box.style.display='block';
  box.innerHTML=
    `<div class="ap-head">일차별 배정 내용</div>` +
    days.map(d=>{
      const groups=byDay[d];
      const cnt=groups.reduce((a,g)=>a+g.nums.length,0);
      const body=groups.map(g=>
        `<span class="ap-grp"><span class="ap-ch">${escapeHtml(g.ch)}</span>` +
        (multiType?`<span class="type-badge tb-${g.cls}">${escapeHtml(g.label)}</span>`:'') +
        `<span class="ap-nums">${g.nums.sort((a,b)=>a-b).join(', ')}</span></span>`
      ).join('');
      return `<div class="ap-day"><span class="ap-dnum">${d}일<em>${cnt}</em></span>`+
             `<span class="ap-body">${body}</span></div>`;
    }).join('');
}
window.renderAssignInfo=renderAssignInfo;

/**
 * 문제 등록 섹션 접기.
 * 상태는 과목별이 아니라 화면 전체에 하나만 둔다 — 과목을 바꿀 때마다
 * 접혔다 펴지면 산만하기 때문이다. 선택은 localStorage에 남겨 다음에도 유지한다.
 * 최초 1회만 데이터 유무로 정한다(문제가 있으면 접어 회독 배정을 먼저 보여줌).
 */
let edCollapsed=null;   // null이면 아직 결정 전
function edIsCollapsed(){
  if(edCollapsed===null){
    let saved=null;
    try{ saved=localStorage.getItem('edCollapsed'); }catch(_){}
    edCollapsed = saved===null ? hasAnyProblems() : saved==='1';
  }
  return edCollapsed;
}
function applyEdSection(){
  const head=document.getElementById('ed-head');
  const body=document.getElementById('ed-body');
  const sum=document.getElementById('ed-summary');
  if(!head||!body)return;
  const collapsed=edIsCollapsed();
  body.style.display=collapsed?'none':'';
  head.classList.toggle('collapsed',collapsed);
  head.setAttribute('aria-expanded',String(!collapsed));

  if(!sum)return;
  const subj=SUBJECTS.find(s=>s.id===curEdSubj);
  if(!subj){sum.textContent='';return;}
  const data=DATA[subj.id]||[];
  let n=0;data.forEach(ch=>subj.cols.forEach(c=>{n+=(ch[c.key]||[]).length;}));
  sum.textContent=data.length?`${data.length}개 장 · ${n}문제`:'등록된 문제 없음';
}
function toggleEdSection(){
  edCollapsed=!edIsCollapsed();
  try{ localStorage.setItem('edCollapsed', edCollapsed?'1':'0'); }catch(_){}
  applyEdSection();
}
window.toggleEdSection=toggleEdSection;
window.applyEdSection=applyEdSection;







function renderSubjGrid(reset){
  // reset이 true이거나 처음 진입(빈 배열)일 때만 SUBJECTS에서 복사
  if(reset||!subjEditRows.length){
    subjEditRows = SUBJECTS.map(s=>({...s,cols:JSON.parse(JSON.stringify(s.cols))}));
  }
  const wrap = document.getElementById('subj-grid-wrap');
  wrap.innerHTML = '';
  const tbl = document.createElement('table');
  tbl.className = 'ss-table';
  const thead = document.createElement('thead');
  const htr = document.createElement('tr');
  // 과목 ID는 내부 관리 값이라 폼에서 감춘다 (addSubjRow가 자동 생성)
  ['#','과목 이름','색상','문제 유형','삭제'].forEach((label,i)=>{
    const th = document.createElement('th');
    th.textContent = label;
    if(i===0) th.style.minWidth='36px';
    if(i===3) th.style.minWidth='200px';
    if(i===4) th.style.minWidth='44px';
    htr.appendChild(th);
  });
  thead.appendChild(htr);tbl.appendChild(thead);
  const tbody = document.createElement('tbody');
  subjEditRows.forEach((row,ri)=>{
    const tr = document.createElement('tr');
    // #
    const tdN = document.createElement('td');tdN.className='row-num';tdN.textContent=ri+1;tr.appendChild(tdN);
    // 이름 (ID 칸은 제거 — 기존 id는 subjEditRows에 그대로 보존됨)
    const tdNm = document.createElement('td');tdNm.className='cell-ch';
    const inpNm = document.createElement('input');inpNm.value=row.name;inpNm.placeholder='과목 이름';
    inpNm.addEventListener('input',()=>{subjEditRows[ri].name=inpNm.value;});
    tdNm.appendChild(inpNm);tr.appendChild(tdNm);
    // 색상
    const tdC = document.createElement('td');tdC.style.padding='4px 8px';
    const sel = document.createElement('select');
    sel.style.cssText='font-size:11px;padding:4px 6px;border:1px solid var(--border);border-radius:var(--r2);background:var(--bg);font-family:inherit;';
    COLOR_PALETTE.forEach(cp=>{
      const opt = document.createElement('option');opt.value=cp.id;opt.textContent=cp.label;
      if(cp.id===row.color)opt.selected=true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change',()=>{subjEditRows[ri].color=sel.value;});
    tdC.appendChild(sel);tr.appendChild(tdC);
    // 문제 유형 — 칩 형태로 자유롭게 편집
    const tdT = document.createElement('td');tdT.style.padding='6px 8px';
    tdT.appendChild(renderTypeChips(ri));
    tr.appendChild(tdT);
    // 삭제
    const tdD = document.createElement('td');
    const delB = document.createElement('button');delB.className='row-del';delB.textContent='✕';
    delB.onclick=()=>{
      if(subjEditRows.length<=1){showToast('최소 1개 과목 필요');return;}
      if(!confirm(row.name+' 과목을 삭제할까요?\n데이터와 진도가 모두 삭제됩니다.'))return;
      subjEditRows.splice(ri,1);renderSubjGrid();
    };
    tdD.appendChild(delB);tr.appendChild(tdD);
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);wrap.appendChild(tbl);
}

// 유형 컬러 옵션 (칩 색상)
const TYPE_CLS_OPTIONS = [
  {id:'th',label:'파랑'},{id:'ba',label:'초록'},{id:'av',label:'빨강'},
  {id:'ca',label:'보라'},{id:'si',label:'회색'},
];

function renderTypeChips(ri){
  const row = subjEditRows[ri];
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;align-items:center;';

  row.cols.forEach((col, ci) => {
    const chip = document.createElement('div');
    chip.style.cssText = 'display:inline-flex;align-items:center;gap:3px;padding:2px 4px;border:1px solid var(--border);border-radius:var(--r2);background:var(--bg);';

    // 라벨 입력 (사용자가 보는 이름)
    const lblInp = document.createElement('input');
    lblInp.value = col.label;
    lblInp.placeholder = '유형명';
    lblInp.style.cssText = 'width:72px;font-size:11px;padding:3px 6px;border:none;background:transparent;outline:none;font-family:inherit;';
    lblInp.addEventListener('input', () => {
      subjEditRows[ri].cols[ci].label = lblInp.value;
    });
    lblInp.addEventListener('change', () => {
      subjEditRows[ri].cols[ci].label = lblInp.value;
    });
    lblInp.addEventListener('blur', () => {
      subjEditRows[ri].cols[ci].label = lblInp.value;
    });
    chip.appendChild(lblInp);

    // 색상 셀렉트 (작게)
    const clsSel = document.createElement('select');
    clsSel.title = '칩 색상';
    clsSel.style.cssText = 'font-size:10px;padding:1px 2px;border:1px solid var(--border);border-radius:3px;background:var(--bg);font-family:inherit;';
    TYPE_CLS_OPTIONS.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.id; o.textContent = opt.label;
      if (opt.id === col.cls) o.selected = true;
      clsSel.appendChild(o);
    });
    clsSel.addEventListener('change', () => {
      subjEditRows[ri].cols[ci].cls = clsSel.value;
    });
    chip.appendChild(clsSel);

    // 삭제 버튼
    const delBtn = document.createElement('button');
    delBtn.textContent = '✕';
    delBtn.title = '유형 삭제';
    delBtn.style.cssText = 'border:none;background:transparent;color:var(--text3);cursor:pointer;font-size:11px;padding:0 2px;';
    delBtn.onclick = () => {
      if (row.cols.length <= 1) { showToast('최소 1개 유형 필요'); return; }
      subjEditRows[ri].cols.splice(ci, 1);
      renderSubjGrid();
    };
    chip.appendChild(delBtn);

    wrap.appendChild(chip);
  });

  // + 버튼
  const addBtn = document.createElement('button');
  addBtn.textContent = '＋';
  addBtn.title = '유형 추가';
  addBtn.style.cssText = 'padding:3px 8px;font-size:11px;border:1px dashed var(--border2);border-radius:var(--r2);background:transparent;color:var(--text3);cursor:pointer;font-family:inherit;';
  addBtn.onclick = () => {
    // 자동 키 생성 (col1, col2, col3...)
    const usedKeys = subjEditRows[ri].cols.map(c => c.key);
    let newKey = 'col1';
    for (let i = 1; i < 999; i++) {
      const k = 'col' + i;
      if (!usedKeys.includes(k)) { newKey = k; break; }
    }
    subjEditRows[ri].cols.push({ key: newKey, label: '새 유형', cls: 'si' });
    renderSubjGrid();
  };
  wrap.appendChild(addBtn);

  // 프리셋 드롭다운 (빠른 적용용)
  const presetSel = document.createElement('select');
  presetSel.style.cssText = 'font-size:10px;padding:2px 4px;border:1px solid var(--border);border-radius:3px;background:var(--bg2);color:var(--text3);font-family:inherit;margin-left:6px;';
  const placeholder = document.createElement('option');
  placeholder.value = ''; placeholder.textContent = '프리셋 적용...';
  placeholder.disabled = true; placeholder.selected = true;
  presetSel.appendChild(placeholder);
  COL_PRESETS.forEach((cp, pi) => {
    const o = document.createElement('option');
    o.value = pi; o.textContent = cp.label;
    presetSel.appendChild(o);
  });
  presetSel.addEventListener('change', () => {
    if (presetSel.value === '') return;
    subjEditRows[ri].cols = JSON.parse(JSON.stringify(COL_PRESETS[parseInt(presetSel.value)].cols));
    renderSubjGrid();
  });
  wrap.appendChild(presetSel);

  return wrap;
}

function addSubjRow(){
  const usedIds = subjEditRows.map(r=>r.id);
  let newId = 'subj1';
  for(let i=1;i<100;i++){if(!usedIds.includes('subj'+i)){newId='subj'+i;break;}}
  // 사용 안 된 색상 찾기
  const usedColors = subjEditRows.map(r=>r.color);
  const availColor = COLOR_PALETTE.find(c=>!usedColors.includes(c.id));
  subjEditRows.push({
    id:newId, name:'새 과목', color:availColor?availColor.id:'fin',
    dataKey:newId+'Data', idbKey:'c'+newId,
    cols:[{key:'t',label:'이론',cls:'th'}]
  });
  renderSubjGrid();
  setTimeout(()=>{const rows=document.querySelectorAll('#subj-grid-wrap tbody tr');if(rows.length)rows[rows.length-1].scrollIntoView({behavior:'smooth'});},50);
}

async function saveSubjects(){
  const st = document.getElementById('subj-st');
  // 저장 직전: DOM의 모든 input/select 값을 subjEditRows에 강제 동기화 (이벤트 미발생 케이스 대비)
  document.querySelectorAll('#subj-grid-wrap tbody tr').forEach((tr,ri)=>{
    if(!subjEditRows[ri])return;
    // 과목 이름 (ID는 폼에서 제거 — 내부에서 자동 관리, subjEditRows[ri].id 유지)
    const inps=tr.querySelectorAll('input');
    if(inps[0])subjEditRows[ri].name=inps[0].value;
    // 색상
    const sels=tr.querySelectorAll('select');
    if(sels[0])subjEditRows[ri].color=sels[0].value;
    // 유형 칩들 — 유형명 input과 색상 select
    const chips=tr.querySelectorAll('td:nth-child(4) > div > div'); // tdT(문제 유형) 안의 chip div
    chips.forEach((chip,ci)=>{
      if(!subjEditRows[ri].cols[ci])return;
      const lblIn=chip.querySelector('input');
      if(lblIn)subjEditRows[ri].cols[ci].label=lblIn.value;
      const clsSel=chip.querySelector('select');
      if(clsSel)subjEditRows[ri].cols[ci].cls=clsSel.value;
    });
  });
  // 검증
  const ids = subjEditRows.map(r=>r.id);
  if(ids.some(id=>!id)){st.className='ed-st err';st.textContent='❌ ID가 비어있는 과목이 있어요';return;}
  if(new Set(ids).size!==ids.length){st.className='ed-st err';st.textContent='❌ 중복된 ID가 있어요';return;}
  if(subjEditRows.some(r=>!r.name)){st.className='ed-st err';st.textContent='❌ 이름이 비어있는 과목이 있어요';return;}

  // dataKey, idbKey 자동 생성
  subjEditRows.forEach(r=>{
    if(!r.dataKey)r.dataKey=r.id+'Data';
    if(!r.idbKey)r.idbKey='c'+r.id;
  });

  // 삭제된 과목의 데이터와 진도 정리
  const oldIds = SUBJECTS.map(s=>s.id);
  const newIds = subjEditRows.map(r=>r.id);
  const removed = oldIds.filter(id=>!newIds.includes(id));
  for(const rid of removed){
    const old = SUBJECTS.find(s=>s.id===rid);
    if(old){
      try{await idbDel(old.idbKey);}catch(e){}
      // localStorage 폴백도 정리
      try{localStorage.removeItem(old.idbKey);}catch(e){}
      // 진도 삭제
      const prefix = rid+'|';
      Object.keys(S).forEach(k=>{if(k.startsWith(prefix))delete S[k];});
    }
    // 메모리에서 데이터 삭제
    delete DATA[rid];
    delete DEFAULTS[rid];
  }

  // 새 과목의 데이터 초기화
  newIds.forEach(id=>{
    if(!DATA[id])DATA[id]=[];
    if(!DEFAULTS[id])DEFAULTS[id]=[];
  });

  // SUBJECTS 적용
  SUBJECTS = JSON.parse(JSON.stringify(subjEditRows));

  // CSS 변수 업데이트
  updateSubjectCSS();

  // 저장
  await idbSet('subjects_config', SUBJECTS);
  await saveState();
  await saveAllSubjData();

  // UI 재구성
  ensureCurSubjects();
  rebuildUI();
  renderSubjGrid(true);
  renderEd();
  renderAssignInfo();
  applyEdSection();
  refreshOnboarding();
  updateEmptyStates();

  st.className='ed-st ok';st.textContent='✓ 저장 완료 ('+SUBJECTS.length+'개 과목)';
  showToast('✅ 과목 설정 저장 완료');
}

function updateSubjectCSS(){
  // 동적 CSS 변수 업데이트
  let styleEl = document.getElementById('dynamic-subj-css');
  if(!styleEl){styleEl=document.createElement('style');styleEl.id='dynamic-subj-css';document.head.appendChild(styleEl);}
  let css = ':root{\n';
  SUBJECTS.forEach(s=>{
    const cp = COLOR_PALETTE.find(c=>c.id===s.color);
    if(cp){
      css+=`  --${s.id}:${cp.c};--${s.id}-bg:${cp.bg};--${s.id}-border:${cp.bd};\n`;
    }
  });
  css+='}';
  styleEl.textContent = css;
}

function copyText(text,label){
  if(navigator.clipboard&&window.isSecureContext){
    navigator.clipboard.writeText(text).then(()=>showToast('📋 '+(label||'복사 완료'))).catch(()=>copyFallback(text,label));
  }else{copyFallback(text,label);}
}
function copyFallback(text,label){
  const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;left:-9999px;top:0;';
  document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');showToast('📋 '+(label||'복사 완료'));}
  catch(e){showToast('⚠️ 복사 실패 — 직접 선택해서 복사해주세요');}
  document.body.removeChild(ta);
}
// ══════════════════════════════════════════
// 남은 문제 조정 (Reschedule)
// ══════════════════════════════════════════
let rescheduleData = null;

function openRescheduleModal(){
  if(curSubj==='all'){showToast('과목을 먼저 선택해주세요');return;}
  const subjDef=SUBJECTS.find(s=>s.id===curSubj);
  if(!subjDef){showToast('과목을 찾을 수 없어요');return;}

  // 1. 모든 문제 수집
  const allProbs = [];
  const data = DATA[curSubj] || [];
  data.forEach((ch, ci) => {
    subjDef.cols.forEach(col => {
      (ch[col.key] || []).forEach(p => {
        const tp = colKeyToType(curSubj, col.key);
        const isDone = dn(curSubj, ci, tp, p[0]);
        allProbs.push({ci, ch:ch.ch, colKey:col.key, num:p[0], day:p[1], done:isDone, type:tp});
      });
    });
  });

  if(!allProbs.length){showToast('문제가 없어요');return;}

  // 2. 원래 순서(회독 순서) = 일차 → 장 → 번호. 이 순서는 절대 바꾸지 않는다.
  //    (완료 문제를 앞으로 옮기지 않음 → 다음 회독에도 같은 문제가 비슷한 시기에 배치됨)
  const seq = [...allProbs].sort((a,b) => {
    if(a.day !== b.day) return a.day - b.day;
    if(a.ci !== b.ci) return a.ci - b.ci;
    return a.num - b.num;
  });

  const completedCount = seq.filter(p=>p.done).length;
  const undoneCount = seq.length - completedCount;
  const origTotalDays = Math.max(0, ...allProbs.map(p=>p.day));

  rescheduleData = {
    subjId: curSubj,
    subjName: subjDef.name,
    seq,                 // 순서 고정된 전체 문제
    completedCount,
    undoneCount,
    origTotalDays
  };

  // 정보 표시
  document.getElementById('reschedule-info').innerHTML =
    `<b>${subjDef.name}</b> · 총 ${allProbs.length}문제 (기존 ${origTotalDays}일 계획)<br>` +
    `✓ 완료: ${completedCount}문제 → 「완료된 문제」로 모음<br>` +
    `🔄 남은 문제: ${undoneCount}문제 → 1일차부터 하루 정한 개수만큼 배정`;

  // 기본값: 미완료 문제를 원래 진행하던 페이스에 맞춰 추정
  const distinctUndoneDays = new Set(seq.filter(p=>!p.done).map(p=>p.day)).size;
  const defaultPerDay = Math.max(1, Math.round(undoneCount / Math.max(1, distinctUndoneDays)));
  document.getElementById('reschedule-per-day').value = defaultPerDay;

  document.getElementById('reschedule-modal').style.display='flex';
  updateReschedulePreview();
}

function closeRescheduleModal(){
  document.getElementById('reschedule-modal').style.display='none';
  rescheduleData = null;
}

// 새 배치 계산
// 완료 문제 → "완료된 문제" 버킷(일차 0). 미완료 문제 → 원래 순서대로 1일차부터 perDay씩.
function computeReschedule(perDay){
  if(!rescheduleData)return null;
  const pd = Math.max(1, perDay|0);
  const seq = rescheduleData.seq;              // 원래 순서(일차→ci→num)
  const bucket = seq.filter(p=>p.done);        // 완료 → 버킷
  const undone = seq.filter(p=>!p.done);       // 미완료 → 1일차부터

  const dayGroups = {};
  let day=1, inDay=0;
  undone.forEach(p=>{
    if(inDay>=pd){ day++; inDay=0; }
    (dayGroups[day]=dayGroups[day]||[]).push(p);
    inDay++;
  });
  return { bucket, dayGroups, totalDays: undone.length?day:0 };
}

function updateReschedulePreview(){
  const perDay = parseInt(document.getElementById('reschedule-per-day').value) || 1;
  const result = computeReschedule(perDay);
  if(!result){document.getElementById('reschedule-preview').innerHTML = '';return;}
  const {bucket, dayGroups, totalDays} = result;

  const chip = p => {
    const txt = `${escapeHtml(p.ch)}-${p.num}`;
    return p.done ? `<span style="color:var(--cost);text-decoration:line-through;opacity:.6;">${txt}</span>` : txt;
  };
  const row = (label, color, probs, count) =>
    `<div style="background:${color==='cost'?'var(--bg3)':'var(--bg)'};border:1px solid var(--${color});border-radius:4px;padding:6px 10px;display:flex;gap:10px;align-items:flex-start;">`+
      `<div style="font-size:11px;font-weight:600;color:var(--${color});min-width:78px;">${label}</div>`+
      `<div style="flex:1;font-size:10px;color:var(--text2);font-family:'JetBrains Mono',monospace;line-height:1.6;">${probs.map(chip).join(', ')}</div>`+
      `<div style="font-size:10px;color:var(--text3);text-align:right;min-width:44px;">${count}문제</div>`+
    `</div>`;

  let html = `<div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:8px;">미리보기 — 완료 ${bucket.length}문제는 「완료된 문제」로, 남은 문제는 1일차부터 하루 ${Math.max(1,perDay)}개씩 (총 ${totalDays}일)</div>`;
  html += '<div style="display:flex;flex-direction:column;gap:4px;">';
  if(bucket.length){
    const bs=[...bucket].sort((a,b)=>a.day-b.day||a.ci-b.ci||a.num-b.num);
    html += row('✓ 완료된 문제','cost',bs,bucket.length);
  }
  for(let d=1; d<=totalDays; d++){
    const probs=(dayGroups[d]||[]).slice().sort((a,b)=>a.ci-b.ci||a.num-b.num);
    html += row(d+'일','accent',probs,probs.length);
  }
  html += '</div>';
  html += '<div style="margin-top:8px;font-size:10px;color:var(--text3);line-height:1.5;">전체 또는 이 과목을 미완료로 초기화하면, 완료 묶음이 원래 순서대로 되돌아옵니다.</div>';
  document.getElementById('reschedule-preview').innerHTML=html;
}

async function applyReschedule(){
  const perDay = parseInt(document.getElementById('reschedule-per-day').value) || 1;
  const result = computeReschedule(perDay);
  if(!result){showToast('계산 실패');return;}

  const subjId = rescheduleData.subjId;
  const data = DATA[subjId];
  if(!data){showToast('데이터를 찾을 수 없어요');return;}

  const bucketN = result.bucket.length;
  const undoneN = rescheduleData.undoneCount;
  if(!bucketN && !undoneN){showToast('조정할 문제가 없어요');return;}

  if(!confirm(`정말 변경할까요?\n${rescheduleData.subjName}\n• 완료 ${bucketN}문제 → 「완료된 문제」로 모으기\n• 남은 ${undoneN}문제 → 1일차부터 하루 ${Math.max(1,perDay)}개씩 (총 ${result.totalDays}일)\n(완료 체크는 그대로 유지돼요)`))return;

  // 조정 전 원래 배치를 스냅샷(최초 1회) — 초기화 시 원래 순서 복원용
  if(!PLAN_SNAPSHOT[subjId]){
    const snap={};
    data.forEach((ch,ci)=>Object.keys(ch).forEach(col=>{
      if(col==='ch'||!Array.isArray(ch[col]))return;
      ch[col].forEach(pair=>{ snap[`${ci}|${col}|${pair[0]}`]=pair[1]; });
    }));
    PLAN_SNAPSHOT[subjId]=snap;
  }

  // 키 → 새 일차 (완료=0 버킷, 미완료=1..N)
  const map={};
  result.bucket.forEach(p=>{ map[`${p.ci}|${p.colKey}|${p.num}`]=0; });
  Object.entries(result.dayGroups).forEach(([d,arr])=>arr.forEach(p=>{ map[`${p.ci}|${p.colKey}|${p.num}`]=+d; }));

  data.forEach((ch,ci)=>Object.keys(ch).forEach(col=>{
    if(col==='ch'||!Array.isArray(ch[col]))return;
    ch[col]=ch[col].map(pair=>{
      const nd=map[`${ci}|${col}|${pair[0]}`];
      return nd!==undefined ? [pair[0],nd] : pair;
    });
  }));

  syncLegacy();
  await saveAllSubjData();
  await savePlanSnapshot();
  buildMaps();
  buildDG();
  if(curView==='chap')renderChaps();
  updateProgress();
  curDay=null;
  const dp=document.getElementById('dpanel');dp.classList.remove('on');dp.innerHTML='';

  closeRescheduleModal();
  showToast(`✅ 완료 ${bucketN}문제 모으기 · 남은 ${undoneN}문제 재배치 (총 ${result.totalDays}일)`);
}

// ══════════════════════════════════════════
// 문제집 카탈로그 (목차 불러오기)
// ══════════════════════════════════════════
// 각 장의 유형별 값은 "문제 개수"(1..n)입니다. loadSelectedBook에서 [번호,일차] 쌍으로 펼칩니다.
// cols의 key와 장(chapter) 객체의 key가 일치해야 합니다.
const PROBLEM_BOOKS = [
  {
    id:'kkd-2026-fin',
    title:'2026 김기동 재무회계 연습서',
    subject:'재무회계',
    author:'김기동',
    year:'2026',
    color:'fin',
    cols:[{key:'b',label:'기본',cls:'ba'},{key:'a',label:'응용',cls:'av'}],
    chapters:[
      {ch:'1장 개념체계',b:0,a:0},
      {ch:'2장 현금과 채권',b:0,a:0},
      {ch:'3장 재고자산',b:4,a:6},
      {ch:'4장 유형자산과 투자부동산',b:5,a:4},
      {ch:'5장 차입원가 자본화',b:4,a:0},
      {ch:'6장 무형자산과 기타자산',b:4,a:0},
      {ch:'7장 금융부채와 사채',b:3,a:2},
      {ch:'8장 충당부채와 종업원급여',b:5,a:4},
      {ch:'9장 자본',b:4,a:0},
      {ch:'10장 수익',b:5,a:4},
      {ch:'11장 투자목적 금융자산',b:5,a:2},
      {ch:'12장 복합금융상품',b:2,a:2},
      {ch:'13장 주식기준보상거래',b:5,a:3},
      {ch:'14장 주당이익',b:4,a:2},
      {ch:'15장 리스',b:4,a:3},
      {ch:'16장 법인세회계',b:4,a:3},
      {ch:'17장 회계변경과 오류수정',b:4,a:2},
      {ch:'18장 현금흐름표',b:3,a:2},
      {ch:'19장 재무회계의 기타사항',b:2,a:0},
      {ch:'20장 환율변동효과와 파생상품',b:0,a:0},
      {ch:'21장 관계기업과 공동기업투자',b:4,a:2},
      {ch:'22장 사업결합과 합병회계',b:4,a:0},
      {ch:'23장 연결회계',b:3,a:0},
    ],
  },
  {
    id:'lcj-jws-2026-tax',
    title:'2026 세무회계연습',
    subject:'세무회계',
    author:'이철재·정우승',
    year:'2026',
    subjectId:'setax',   // 'tax'는 부/법/소 특화 렌더링과 충돌하므로 일반 경로를 타는 id를 쓴다
    color:'tax',
    cols:[
      {key:'req',label:'필수',cls:'av'},
      {key:'prac',label:'연습',cls:'ba'},
      {key:'def',label:'유예',cls:'si'},
    ],
    // 필수 문제 번호는 비연속이므로 배열로 명시. 연습·유예는 아직 비어 있어 생략(빈 배열).
    chapters:[
      {ch:'부가가치세 1장',req:[1,2,3,4,5,6,7,8,9,10,11,12,13]},
      {ch:'부가가치세 2장',req:[1,2,3,4,9,12]},
      {ch:'부가가치세 3장',req:[1,2,3,4,5,7,8,9]},
      {ch:'부가가치세 4장',req:[1,2,3,4,5]},
      {ch:'법인세 1장',req:[1,2]},
      {ch:'법인세 2장',req:[1,2,3,4,5,6,7]},
      {ch:'법인세 3장',req:[1,3,4,8,9,10,11]},
      {ch:'법인세 4장',req:[1,3,4,5,6,7,8,10]},
      {ch:'법인세 5장',req:[1,2,4,5,6]},
      {ch:'법인세 6장',req:[1,3,4,5,6,8,9,10,11,12]},
      {ch:'법인세 7장',req:[1,2,3]},
      {ch:'법인세 8장',req:[1,3,4,5,8,9,10,12]},
      {ch:'법인세 9장',req:[1,2,3,4,5,6,7,8,9,11,12,13,16]},
      {ch:'법인세 10장',req:[1,2,3,9,10]},
      {ch:'법인세 11장',req:[2,3,5,6,7]},
      {ch:'법인세 12장',req:[1,3]},
      {ch:'법인세 13장',req:[1,2,3,4,5,7,11,13,14,15]},
      {ch:'법인세 14장',req:[2,5,9,11,13,14,15,18,21,22,23]},
      {ch:'법인세 15장',req:[2,4,5,6,12]},
      {ch:'법인세 16장',req:[1,2,3]},
      {ch:'법인세 17장',req:[1,3,5]},
      {ch:'소득세 1장',req:[1,2,3,4,5,6,7,8,9]},
      {ch:'소득세 2장',req:[1,3,4,5,7,8,9,10,11]},
      {ch:'소득세 3장',req:[1,2,3,4,5,6,8,9,10,12]},
      {ch:'소득세 4장',req:[2,3,5]},
      {ch:'소득세 5장',req:[1,2,3]},
      {ch:'소득세 6장',req:[1,2,3,6,7,8,9,16,17]},
      {ch:'소득세 7장',req:[1,2,5]},
      {ch:'소득세 8장',req:[1,2,3,4,5,6,8,11,12,13]},
      {ch:'소득세 9장',req:[2]},
    ],
  },
];

// 1..n 정수 배열
function bookRange(n){const a=[];for(let i=1;i<=(n|0);i++)a.push(i);return a;}
// 장의 유형별 값 → 문제번호 배열. 숫자면 1..n, 배열이면 그 번호들(비연속 허용), 없으면 빈 배열.
function bookNums(v){ if(Array.isArray(v))return v.slice(); if(typeof v==='number')return bookRange(v); return []; }
function bookProbCount(b){return b.chapters.reduce((t,ch)=>t+b.cols.reduce((s,c)=>s+bookNums(ch[c.key]).length,0),0);}

let selectedBookId = null;

function openBookModal(){
  selectedBookId = null;
  const s=document.getElementById('book-search'); if(s)s.value='';
  const pv=document.getElementById('book-preview'); if(pv)pv.innerHTML='';
  const btn=document.getElementById('book-load-btn'); if(btn)btn.disabled=true;
  renderBookList();
  document.getElementById('book-modal').style.display='flex';
}
function closeBookModal(){
  const m=document.getElementById('book-modal'); if(m)m.style.display='none';
}
window.openBookModal=openBookModal;
window.closeBookModal=closeBookModal;

function filteredBooks(){
  const q=(document.getElementById('book-search')?.value||'').trim().toLowerCase();
  if(!q)return PROBLEM_BOOKS;
  return PROBLEM_BOOKS.filter(b=>
    [b.title,b.subject,b.author,b.year].join(' ').toLowerCase().includes(q));
}
function renderBookList(){
  const con=document.getElementById('book-list');
  if(!con)return;
  const books=filteredBooks();
  if(!books.length){con.innerHTML='<div class="book-empty">검색 결과가 없어요</div>';return;}
  con.innerHTML=books.map(b=>{
    const on=b.id===selectedBookId;
    return `<button class="book-item${on?' on':''}" onclick="selectBook('${b.id}')">`+
      `<div class="book-item-main">`+
        `<div class="book-item-title">${escapeHtml(b.title)}</div>`+
        `<div class="book-item-meta">${escapeHtml(b.subject)} · ${escapeHtml(b.author)} · ${b.chapters.length}개 장 · ${bookProbCount(b)}문제</div>`+
      `</div><span class="book-item-chev">›</span></button>`;
  }).join('');
}
window.renderBookList=renderBookList;

function selectBook(id){
  selectedBookId=id;
  renderBookList();
  renderBookPreview(id);
  const btn=document.getElementById('book-load-btn'); if(btn)btn.disabled=false;
}
window.selectBook=selectBook;

function renderBookPreview(id){
  const box=document.getElementById('book-preview');
  if(!box)return;
  const b=PROBLEM_BOOKS.find(x=>x.id===id);
  if(!b){box.innerHTML='';return;}
  let html=`<div class="book-pv-head">${escapeHtml(b.title)} · 목차 미리보기</div>`;
  html+='<div class="book-pv-table"><table class="ss-table"><thead><tr><th>장</th>'+
    b.cols.map(c=>`<th>${escapeHtml(c.label)}</th>`).join('')+'</tr></thead><tbody>';
  b.chapters.forEach(ch=>{
    html+=`<tr><td style="padding:6px 10px;font-size:12px;white-space:nowrap;">${escapeHtml(ch.ch)}</td>`;
    b.cols.forEach(c=>{
      const nums=bookNums(ch[c.key]);
      html+='<td style="padding:6px 10px;">'+
        (nums.length?nums.map(x=>`<span class="prob-chip-inline">${x}</span>`).join('')
                    :'<span style="color:var(--text3)">—</span>')+'</td>';
    });
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  box.innerHTML=html;
}

async function loadSelectedBook(){
  const b=PROBLEM_BOOKS.find(x=>x.id===selectedBookId);
  if(!b){showToast('먼저 문제집을 선택해주세요');return;}

  // 과목 id 충돌 방지 — 선호 id(색상 계열)가 이미 있으면 숫자 접미사를 붙인다
  const usedIds=SUBJECTS.map(s=>s.id);
  const base=b.subjectId||b.color||'subj';
  let id=base;
  for(let i=2;usedIds.includes(id);i++) id=base+i;

  // 색상도 이미 쓰였으면 미사용 팔레트로
  const usedColors=SUBJECTS.map(s=>s.color);
  let color=b.color;
  if(usedColors.includes(color)){
    const av=COLOR_PALETTE.find(c=>!usedColors.includes(c.id));
    if(av)color=av.id;
  }

  const subj={
    id, name:b.subject, color,
    dataKey:id+'Data', idbKey:'c'+id,
    cols:JSON.parse(JSON.stringify(b.cols))
  };
  SUBJECTS.push(subj);
  DATA[id]=b.chapters.map(ch=>{
    const row={ch:ch.ch};
    b.cols.forEach(c=>{ row[c.key]=bookNums(ch[c.key]).map(n=>[n,0]); });
    return row;
  });
  DEFAULTS[id]=DEFAULTS[id]||[];

  updateSubjectCSS();
  await idbSet('subjects_config', SUBJECTS);
  await saveAllSubjData();   // 여기서 CloudSync.schedulePush()가 호출됨

  // 새 과목을 선택 상태로 두고 전체 UI 재구성
  curEdSubj=id; curRandSubj=id;
  ensureCurSubjects();
  rebuildUI();
  renderSubjGrid(true);
  renderEd();
  renderAssignInfo();
  applyEdSection();
  refreshOnboarding();
  updateEmptyStates();
  document.getElementById('hdr-sub-names').textContent=SUBJECTS.map(s=>s.name).join(' · ');

  closeBookModal();
  showToast(`✅ ${b.title} 목차를 불러왔어요`);
}
window.loadSelectedBook=loadSelectedBook;

// ══════════════════════════════════════════
// 사용자 이름 (로그인 후 1회 수집 · 동기화됨)
// ══════════════════════════════════════════
let userName='';
async function loadUserName(){
  try{ const n=await idbGet('user_name'); if(typeof n==='string') userName=n; }catch(_){}
}
window.getUserName=()=>userName;

/** 로그인 직후 이름이 없으면 입력 모달을 띄운다(구글 표시이름을 기본값으로). */
function ensureUserName(googleName){
  if(userName&&userName.trim())return;
  const inp=document.getElementById('name-input');
  if(inp)inp.value=(googleName||'').trim();
  const m=document.getElementById('name-modal');
  if(m)m.style.display='flex';
  setTimeout(()=>{ if(inp)inp.focus(); },100);
}
window.ensureUserName=ensureUserName;

async function saveUserName(){
  const inp=document.getElementById('name-input');
  const v=(inp?inp.value:'').trim();
  if(!v){ closeNameModal(); return; }
  userName=v;
  try{ await idbSet('user_name', userName); }catch(_){}
  closeNameModal();
  if(typeof window.__refreshUserLabel==='function') window.__refreshUserLabel();
  if(window.CloudSync&&window.CloudSync.schedulePush) window.CloudSync.schedulePush();
  showToast('반가워요, '+v+'님!');
}
function skipUserName(){ closeNameModal(); }
function closeNameModal(){ const m=document.getElementById('name-modal'); if(m)m.style.display='none'; }
window.saveUserName=saveUserName;
window.skipUserName=skipUserName;

// ══════════════════════════════════════════
// 로그아웃 (동기화 중단 · 이 기기 데이터 유지/삭제 선택)
// ══════════════════════════════════════════
function openLogoutModal(){ const m=document.getElementById('logout-modal'); if(m)m.style.display='flex'; }
function closeLogoutModal(){ const m=document.getElementById('logout-modal'); if(m)m.style.display='none'; }
window.openLogoutModal=openLogoutModal;
window.closeLogoutModal=closeLogoutModal;

/**
 * wipe=false: 로그아웃만 — 이 기기 데이터는 그대로 둔다(로컬 계속 사용 가능).
 * wipe=true : 로그아웃 + 이 기기 앱 데이터(IndexedDB·localStorage) 전체 삭제 후 새로고침.
 *             클라우드(계정) 데이터는 건드리지 않으므로 다시 로그인하면 되돌아온다.
 */
async function doLogout(wipe){
  closeLogoutModal();
  if(wipe && !confirm('이 기기의 진도·과목·설정을 지우고 로그아웃할까요?\n클라우드에 저장된 데이터는 그대로라 다시 로그인하면 불러옵니다.')) return;
  // 1) 동기화 중단(로그아웃). 이후 pull/push가 로컬을 덮어쓰지 않게 먼저 끊는다.
  try{ await window.CloudSync?.signOut?.(); }catch(_){}
  if(!wipe){ showToast('로그아웃됐어요 — 이 기기 데이터는 그대로예요'); return; }
  // 2) 이 기기 앱 데이터 전체 삭제 후 깨끗한 상태로 새로고침
  try{ await idbClear(); }catch(_){}
  try{ localStorage.clear(); }catch(_){}
  showToast('🗑 이 기기 데이터를 지웠어요');
  setTimeout(()=>location.reload(), 500);
}
window.doLogout=doLogout;

function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2500);}


// ══════════════════════════════════════════
// 데이터 로드
// ══════════════════════════════════════════
// 공개 서비스에서는 예시 데이터를 주입하지 않는다.
// 사용자가 직접 등록한 과목·문제만 다루며, 저장된 값은 loadData()가 읽는다.
async function fetchData(){
  SUBJECTS.forEach(s=>{ if(!DEFAULTS[s.id]) DEFAULTS[s.id]=[]; });
  syncLegacy();
}
async function init(){
  applyThemeIcon();
  try{ const t=await idbGet('app_title'); if(typeof t==='string'&&t.trim()) appTitle=t.trim(); }catch(_){}
  await loadUserName();
  try{ const ps=await idbGet('plan_snapshot'); if(ps&&typeof ps==='object') PLAN_SNAPSHOT=ps; }catch(_){}
  renderAppTitle();
  await loadSubjectsConfig();
  await fetchData();
  await loadData();
  await loadState();
  buildMaps();
  const now=new Date();document.getElementById('today-date').textContent=`${now.getFullYear()}. ${now.getMonth()+1}. ${now.getDate()}`;
  buildDG();updateProgress();
  renderStudyTabs();renderProgressCards();renderFooterBtns();updateProgress();
  document.getElementById('hdr-sub-names').textContent=SUBJECTS.map(s=>s.name).join(' · ');
  applyEntryGate();
  refreshOnboarding();
  // 아직 아무것도 없으면 준비 화면부터 보여준다
  if(!hasAnyProblems()) goNav('setup');
}
// 클라우드 동기화 모듈이 최초 로드 완료를 기다릴 수 있도록 promise를 노출
window.__appReady = init();
