// ══════════════════════════════════════════
// 학습 캘린더 — 몇월 며칠에 어떤 문제를 풀었는지
// ══════════════════════════════════════════
let calYear=null, calMonth=null, calSelDate=null;
const CAL_WD=['일','월','화','수','목','금','토'];

function calInit(){
  if(calYear===null){const t=new Date();calYear=t.getFullYear();calMonth=t.getMonth();}
  if(calSelDate===null)calSelDate=todayStr();
}
function calShift(delta){
  calInit();
  calMonth+=delta;
  if(calMonth<0){calMonth=11;calYear--;}
  else if(calMonth>11){calMonth=0;calYear++;}
  renderCalendar();saveView();
}
function calToday(){
  const t=new Date();
  calYear=t.getFullYear();calMonth=t.getMonth();calSelDate=todayStr(t);
  renderCalendar();saveView();
}
function subjColorVar(id){return SUBJECTS.find(s=>s.id===id)?subjVar(id):(SUBJ_COLOR[id]||'var(--text3)');}
function subjDispName(id){const s=SUBJECTS.find(x=>x.id===id);return s?s.name:(SUBJ_NAME[id]||id);}
function typeDispLabel(subj,type){
  const s=SUBJECTS.find(x=>x.id===subj);
  if(s){const c=s.cols.find(c=>colKeyToType(subj,c.key)===type);if(c)return c.label||c.key;}
  return TL[type]||'';
}

function renderCalendar(){
  calInit();
  const byDate=buildDateIndex();
  const hasAny=Object.keys(byDate).length>0 || Object.keys(DAYNOTES).length>0;
  const emptyEl=document.getElementById('cal-empty'),bodyEl=document.getElementById('cal-body');
  if(emptyEl)emptyEl.style.display=hasAny?'none':'block';
  if(bodyEl)bodyEl.style.display=hasAny?'block':'none';
  if(!hasAny)return;

  document.getElementById('cal-title').textContent=calYear+'년 '+(calMonth+1)+'월';

  const grid=document.getElementById('cal-grid');grid.innerHTML='';
  CAL_WD.forEach((w,i)=>{const c=document.createElement('div');c.className='cal-wd'+(i===0?' sun':i===6?' sat':'');c.textContent=w;grid.appendChild(c);});

  const startDow=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const today=todayStr();
  for(let i=0;i<startDow;i++){const c=document.createElement('div');c.className='cal-cell empty';grid.appendChild(c);}
  for(let d=1;d<=daysInMonth;d++){
    const ds=todayStr(new Date(calYear,calMonth,d));
    const items=byDate[ds]||[];
    const dow=(startDow+d-1)%7;
    const cell=document.createElement('div');cell.className='cal-cell';cell.dataset.ds=ds;
    if(ds===today)cell.classList.add('today');
    if(ds===calSelDate)cell.classList.add('sel');
    if(items.length)cell.classList.add('has');
    const dnum=document.createElement('div');dnum.className='cal-dnum'+(dow===0?' sun':dow===6?' sat':'');dnum.textContent=d;cell.appendChild(dnum);
    if((DAYNOTES[ds]||'').trim()){const mk=document.createElement('div');mk.className='cal-note-mark';mk.textContent='✎';mk.title=DAYNOTES[ds];cell.appendChild(mk);}
    if(items.length){
      const bySubj={};items.forEach(it=>bySubj[it.subj]=(bySubj[it.subj]||0)+1);
      const dots=document.createElement('div');dots.className='cal-dots';
      Object.keys(bySubj).slice(0,4).forEach(sid=>{const dot=document.createElement('span');dot.className='cal-dot';dot.style.background=subjColorVar(sid);dots.appendChild(dot);});
      cell.appendChild(dots);
      const cnt=document.createElement('div');cnt.className='cal-cnt';cnt.textContent=items.length;cell.appendChild(cnt);
    }
    cell.onclick=()=>selCalDay(ds);
    grid.appendChild(cell);
  }

  const prefix=calYear+'-'+String(calMonth+1).padStart(2,'0');
  if(calSelDate&&calSelDate.startsWith(prefix))renderCalPanel(calSelDate,byDate);
  else document.getElementById('cal-panel').innerHTML='';
}

function selCalDay(ds){calSelDate=ds;renderCalendar();saveView();}

// 하루 한 줄 기록 입력 행 (패널 상단 공통)
function calNoteRowHtml(ds){
  const cur=DAYNOTES[ds]||'';
  return `<div class="cal-note-row">`+
    `<input id="cal-note-input" class="cal-note-input" type="text" maxlength="${DAYNOTE_MAX}" `+
      `placeholder="이 날 한 줄 기록 (${DAYNOTE_MAX}자 이내)" oninput="calNoteInput(this.value)">`+
    `<span class="cal-note-count" id="cal-note-count">${cur.length}/${DAYNOTE_MAX}</span>`+
  `</div>`;
}

