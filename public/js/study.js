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

  el.addEventListener('click',async()=>{
    const done=S[gk(subj,ci,type,num)]=!S[gk(subj,ci,type,num)];
    recordSolve(subj,ci,type,num,done);
    const reflow=!done && clearRetryAndWrong(subj,ci,type,num);   // 완료 해제 시 오답·다시풀기도 해제
    saveState();saveLog();
    if(reflow){ await saveRetries();await saveAllSubjData();buildMaps();buildDG();renderDP(curDay);updateProgress(); }
    else { refreshChip(el,subj,ci,type,num);refreshDPMeta(curDay);updateProgress();updateDBtns(); }
  });
  return el;
}
function refreshChip(el,subj,ci,type,num){
  el.classList.toggle('done',dn(subj,ci,type,num));
  const cst=el.querySelector('.cst');
  if(cst){cst.style.display=dn(subj,ci,type,num)?'flex':'none';}
}
// 일차 패널용 — 칩 + (완료 시 노출되는) [오답][다시풀기] 버튼 묶음.
// 버튼 노출은 CSS 형제 선택자(.chip.done ~ .pu-actions)로 처리해 완료 토글에 자동 반응한다.
function makeProbUnit(subj,ci,type,num,cls){
  const unit=document.createElement('div');unit.className='prob-unit';
  if(isWrong(subj,ci,type,num))unit.classList.add('wrong');
  unit.appendChild(makeChip(subj,ci,type,num,null,cls));
  const act=document.createElement('div');act.className='pu-actions';
  const wb=document.createElement('button');wb.type='button';
  wb.className='pu-btn pu-wrong'+(isWrong(subj,ci,type,num)?' on':'');wb.textContent='오답';
  wb.onclick=e=>{e.stopPropagation();toggleWrong(subj,ci,type,num);const on=isWrong(subj,ci,type,num);wb.classList.toggle('on',on);unit.classList.toggle('wrong',on);};
  act.appendChild(wb);
  // 다시풀기 — 완료 버킷(일차 0) 포함 어디서든 가능. 버킷이면 현재 진행 위치+7로 예약된다.
  const rb=document.createElement('button');rb.type='button';
  rb.className='pu-btn pu-retry'+(isRetryScheduled(subj,ci,type,num)?' on':'');
  rb.textContent=isRetryScheduled(subj,ci,type,num)?'예약됨':'다시풀기';
  rb.onclick=async e=>{
    e.stopPropagation();
    if(isRetryScheduled(subj,ci,type,num))unscheduleRetry(subj,ci,type,num);
    else scheduleRetry(subj,ci,type,num,curDay);
    await saveRetries();await saveAllSubjData();
    buildMaps();buildDG();renderDP(curDay);updateProgress();
  };
  act.appendChild(rb);
  // 미루기(정규 일차·미완료) / 되돌리기(미뤄둔 문제 버킷)
  if(curDay===POSTPONE_DAY){
    const ub=document.createElement('button');ub.type='button';ub.className='pu-btn pu-unpostpone';ub.textContent='되돌리기';
    ub.onclick=e=>{e.stopPropagation();unpostponeProblem(subj,ci,type,num);};
    act.appendChild(ub);
  } else if(curDay>=1){
    const pb=document.createElement('button');pb.type='button';pb.className='pu-btn pu-postpone';pb.textContent='미루기';
    pb.onclick=e=>{e.stopPropagation();postponeProblem(subj,ci,type,num);};
    act.appendChild(pb);
  }
  unit.appendChild(act);
  return unit;
}
// 미루기 — 문제를 '미뤄둔 문제' 버킷(맨 뒤)으로. 원래 일차는 p[3]에 보관(되돌리기용).
async function postponeProblem(subj,ci,type,num){
  const p=findProb(subj,ci,type,num); if(!p||!Array.isArray(p)||p[1]===POSTPONE_DAY)return;
  p[3]=p[1]; p[1]=POSTPONE_DAY;
  await saveAllSubjData();
  buildMaps();buildDG();renderDP(curDay);updateProgress();
  showToast('⏸ 미뤄둔 문제로 보냈어요');
}
// 되돌리기 — 미뤄둔 문제를 원래 일차로 복귀.
async function unpostponeProblem(subj,ci,type,num){
  const p=findProb(subj,ci,type,num); if(!p||!Array.isArray(p)||p[1]!==POSTPONE_DAY)return;
  p[1]=(p.length>3&&p[3]>=1)?p[3]:Math.max(1,(MAXS[subj]||0)); if(p.length>3)p.length=3;
  await saveAllSubjData();
  buildMaps();buildDG();
  if(!(getDM()[POSTPONE_DAY]||[]).length && curDay===POSTPONE_DAY){
    curDay=null; const dp=document.getElementById('dpanel');dp.classList.remove('on');dp.innerHTML='';
  } else renderDP(curDay);
  updateProgress();
  showToast('↩ 되돌렸어요');
}

