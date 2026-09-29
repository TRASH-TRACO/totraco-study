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
// 물음이 많아 한 문제가 사실상 2~3문제면 "3*3"처럼 분량을 붙인다(체크는 그대로 문제 하나).
function probsToText(arr){
  return(arr||[]).map(p=>{
    const num=Array.isArray(p)?p[0]:p;
    const w=weightOfProb(p);
    return w>1?num+'*'+w:String(num);
  }).join(', ');
}
function textToProbs(str){
  if(!str||!str.trim())return[];
  return str.split(/[,，\s]+/).map(s=>s.trim()).filter(Boolean).map(s=>{
    // 번호[*분량][(일차)] — 분량은 물음 가중치, (일차)는 예전 형식 호환
    const m=s.match(/^(\d+)(?:\s*[*xX×]\s*(\d+))?(?:\s*[\(（](\d+)[\)）])?$/);
    if(!m)throw new Error('"'+s+'" — 숫자만 입력하세요 (물음 많으면 3*2)');
    const w=m[2]?parseInt(m[2]):1;
    if(w<1||w>99)throw new Error('"'+s+'" — 분량은 1~99');
    return[parseInt(m[1]), m[3]?parseInt(m[3]):0, w];
  });
}
function buildEdRows(){
  const data=getCurData(),cols=getEdCols(curEdSubj);
  edRows=data.map(row=>{const r={};cols.forEach(c=>{r[c.key]=c.type==='ch'?row[c.key]||'':probsToText(row[c.key]||[]);});return r;});
  ssResetState();   // 과목이 바뀌면 선택·되돌리기 이력도 새로
}
/** 그리드 상태 초기화 — 다른 데이터로 갈아탈 때 선택과 되돌리기 이력을 리셋한다. */
function ssResetState(){
  ssSel={r:0,c:0,r2:0,c2:0};ssEdit=null;ssDrag=false;
  ssUndo.length=0;ssRedo.length=0;
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
      obj[c.key]=textToProbs(r[c.key]).map(([num,day,w])=>{
        const pv=prev.get(num);
        const pid=(pv&&pv[2])||newPid();
        if(w>1)WEIGHTS[pid]=w; else delete WEIGHTS[pid];   // 분량(물음 가중치)
        return [num, day||(pv&&pv[1])||0, pid];
      });
    });
    return obj;
  });
}

// ══════════════════════════════════════════
// 스프레드시트 그리드
// ══════════════════════════════════════════
// 실제 스프레드시트처럼 '선택 모드'와 '편집 모드'를 나눈다.
//  선택 모드 — 셀/범위 선택, 방향키 이동, Ctrl+C/X/V, Del, Ctrl+Z, Ctrl+D
//  편집 모드 — Enter·F2·더블탭(또는 값을 바로 입력)로 진입, Esc 취소, Enter/Tab 확정 후 이동
// 값 모델은 edRows[행][열키] = 문자열 하나뿐이라 셀 단위로 그대로 다룬다.
let ssSel={r:0,c:0,r2:0,c2:0};   // 앵커(r,c) + 포커스(r2,c2)
let ssEdit=null;                 // 편집 중인 {r,c}
let ssDrag=false;
let ssUndo=[],ssRedo=[];
const SS_UNDO_MAX=60;

function ssCols(){return getEdCols(curEdSubj);}
function ssMaxR(){return Math.max(0,edRows.length-1);}
function ssMaxC(){return Math.max(0,ssCols().length-1);}
function ssCellEl(r,c){return document.querySelector(`#ss-wrap td[data-ri="${r}"][data-ci="${c}"]`);}
function ssRange(){const s=ssSel;return{r1:Math.min(s.r,s.r2),r2:Math.max(s.r,s.r2),c1:Math.min(s.c,s.c2),c2:Math.max(s.c,s.c2)};}
function ssColName(ci){return String.fromCharCode(65+ci);}
function ssRefText(){
  const s=ssSel,one=(s.r===s.r2&&s.c===s.c2);
  const a=ssColName(s.c)+(s.r+1);
  return one?a:`${a}:${ssColName(s.c2)}${s.r2+1}`;
}
function ssVal(r,c){const col=ssCols()[c];return(col&&edRows[r]&&edRows[r][col.key])||'';}
function ssSetVal(r,c,v){
  const col=ssCols()[c]; if(!col||!edRows[r])return false;
  const nv=(v==null?'':String(v)).trim();
  if(edRows[r][col.key]===nv)return false;
  edRows[r][col.key]=nv; return true;
}
function ssBlankRow(){const r={};ssCols().forEach(c=>r[c.key]=c.type==='ch'?'':'');return r;}

