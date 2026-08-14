// ══════════════════════════════════════════
// 오답노트 — '오답' 표시(WRONG)한 문제 모아보기
// ══════════════════════════════════════════
// WRONG은 pid로만 키를 잡으므로, 현재 DATA에서 위치(과목·장·유형·번호)를 역인덱스로 찾는다.
function buildPidIndex(){
  const idx={};
  SUBJECTS.forEach(s=>{
    (DATA[s.id]||[]).forEach((ch,ci)=>{
      s.cols.forEach(col=>{
        const tp=colKeyToType(s.id,col.key);
        (ch[col.key]||[]).forEach(p=>{ if(Array.isArray(p)&&p[2])idx[p[2]]={subj:s.id,ci,type:tp,num:p[0],ch:ch.ch,cls:col.cls}; });
      });
    });
  });
  return idx;
}

function makeWrongItem(it){
  const wrap=document.createElement('div');wrap.className='wrong-item';
  const chip=document.createElement('span');chip.className='chip '+(it.cls||CC[it.type]||'si');
  const tl=typeDispLabel(it.subj,it.type);
  chip.textContent=(it.type!=='single'&&tl?tl+' ':'')+it.num+'번';
  wrap.appendChild(chip);
  // 다시풀기 (문제의 현재 일차 기준 +7; 완료 버킷이면 현재 진행 위치 기준)
  const rb=document.createElement('button');rb.type='button';
  rb.className='pu-btn pu-retry'+(isRetryScheduled(it.subj,it.ci,it.type,it.num)?' on':'');
  rb.textContent=isRetryScheduled(it.subj,it.ci,it.type,it.num)?'예약됨':'다시풀기';
  rb.onclick=async()=>{
    if(isRetryScheduled(it.subj,it.ci,it.type,it.num))unscheduleRetry(it.subj,it.ci,it.type,it.num);
    else{ const p=findProb(it.subj,it.ci,it.type,it.num); scheduleRetry(it.subj,it.ci,it.type,it.num,p?p[1]:0); }
    await saveRetries();await saveAllSubjData();buildMaps();buildDG();updateProgress();renderWrongNote();
  };
  wrap.appendChild(rb);
  // 오답 해제
  const xb=document.createElement('button');xb.type='button';xb.className='pu-btn';xb.textContent='해제';
  xb.onclick=()=>{ toggleWrong(it.subj,it.ci,it.type,it.num); renderWrongNote(); };
  wrap.appendChild(xb);
  return wrap;
}

function renderWrongNote(){
  const emptyEl=document.getElementById('wrong-empty'), body=document.getElementById('wrong-body');
  if(!emptyEl||!body)return;
  const pidIdx=buildPidIndex();
  const items=Object.keys(WRONG).filter(pid=>WRONG[pid]&&pidIdx[pid]).map(pid=>({pid,...pidIdx[pid]}));
  body.innerHTML='';
  if(!items.length){ emptyEl.style.display='block'; return; }
  emptyEl.style.display='none';

  const hdr=document.createElement('div');hdr.className='wrong-hdr';
  hdr.innerHTML='틀린 문제 <span class="wrong-cnt">'+items.length+'개</span>';
  body.appendChild(hdr);

  const bySubj={},subjOrder=[];
  items.forEach(it=>{ if(!bySubj[it.subj]){bySubj[it.subj]=[];subjOrder.push(it.subj);} bySubj[it.subj].push(it); });
  subjOrder.forEach(sid=>{
    const list=bySubj[sid];
    const sh=document.createElement('div');sh.className='cal-subj';
    sh.innerHTML='<span class="cal-subj-dot" style="background:'+subjColorVar(sid)+'"></span>'+
      '<span class="cal-subj-nm">'+escapeHtml(subjDispName(sid))+'</span>'+
      '<span class="cal-subj-cnt">'+list.length+'</span>';
    body.appendChild(sh);
    const byCh={},chOrder=[];
    list.forEach(it=>{ if(!byCh[it.ci]){byCh[it.ci]=[];chOrder.push(it.ci);} byCh[it.ci].push(it); });
    chOrder.sort((a,b)=>a-b).forEach(ci=>{
      const chItems=byCh[ci].slice().sort((a,b)=>a.num-b.num);
      const row=document.createElement('div');row.className='cal-ch';
      const nm=document.createElement('div');nm.className='cal-ch-nm';
      const chName=chItems[0].ch||'';
      nm.textContent=(sid==='tax'?taxDisplayName(chName):chName)||'(장 없음)';
      row.appendChild(nm);
      const items2=document.createElement('div');items2.className='wrong-items';
      chItems.forEach(it=>items2.appendChild(makeWrongItem(it)));
      row.appendChild(items2);
      body.appendChild(row);
    });
  });
}
