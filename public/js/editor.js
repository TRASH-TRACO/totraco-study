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
      // 화면에는 번호만 있으므로, 같은 장·같은 번호의 기존 일차·pid를 되살린다.
      // 새로 추가된 번호는 새 pid를 발급 → 기존 문제의 풀이 기록은 편집해도 유지된다.
      const prev=new Map(((old[ri]||{})[c.key]||[]).map(p=>[p[0],p]));
      obj[c.key]=textToProbs(r[c.key]).map(([num,day])=>{
        const pv=prev.get(num);
        return [num, day||(pv&&pv[1])||0, (pv&&pv[2])||newPid()];
      });
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
  // 과목 즉시 추가 (+) — 저장 안 눌러도 바로 반영되는 별도 모달
  const add=document.createElement('button');
  add.className='ed-stab ed-stab-add';add.type='button';add.title='새 과목 추가';
  add.textContent='＋';
  add.onclick=openNewSubjectModal;
  con.appendChild(add);
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