// ── 되돌리기 ──────────────────────────────
function ssSnap(){ ssUndo.push(JSON.stringify(edRows)); if(ssUndo.length>SS_UNDO_MAX)ssUndo.shift(); ssRedo.length=0; }
function ssUndoStep(){
  if(!ssUndo.length){showToast('되돌릴 게 없어요');return;}
  ssRedo.push(JSON.stringify(edRows));
  edRows=JSON.parse(ssUndo.pop());
  renderEdGrid();showToast('↩ 되돌렸어요');
}
function ssRedoStep(){
  if(!ssRedo.length){showToast('다시 실행할 게 없어요');return;}
  ssUndo.push(JSON.stringify(edRows));
  edRows=JSON.parse(ssRedo.pop());
  renderEdGrid();showToast('↪ 다시 실행');
}

// ── 선택 ──────────────────────────────────
function ssSelect(r,c,extend){
  const R=ssMaxR(),C=ssMaxC();
  r=Math.min(Math.max(0,r),R); c=Math.min(Math.max(0,c),C);
  if(extend){ ssSel.r2=r; ssSel.c2=c; }
  else ssSel={r,c,r2:r,c2:c};
  ssPaint();ssScrollIntoView();
}
function ssMove(dr,dc,extend){
  const s=ssSel;
  if(extend)ssSelect(s.r2+dr,s.c2+dc,true);
  else{
    let r=s.r+dr,c=s.c+dc;
    const C=ssMaxC();
    if(c>C){c=0;r++;} if(c<0){c=C;r--;}      // Tab 이동은 행을 넘나든다
    ssSelect(r,c,false);
  }
}
function ssScrollIntoView(){
  const td=ssCellEl(ssSel.r2,ssSel.c2)||ssCellEl(ssSel.r,ssSel.c);
  if(td&&td.scrollIntoView)td.scrollIntoView({block:'nearest',inline:'nearest'});
}
function ssPaint(){
  const wrap=document.getElementById('ss-wrap'); if(!wrap)return;
  const rg=ssRange();
  wrap.querySelectorAll('td.ss-cell').forEach(td=>{
    const r=+td.dataset.ri,c=+td.dataset.ci;
    const inRange=r>=rg.r1&&r<=rg.r2&&c>=rg.c1&&c<=rg.c2;
    td.classList.toggle('sel',inRange);
    td.classList.toggle('active',r===ssSel.r&&c===ssSel.c);
  });
  wrap.querySelectorAll('td.row-num').forEach(td=>{
    const r=+td.dataset.ri;
    td.classList.toggle('hl',r>=rg.r1&&r<=rg.r2);
  });
  wrap.querySelectorAll('th[data-ci]').forEach(th=>{
    const c=+th.dataset.ci;
    th.classList.toggle('hl',c>=rg.c1&&c<=rg.c2);
  });
  ssUpdateBar();
}
function ssUpdateBar(){
  const ref=document.getElementById('ss-ref'); if(ref)ref.textContent=ssRefText();
  const mode=document.getElementById('ss-mode');
  if(mode){ mode.textContent=ssEdit?'편집 중':'선택'; mode.classList.toggle('editing',!!ssEdit); }
  const fx=document.getElementById('ss-fx');
  if(fx&&document.activeElement!==fx){
    fx.value=ssVal(ssSel.r,ssSel.c);
    const col=ssCols()[ssSel.c];
    fx.placeholder=col&&col.type==='ch'?'장 이름 — Enter로 적용':'문제번호 (예: 1, 2, 3) — Enter로 적용';
  }
}