function renderCalPanel(ds,byDate){
  byDate=byDate||buildDateIndex();
  const items=byDate[ds]||[];
  const panel=document.getElementById('cal-panel');
  const dObj=new Date(ds+'T00:00:00');
  const dateLabel=`${dObj.getMonth()+1}월 ${dObj.getDate()}일 (${CAL_WD[dObj.getDay()]})`;
  const cntLabel=items.length?`<span class="cal-panel-cnt">${items.length}문제</span>`:'';
  const noteRow=calNoteRowHtml(ds);
  if(!items.length){
    panel.innerHTML=`<div class="cal-panel-hdr">${dateLabel}</div>${noteRow}<div class="noprob">이 날 푼 문제가 없어요</div>`;
    const ni=document.getElementById('cal-note-input');if(ni)ni.value=DAYNOTES[ds]||'';
    return;
  }

  let html=`<div class="cal-panel-hdr">${dateLabel}${cntLabel}</div>${noteRow}`;
  html+=`<div class="cal-edit-hint">문제를 누르면 푼 날짜를 고치거나 지울 수 있어요</div>`;
  const bySubj={},subjOrder=[];
  items.forEach(it=>{if(!bySubj[it.subj]){bySubj[it.subj]=[];subjOrder.push(it.subj);}bySubj[it.subj].push(it);});
  subjOrder.forEach(sid=>{
    const list=bySubj[sid];
    html+=`<div class="cal-subj"><span class="cal-subj-dot" style="background:${subjColorVar(sid)}"></span><span class="cal-subj-nm">${escapeHtml(subjDispName(sid))}</span><span class="cal-subj-cnt">${list.length}</span></div>`;
    const byCh={},chOrder=[];
    list.forEach(it=>{const key=it.ch||'';if(!byCh[key]){byCh[key]=[];chOrder.push(key);}byCh[key].push(it);});
    chOrder.forEach(ch=>{
      const chItems=byCh[ch].slice().sort((a,b)=>a.num-b.num);
      const dispCh=sid==='tax'?taxDisplayName(ch):ch;
      html+=`<div class="cal-ch"><div class="cal-ch-nm">${escapeHtml(dispCh||'(장 없음)')}</div><div class="cal-ch-chips">`;
      chItems.forEach(it=>{
        const tl=typeDispLabel(it.subj,it.type);
        const pre=(it.type!=='single'&&tl)?escapeHtml(tl)+' ':'';
        const rmark=it.retry?'<span class="cal-chip-re">🔁</span> ':'';
        const lastL=fmtSolvedDate(lastSolvedDate(it.pid));
        const tip=lastL?` title="최근 푼 날짜: ${lastL}"`:'';
        html+=`<span class="cal-chip cal-chip-edit${it.retry?' retry':''}"${tip} data-pid="${escapeHtml(it.pid||'')}" data-ds="${ds}" data-label="${escapeHtml((dispCh?dispCh+' ':'')+it.num+'번')}" style="border-color:${subjColorVar(it.subj)}">${rmark}${pre}${it.num}번</span>`;
      });
      html+=`</div></div>`;
    });
  });
  panel.innerHTML=html;
  // 칩 클릭 → 푼 날짜 고치기(옮기기·삭제)
  panel.querySelectorAll('.cal-chip-edit').forEach(el=>{
    el.onclick=()=>openSolveDateEditor(el,el.dataset.pid,el.dataset.ds,el.dataset.label,()=>{
      renderCalendar();updateProgress();
    });
  });
  const ni=document.getElementById('cal-note-input');if(ni)ni.value=DAYNOTES[ds]||'';
}

// 하루 기록 입력 — 타이핑 중엔 전체 재렌더 없이(포커스 유지) DAYNOTES만 갱신하고 저장한다.
function calNoteInput(val){
  const ds=calSelDate;if(!ds)return;
  val=(val||'').slice(0,DAYNOTE_MAX);
  if(val.trim())DAYNOTES[ds]=val; else delete DAYNOTES[ds];
  saveDayNotes();
  const cnt=document.getElementById('cal-note-count');if(cnt)cnt.textContent=val.length+'/'+DAYNOTE_MAX;
  updateCalCellNote(ds);
}
// 해당 날짜 셀의 메모 표식(✎)만 즉석 갱신 — 전체 재렌더를 피해 입력 포커스를 지킨다.
function updateCalCellNote(ds){
  const cell=document.querySelector('.cal-cell[data-ds="'+ds+'"]');if(!cell)return;
  const has=(DAYNOTES[ds]||'').trim();
  let mk=cell.querySelector('.cal-note-mark');
  if(has&&!mk){mk=document.createElement('div');mk.className='cal-note-mark';mk.textContent='✎';cell.insertBefore(mk,cell.querySelector('.cal-dnum').nextSibling);}
  else if(!has&&mk){mk.remove();}
  if(mk)mk.title=DAYNOTES[ds]||'';
}
window.calNoteInput=calNoteInput;

