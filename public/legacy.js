
// ══════════════════════════════════════════
// 과목 관리
// ══════════════════════════════════════════
// SUBJECTS: 과목 설정의 원본 (런타임에 수정 가능)
// id: 내부 키 (영문), name: 표시 이름, color: CSS 변수명,
// cols: 문제 유형 [{key, label, cssClass}]
// dataKey: data.json 및 백업에서 사용하는 키
// idbKey: IndexedDB 저장 키

const DEFAULT_SUBJECTS = [
  {id:'fin',name:'재무회계',color:'fin',dataKey:'finData',idbKey:'cfd',
   cols:[{key:'t',label:'이론',cls:'th'},{key:'b',label:'기본',cls:'ba'},{key:'a',label:'심화',cls:'av'}]},
  {id:'cost',name:'원가회계',color:'cost',dataKey:'costData',idbKey:'ccd',
   cols:[{key:'p',label:'문제',cls:'si'}]},
  {id:'tax',name:'세법',color:'tax',dataKey:'taxData',idbKey:'ctaxd',
   cols:[{key:'th',label:'이론',cls:'th'},{key:'ca',label:'계산',cls:'ca'}]},
  {id:'gib',name:'국기법',color:'gib',dataKey:'gibData',idbKey:'cgibd',
   cols:[{key:'t',label:'이론',cls:'th'}]},
  {id:'jing',name:'국징법',color:'jing',dataKey:'jingData',idbKey:'cjingd',
   cols:[{key:'t',label:'이론',cls:'th'}]},
  {id:'beol',name:'조처법',color:'beol',dataKey:'beolData',idbKey:'cbeold',
   cols:[{key:'t',label:'이론',cls:'th'}]},
];

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
function applyThemeIcon(){
  const b=document.getElementById('theme-toggle');
  if(b) b.textContent=currentTheme()==='dark'?'☀️':'🌙';
}
function toggleTheme(){
  const next=currentTheme()==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',next);
  try{localStorage.setItem('theme',next);}catch(_){}
  applyThemeIcon();
}
window.toggleTheme=toggleTheme;
matchMedia('(prefers-color-scheme:dark)').addEventListener?.('change',applyThemeIcon);

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
let curDay=null,curView='day',curSubj='fin',curNav='study';
let curEdSubj='fin',curEdMode='grid',edRows=[];

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
  ['study','data','rand','subj'].forEach(id=>{
    document.getElementById('nt-'+id).classList.toggle('on',id===n);
    document.getElementById('nav-'+id).style.display=id===n?'block':'none';
  });
  if(n==='data')renderEd();
  if(n==='rand'){renderRandSubjTabs();renderRandGrid();}
  if(n==='subj')renderSubjGrid(true);
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
  const titleEl=document.createElement('div');titleEl.className='dpanel-title';titleEl.textContent=day+'일차';
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
  s.cols.forEach(c=>{cols.push({key:c.key,label:c.label+'\n문제번호(일차)',type:'prob',color:'tb-'+c.cls});});
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
function probsToText(arr){return(arr||[]).map(p=>p[0]+'('+p[1]+')').join(', ');}
function textToProbs(str){
  if(!str||!str.trim())return[];
  return str.split(/[,，\n]+/).map(s=>s.trim()).filter(Boolean).map(s=>{
    const m=s.match(/^(\d+)\s*[\(（](\d+)[\)）]$/);
    if(!m)throw new Error('"'+s+'" — 형식: 번호(일차)');
    return[parseInt(m[1]),parseInt(m[2])];
  });
}
function buildEdRows(){
  const data=getCurData(),cols=getEdCols(curEdSubj);
  edRows=data.map(row=>{const r={};cols.forEach(c=>{r[c.key]=c.type==='ch'?row[c.key]||'':probsToText(row[c.key]||[]);});return r;});
}
function edRowsToData(){
  const cols=getEdCols(curEdSubj);
  return edRows.map(r=>{const obj={};cols.forEach(c=>{obj[c.key]=c.type==='ch'?r[c.key]:textToProbs(r[c.key]);});return obj;});
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
    ta.placeholder=c.type==='ch'?'장 이름 열 복사 후 붙여넣기\n예:\n4장\n6장\n...':'문제번호(일차) 열 복사 후 붙여넣기\n예:\n1(3), 5(1)\n2(4), 7(2)\n...';
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
  document.querySelectorAll('.ed-subj-tabs .ed-stab').forEach(el=>{
    el.classList.toggle('on',el.dataset.subj===s);
  });
  buildEdRows();if(curEdMode==='grid')renderEdGrid();else renderPastePanel();
  document.getElementById('paste-preview').innerHTML='';document.getElementById('ed-st').textContent='';
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
function renderEdSubjTabs(){
  const con=document.getElementById('ed-subj-tabs-con');
  if(!con)return;
  con.innerHTML='';
  SUBJECTS.forEach(s=>{
    const btn=document.createElement('button');
    btn.className='ed-stab';btn.dataset.subj=s.id;
    btn.textContent=s.name;
    if(s.id===curEdSubj)btn.classList.add('on');
    btn.onclick=()=>goEdSubj(s.id);
    con.appendChild(btn);
  });
}
function renderRandSubjTabs(){
  const con=document.getElementById('rand-subj-tabs');
  if(!con)return;
  con.innerHTML='';
  SUBJECTS.forEach(s=>{
    const btn=document.createElement('button');
    btn.className='ed-stab';btn.dataset.subj=s.id;
    btn.textContent=s.name;
    if(s.id===curRandSubj)btn.classList.add('on');
    btn.onclick=()=>goRandSubj(s.id);
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
  const data={version:4,date:new Date().toISOString(),progress:S,subjects:SUBJECTS,title:appTitle};
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
async function newRound(){
  if(!confirm('모든 문제를 미완료로 초기화할까요?'))return;
  S={};await saveState();curDay=null;
  const dp=document.getElementById('dpanel');dp.classList.remove('on');dp.innerHTML='';
  buildDG();updateProgress();
}
async function resetAll(){
  if(!confirm('전체 진도를 초기화할까요?'))return;
  S={};await saveState();curDay=null;
  const dp=document.getElementById('dpanel');dp.classList.remove('on');dp.innerHTML='';
  buildDG();if(curView==='chap')renderChaps();updateProgress();
}
async function resetSubj(subj){
  const names={};
  SUBJECTS.forEach(s=>{names[s.id]=s.name;});
  const name=names[subj];
  if(!confirm(name+' 진도를 초기화할까요?'))return;
  const prefix=subj+'|';
  Object.keys(S).forEach(k=>{if(k.startsWith(prefix))delete S[k];});
  await saveState();curDay=null;
  const dp=document.getElementById('dpanel');dp.classList.remove('on');dp.innerHTML='';
  buildDG();if(curView==='chap')renderChaps();updateProgress();
  showToast('✅ '+name+' 진도 초기화 완료');
}

// ══════════════════════════════════════════
// 랜덤 배정
// ══════════════════════════════════════════
let curRandSubj='fin';
let randResult=[];

// RAND_COLS는 getRandCols() 동적 함수로 대체됨

function emptyRandRow(){const r={ch:''};getRandCols(curRandSubj).filter(c=>c.type==='prob').forEach(c=>{r[c.key]='';});return r;}
let randRows=[emptyRandRow(),emptyRandRow(),emptyRandRow()];

function goRandSubj(s){
  curRandSubj=s;
  document.querySelectorAll('#rand-subj-tabs .ed-stab').forEach(el=>{
    el.classList.toggle('on',el.dataset.subj===s);
  });
  randRows=[emptyRandRow(),emptyRandRow(),emptyRandRow()];
  document.getElementById('rand-result-area').style.display='none';
  renderRandGrid();
}

function renderRandGrid(){
  const wrap=document.getElementById('rand-grid-wrap');wrap.innerHTML='';
  const cols=getRandCols(curRandSubj);
  const tbl=document.createElement('table');tbl.className='ss-table';
  const thead=document.createElement('thead');const htr=document.createElement('tr');
  const thN=document.createElement('th');thN.style.minWidth='36px';thN.textContent='#';htr.appendChild(thN);
  cols.forEach(c=>{
    const th=document.createElement('th');
    if(c.type==='ch'){th.className='ch-col';th.textContent=c.label;}
    else{th.className='prob-col';if(c.color){const sp=document.createElement('span');sp.className='type-badge '+c.color;sp.textContent=c.label;th.innerHTML='';th.appendChild(sp);}else th.textContent=c.label;}
    htr.appendChild(th);
  });
  const thD=document.createElement('th');thD.textContent='삭제';thD.style.minWidth='44px';htr.appendChild(thD);
  thead.appendChild(htr);tbl.appendChild(thead);
  const tbody=document.createElement('tbody');
  randRows.forEach((row,ri)=>{
    const tr=document.createElement('tr');
    const tdN=document.createElement('td');tdN.className='row-num';tdN.textContent=ri+1;tr.appendChild(tdN);
    cols.forEach((c,colIdx)=>{
      const td=document.createElement('td');
      if(c.type==='ch'){
        td.className='cell-ch';
        const inp=document.createElement('input');inp.value=row.ch||'';inp.placeholder='예) 4장 재고자산';
        inp.addEventListener('input',()=>{randRows[ri].ch=inp.value;});
        inp.addEventListener('paste',e=>{const raw=e.clipboardData.getData('text');if(/[\t\n]/.test(raw)){e.preventDefault();handleRandPaste(raw,ri,colIdx);}});
        td.appendChild(inp);
      }else{
        td.className='cell-prob';
        const ta=document.createElement('textarea');ta.value=row[c.key]||'';ta.rows=2;
        ta.placeholder='예) 1, 2, 3, 4, 5';
        ta.addEventListener('input',()=>{randRows[ri][c.key]=ta.value;ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';});
        ta.addEventListener('paste',e=>{
          const raw=e.clipboardData.getData('text');
          if(/\t/.test(raw)){e.preventDefault();handleRandPaste(raw,ri,colIdx);}
          else if(/\n/.test(raw)){e.preventDefault();
            const cleaned=raw.replace(/\r\n/g,'\n').split('\n').map(s=>s.trim()).filter(Boolean).join(', ');
            const s2=ta.selectionStart,en=ta.selectionEnd,cur=ta.value;
            ta.value=cur.slice(0,s2)+cleaned+cur.slice(en);randRows[ri][c.key]=ta.value;}
        });
        td.appendChild(ta);
      }
      tr.appendChild(td);
    });
    const tdD=document.createElement('td');const delB=document.createElement('button');delB.className='row-del';delB.textContent='✕';
    delB.onclick=()=>{if(randRows.length<=1){showToast('최소 1행 필요');return;}randRows.splice(ri,1);renderRandGrid();};
    tdD.appendChild(delB);tr.appendChild(tdD);
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);wrap.appendChild(tbl);
  setTimeout(()=>{wrap.querySelectorAll('textarea').forEach(ta=>{ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';});},0);
}
function handleRandPaste(raw,startRi,startCol){
  const cols=getRandCols(curRandSubj);
  const rows=raw.replace(/\r\n/g,'\n').replace(/\r/g,'\n').trimEnd().split('\n').map(line=>line.split('\t').map(c=>c.trim()));
  while(randRows.length<startRi+rows.length)randRows.push(emptyRandRow());
  rows.forEach((cells,dr)=>{const ri=startRi+dr;cells.forEach((val,dc)=>{const ci=startCol+dc;if(ci>=cols.length)return;const col=cols[ci];if(col.type==='ch')randRows[ri].ch=val;else randRows[ri][col.key]=val;});});
  renderRandGrid();showToast('✅ '+rows.length+'행 붙여넣기 완료');
}
function addRandRow(){
  randRows.push(emptyRandRow());renderRandGrid();
  setTimeout(()=>{const rows=document.querySelectorAll('#rand-grid-wrap tbody tr');if(rows.length)rows[rows.length-1].scrollIntoView({behavior:'smooth'});},50);
}

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

function runRandom(){
  const cols=getRandCols(curRandSubj);
  const probCols=cols.filter(c=>c.type==='prob');
  const chapters=[];let totalCount=0;
  for(let ri=0;ri<randRows.length;ri++){
    const row=randRows[ri];const types=[];
    probCols.forEach(c=>{const nums=parseNums(row[c.key]);if(nums.length){types.push({key:c.key,label:c.label,nums});totalCount+=nums.length;}});
    if(!types.length)continue;
    chapters.push({ch:row.ch||('장 '+(ri+1)),ci:ri,types});
  }
  if(!totalCount){showToast('문제번호를 입력해주세요');return;}
  const days=parseInt(document.getElementById('rand-days').value)||8;

  // 모든 문제 풀 + 셔플
  const pool=[];
  chapters.forEach(ch=>{ch.types.forEach(tp=>{
    const arr=tp.nums.map(num=>({ci:ch.ci,ch:ch.ch,num,typeKey:tp.key,typeLabel:tp.label}));
    for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
    arr.forEach(p=>pool.push(p));
  });});

  // 일차 버킷
  const perDay=Math.floor(totalCount/days),extra=totalCount%days;
  const buckets=[];
  for(let d=0;d<days;d++)buckets.push({day:d+1,cap:perDay+(d<extra?1:0),items:[],chCounts:{}});

  // 장별 큐 — 문제 수 많은 장 먼저 (분산 효과 ↑)
  const queues={};chapters.forEach(ch=>{queues[ch.ci]=pool.filter(p=>p.ci===ch.ci);});
  const chOrder=[...chapters].sort((a,b)=>{
    const aL=a.types.reduce((s,t)=>s+t.nums.length,0);
    const bL=b.types.reduce((s,t)=>s+t.nums.length,0);
    return bL-aL;
  });

  // 장별 평균 간격(spacing) 계산: days / chapter문제수
  // (장 문제수가 적을수록 간격을 멀리 두는 게 좋음)

  // 점수 계산 함수: 낮을수록 좋음
  function scoreBucket(bucket, ci, idx){
    if(bucket.items.length>=bucket.cap)return Infinity; // 가득
    let score=0;
    // 1) 같은 일차 같은 장: 매우 큰 페널티
    if(bucket.chCounts[ci])score+=1000*bucket.chCounts[ci];
    // 2) 인접 일차 페널티 (±1: 큰, ±2: 중간, ±3: 작은)
    const offsets=[[1,300],[2,80],[3,20]];
    offsets.forEach(([off,pen])=>{
      const prev=buckets[idx-off];const next=buckets[idx+off];
      if(prev&&prev.chCounts[ci])score+=pen*prev.chCounts[ci];
      if(next&&next.chCounts[ci])score+=pen*next.chCounts[ci];
    });
    // 3) 균등: 덜 찬 일차 선호 (매우 작은 가중치)
    score+=bucket.items.length*2;
    return score;
  }

  // 각 장별로 문제 하나씩 라운드로빈으로 배치 (동시에 여러 장 진행 → 자연스러운 분산)
  const remaining = chOrder.map(ch => ({ ci: ch.ci, queue: [...queues[ch.ci]] }));
  while(remaining.some(r=>r.queue.length>0)){
    for(const r of remaining){
      if(!r.queue.length)continue;
      const prob=r.queue.shift();
      // 모든 버킷의 점수를 계산하고 최저 점수 버킷 선택
      let bestScore=Infinity;let candidates=[];
      buckets.forEach((b,idx)=>{
        const sc=scoreBucket(b,r.ci,idx);
        if(sc<bestScore){bestScore=sc;candidates=[idx];}
        else if(sc===bestScore){candidates.push(idx);}
      });
      if(!candidates.length)continue;
      // 동점 시 랜덤
      const pickIdx=candidates[Math.floor(Math.random()*candidates.length)];
      const pick=buckets[pickIdx];
      pick.items.push(prob);
      pick.chCounts[r.ci]=(pick.chCounts[r.ci]||0)+1;
    }
  }

  const dayAssign=[];
  buckets.forEach(b=>{b.items.forEach(p=>{dayAssign.push({...p,day:b.day});});});

  randResult=[];
  chapters.forEach(ch=>{
    const typeResults=[];
    ch.types.forEach(tp=>{const items=dayAssign.filter(p=>p.ci===ch.ci&&p.typeKey===tp.key).sort((a,b)=>a.num-b.num);typeResults.push({key:tp.key,label:tp.label,items});});
    randResult.push({ch:ch.ch,ci:ch.ci,typeResults});
  });
  renderRandResult(days,dayAssign);
  document.getElementById('rand-result-area').style.display='block';
  showToast('✅ '+totalCount+'문제 → '+days+'일에 배정 완료');
}

function renderRandResult(days,dayAssign){
  const probCols=getRandCols(curRandSubj).filter(c=>c.type==='prob');
  const wrap=document.getElementById('rand-result-grid');wrap.innerHTML='';
  const tbl=document.createElement('table');tbl.className='ss-table';
  const thead=document.createElement('thead');const htr=document.createElement('tr');
  const thN=document.createElement('th');thN.style.minWidth='36px';thN.textContent='#';htr.appendChild(thN);
  const thCh=document.createElement('th');thCh.textContent='장 이름';htr.appendChild(thCh);
  probCols.forEach(c=>{const th=document.createElement('th');th.style.minWidth='160px';if(c.color){const sp=document.createElement('span');sp.className='type-badge '+c.color;sp.textContent=c.label+' 결과';th.appendChild(sp);}else th.textContent=c.label+' 결과';htr.appendChild(th);});
  const thC=document.createElement('th');thC.textContent='복사';thC.style.minWidth='52px';htr.appendChild(thC);
  thead.appendChild(htr);tbl.appendChild(thead);
  const tbody=document.createElement('tbody');
  randResult.forEach((r,ri)=>{
    const tr=document.createElement('tr');
    const tdN=document.createElement('td');tdN.className='row-num';tdN.textContent=ri+1;tr.appendChild(tdN);
    const tdCh=document.createElement('td');tdCh.style.cssText='padding:8px 10px;font-size:12px;font-weight:500;';tdCh.textContent=r.ch;tr.appendChild(tdCh);
    probCols.forEach(c=>{
      const tdR=document.createElement('td');tdR.style.cssText='padding:8px 10px;font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--text);line-height:1.7;';
      const tr2=r.typeResults.find(t=>t.key===c.key);
      tdR.textContent=tr2?tr2.items.map(p=>p.num+'('+p.day+')').join(', '):'';
      tr.appendChild(tdR);
    });
    const tdC=document.createElement('td');tdC.style.textAlign='center';
    const cpBtn=document.createElement('button');cpBtn.className='row-del';cpBtn.textContent='📋';cpBtn.title='이 행 복사';cpBtn.style.cssText='color:var(--accent);font-size:14px;';
    const rowText=r.ch+'\t'+probCols.map(c=>{const tr2=r.typeResults.find(t=>t.key===c.key);return tr2?tr2.items.map(p=>p.num+'('+p.day+')').join(', '):'';}).join('\t');
    cpBtn.onclick=()=>{copyText(rowText,r.ch+' 복사됨');};
    tdC.appendChild(cpBtn);tr.appendChild(tdC);
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);wrap.appendChild(tbl);

  const dist={};dayAssign.forEach(p=>{if(!dist[p.day])dist[p.day]=[];dist[p.day].push(p);});
  let html='<div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:8px;">일차별 분포</div>';
  html+='<div style="display:flex;flex-wrap:wrap;gap:6px;">';
  for(let d=1;d<=days;d++){
    const items=dist[d]||[];
    // ci(입력 순서)로 그룹 정렬
    const chCountsArr=[];const chSeen={};
    items.forEach(p=>{
      if(chSeen[p.ci]===undefined){chSeen[p.ci]=chCountsArr.length;chCountsArr.push({ci:p.ci,ch:p.ch,cnt:1});}
      else chCountsArr[chSeen[p.ci]].cnt++;
    });
    chCountsArr.sort((a,b)=>a.ci-b.ci);
    html+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r);padding:8px 10px;min-width:70px;">';
    html+='<div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:3px;">'+d+'일차 <span style="color:var(--text3);font-weight:400;">'+items.length+'문제</span></div>';
    html+='<div style="font-size:10px;color:var(--text2);font-family:\'JetBrains Mono\',monospace;line-height:1.5;">';
    chCountsArr.forEach(({ch,cnt})=>{html+=escapeHtml(ch)+' ×'+cnt+'<br>';});
    html+='</div></div>';
  }
  html+='</div>';
  document.getElementById('rand-preview').innerHTML=html;
}

function copyRandAll(){
  if(!randResult.length){showToast('먼저 랜덤 배정을 실행해주세요');return;}
  const probCols=getRandCols(curRandSubj).filter(c=>c.type==='prob');
  const rows=randResult.map(r=>r.ch+'\t'+probCols.map(c=>{const tr=r.typeResults.find(t=>t.key===c.key);return tr?tr.items.map(p=>p.num+'('+p.day+')').join(', '):'';}).join('\t'));
  copyText(rows.join('\n'),'복사 완료');
}




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
  ['#','과목 ID','과목 이름','색상','문제 유형','삭제'].forEach((label,i)=>{
    const th = document.createElement('th');
    th.textContent = label;
    if(i===0) th.style.minWidth='36px';
    if(i===4) th.style.minWidth='200px';
    if(i===5) th.style.minWidth='44px';
    htr.appendChild(th);
  });
  thead.appendChild(htr);tbl.appendChild(thead);
  const tbody = document.createElement('tbody');
  subjEditRows.forEach((row,ri)=>{
    const tr = document.createElement('tr');
    // #
    const tdN = document.createElement('td');tdN.className='row-num';tdN.textContent=ri+1;tr.appendChild(tdN);
    // ID
    const tdId = document.createElement('td');tdId.className='cell-ch';
    const inpId = document.createElement('input');inpId.value=row.id;inpId.placeholder='영문 ID';
    inpId.style.fontFamily="'JetBrains Mono',monospace";inpId.style.fontSize='11px';
    inpId.addEventListener('input',()=>{subjEditRows[ri].id=inpId.value.replace(/[^a-z0-9_]/g,'');inpId.value=subjEditRows[ri].id;});
    tdId.appendChild(inpId);tr.appendChild(tdId);
    // 이름
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
    // 과목 ID
    const inps=tr.querySelectorAll('input');
    if(inps[0])subjEditRows[ri].id=inps[0].value;
    if(inps[1])subjEditRows[ri].name=inps[1].value;
    // 색상
    const sels=tr.querySelectorAll('select');
    if(sels[0])subjEditRows[ri].color=sels[0].value;
    // 유형 칩들 — 유형명 input과 색상 select
    const chips=tr.querySelectorAll('td:nth-child(5) > div > div'); // tdT 안의 chip div
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
  rebuildUI();
  renderSubjGrid(true);

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
    `✓ 완료: ${completedCount}문제 (순서 유지 — 제자리에 남음)<br>` +
    `🔄 남은 문제(미완료): ${undoneCount}문제 → 하루 정한 개수만큼 채움`;

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

// 새 일차 배정 계산
// 원래 순서(seq)를 그대로 유지하며 일차 경계만 다시 긋는다.
// - 한 일차가 미완료 perDay개를 채우면 다음 일차로 넘어감 (완료 문제는 개수에 안 셈)
// - 아직 미완료가 하나도 없는데 완료만 perDay개 쌓이면 다음 일차로 분리 (완료 일차 → 특정 일차 비대화 방지)
function computeReschedule(perDay){
  if(!rescheduleData)return null;
  const pd = Math.max(1, perDay|0);

  let newDay = 1, undoneInDay = 0, totalInDay = 0;
  const assign = rescheduleData.seq.map(p => {
    if(undoneInDay >= pd || (undoneInDay === 0 && totalInDay >= pd)){
      newDay++; undoneInDay = 0; totalInDay = 0;
    }
    totalInDay++;
    if(!p.done) undoneInDay++;
    return {...p, oldDay: p.day, newDay};
  });

  // 새 일차별 그룹 → 완료만 있는 일차 = 잠금(locked)
  const dayGroups = {};
  assign.forEach(p => { (dayGroups[p.newDay] = dayGroups[p.newDay] || []).push(p); });
  const lockedDays = new Set(
    Object.keys(dayGroups)
      .filter(d => dayGroups[d].every(p => p.done))
      .map(Number)
  );

  return {
    assign,
    dayGroups,
    lockedDays,
    totalDays: assign.length ? Math.max(...assign.map(a => a.newDay)) : 0
  };
}

function updateReschedulePreview(){
  const perDay = parseInt(document.getElementById('reschedule-per-day').value) || 1;
  const result = computeReschedule(perDay);
  if(!result){document.getElementById('reschedule-preview').innerHTML = '';return;}

  const {dayGroups, lockedDays, totalDays} = result;
  const days = [];
  for(let d=1; d<=totalDays; d++) days.push(d);

  let html = `<div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:8px;">미리보기 — 총 ${totalDays}일 (하루 미완료 ${Math.max(1,perDay)}문제)</div>`;
  html += '<div style="display:flex;flex-direction:column;gap:4px;">';
  days.forEach(d => {
    const probs = (dayGroups[d] || []).slice();
    const isLocked = lockedDays.has(d);
    const undoneN = probs.filter(p=>!p.done).length;
    let bg, border;
    if(isLocked){bg='var(--bg3)'; border='var(--border2)';}
    else {bg='var(--bg)'; border='var(--accent)';}
    html += `<div style="background:${bg};border:1px solid ${border};border-radius:4px;padding:6px 10px;display:flex;gap:10px;align-items:flex-start;">`;
    html += `<div style="font-size:11px;font-weight:600;color:var(--text);min-width:42px;">${isLocked?'🔒':''} ${d}일</div>`;
    html += `<div style="flex:1;font-size:10px;color:var(--text2);font-family:'JetBrains Mono',monospace;line-height:1.6;">`;
    // seq 순서 유지 (day → ci → num). 같은 일차 내에서는 ci→num으로 표시.
    probs.sort((a,b)=>{if(a.ci!==b.ci)return a.ci-b.ci;return a.num-b.num;});
    html += probs.map(p => {
      const txt = `${escapeHtml(p.ch)}-${p.num}`;
      if(p.done)return `<span style="color:var(--cost);text-decoration:line-through;opacity:.6;" title="완료">${txt}</span>`;
      return txt;
    }).join(', ');
    html += `</div>`;
    html += `<div style="font-size:10px;color:var(--text3);text-align:right;min-width:56px;">${probs.length}문제${isLocked?'':`<br><span style="color:var(--accent);">미완료 ${undoneN}</span>`}</div>`;
    html += `</div>`;
  });
  html += '</div>';
  // 범례
  html += '<div style="margin-top:8px;font-size:10px;color:var(--text3);display:flex;gap:12px;flex-wrap:wrap;">';
  html += '<span>🔒 완료된 일차</span>';
  html += '<span style="color:var(--cost);text-decoration:line-through;">완료 문제 (순서 그대로)</span>';
  html += '</div>';
  document.getElementById('reschedule-preview').innerHTML=html;
}

async function applyReschedule(){
  const perDay = parseInt(document.getElementById('reschedule-per-day').value) || 1;
  const result = computeReschedule(perDay);
  if(!result){showToast('계산 실패');return;}

  const undoneN = result.assign.filter(p=>!p.done).length;
  if(!undoneN){showToast('재배치할 미완료 문제가 없어요');return;}

  if(!confirm(`정말 변경할까요?\n${rescheduleData.subjName}: 미완료 ${undoneN}문제를 하루 ${Math.max(1,perDay)}문제씩 다시 배치합니다.\n• 문제 순서는 그대로 유지 (완료 문제도 제자리)\n• 총 ${result.totalDays}일 계획`))return;

  // DATA[subjId]의 모든 문제 일차 업데이트 (순서 유지 재배치)
  const subjId = rescheduleData.subjId;
  const data = DATA[subjId];
  if(!data){showToast('데이터를 찾을 수 없어요');return;}

  // 키: "ci|colKey|num" → newDay (완료·미완료 모두)
  const map = {};
  result.assign.forEach(p => {
    map[`${p.ci}|${p.colKey}|${p.num}`] = p.newDay;
  });

  data.forEach((ch, ci) => {
    Object.keys(ch).forEach(key => {
      if(key === 'ch')return;
      if(!Array.isArray(ch[key]))return;
      ch[key] = ch[key].map(pair => {
        const newDay = map[`${ci}|${key}|${pair[0]}`];
        return newDay !== undefined ? [pair[0], newDay] : pair;
      });
    });
  });

  syncLegacy();
  await saveAllSubjData();
  buildMaps();
  buildDG();
  if(curView==='chap')renderChaps();
  updateProgress();
  curDay=null;
  const dp=document.getElementById('dpanel');dp.classList.remove('on');dp.innerHTML='';

  closeRescheduleModal();
  showToast(`✅ 미완료 ${undoneN}문제 재배치 완료 (총 ${result.totalDays}일)`);
}

function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2500);}

// ══════════════════════════════════════════
// 더미 데이터 (data.json 로드 실패 시 폴백)
// [문제번호, 일차] 형식
// ══════════════════════════════════════════
const DEMO_FIN=[
  {ch:'4장 재고자산',
    t:[[1,1],[2,1],[3,2],[4,3]],
    b:[[1,1],[2,1],[3,2],[4,2],[5,3],[6,3]],
    a:[[1,2],[2,3],[3,4]]},
  {ch:'6장 유형자산',
    t:[[1,2],[2,3],[3,4]],
    b:[[1,2],[2,3],[3,4],[4,5]],
    a:[[1,3],[2,5]]},
  {ch:'8장 무형자산',
    t:[[1,4],[2,5]],
    b:[[1,4],[2,5],[3,6]],
    a:[[1,5],[2,6]]},
  {ch:'10장 금융부채',
    t:[[1,5],[2,6],[3,7]],
    b:[[1,6],[2,6],[3,7],[4,7]],
    a:[[1,7],[2,8]]},
  {ch:'12장 충당부채',
    t:[[1,7],[2,8]],
    b:[[1,7],[2,8],[3,8]],
    a:[[1,8]]},
];
const DEMO_COST=[
  {ch:'2장 원가배분',p:[[1,1],[2,1],[3,2],[4,2],[5,3]]},
  {ch:'4장 종합원가',p:[[1,2],[2,3],[3,3],[4,4],[5,4]]},
  {ch:'6장 표준원가',p:[[1,4],[2,5],[3,5],[4,6],[5,6]]},
  {ch:'8장 변동원가',p:[[1,6],[2,7],[3,7],[4,8]]},
];
const DEMO_TAX=[
  {ch:'부-1장 과세거래',
    th:[[1,1],[2,1],[3,2]],
    ca:[[1,1],[2,2],[3,3]]},
  {ch:'부-2장 영세율·면세',
    th:[[1,2],[2,3]],
    ca:[[1,3],[2,4]]},
  {ch:'부-3장 납부세액',
    th:[[1,3],[2,4]],
    ca:[[1,4],[2,5]]},
  {ch:'법-1장 세무조정',
    th:[[1,4],[2,5],[3,5]],
    ca:[[1,5],[2,6]]},
  {ch:'법-2장 소득처분',
    th:[[1,5],[2,6]],
    ca:[[1,6],[2,7]]},
  {ch:'소-1장 종합소득',
    th:[[1,6],[2,7],[3,7]],
    ca:[[1,7],[2,8]]},
  {ch:'소-2장 퇴직소득',
    th:[[1,7],[2,8]],
    ca:[[1,8],[2,8]]},
];
const DEMO_GIB=[
  {ch:'1장 총칙',t:[[1,1],[2,1],[3,2],[4,3]]},
  {ch:'2장 국세부과의 원칙',t:[[1,2],[2,3],[3,4]]},
  {ch:'3장 납세의무',t:[[1,3],[2,4],[3,5],[4,5]]},
  {ch:'4장 조세채권 보전',t:[[1,4],[2,5],[3,6]]},
  {ch:'5장 과세와 환급',t:[[1,6],[2,7],[3,7],[4,8]]},
  {ch:'6장 심사와 심판',t:[[1,6],[2,7],[3,8]]},
];
const DEMO_JING=[
  {ch:'1장 총칙',t:[[1,1],[2,2],[3,3]]},
  {ch:'2장 임의적 징수유예',t:[[1,2],[2,3],[3,4]]},
  {ch:'3장 체납처분',t:[[1,3],[2,4],[3,5],[4,6]]},
  {ch:'4장 보칙',t:[[1,5],[2,6],[3,7]]},
];
const DEMO_BEOL=[
  {ch:'1장 조세범 처벌',t:[[1,1],[2,2],[3,3],[4,4]]},
  {ch:'2장 조세범 처벌절차',t:[[1,3],[2,5],[3,6]]},
];

// ══════════════════════════════════════════
// 데이터 로드
// ══════════════════════════════════════════
async function fetchData(){
  try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),3000);
    const res=await fetch('./data.json',{signal:controller.signal});
    clearTimeout(timeout);
    if(!res.ok)throw new Error('HTTP '+res.status);
    const d=await res.json();
    // SUBJECTS 기준으로만 데이터 로드 (삭제된 과목은 무시)
    SUBJECTS.forEach(s=>{
      DEFAULTS[s.id]=d[s.dataKey]||[];
      DATA[s.id]=JSON.parse(JSON.stringify(DEFAULTS[s.id]));
    });
    syncLegacy();
    const totalChs=SUBJECTS.reduce((acc,s)=>acc+(DATA[s.id]||[]).length,0);
    if(totalChs===0)throw new Error('빈 데이터');
    console.log('✅ data.json 로드 완료 —', SUBJECTS.map(s=>s.name+' '+(DATA[s.id]||[]).length+'장').join(', '));
  }catch(e){
    console.warn('⚠️ data.json 로드 실패, 더미 데이터로 대체:', e.message);
    DF=JSON.parse(JSON.stringify(DEMO_FIN));
    DC=JSON.parse(JSON.stringify(DEMO_COST));
    DTAX=JSON.parse(JSON.stringify(DEMO_TAX));
    DGIB=JSON.parse(JSON.stringify(DEMO_GIB));
    DJING=JSON.parse(JSON.stringify(DEMO_JING));
    DBEOL=JSON.parse(JSON.stringify(DEMO_BEOL));
    // SUBJECTS 기준으로 동적 데이터 채우기 (데모 데이터 매핑)
    const demoMap={fin:DEMO_FIN,cost:DEMO_COST,tax:DEMO_TAX,gib:DEMO_GIB,jing:DEMO_JING,beol:DEMO_BEOL};
    SUBJECTS.forEach(s=>{
      const demo=demoMap[s.id]||[];
      DEFAULTS[s.id]=JSON.parse(JSON.stringify(demo));
      DATA[s.id]=JSON.parse(JSON.stringify(demo));
    });
    syncLegacy();
  }
}
async function init(){
  applyThemeIcon();
  try{ const t=await idbGet('app_title'); if(typeof t==='string'&&t.trim()) appTitle=t.trim(); }catch(_){}
  renderAppTitle();
  await loadSubjectsConfig();
  await fetchData();
  await loadData();
  await loadState();
  // 데이터가 여전히 비어 있으면 더미로 강제 세팅
  const totalChs = SUBJECTS.reduce((acc,s)=>acc+(DATA[s.id]||[]).length,0);
  const usedDemo = totalChs===0;
  if(usedDemo){
    const demoMap={fin:DEMO_FIN,cost:DEMO_COST,tax:DEMO_TAX,gib:DEMO_GIB,jing:DEMO_JING,beol:DEMO_BEOL};
    SUBJECTS.forEach(s=>{
      const demo=demoMap[s.id]||[];
      DATA[s.id]=JSON.parse(JSON.stringify(demo));
      DEFAULTS[s.id]=JSON.parse(JSON.stringify(demo));
    });
    syncLegacy();
  }
  buildMaps();
  const now=new Date();document.getElementById('today-date').textContent=`${now.getFullYear()}. ${now.getMonth()+1}. ${now.getDate()}`;
  buildDG();updateProgress();
  renderStudyTabs();renderProgressCards();renderFooterBtns();updateProgress();
  document.getElementById('hdr-sub-names').textContent=SUBJECTS.map(s=>s.name).join(' · ');
  // 더미 데이터 사용 시 안내 (UI 렌더 후 표시)
  if(usedDemo||DF===DEMO_FIN)setTimeout(()=>showToast('📦 더미 데이터로 실행 중 — data.json을 확인해주세요'),500);
}
// 클라우드 동기화 모듈이 최초 로드 완료를 기다릴 수 있도록 promise를 노출
window.__appReady = init();