// ── 편집 모드 ─────────────────────────────
function ssStartEdit(r,c,initial){
  if(ssEdit)ssCommitEdit(true);
  const col=ssCols()[c]; if(!col||!edRows[r])return;
  ssSel={r,c,r2:r,c2:c};ssPaint();
  const td=ssCellEl(r,c); if(!td)return;
  ssEdit={r,c};
  const isCh=col.type==='ch';
  const el=document.createElement(isCh?'input':'textarea');
  el.className='ss-input'+(isCh?' ch':'');
  el.value=initial!==undefined?initial:ssVal(r,c);
  td.innerHTML='';td.classList.add('editing');td.appendChild(el);
  const fit=()=>{ if(!isCh){el.style.height='auto';el.style.height=Math.max(32,el.scrollHeight)+'px';} };
  el.addEventListener('input',fit);
  el.addEventListener('keydown',ssEditKey);
  el.addEventListener('blur',()=>{ if(ssEdit&&ssEdit.r===r&&ssEdit.c===c)ssCommitEdit(true); });
  el.addEventListener('paste',e=>{
    const raw=e.clipboardData.getData('text');
    if(/\t/.test(raw)){ e.preventDefault(); ssCommitEdit(false); ssPasteGrid(raw,r,c); return; }
    if(/\n/.test(raw.trim())&&!isCh){   // 세로로 복사한 번호 목록 → 한 칸에 쉼표로
      e.preventDefault();
      const cleaned=raw.replace(/\r\n?/g,'\n').split('\n').map(s=>s.trim()).filter(Boolean).join(', ');
      const s0=el.selectionStart,e0=el.selectionEnd,cur=el.value;
      el.value=cur.slice(0,s0)+cleaned+cur.slice(e0);
      el.selectionStart=el.selectionEnd=s0+cleaned.length;fit();
    }
  });
  el.focus();
  if(initial!==undefined)el.selectionStart=el.selectionEnd=el.value.length;
  else el.select();
  fit();ssUpdateBar();
}
function ssCommitEdit(save){
  if(!ssEdit)return;
  const {r,c}=ssEdit;
  const td=ssCellEl(r,c);
  const el=td&&td.querySelector('.ss-input');
  const v=el?el.value:null;
  ssEdit=null;
  if(el&&save&&v!==ssVal(r,c)){ ssSnap(); ssSetVal(r,c,v); }
  if(td){ td.classList.remove('editing'); ssRenderCell(r,c); }
  ssUpdateBar();
}
function ssCancelEdit(){
  if(!ssEdit)return;
  const {r,c}=ssEdit;ssEdit=null;
  const td=ssCellEl(r,c);
  if(td){td.classList.remove('editing');ssRenderCell(r,c);}
  ssFocusGrid();ssPaint();
}
function ssEditKey(e){
  if(!ssEdit)return;
  e.stopPropagation();   // 편집 중 키는 그리드(선택 모드) 핸들러로 올라가면 안 된다 — Enter가 다시 편집을 열어버린다
  if(e.key==='Escape'){e.preventDefault();ssCancelEdit();return;}
  if(e.key==='Enter'&&!e.altKey&&!e.shiftKey){e.preventDefault();ssCommitEdit(true);ssFocusGrid();ssMove(1,0,false);return;}
  if(e.key==='Tab'){e.preventDefault();ssCommitEdit(true);ssFocusGrid();ssMove(0,e.shiftKey?-1:1,false);return;}
  // Alt/Shift+Enter는 줄바꿈 그대로(문제번호 칸)
}
function ssRenderCell(r,c){
  const td=ssCellEl(r,c); if(!td)return;
  const col=ssCols()[c];
  td.innerHTML='';
  const v=ssVal(r,c);
  const div=document.createElement('div');
  div.className='ss-val'+(col&&col.type==='ch'?' ch':'');
  if(v)div.textContent=v;
  else{ div.classList.add('ph'); div.textContent=col&&col.type==='ch'?'장 이름':'예) 1, 2, 3'; }
  td.appendChild(div);
}
function ssFocusGrid(){
  const wrap=document.getElementById('ss-wrap');
  if(wrap&&document.activeElement!==wrap)wrap.focus({preventScroll:true});
}

