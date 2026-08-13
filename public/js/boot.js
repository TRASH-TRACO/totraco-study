// ══════════════════════════════════════════
// 마지막으로 보던 화면 기억 (이 기기 로컬 · 동기화 대상 아님)
// ══════════════════════════════════════════
const VIEW_KEY='ui_view';
let _pendingDay=null;   // 복원용: 렌더 중 goSubj가 curDay를 지우므로 따로 들고 있는다
function saveView(){
  try{
    localStorage.setItem(VIEW_KEY, JSON.stringify({
      nav:curNav, subj:curSubj, view:curView, day:curDay,
      calY:calYear, calM:calMonth, calSel:calSelDate
    }));
  }catch(_){}
}
/** 저장된 화면 상태를 전역에 복원(검증 포함). init에서 렌더 전에 호출. */
function loadSavedView(){
  let v=null;
  try{ const s=localStorage.getItem(VIEW_KEY); if(s)v=JSON.parse(s); }catch(_){}
  if(!v||typeof v!=='object')return;
  const ids=SUBJECTS.map(s=>s.id);
  if(v.nav==='study'||v.nav==='cal'||v.nav==='setup') curNav=v.nav;
  if(v.subj==='all'||ids.includes(v.subj)) curSubj=v.subj;
  if(v.view==='day'||v.view==='chap') curView=v.view;
  _pendingDay=(typeof v.day==='number')?v.day:null;   // 실제 적용·검증은 restoreView에서
  if(typeof v.calY==='number') calYear=v.calY;
  if(typeof v.calM==='number'&&v.calM>=0&&v.calM<=11) calMonth=v.calM;
  if(typeof v.calSel==='string') calSelDate=v.calSel;
}
/** 렌더가 끝난 뒤 DOM에 화면 상태 반영(뷰 토글·선택 일자·활성 탭). */
function restoreView(){
  goView(curView);   // 일차별/장별 토글 반영
  // 선택했던 일자 패널 복원 — 그 일자에 배정된 문제가 아직 있을 때만
  if(_pendingDay!=null){
    const dm=getDM();
    if(dm && dm[_pendingDay] && dm[_pendingDay].length) selDay(_pendingDay);
  }
  goNav(curNav);     // 활성 탭 반영 (cal이면 renderCalendar가 저장된 월·선택날짜 사용)
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
  await loadLog();
  await loadDayNotes();
  await loadRetries();
  await loadRetryDone();
  if(ensurePids()) await saveAllSubjData();  // 기존 문제에 고유 ID 채우기(최초 1회 마이그레이션)
  buildMaps();
  loadSavedView();   // 마지막으로 보던 화면을 렌더 전에 전역으로 복원
  const now=new Date();document.getElementById('today-date').textContent=`${now.getFullYear()}. ${now.getMonth()+1}. ${now.getDate()}`;
  buildDG();updateProgress();
  renderStudyTabs();renderProgressCards();renderFooterBtns();updateProgress();
  document.getElementById('hdr-sub-names').textContent=SUBJECTS.map(s=>s.name).join(' · ');
  applyEntryGate();
  refreshOnboarding();
  restoreView();     // 뷰 토글·선택 일자·활성 탭을 DOM에 반영
  // 아직 아무것도 없으면 준비 화면부터 보여준다
  if(!hasAnyProblems()) goNav('setup');
  // 모든 렌더가 끝났으니 앱을 드러낸다 (깜빡임 방지용 booting 해제)
  document.documentElement.classList.remove('booting');
}
// 클라우드 동기화 모듈이 최초 로드 완료를 기다릴 수 있도록 promise를 노출
// init이 실패로 끝나더라도 앱이 계속 숨겨지지 않도록 booting은 반드시 해제한다.
window.__appReady = init().finally(()=>{document.documentElement.classList.remove('booting');});
