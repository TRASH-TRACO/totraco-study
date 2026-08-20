// ══════════════════════════════════════════
// 스냅샷 / 버전 · 클라우드 동기화 공용
// ══════════════════════════════════════════
// 현재 상태 전체를 덩어리 하나로 (버전 스냅샷 · 클라우드 업로드 공용)
function buildBlob(){
  const data={version:4,date:new Date().toISOString(),progress:S,subjects:SUBJECTS,title:appTitle,userName,planSnapshot:PLAN_SNAPSHOT,log:LOG,dayNotes:DAYNOTES,retries:RETRIES,wrong:WRONG,retryBase:RETRY_BASE,retryDone:RETRY_DONE};
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
    await applyBlob(data,{replaceHistory:true});   // 되돌리기는 이력까지 그 시점으로
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
  if(data.log&&typeof data.log!=='object')throw new Error('풀이 기록 형식 오류');
  if(data.dayNotes&&typeof data.dayNotes!=='object')throw new Error('하루 기록 형식 오류');
  if(data.retries&&!Array.isArray(data.retries))throw new Error('재수강 형식 오류');
  if(data.subjects&&!Array.isArray(data.subjects))throw new Error('과목 설정 형식 오류');
  // legacy 키 검증 (호환성)
  if(data.finData&&!Array.isArray(data.finData))throw new Error('재무회계 데이터 형식 오류');
  if(data.costData&&!Array.isArray(data.costData))throw new Error('원가회계 데이터 형식 오류');
  if(data.taxData&&!Array.isArray(data.taxData))throw new Error('세법 데이터 형식 오류');
  return data;
}

// 덩어리를 현재 상태에 적용하고 UI 전체를 재구성 (버전 복원 · 클라우드 다운로드 공용)
// 호출 전에 validateBlob()으로 검증되어 있어야 합니다.
//
// opts.replaceHistory — 이력(풀이 기록·하루 기록·재수강 완료 표식)을 병합하지 않고 통째로 교체한다.
//   클라우드 다운로드는 기본값(병합): 다른 기기가 빈 기록을 올려도 내 이력이 사라지면 안 된다.
//   버전 복원은 true: "그 시점으로 되돌린다"가 목적이라 그 뒤에 쌓인 기록도 같이 되돌아가야 한다.
//   (병합만 하면 진도는 되돌아가는데 학습 캘린더엔 완료 취소된 문제가 그대로 남는다)
async function applyBlob(data,opts){
  const replaceHistory=!!(opts&&opts.replaceHistory);
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

  // 2-1) 풀이 날짜 기록 복원 — 동기화는 이력이 줄어들지 않게 "합집합"으로 병합,
  //      버전 복원은 스냅샷 그대로 교체(그 뒤에 완료한 기록도 캘린더에서 같이 사라져야 한다).
  if(data.log&&typeof data.log==='object')LOG=replaceHistory?data.log:mergeLogInto(LOG,data.log);
  // 2-2) 하루 한 줄 기록 복원 — 동기화는 빈 값이 로컬 기록을 지우지 못하게 병합, 복원은 교체
  if(data.dayNotes&&typeof data.dayNotes==='object')DAYNOTES=replaceHistory?data.dayNotes:mergeNotesInto(DAYNOTES,data.dayNotes);
  // 2-3) 재수강 복원 — 회차 단위라 최신 것으로 교체(진도 S와 동일 성격)
  if(Array.isArray(data.retries))RETRIES=data.retries;
  if(data.wrong&&typeof data.wrong==='object')WRONG=data.wrong;
  if(data.retryBase&&typeof data.retryBase==='object')RETRY_BASE=data.retryBase;
  // 재수강 완료 표식도 이력 → 동기화는 합집합(빈 값이 덮어쓰지 못하게), 복원은 교체
  if(data.retryDone&&typeof data.retryDone==='object')RETRY_DONE=replaceHistory?data.retryDone:{...RETRY_DONE,...data.retryDone};

  // 3) 데이터 복원 — SUBJECTS 기준으로 dataKey 매핑
  SUBJECTS.forEach(s=>{
    if(Array.isArray(data[s.dataKey])){
      DATA[s.id]=data[s.dataKey];
      // DEFAULTS는 유지 (data.json 기준)
    }
  });
  syncLegacy();
  ensurePids();  // 예전 백업엔 pid가 없을 수 있으니 보강

  // 4) 저장
  await saveState();
  await saveLog();
  await saveDayNotes();
  await saveRetries();
  await saveRetryDone();
  await saveAllSubjData();

  // 5) UI 전체 재구성
  buildMaps();
  renderStudyTabs();renderProgressCards();renderFooterBtns();
  buildDG();updateProgress();
  curDay=null;
  const dp=document.getElementById('dpanel');dp.classList.remove('on');dp.innerHTML='';
  if(curView==='chap')renderChaps();
  if(curNav==='cal')renderCalendar();
  if(curNav==='wrong')renderWrongNote();
  // 과목 설정 모달이 열려 있으면 내용도 갱신
  const setupM=document.getElementById('nav-setup');
  if(setupM&&setupM.style.display!=='none'){ renderSubjGrid(true);renderEd();renderAssignInfo();applyEdSection(); }
  document.getElementById('hdr-sub-names').textContent=SUBJECTS.map(s=>s.name).join(' · ');
  // 동기화로 데이터가 들어왔으면 빈 화면 안내·온보딩도 최신 상태로
  updateEmptyStates();
  refreshOnboarding();
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
  if(!confirm('모든 문제를 미완료로 초기화할까요?\n(다시 풀기·오답 표시도 함께 초기화됩니다)'))return;
  S={};await saveState();
  await clearAllRetries();   // 재수강·오답 제거 + 밀린 정규 일차 복원
  // 완료 묶음(완료된 문제)을 원래 순서대로 되돌린다
  await restoreAfterReset(SUBJECTS.map(s=>s.id));
  curDay=null;
  const dp=document.getElementById('dpanel');dp.classList.remove('on');dp.innerHTML='';
  buildMaps();buildDG();if(curView==='chap')renderChaps();updateProgress();
}
async function resetAll(){
  if(!confirm('전체 진도를 초기화할까요?'))return;
  S={};await saveState();
  await clearAllRetries();
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