// ── 복사 / 붙여넣기 / 지우기 ───────────────
function ssGridFocused(){
  const wrap=document.getElementById('ss-wrap');
  if(!wrap||wrap.offsetParent===null)return false;
  return document.activeElement===wrap||wrap.contains(document.activeElement);
}
function ssSelText(){
  const rg=ssRange(),lines=[];
  for(let r=rg.r1;r<=rg.r2;r++){
    const cells=[];
    for(let c=rg.c1;c<=rg.c2;c++)cells.push(ssVal(r,c));
    lines.push(cells.join('\t'));
  }
  return lines.join('\n');
}
function ssClearRange(){
  const rg=ssRange();let changed=false;
  const snap=JSON.stringify(edRows);
  for(let r=rg.r1;r<=rg.r2;r++)for(let c=rg.c1;c<=rg.c2;c++)if(ssSetVal(r,c,''))changed=true;
  if(!changed)return;
  ssUndo.push(snap);if(ssUndo.length>SS_UNDO_MAX)ssUndo.shift();ssRedo.length=0;
  for(let r=rg.r1;r<=rg.r2;r++)for(let c=rg.c1;c<=rg.c2;c++)ssRenderCell(r,c);
  ssUpdateBar();
}
function ssFillDown(){
  const rg=ssRange();
  if(rg.r1===rg.r2){showToast('아래로 채울 범위를 잡아주세요 (Shift+↓)');return;}
  ssSnap();
  for(let c=rg.c1;c<=rg.c2;c++){
    const src=ssVal(rg.r1,c);
    for(let r=rg.r1+1;r<=rg.r2;r++){ssSetVal(r,c,src);ssRenderCell(r,c);}
  }
  showToast('⬇ 아래로 채웠어요');ssUpdateBar();
}
/** TSV/줄바꿈 텍스트를 (r,c)부터 셀에 펼쳐 넣는다. 한 칸만 복사했으면 선택 범위를 그 값으로 채운다. */
function ssPasteGrid(raw,r,c){
  const cols=ssCols();
  const grid=raw.replace(/\r\n?/g,'\n').replace(/\n+$/,'').split('\n').map(l=>l.split('\t'));
  if(!grid.length)return;
  ssSnap();
  const rg=ssRange();
  if(grid.length===1&&grid[0].length===1&&(rg.r1!==rg.r2||rg.c1!==rg.c2)){
    for(let i=rg.r1;i<=rg.r2;i++)for(let j=rg.c1;j<=rg.c2;j++)ssSetVal(i,j,grid[0][0]);
    renderEdGrid();showToast('✅ 선택 범위에 붙여넣기');
    return;
  }
  while(edRows.length<r+grid.length)edRows.push(ssBlankRow());
  let wide=0;
  grid.forEach((line,dr)=>{
    wide=Math.max(wide,line.length);
    line.forEach((v,dc)=>{const ri=r+dr,ci=c+dc;if(ci<cols.length)ssSetVal(ri,ci,v);});
  });
  ssSel={r,c,r2:Math.min(r+grid.length-1,ssMaxR()),c2:Math.min(c+wide-1,ssMaxC())};
  renderEdGrid();
  showToast(`✅ ${grid.length}행 × ${Math.min(wide,cols.length-c)}열 붙여넣기`);
}
// 예전 이름 호환 (붙여넣기 모드 등에서 호출)
function handleGridPaste(e,startRi,startCi){
  const raw=e.clipboardData.getData('text');
  if(!/[\t\r\n]/.test(raw.trim()))return;
  e.preventDefault();
  ssPasteGrid(raw,startRi,startCi);
}