// ══════════════════════════════════════════
// 네비
// ══════════════════════════════════════════
function goNav(n){
  if(n==='setup'){ openSetup(); return; }   // 과목 설정은 이제 모달 (옛 호출 호환용 가드)
  curNav=n;
  ['study','cal','wrong'].forEach(id=>{
    const nav=document.getElementById('nav-'+id); if(nav)nav.style.display=id===n?'block':'none';
    const nt=document.getElementById('nt-'+id); if(nt)nt.classList.toggle('on',id===n);
  });
  if(n==='cal') renderCalendar();
  if(n==='wrong') renderWrongNote();
  updateEmptyStates();
  saveView();
}
// 과목 설정 모달 — 헤더 ⚙ 버튼으로 열고, 내용을 채운 뒤 표시한다. 밑의 탭(학습 등)은 유지.
function openSetup(){
  ensureCurSubjects();
  renderSubjGrid(true);   // 과목 목록
  renderEd();             // 선택 과목의 문제 등록
  renderAssignInfo();     // 회독 배정
  applyEdSection();
  refreshOnboarding();
  updateEmptyStates();
  const m=document.getElementById('nav-setup'); if(m)m.style.display='flex';
  const hs=document.getElementById('hdr-setup'); if(hs)hs.classList.add('on');
}
function closeSetup(){
  const m=document.getElementById('nav-setup'); if(m)m.style.display='none';
  const hs=document.getElementById('hdr-setup'); if(hs)hs.classList.remove('on');
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
        el.style.color=subjVar(id);
        el.style.background=subjVar(id,'bg');
        el.style.borderColor=subjVar(id,'border');
      }
    }
  });
  curDay=null;const dp=document.getElementById('dpanel');dp.classList.remove('on');dp.innerHTML='';
  renderProgressCards();updateProgress();
  buildDG();if(curView==='chap')renderChaps();
  saveView();
}
function goView(v){
  curView=v;
  document.getElementById('view-day').style.display=v==='day'?'block':'none';
  document.getElementById('view-chap').style.display=v==='chap'?'block':'none';
  document.getElementById('btn-day').classList.toggle('on',v==='day');
  document.getElementById('btn-chap').classList.toggle('on',v==='chap');
  if(v==='chap')renderChaps();
  saveView();
}

// ══════════════════════════════════════════
// 일차 그리드
// ══════════════════════════════════════════
function getDM(){return curSubj==='all'?adm:(MAPS[curSubj]||{});}
function getMax(){const reg=curSubj==='all'?Math.max(0,...Object.values(MAXS)):(MAXS[curSubj]||0);return Math.max(reg,maxRetryDay());}

