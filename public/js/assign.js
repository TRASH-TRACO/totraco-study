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
      const pid=(Array.isArray(p)&&p[2])||newPid();
      return [num, dayOf.get(ci+'|'+c.key+'|'+num)||0, pid];
    });
  }));

  // 재수강(다시풀기)은 유지 — 새 배정된 일차 + 7로 다시 앵커링하고 캐스케이드 재적용
  const _sr=RETRIES.filter(r=>r.subj===subj.id);
  delete RETRY_BASE[subj.id];
  if(_sr.length){
    _sr.forEach(r=>{
      const col=subj.cols.find(c=>colKeyToType(subj.id,c.key)===r.type);
      const nd=col?dayOf.get(r.ci+'|'+col.key+'|'+r.num):undefined;
      r.day=((nd&&nd>=1)?nd:1)+RETRY_OFFSET;
    });
    const base={};
    data.forEach(ch=>subj.cols.forEach(c=>{ (ch[c.key]||[]).forEach(p=>{ if(Array.isArray(p)&&p[2])base[p[2]]=p[1]; }); }));
    RETRY_BASE[subj.id]=base;
    applyRetrySchedule(subj.id);
  }
  await saveRetries();

  syncLegacy();
  await saveAllSubjData();
  buildMaps();buildDG();updateProgress();
  renderStudyTabs();renderProgressCards();
  buildEdRows();if(curNav==='setup'&&curEdMode==='grid')renderEdGrid();
  refreshOnboarding();updateEmptyStates();renderAssignInfo();applyEdSection();
  if(window.CloudSync&&window.CloudSync.schedulePush)window.CloudSync.schedulePush();
  // 배정 직후 자가 점검 — 모든 문제가 일차(1..N)에 들어갔는지 대사한다
  const audit=assignmentAudit(subj.id);
  if(audit.onDays===total && audit.ok){
    showToast(`✅ ${total}문제 모두 ${days}일에 배정 (누락 0)`);
  }else{
    showToast(`⚠️ 배정 점검 실패 — 전체 ${total} 중 일차 ${audit.onDays} (누락 ${total-audit.onDays})`);
    console.warn('[assign] 누락 감지', audit);
  }
}
window.runAssign=runAssign;

// ── 배정 대사(점검) ──────────────────────────
// 전체 문제가 모두 어딘가에 들어가 있는지 확인한다:
//   일차 배정(1..N) + 완료 묶음(일차 0) + 미뤄둠(POSTPONE_DAY) = 전체
// 누락(이상한 일차값)·완료 묶음에 섞인 미완료 문제를 잡아낸다. ok면 누락 0.
function assignmentAudit(subjId){
  const subj=SUBJECTS.find(s=>s.id===subjId);
  const data=subj?(DATA[subjId]||[]):[];
  let total=0,onDays=0,doneBucket=0,doneBucketUndone=0,postponed=0,orphan=0;
  data.forEach((ch,ci)=>(subj?subj.cols:[]).forEach(c=>{
    (ch[c.key]||[]).forEach(p=>{
      total++;
      const d=Array.isArray(p)?p[1]:0;
      const done=dn(subjId,ci,colKeyToType(subjId,c.key),Array.isArray(p)?p[0]:p);
      if(d===POSTPONE_DAY)postponed++;
      else if(d===0){ doneBucket++; if(!done)doneBucketUndone++; }   // 완료 묶음. 미완료가 여기 있으면 이상(누락 징후)
      else if(d>=1)onDays++;
      else orphan++;   // 음수 등 이상 일차값
    });
  }));
  const accounted=onDays+doneBucket+postponed+orphan;   // 모든 문제는 셋 중 하나 (합계는 항상 total)
  return {total,onDays,doneBucket,doneBucketUndone,postponed,orphan,accounted,
    ok: orphan===0 && doneBucketUndone===0 && accounted===total};
}