// ── 선택 모드 키 ──────────────────────────
function ssGridKey(e){
  if(ssEdit)return;
  const meta=e.ctrlKey||e.metaKey;
  const k=e.key;
  if(meta&&(k==='z'||k==='Z')){e.preventDefault();e.shiftKey?ssRedoStep():ssUndoStep();return;}
  if(meta&&(k==='y'||k==='Y')){e.preventDefault();ssRedoStep();return;}
  if(meta&&(k==='a'||k==='A')){e.preventDefault();ssSel={r:0,c:0,r2:ssMaxR(),c2:ssMaxC()};ssPaint();return;}
  if(meta&&(k==='d'||k==='D')){e.preventDefault();ssFillDown();return;}
  if(meta&&(k==='c'||k==='C'||k==='x'||k==='X'||k==='v'||k==='V'))return;   // copy/cut/paste 이벤트에서 처리
  switch(k){
    case 'ArrowUp':    e.preventDefault(); meta?ssSelect(0,ssSel.c,e.shiftKey):ssMove(-1,0,e.shiftKey); return;
    case 'ArrowDown':  e.preventDefault(); meta?ssSelect(ssMaxR(),ssSel.c,e.shiftKey):ssMove(1,0,e.shiftKey); return;
    case 'ArrowLeft':  e.preventDefault(); meta?ssSelect(ssSel.r,0,e.shiftKey):ssMove(0,-1,e.shiftKey); return;
    case 'ArrowRight': e.preventDefault(); meta?ssSelect(ssSel.r,ssMaxC(),e.shiftKey):ssMove(0,1,e.shiftKey); return;
    case 'Tab':        e.preventDefault(); ssMove(0,e.shiftKey?-1:1,false); return;
    case 'Enter': case 'F2':
      e.preventDefault(); ssStartEdit(ssSel.r,ssSel.c); return;
    case 'Escape':     e.preventDefault(); ssSelect(ssSel.r,ssSel.c,false); return;
    case 'Delete': case 'Backspace':
      e.preventDefault(); ssClearRange(); return;
    case 'Home':       e.preventDefault(); meta?ssSelect(0,0,e.shiftKey):ssSelect(ssSel.r,0,e.shiftKey); return;
    case 'End':        e.preventDefault(); meta?ssSelect(ssMaxR(),ssMaxC(),e.shiftKey):ssSelect(ssSel.r,ssMaxC(),e.shiftKey); return;
    case 'PageUp':     e.preventDefault(); ssMove(-10,0,e.shiftKey); return;
    case 'PageDown':   e.preventDefault(); ssMove(10,0,e.shiftKey); return;
  }
  // 값을 바로 입력하면 편집 모드로 (스프레드시트와 같게)
  if(!meta&&!e.altKey&&k.length===1){ e.preventDefault(); ssStartEdit(ssSel.r,ssSel.c,k); }
}
// 복사/잘라내기/붙여넣기는 문서 레벨에서 — 그리드가 포커스이고 편집 중이 아닐 때만 가로챈다
document.addEventListener('copy',e=>{
  if(!ssGridFocused()||ssEdit)return;
  e.preventDefault();e.clipboardData.setData('text/plain',ssSelText());
  showToast('📋 복사했어요');
});
document.addEventListener('cut',e=>{
  if(!ssGridFocused()||ssEdit)return;
  e.preventDefault();e.clipboardData.setData('text/plain',ssSelText());ssClearRange();
  showToast('✂ 잘라냈어요');
});
document.addEventListener('paste',e=>{
  if(!ssGridFocused()||ssEdit)return;
  const raw=e.clipboardData.getData('text');
  if(!raw)return;
  e.preventDefault();ssPasteGrid(raw,ssSel.r,ssSel.c);
});
document.addEventListener('pointerup',()=>{ssDrag=false;});
document.addEventListener('pointercancel',()=>{ssDrag=false;});
document.addEventListener('mouseup',()=>{ssDrag=false;});

// 수식 입력줄 — 활성 셀 값을 그대로 고쳐 넣는다(긴 번호 목록 편집용)
function ssFxKey(e){
  const fx=document.getElementById('ss-fx');
  if(e.key==='Enter'){e.preventDefault();ssFxCommit();ssFocusGrid();ssMove(1,0,false);}
  else if(e.key==='Escape'){e.preventDefault();fx.value=ssVal(ssSel.r,ssSel.c);ssFocusGrid();}
}
function ssFxCommit(){
  const fx=document.getElementById('ss-fx'); if(!fx)return;
  if(fx.value===ssVal(ssSel.r,ssSel.c))return;
  ssSnap();ssSetVal(ssSel.r,ssSel.c,fx.value);ssRenderCell(ssSel.r,ssSel.c);
}