function buildDG(){
  const g=document.getElementById('dg');g.innerHTML='';
  const max=getMax(),isTax=curSubj==='tax',dm=getDM();
  // 완료된 문제 버킷(일차 0) — 남은 문제 조정으로 완료 문제를 몰아둔 경우 맨 앞에 표시
  const bucket=dm[0]||[];
  if(bucket.length){
    const b=document.createElement('button');b.className='db done-bucket';b.id='db0';
    b.innerHTML=`<span>✓ 완료된 문제</span>`;
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
  // 미뤄둔 문제 버킷 — 맨 뒤에 표시 (완료 버킷의 정반대)
  const post=dm[POSTPONE_DAY]||[];
  if(post.length){
    const b=document.createElement('button');b.className='db postpone-bucket';b.id='dbP';
    b.innerHTML=`<span>⏸ 미뤄둔 문제</span>`;
    b.onclick=()=>selDay(POSTPONE_DAY);g.appendChild(b);
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
    const ps=dm[d]||[];const rs=retriesForDay(d);
    const total=ps.length+rs.length;
    const dk=ps.filter(p=>dn(p.subj,p.ci,p.type,p.num)).length + rs.filter(r=>r.done).length;
    b.className='db'+(curSubj==='tax'?' tax-mode':'');
    if(rs.length)b.classList.add('has-retry');
    if(d===curDay)b.classList.add('sel');
    if(total>0&&dk===total)b.classList.add('full');
    else if(dk>0)b.classList.add('part');
  }
  // 미뤄둔 문제 버킷 타일
  const bP=document.getElementById('dbP');
  if(bP){
    const ps=dm[POSTPONE_DAY]||[];const dk=ps.filter(p=>dn(p.subj,p.ci,p.type,p.num)).length;
    bP.className='db postpone-bucket';
    if(curDay===POSTPONE_DAY)bP.classList.add('sel');
    if(ps.length>0&&dk===ps.length)bP.classList.add('full');
    else if(dk>0)bP.classList.add('part');
  }
}
function selDay(day){curDay=day;updateDBtns();const dp=document.getElementById('dpanel');dp.classList.add('on');renderDP(day);saveView();}

function renderDP(day){
  const dp=document.getElementById('dpanel');dp.innerHTML='';
  const dm=getDM();const ps=dm[day]||[];
  const rs=retriesForDay(day);
  if(!ps.length&&!rs.length){dp.innerHTML='<div class="noprob">이 일차에 배정된 문제가 없어요</div>';return;}
  const dk=ps.filter(p=>dn(p.subj,p.ci,p.type,p.num)).length + rs.filter(r=>r.done).length;
  const totalN=ps.length+rs.length;
  const allD=totalN>0&&dk===totalN;
  // 헤더
  const hdr=document.createElement('div');hdr.className='dpanel-hdr';
  const titleEl=document.createElement('div');titleEl.className='dpanel-title';titleEl.textContent=day===0?'완료된 문제':day===POSTPONE_DAY?'미뤄둔 문제':day+'일차';
  const metaEl=document.createElement('div');metaEl.style.display='flex';metaEl.style.alignItems='center';metaEl.style.gap='10px';
  const subEl=document.createElement('div');subEl.className='dpanel-meta';subEl.id='dp-sub';subEl.textContent=totalN+'문제 · '+dk+'개 완료';
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
      const dot=document.createElement('div');dot.className='subj-dot';dot.style.background=subjColorVar(subj);
      const nm=document.createElement('span');nm.style.cssText='font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--text3)';nm.textContent=subjDispName(subj);
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
  if(body.childNodes.length)dp.appendChild(body);   // 재수강만 있는 일차는 빈 본문 생략
  renderRetrySection(dp,day);
}
// 일차 패널의 '다시 풀기' 별도 섹션 — 정규 문제와 구분해서 보여준다. 자체 완료 토글.
function renderRetrySection(dp,day){
  const rs=retriesForDay(day);
  if(!rs.length)return;
  const sec=document.createElement('div');sec.className='retry-sec';
  const hd=document.createElement('div');hd.className='retry-sec-hdr';
  hd.innerHTML='🔁 다시 풀기 <span class="retry-sec-cnt" id="retry-cnt">'+rs.filter(r=>r.done).length+' / '+rs.length+'</span>';
  sec.appendChild(hd);
  const row=document.createElement('div');row.className='retry-row';
  rs.slice().sort((a,b)=>a.ci-b.ci||a.num-b.num).forEach(r=>{
    const chip=document.createElement('div');
    chip.className='chip retry-chip '+(CC[r.type]||'si')+(r.done?' done':'');
    const chName=(DATA[r.subj]&&DATA[r.subj][r.ci]&&DATA[r.subj][r.ci].ch)||'';
    const dispCh=r.subj==='tax'?taxDisplayName(chName):chName;
    const subjTag=curSubj==='all'?(subjDispName(r.subj)+' · '):'';
    chip.innerHTML=escapeHtml(subjTag+dispCh)+' '+r.num+'번';
    const cst=document.createElement('div');cst.className='cst';cst.textContent='✓';chip.appendChild(cst);
    chip.addEventListener('click',()=>{
      toggleRetryDone(r.rid);
      chip.classList.toggle('done',r.done);
      const cntEl=document.getElementById('retry-cnt');const cur=retriesForDay(day);
      if(cntEl)cntEl.textContent=cur.filter(x=>x.done).length+' / '+cur.length;
      refreshDPMeta(day);updateDBtns();
    });
    row.appendChild(chip);
  });
  sec.appendChild(row);dp.appendChild(sec);
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
        nums.forEach(num=>row.appendChild(makeProbUnit(subj,ci,tp,num,cls)));
        grp.appendChild(row);groups.appendChild(grp);
      });
      inner.appendChild(groups);block.appendChild(inner);body.appendChild(block);
    });
}