/** 배정 섹션 상단 요약 + 일차별 분포 미리보기 */
function renderAssignInfo(){
  renderEdSubjTabs();   // 배정 뱃지(배정/전체)를 최신 상태로
  const sum=document.getElementById('assign-summary');
  if(!sum) return;
  const subj=SUBJECTS.find(s=>s.id===curEdSubj);
  const data=subj?(DATA[subj.id]||[]):[];
  const audit=subj?assignmentAudit(subj.id):{total:0,onDays:0,doneBucket:0,doneBucketUndone:0,postponed:0,orphan:0,ok:true};
  const total=audit.total;
  const nDays=(function(){const s=new Set();data.forEach(ch=>(subj?subj.cols:[]).forEach(c=>(ch[c.key]||[]).forEach(p=>{const d=Array.isArray(p)?p[1]:0;if(d>=1&&d!==POSTPONE_DAY)s.add(d);})));return s.size;})();

  if(!subj){ sum.innerHTML='과목을 먼저 등록해주세요.'; }
  else if(total===0){ sum.innerHTML='이 과목에 등록된 문제가 없습니다. 위에서 문제를 먼저 저장하세요.'; }
  else if(audit.onDays===0 && !audit.doneBucket && !audit.postponed){
    sum.innerHTML=`${escapeHtml(subj.name)} · 문제 ${total}개 — 아직 일차가 배정되지 않았습니다.`;
  } else {
    const parts=[`${nDays}일에 배정 <b>${audit.onDays}</b>`];
    if(audit.doneBucket)parts.push(`완료 묶음 ${audit.doneBucket}`);
    if(audit.postponed)parts.push(`미뤄둠 ${audit.postponed}`);
    const badge = audit.ok
      ? `<span class="audit-ok">✅ 전체 ${total}문제 모두 확인 · 누락 0</span>`
      : `<span class="audit-warn">⚠️ 확인 필요${audit.orphan?` · 사라진 문제 ${audit.orphan}`:''}${audit.doneBucketUndone?` · 완료묶음에 미완료 ${audit.doneBucketUndone}`:''}</span>`;
    sum.innerHTML=`${escapeHtml(subj.name)} · 전체 <b>${total}</b>문제 = ${parts.join(' · ')}<br>${badge}`;
  }

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
    // 색상 (팝오버 팔레트)
    const tdC = document.createElement('td');tdC.style.padding='4px 8px';
    tdC.appendChild(colorTrigger(row.color, id=>{ subjEditRows[ri].color=id; renderSubjGrid(); }));
    tr.appendChild(tdC);
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

    // 색상 스와치 (텍스트 셀렉트 대신 팔레트)
    const clsWrap = document.createElement('div');
    clsWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;align-items:center;';
    TYPE_COLORS.forEach(tc => {
      clsWrap.appendChild(swatchBtn('var('+tc.v+')', tc.id===col.cls,
        () => { subjEditRows[ri].cols[ci].cls = tc.id; renderSubjGrid(); }, '', true));
    });
    chip.appendChild(clsWrap);

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
    // 과목 이름만 DOM에서 동기화. 색상/유형색은 스와치 클릭 때 subjEditRows에 이미 반영됨(select 아님).
    const inps=tr.querySelectorAll('input');
    if(inps[0])subjEditRows[ri].name=inps[0].value;
    // 유형명(라벨) input만 동기화
    const chips=tr.querySelectorAll('td:nth-child(4) > div > div'); // tdT(문제 유형) 안의 chip div
    chips.forEach((chip,ci)=>{
      if(!subjEditRows[ri].cols[ci])return;
      const lblIn=chip.querySelector('input');
      if(lblIn)subjEditRows[ri].cols[ci].label=lblIn.value;
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

// 유형(문제 유형) 색상 팔레트 — 칩/뱃지 CSS 클래스와 매칭(테마 변수 사용)
const TYPE_COLORS=[
  {id:'th',v:'--theory'},{id:'ba',v:'--cost'},{id:'av',v:'--fin'},{id:'ca',v:'--tax'},
  {id:'gib',v:'--gib'},{id:'jing',v:'--jing'},{id:'beol',v:'--beol'},{id:'si',v:'--text3'}
];
// 색상 스와치 버튼 하나
function swatchBtn(bg,selected,onclick,title,small){
  const b=document.createElement('button');b.type='button';
  b.className='sw'+(small?' sw-sm':'')+(selected?' on':'');
  b.style.background=bg; if(title)b.title=title; b.onclick=onclick; return b;
}

// ── 색상 팝오버 (과목 색상 — 그리드 팔레트) ──────────
// body에 붙여(포털) 모달/그리드 어디서 열어도 잘리지 않게 한다.
let _colorPop=null;
function closeColorPop(){
  if(_colorPop){ _colorPop.remove(); _colorPop=null; }
  document.removeEventListener('mousedown',_colorPopOutside,true);
  window.removeEventListener('resize',closeColorPop);
}
function _colorPopOutside(e){
  if(_colorPop && !_colorPop.contains(e.target) && !(_colorPop._trigger&&_colorPop._trigger.contains(e.target))) closeColorPop();
}
function openColorPop(trigger,currentId,onPick){
  closeColorPop();
  const pop=document.createElement('div');pop.className='color-pop';pop._trigger=trigger;
  const hd=document.createElement('div');hd.className='color-pop-hd';hd.textContent='색상 선택';pop.appendChild(hd);
  const grid=document.createElement('div');grid.className='color-pop-grid';
  COLOR_PALETTE.forEach(cp=>{
    grid.appendChild(swatchBtn(cp.c, cp.id===currentId, ()=>{ closeColorPop(); onPick(cp.id); }, cp.label));
  });
  pop.appendChild(grid);
  document.body.appendChild(pop);
  const r=trigger.getBoundingClientRect(), pw=pop.offsetWidth, ph=pop.offsetHeight;
  let left=Math.min(r.left, window.innerWidth-8-pw); if(left<8)left=8;
  let top=r.bottom+6; if(top+ph>window.innerHeight-8) top=Math.max(8, r.top-6-ph);
  pop.style.left=left+'px'; pop.style.top=top+'px';
  _colorPop=pop;
  setTimeout(()=>{ document.addEventListener('mousedown',_colorPopOutside,true); window.addEventListener('resize',closeColorPop); },0);
}
// 현재 색을 보여주는 트리거(누르면 팝오버 그리드)
function colorTrigger(currentId,onPick){
  const cp=COLOR_PALETTE.find(c=>c.id===currentId)||COLOR_PALETTE[0];
  const b=document.createElement('button');b.type='button';b.className='color-trigger';b.title=cp.label;
  b.innerHTML='<span class="ct-dot" style="background:'+cp.c+'"></span><span class="ct-chev">▾</span>';
  b.onclick=e=>{ e.stopPropagation(); openColorPop(b,currentId,onPick); };
  return b;
}

// ── 새 과목 추가 모달 (즉시 저장 · 문제집 불러오기 내장) ─────────────
let nsMode='manual';        // 'manual' | 'book'
let nsColorId=null;         // 선택한 과목 색상
let nsTypes=[];             // [{key,label,cls}]
function openNewSubjectModal(){
  const used=SUBJECTS.map(s=>s.color);
  nsColorId=(COLOR_PALETTE.find(c=>!used.includes(c.id))||COLOR_PALETTE[0]).id;
  nsTypes=JSON.parse(JSON.stringify(COL_PRESETS[1].cols));   // 이론+기본+심화 기본
  document.getElementById('ns-name').value='';
  // 문제집 검색 상태 초기화
  selectedBookId=null;
  const bs=document.getElementById('book-search'); if(bs)bs.value='';
  const bp=document.getElementById('book-preview'); if(bp)bp.innerHTML='';
  nsRenderColors(); nsRenderPresets(); nsRenderTypes();
  nsSetMode('manual');
  document.getElementById('newsubj-modal').style.display='flex';
  setTimeout(()=>{const n=document.getElementById('ns-name');if(n)n.focus();},50);
}
function closeNewSubjectModal(){
  const m=document.getElementById('newsubj-modal'); if(m)m.style.display='none';
}
function nsSetMode(m){
  nsMode=m;
  document.getElementById('ns-mode-manual').classList.toggle('on',m==='manual');
  document.getElementById('ns-mode-book').classList.toggle('on',m==='book');
  document.getElementById('ns-manual').style.display=m==='manual'?'block':'none';
  document.getElementById('ns-book').style.display=m==='book'?'block':'none';
  const cb=document.getElementById('ns-confirm');
  if(m==='book'){ renderBookList(); cb.textContent='이 문제집 불러오기'; cb.disabled=!selectedBookId; }
  else { cb.textContent='추가'; cb.disabled=false; }
}
function nsRenderColors(){
  const con=document.getElementById('ns-color-swatches'); if(!con)return; con.innerHTML='';
  con.appendChild(colorTrigger(nsColorId, id=>{ nsColorId=id; nsRenderColors(); }));
}
function nsRenderPresets(){
  const con=document.getElementById('ns-preset-row'); if(!con)return; con.innerHTML='';
  COL_PRESETS.forEach(cp=>{
    const b=document.createElement('button');b.type='button';b.className='ns-preset-btn';b.textContent=cp.label;
    b.onclick=()=>{ nsTypes=JSON.parse(JSON.stringify(cp.cols)); nsRenderTypes(); };
    con.appendChild(b);
  });
}
function nsRenderTypes(){
  const con=document.getElementById('ns-types'); if(!con)return; con.innerHTML='';
  nsTypes.forEach((t,i)=>{
    const row=document.createElement('div');row.className='ns-type';
    const inp=document.createElement('input');inp.value=t.label;inp.placeholder='유형명';inp.className='ns-type-name';
    inp.oninput=()=>{ nsTypes[i].label=inp.value; };
    row.appendChild(inp);
    const sw=document.createElement('div');sw.className='ns-type-sw';
    TYPE_COLORS.forEach(tc=>{
      sw.appendChild(swatchBtn('var('+tc.v+')', tc.id===t.cls, ()=>{ nsTypes[i].cls=tc.id; nsRenderTypes(); }, '', true));
    });
    row.appendChild(sw);
    if(nsTypes.length>1){
      const x=document.createElement('button');x.type='button';x.className='ns-type-del';x.textContent='✕';x.title='유형 삭제';
      x.onclick=()=>{ nsTypes.splice(i,1); nsRenderTypes(); };
      row.appendChild(x);
    }
    con.appendChild(row);
  });
}
function nsAddType(){
  const used=nsTypes.map(t=>t.key);
  let key='col1'; for(let i=1;i<999;i++){ if(!used.includes('col'+i)){key='col'+i;break;} }
  const usedCls=nsTypes.map(t=>t.cls);
  const av=TYPE_COLORS.find(c=>!usedCls.includes(c.id))||TYPE_COLORS[0];
  nsTypes.push({key,label:'새 유형',cls:av.id});
  nsRenderTypes();
}
function nsConfirm(){
  if(nsMode==='book'){ loadSelectedBook(); return; }
  const name=(document.getElementById('ns-name').value||'').trim();
  if(!name){ showToast('과목 이름을 입력하세요'); const n=document.getElementById('ns-name'); if(n)n.focus(); return; }
  if(!nsTypes.length){ showToast('문제 유형을 하나 이상 추가하세요'); return; }
  nsTypes.forEach((t,i)=>{ if(!t.label||!t.label.trim())t.label='유형'+(i+1); });
  createSubjectNow(name, nsColorId, JSON.parse(JSON.stringify(nsTypes)));
}
async function createSubjectNow(name, colorId, cols){
  const used=SUBJECTS.map(s=>s.id); let id='subj1';
  for(let i=1;i<1000;i++){ if(!used.includes('subj'+i)){id='subj'+i;break;} }
  SUBJECTS.push({ id, name, color:colorId, dataKey:id+'Data', idbKey:'c'+id, cols });
  DATA[id]=[]; DEFAULTS[id]=[];
  updateSubjectCSS();
  await idbSet('subjects_config', SUBJECTS);
  await saveAllSubjData();
  curEdSubj=id; curRandSubj=id; curSubj=id;
  ensureCurSubjects();
  rebuildUI();
  renderSubjGrid(true); renderEd(); renderAssignInfo(); applyEdSection(); refreshOnboarding(); updateEmptyStates();
  closeNewSubjectModal();
  showToast('✅ 과목 추가: '+name);
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
  const origTotalDays = Math.max(0, ...allProbs.map(p=>p.day===POSTPONE_DAY?0:p.day));

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

  // 대사(점검) — 전체 = 완료 + 남은, 빠진 문제 없는지 미리 확인
  const placed = bucket.length + Object.values(dayGroups).reduce((a,arr)=>a+arr.length,0);
  const total = rescheduleData.seq.length;
  const missing = total - placed;
  let html = `<div style="font-size:12px;font-weight:700;margin-bottom:8px;color:${missing===0?'var(--cost)':'var(--red)'};">`+
    `${missing===0?'✅':'⚠️'} 전체 ${total}문제 = 완료 ${bucket.length} + 남은 ${total-bucket.length} · 누락 ${missing}</div>`;
  html += `<div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:8px;">미리보기 — 완료 ${bucket.length}문제는 「완료된 문제」로, 남은 문제는 1일차부터 하루 ${Math.max(1,perDay)}개씩 (총 ${totalDays}일)</div>`;
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
      return nd!==undefined ? [pair[0],nd,pair[2]] : pair;
    });
  }));

  // 재수강(다시풀기)은 제거하지 않고 유지 — 새 일차에 맞춰 (문제의 새 일차 + 7)로 다시 앵커링하고,
  // 재조정된 깔끔한 일차를 base로 캐스케이드를 다시 적용한다. (예전엔 제거해서 다시풀기 문제가 사라졌음)
  const sdefR=SUBJECTS.find(s=>s.id===subjId);
  const subjRetries=RETRIES.filter(r=>r.subj===subjId);
  delete RETRY_BASE[subjId];
  if(subjRetries.length && sdefR){
    subjRetries.forEach(r=>{
      const col=sdefR.cols.find(c=>colKeyToType(subjId,c.key)===r.type);
      const nd=col?map[`${r.ci}|${col.key}|${r.num}`]:undefined;
      r.day=((nd&&nd>=1)?nd:1)+RETRY_OFFSET;
    });
    const base={};
    (DATA[subjId]||[]).forEach(ch=>sdefR.cols.forEach(c=>{
      (ch[c.key]||[]).forEach(p=>{ if(Array.isArray(p)&&p[2])base[p[2]]=p[1]; });
    }));
    RETRY_BASE[subjId]=base;
    applyRetrySchedule(subjId);
  }
  await saveRetries();

  syncLegacy();
  await saveAllSubjData();
  await savePlanSnapshot();
  buildMaps();
  buildDG();
  if(curView==='chap')renderChaps();
  updateProgress();
  curDay=null;
  const dp=document.getElementById('dpanel');dp.classList.remove('on');dp.innerHTML='';
  renderAssignInfo();   // 회독 배정 칸의 대사 배지 갱신

  // 적용 직후 자가 점검 — 완료는 완료 묶음, 남은 건 일차에, 빠진 문제 없는지 대사
  const audit=assignmentAudit(subjId);
  closeRescheduleModal();
  if(audit.ok){
    showToast(`✅ 완료 ${bucketN} 모으기 · 남은 ${undoneN} 재배치 (${result.totalDays}일) · 전체 ${audit.total} 누락 0`);
  }else{
    showToast(`⚠️ 재조정 점검 실패 — 확인 필요${audit.doneBucketUndone?` · 완료묶음에 미완료 ${audit.doneBucketUndone}`:''}`);
    console.warn('[reschedule] 누락/이상 감지', audit);
  }
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

// 문제집 불러오기는 새 과목 추가 모달의 한 모드가 됐다 — 모달을 열고 book 모드로.
function openBookModal(){ openNewSubjectModal(); nsSetMode('book'); }
function closeBookModal(){ closeNewSubjectModal(); }
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
  const btn=document.getElementById('ns-confirm'); if(btn)btn.disabled=false;
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
    b.cols.forEach(c=>{ row[c.key]=bookNums(ch[c.key]).map(n=>[n,0,newPid()]); });
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