// ── 열(문제 유형) 편집 ────────────────────
// 그리드의 열 = 과목의 문제 유형(SUBJECTS[].cols)이다. 과목 설정까지 가지 않고 여기서 바로
// 추가·이름변경·삭제할 수 있게 한다. 구조 변경이라 과목 설정에 바로 저장한다.
function ssSubjDef(){ return SUBJECTS.find(s=>s.id===curEdSubj); }
async function ssPersistCols(){
  const sd=ssSubjDef(); if(!sd)return;
  updateSubjectCSS();
  try{ await idbSet('subjects_config',SUBJECTS); }catch(_){}
  window.CloudSync?.schedulePush();
  // 과목 설정 표(편집 중일 수 있다)에도 같은 열 구성을 반영 — 다른 미저장 수정은 건드리지 않는다
  const er=(typeof subjEditRows!=='undefined')&&subjEditRows.find(r=>r.id===curEdSubj);
  if(er)er.cols=JSON.parse(JSON.stringify(sd.cols));
  if(typeof renderSubjGrid==='function'&&document.getElementById('subj-grid-wrap'))renderSubjGrid();
  renderEdSubjTabs();
}
/** 새 열(유형) 추가 — 이름을 물어보고 안 쓰는 색을 하나 집어준다. */
async function ssAddCol(){
  const sd=ssSubjDef(); if(!sd){showToast('과목을 먼저 선택해주세요');return;}
  const name=(prompt('새 유형 이름을 정해주세요\n예) 심화 · 계산 · 기출','새 유형')||'').trim();
  if(!name)return;
  if(sd.cols.some(c=>(c.label||'')===name)){showToast('같은 이름의 유형이 이미 있어요');return;}
  const used=sd.cols.map(c=>c.key);
  let key='col1';
  for(let i=1;i<999;i++){ if(!used.includes('col'+i)){key='col'+i;break;} }
  const usedCls=sd.cols.map(c=>c.cls);
  const pick=(TYPE_CLS_OPTIONS.find(o=>!usedCls.includes(o.id))||{id:'si'}).id;
  sd.cols.push({key,label:name,cls:pick});
  edRows.forEach(r=>{ if(r[key]===undefined)r[key]=''; });
  await ssPersistCols();
  ssSel={r:ssSel.r,c:ssMaxC(),r2:ssSel.r,c2:ssMaxC()};
  renderEdGrid();ssFocusGrid();
  showToast('✅ ‘'+name+'’ 열을 추가했어요');
}
/** 열 이름 바꾸기 — 값(문제번호)은 그대로. */
async function ssRenameCol(ci){
  const sd=ssSubjDef(); if(!sd)return;
  const col=ssCols()[ci]; if(!col||col.type!=='prob')return;
  const target=sd.cols.find(c=>c.key===col.key); if(!target)return;
  const name=(prompt('유형 이름 바꾸기',target.label||'')||'').trim();
  if(!name||name===target.label)return;
  target.label=name;
  await ssPersistCols();
  renderEdGrid();
  showToast('✏️ 이름을 바꿨어요');
}
/** 열 삭제 — 그 유형의 문제가 통째로 사라지므로 개수를 세어 확인받는다. */
async function ssDeleteCol(ci){
  const sd=ssSubjDef(); if(!sd)return;
  const col=ssCols()[ci]; if(!col||col.type!=='prob')return;
  if(sd.cols.length<=1){showToast('유형이 하나뿐이라 지울 수 없어요');return;}
  const n=(DATA[curEdSubj]||[]).reduce((a,ch)=>a+((ch[col.key]||[]).length),0);
  const label=(sd.cols.find(c=>c.key===col.key)||{}).label||col.key;
  if(!confirm('‘'+label+'’ 열을 삭제할까요?'+(n?`\n이 유형의 문제 ${n}개와 진도가 함께 지워집니다.`:'')))return;
  const tp=colKeyToType(curEdSubj,col.key);
  sd.cols=sd.cols.filter(c=>c.key!==col.key);
  (DATA[curEdSubj]||[]).forEach(ch=>{ delete ch[col.key]; });
  edRows.forEach(r=>{ delete r[col.key]; });
  // 이 유형에 달린 진도·다시풀기 예약도 정리한다(가리킬 문제가 없어졌다)
  const pre=curEdSubj+'|';
  Object.keys(S).forEach(k=>{ const p=k.split('|'); if(k.startsWith(pre)&&p[2]===tp)delete S[k]; });
  RETRIES=RETRIES.filter(r=>!(r.subj===curEdSubj&&r.type===tp));
  ssResetState();
  await ssPersistCols();
  syncLegacy();
  await saveAllSubjData();await saveState();await saveRetries();
  if(pruneWeights())await saveWeights();
  buildMaps();buildDG();updateProgress();
  renderEdGrid();
  showToast('🗑 ‘'+label+'’ 열을 지웠어요');
}