function refreshDPMeta(day){
  if(day==null)return;
  const ps=(getDM()[day])||[];const rs=retriesForDay(day);
  const dk=ps.filter(p=>dn(p.subj,p.ci,p.type,p.num)).length + rs.filter(r=>r.done).length;
  const totalN=ps.length+rs.length;
  const allD=totalN>0&&dk===totalN;
  const sub=document.getElementById('dp-sub');if(sub)sub.textContent=totalN+'문제 · '+dk+'개 완료';
  const btn=document.getElementById('all-btn');if(btn){btn.className='toggle-all-btn '+(allD?'ad':'nd');btn.textContent=allD?'전체 해제':'전체 완료';}
}
function toggleAll(day){
  const ps=(getDM()[day])||[];const rs=retriesForDay(day);
  const allD=(ps.length+rs.length)>0 && ps.every(p=>dn(p.subj,p.ci,p.type,p.num)) && rs.every(r=>r.done);
  const nv=!allD;
  ps.forEach(p=>{S[gk(p.subj,p.ci,p.type,p.num)]=nv;recordSolve(p.subj,p.ci,p.type,p.num,nv);});
  rs.forEach(r=>{r.done=nv;recordSolve(r.subj,r.ci,r.type,r.num,nv);const pid=r.pid||pidOf(r.subj,r.ci,r.type,r.num);if(pid){const k=pid+'|'+todayStr();if(nv)RETRY_DONE[k]=true;else delete RETRY_DONE[k];}});
  let reflow=false;
  if(!nv)ps.forEach(p=>{ if(clearRetryAndWrong(p.subj,p.ci,p.type,p.num))reflow=true; });   // 전체 해제 시 오답·다시풀기도 해제
  saveState();saveLog();saveRetries();saveRetryDone();
  if(reflow){buildMaps();buildDG();saveAllSubjData();}
  renderDP(day);refreshDPMeta(day);updateProgress();updateDBtns();
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
      const dot=document.createElement('div');dot.className='subj-dot';dot.style.background=subjColorVar(s.id);
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
  const barColor=subjColorVar(subj);
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