// ══════════════════════════════════════════
// 푼 날짜 고치기 (팝오버)
// ══════════════════════════════════════════
// 체크를 하루 늦게 눌러 날짜가 밀렸을 때 기록을 옮기거나 지운다.
// 캘린더의 문제 칩, 일차 패널의 완료된 칩에서 연다.
let _sdePop=null;
function closeSolveDateEditor(){
  if(_sdePop){_sdePop.remove();_sdePop=null;}
  document.removeEventListener('mousedown',_sdeOutside,true);
  document.removeEventListener('keydown',_sdeEsc,true);
}
function _sdeOutside(e){ if(_sdePop&&!_sdePop.contains(e.target))closeSolveDateEditor(); }
function _sdeEsc(e){ if(e.key==='Escape')closeSolveDateEditor(); }
/**
 * @param anchorEl 기준 요소(이 아래에 띄운다)
 * @param pid 문제 pid
 * @param date 고칠 기록 날짜 (없으면 '기록 추가' 모드)
 * @param label 제목에 보여줄 문제 이름
 * @param after 반영 후 콜백
 */
function openSolveDateEditor(anchorEl,pid,date,label,after){
  closeSolveDateEditor();
  if(!pid){showToast('이 문제의 기록을 찾을 수 없어요');return;}
  const pop=document.createElement('div');pop.className='sde-pop';
  const cur=date||todayStr();
  pop.innerHTML=
    `<div class="sde-hdr">${escapeHtml(label||'푼 날짜')}</div>`+
    `<div class="sde-sub">${date?'기록된 날짜 '+fmtSolvedDate(date):'아직 푼 날짜 기록이 없어요'}</div>`+
    `<div class="sde-row">`+
      `<button type="button" class="sde-btn" data-act="prev">◀ 하루 앞</button>`+
      `<input type="date" class="sde-date" value="${cur}">`+
      `<button type="button" class="sde-btn" data-act="next">하루 뒤 ▶</button>`+
    `</div>`+
    `<div class="sde-row sde-foot">`+
      `<button type="button" class="sde-btn pri" data-act="apply">${date?'이 날짜로 옮기기':'이 날짜로 기록'}</button>`+
      (date?`<button type="button" class="sde-btn del" data-act="del">기록 삭제</button>`:'')+
    `</div>`;
  document.body.appendChild(pop);
  const r=anchorEl.getBoundingClientRect();
  const w=pop.offsetWidth||260;
  let left=Math.min(Math.max(8,r.left),window.innerWidth-w-8);
  let top=r.bottom+6;
  if(top+pop.offsetHeight>window.innerHeight-8)top=Math.max(8,r.top-pop.offsetHeight-6);
  pop.style.left=left+'px';pop.style.top=top+'px';
  const inp=pop.querySelector('.sde-date');
  const done=changed=>{
    closeSolveDateEditor();
    if(!changed)return;
    if(typeof after==='function')after();
  };
  pop.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    const act=b.dataset.act;
    if(act==='prev'){inp.value=shiftDate(inp.value||cur,-1);return;}
    if(act==='next'){inp.value=shiftDate(inp.value||cur,1);return;}
    if(act==='apply'){
      const to=inp.value;
      if(!to){showToast('날짜를 골라주세요');return;}
      const ok=date?moveSolveDate(pid,date,to):addSolveDate(pid,to);
      if(!ok){showToast('바뀐 게 없어요');closeSolveDateEditor();return;}
      showToast('📅 '+fmtSolvedDate(to)+'로 기록했어요');
      done(true);return;
    }
    if(act==='del'){
      if(!confirm(fmtSolvedDate(date)+' 기록을 지울까요?\n(문제 완료 체크는 그대로 남습니다)'))return;
      removeSolveDate(pid,date);
      showToast('🗑 기록을 지웠어요');
      done(true);return;
    }
  });
  _sdePop=pop;
  setTimeout(()=>{
    document.addEventListener('mousedown',_sdeOutside,true);
    document.addEventListener('keydown',_sdeEsc,true);
  },0);
}
/** 일차 패널·오답노트 등 문제 위치로 여는 편의 함수 */
function openSolveDateFor(anchorEl,subj,ci,type,num,after){
  const pid=pidOf(subj,ci,type,num);
  if(!pid){showToast('이 문제의 기록을 찾을 수 없어요');return;}
  const ch=(DATA[subj]&&DATA[subj][ci]&&DATA[subj][ci].ch)||'';
  const dispCh=subj==='tax'?taxDisplayName(ch):ch;
  const last=lastSolvedDate(pid);
  if(!last&&!LOG[pid]){
    // 기록이 아예 없으면 지금 위치 정보로 새로 만든다
    addSolveDate(pid,todayStr(),{subj,ci,type,num,ch});
  }
  openSolveDateEditor(anchorEl,pid,lastSolvedDate(pid),(dispCh?dispCh+' ':'')+num+'번',after);
}