function renderEdGrid(){
  const wrap=document.getElementById('ss-wrap');if(!wrap)return;
  const hadFocus=ssGridFocused();
  wrap.innerHTML='';
  wrap.tabIndex=0;
  if(!wrap.dataset.bound){
    wrap.dataset.bound='1';
    wrap.addEventListener('keydown',ssGridKey);
    wrap.addEventListener('focus',()=>wrap.classList.add('focused'));
    wrap.addEventListener('blur',()=>wrap.classList.remove('focused'));
  }
  const cols=ssCols();
  if(!edRows.length)edRows.push(ssBlankRow());
  // 선택이 범위를 벗어났으면 되돌린다(행 삭제 등)
  ssSel={r:Math.min(ssSel.r,ssMaxR()),c:Math.min(ssSel.c,ssMaxC()),
         r2:Math.min(ssSel.r2,ssMaxR()),c2:Math.min(ssSel.c2,ssMaxC())};

  const tbl=document.createElement('table');tbl.className='ss-table';
  const thead=document.createElement('thead');const htr=document.createElement('tr');
  const thN=document.createElement('th');thN.className='th-num';thN.textContent='#';
  thN.title='전체 선택';thN.onclick=()=>{ssSel={r:0,c:0,r2:ssMaxR(),c2:ssMaxC()};ssPaint();ssFocusGrid();};
  htr.appendChild(thN);
  cols.forEach((c,ci)=>{
    const th=document.createElement('th');th.className=c.type==='ch'?'ch-col':'prob-col';
    th.dataset.ci=ci;th.title=c.type==='prob'?'클릭: 열 전체 선택 · 더블클릭: 이름 바꾸기':'열 전체 선택';
    const box=document.createElement('div');box.className='th-in';
    const txt=document.createElement('div');txt.className='th-txt';
    if(c.color){const sp=document.createElement('span');sp.className='type-badge '+c.color;sp.textContent=c.label.split('\n')[0];txt.appendChild(sp);const sub=c.label.split('\n')[1];if(sub){txt.appendChild(document.createElement('br'));txt.appendChild(document.createTextNode(sub));}}
    else txt.innerHTML=c.label.replace('\n','<br>');
    box.appendChild(txt);
    if(c.type==='prob'){
      const del=document.createElement('button');del.className='col-del';del.type='button';
      del.textContent='✕';del.title='이 열(유형) 삭제';
      del.onclick=e=>{e.stopPropagation();ssDeleteCol(ci);};
      box.appendChild(del);
      th.ondblclick=e=>{e.preventDefault();ssRenameCol(ci);};
    }
    th.appendChild(box);
    th.onclick=()=>{ssSel={r:0,c:ci,r2:ssMaxR(),c2:ci};ssPaint();ssFocusGrid();};
    htr.appendChild(th);
  });
  // 열 추가 — 과목 설정까지 가지 않고 여기서 바로 유형을 늘린다
  const thA=document.createElement('th');thA.className='th-addcol';
  const addC=document.createElement('button');addC.className='add-col-btn';addC.type='button';
  addC.textContent='＋ 열';addC.title='새 문제 유형(열) 추가';
  addC.onclick=ssAddCol;
  thA.appendChild(addC);htr.appendChild(thA);
  const thD=document.createElement('th');thD.textContent='삭제';thD.style.minWidth='44px';htr.appendChild(thD);
  thead.appendChild(htr);tbl.appendChild(thead);

  const tbody=document.createElement('tbody');
  edRows.forEach((row,ri)=>{
    const tr=document.createElement('tr');tr.id='edr'+ri;
    const tdN=document.createElement('td');tdN.className='row-num';tdN.dataset.ri=ri;
    const nSpan=document.createElement('span');nSpan.textContent=ri+1;tdN.appendChild(nSpan);
    tdN.title='행 전체 선택';
    tdN.onclick=()=>{ssSel={r:ri,c:0,r2:ri,c2:ssMaxC()};ssPaint();ssFocusGrid();};
    const insB=document.createElement('button');insB.className='ins-btn';insB.textContent='+행';insB.title='아래에 행 삽입';
    insB.onclick=e=>{e.stopPropagation();insEdRow(ri);};
    tdN.appendChild(insB);tr.appendChild(tdN);

    cols.forEach((c,ci)=>{
      const td=document.createElement('td');
      td.className='ss-cell '+(c.type==='ch'?'cell-ch':'cell-prob');
      td.dataset.ri=ri;td.dataset.ci=ci;
      td.addEventListener('pointerdown',e=>{
        if(e.button===2)return;
        if(ssEdit&&(ssEdit.r!==ri||ssEdit.c!==ci))ssCommitEdit(true);
        if(ssEdit)return;                                   // 편집 중인 셀 안에서의 클릭은 그대로
        const wasActive=(ssSel.r===ri&&ssSel.c===ci&&ssSel.r2===ri&&ssSel.c2===ci);
        // preventDefault는 쓰지 않는다 — pointerdown을 막으면 뒤따르는 click/dblclick까지 죽는다.
        // 드래그 중 텍스트가 잡히는 건 .ss-cell{user-select:none}이 막아준다.
        ssFocusGrid();
        if(e.shiftKey){ssSelect(ri,ci,true);return;}
        ssSelect(ri,ci,false);ssDrag=true;
        // 터치: 이미 고른 셀을 다시 탭하면 편집 (스프레드시트 앱과 같은 동작)
        if(e.pointerType==='touch'&&wasActive)ssStartEdit(ri,ci);
      });
      td.addEventListener('pointerenter',()=>{ if(ssDrag&&!ssEdit)ssSelect(ri,ci,true); });
      td.addEventListener('dblclick',e=>{e.preventDefault();ssStartEdit(ri,ci);});
      tr.appendChild(td);
    });

    const tdSp=document.createElement('td');tdSp.className='cell-spacer';tr.appendChild(tdSp);   // '＋ 열' 머리글 자리
    const tdD=document.createElement('td');tdD.className='cell-del';
    const delB=document.createElement('button');delB.className='row-del';delB.title='행 삭제';delB.textContent='✕';
    delB.onclick=()=>{
      if(edRows.length<=1){showToast('마지막 행은 지울 수 없어요');return;}
      if(!confirm((row.ch||ri+1+'행')+' 삭제?'))return;
      ssSnap();edRows.splice(ri,1);renderEdGrid();
    };
    tdD.appendChild(delB);tr.appendChild(tdD);tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);wrap.appendChild(tbl);
  edRows.forEach((row,ri)=>cols.forEach((c,ci)=>ssRenderCell(ri,ci)));
  ssPaint();
  if(hadFocus)ssFocusGrid();
}

function addEdRow(){
  ssSnap();
  edRows.push(ssBlankRow());
  const r=ssMaxR();
  ssSel={r,c:0,r2:r,c2:0};
  renderEdGrid();ssFocusGrid();ssScrollIntoView();
}
function insEdRow(afterIdx){
  ssSnap();
  edRows.splice(afterIdx+1,0,ssBlankRow());
  ssSel={r:afterIdx+1,c:0,r2:afterIdx+1,c2:0};
  renderEdGrid();ssFocusGrid();ssScrollIntoView();
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
  edRows=newRows;ssResetState();goEdMode('grid');showToast(`✅ ${newRows.length}개 장이 그리드에 반영됐어요`);
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
  document.getElementById('ed-hint').textContent=m==='grid'?'셀 클릭 → 선택 · Enter/더블클릭 → 편집':'열 단위로 복사해서 붙여넣기';
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
    btn.style.setProperty('--stab-c',subjVar(s.id,'','var(--text2)'));
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
    pruneWeights();
    await saveWeights();
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
      cells.push(probs.map(p=>p[0]+(weightOfProb(p)>1?'*'+weightOfProb(p):'')+'('+p[1]+')').join(', '));
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
      cells.push(undone.map(p=>p[0]+(weightOfProb(p)>1?'*'+weightOfProb(p):'')+'('+p[1]+')').join(', '));
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
      cells.push(done.map(p=>p[0]+(weightOfProb(p)>1?'*'+weightOfProb(p):'')+'('+p[1]+')').join(', '));
    });
    if(hasDone)lines.push(cells.join('\t'));
  });
  if(!lines.length){showToast('완료된 문제가 없어요');return;}
  copyText(lines.join('\n'),'완료 TSV 복사 완료 ('+lines.length+'개 장)');
}

