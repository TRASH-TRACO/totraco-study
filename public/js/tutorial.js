// ══════════════════════════════════════════
// 빠른 튜토리얼 — 실제 화면 위에 스포트라이트 + 말풍선으로 사용법을 짚어준다.
// ══════════════════════════════════════════
// 두 챕터로 나뉜다.
//  1) 학습 화면  — 임시 '샘플 과목'을 깔고 그 위에서 읽으며 익힌다(다음 버튼).
//  2) 과목 등록  — 샘플을 지우고 진짜 과목 설정에서 직접 따라 만든다(실제 조작 대기).
// 처음 쓰는 사람은 '과목 등록 → 문제 등록 → 회독 배정'을 마치기 전까지 학습 화면이 비어 있어
// 설명할 대상이 아예 없다. 그래서 1챕터에만 샘플을 쓴다.
// 샘플은 끝내거나 도중에 닫아도 항상 지워진다 — 사용자의 실제 데이터는 건드리지 않는다.

const TUT_SUBJ_ID = 'tutorial_sample';
const TUT_DONE_KEY = 'tutorialDone';

let tutSteps = [], tutIdx = -1, tutSeeded = false, tutRestore = null, tutBusy = false;
let tutChapter = '', tutWaitTimer = null;

// ── 샘플 과목 ────────────────────────────────
function tutSampleSubject(){
  const used = SUBJECTS.map(s => s.color);
  const cp = COLOR_PALETTE.find(c => !used.includes(c.id)) || COLOR_PALETTE[0];
  return {
    id: TUT_SUBJ_ID, name: '샘플 과목', color: cp.id,
    dataKey: TUT_SUBJ_ID + 'Data', idbKey: 'c' + TUT_SUBJ_ID,
    cols: [{key:'t', label:'이론', cls:'th'}, {key:'b', label:'기본', cls:'ba'}]
  };
}
/** 3장 × 3문제를 3일차에 나눠 담은 샘플을 만든다(1일차 첫 문제는 완료 상태로). */
async function tutSeedSample(){
  if(SUBJECTS.some(s => s.id === TUT_SUBJ_ID)) return;
  SUBJECTS.push(tutSampleSubject());
  DATA[TUT_SUBJ_ID] = [1,2,3].map(d => ({
    ch: d + '장 샘플',
    t: [[1, d, newPid()], [2, d, newPid()]],
    b: [[1, d, newPid()]]
  }));
  DEFAULTS[TUT_SUBJ_ID] = [];
  S[gk(TUT_SUBJ_ID, 0, 'theory', 1)] = true;   // 완료 칩이 하나 있어야 오답·다시풀기를 보여줄 수 있다
  tutSeeded = true;
  updateSubjectCSS();
  syncLegacy(); buildMaps();
  rebuildUI(); updateEmptyStates();
}
/** 샘플 과목과 그 흔적(진도·기록·재수강)을 모두 지운다. */
async function tutRemoveSample(){
  if(!tutSeeded) return;
  tutSeeded = false;
  const pids = new Set();
  (DATA[TUT_SUBJ_ID] || []).forEach(ch => ['t','b'].forEach(k =>
    (ch[k] || []).forEach(p => { if(Array.isArray(p) && p[2]) pids.add(p[2]); })));
  pids.forEach(pid => { delete LOG[pid]; });
  Object.keys(RETRY_DONE).forEach(k => { if(pids.has(k.split('|')[0])) delete RETRY_DONE[k]; });
  Object.keys(S).forEach(k => { if(k.startsWith(TUT_SUBJ_ID + '|')) delete S[k]; });
  Object.keys(WRONG).forEach(k => { if(k.startsWith(TUT_SUBJ_ID + '|')) delete WRONG[k]; });
  RETRIES = RETRIES.filter(r => r.subj !== TUT_SUBJ_ID);
  delete RETRY_BASE[TUT_SUBJ_ID];
  delete PLAN_SNAPSHOT[TUT_SUBJ_ID];
  SUBJECTS = SUBJECTS.filter(s => s.id !== TUT_SUBJ_ID);
  delete DATA[TUT_SUBJ_ID]; delete DEFAULTS[TUT_SUBJ_ID];
  try{ await idbDel('c' + TUT_SUBJ_ID); }catch(_){}
  try{ localStorage.removeItem('c' + TUT_SUBJ_ID); }catch(_){}
  updateSubjectCSS();
  ensureCurSubjects();
  syncLegacy(); buildMaps();
  await saveState(); await saveLog(); await saveRetries(); await saveRetryDone();
  rebuildUI(); updateEmptyStates(); refreshOnboarding();
}

// ── 단계 정의 ────────────────────────────────
// el      : 하이라이트할 요소(없으면 그 단계는 건너뛴다)
// before  : 그 요소가 보이게 화면을 미리 맞추는 훅
// action  : 있으면 '직접 해보는 단계'. 오버레이가 클릭을 통과시키고 until()이 참이 되면 자동으로 넘어간다.
const tutVisible = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };

function tutStepsLearn(){
  const q = sel => document.querySelector(sel);
  return [
    {
      before(){ goNav('study'); goSubj(TUT_SUBJ_ID); },
      el: () => document.getElementById('study-subj-tabs'),
      title: '과목별로 따로',
      body: '과목마다 진도를 따로 관리해요. <b>전체</b>를 누르면 모든 과목을 한 화면에서 볼 수 있어요.'
    },
    {
      el: () => document.getElementById('prog-cards-con'),
      title: '지금 어디까지 왔는지',
      body: '완료 체크를 할 때마다 진도율이 바로 올라가요.'
    },
    {
      before(){ goView('day'); },
      el: () => document.getElementById('dg'),
      title: '회독을 일차로 쪼개서',
      body: '문제를 등록하고 <b>회독 배정</b>을 하면 이렇게 일차 타일이 만들어져요.<br>타일을 누르면 그날 풀 문제가 아래에 펼쳐집니다.'
    },
    {
      before(){ selDay(1); },
      el: () => q('#dpanel .chip'),
      title: '누르면 완료',
      body: '문제 칩을 누르면 완료로 체크돼요. 다시 누르면 해제됩니다.<br>완료한 날짜는 <b>학습 캘린더</b>에 자동으로 쌓여요.'
    },
    {
      before(){ selDay(1); },
      el: () => q('#dpanel .chip.done ~ .pu-actions'),
      title: '틀렸으면 여기서',
      body: '완료한 문제에는 <b>오답</b>·<b>다시풀기</b> 버튼이 나와요.<br>다시풀기를 누르면 7일 뒤 일차에 자동으로 예약됩니다.'
    },
    {
      el: () => q('button.rbtn.sec[onclick*="openRescheduleModal"]'),
      title: '밀렸을 때',
      body: '계획이 밀려도 괜찮아요. <b>남은 문제 조정하기</b>로 완료한 건 모아두고, 남은 문제만 1일차부터 다시 나눠줍니다.'
    },
    {
      el: () => document.getElementById('nt-cal'),
      title: '기록은 캘린더에',
      body: '며칠에 어떤 문제를 풀었는지 달력에 쌓여요. <b>오답노트</b> 탭에는 오답으로 표시한 문제만 모입니다.',
      nextLabel: '내 과목 만들기',
      goSetup: true
    }
  ];
}

// 2챕터 — 샘플을 지운 뒤 진짜 과목 설정에서 직접 따라 만든다.
function tutStepsSetup(){
  return [
    {
      el: () => document.getElementById('btn-new-subject'),
      title: '① 과목 만들기',
      body: '여기서 과목을 추가해요. 직접 만들 수도 있고, <b>문제집</b>을 고르면 목차가 통째로 들어옵니다.',
      action: { hint: '👆 눌러서 과목 추가 창을 열어보세요', until: () => tutVisible('newsubj-modal') }
    },
    {
      el: () => document.getElementById('ns-mode-book'),
      title: '문제집이 있다면',
      body: '<b>문제집에서 불러오기</b>를 고르면 장·문제 번호를 일일이 넣지 않아도 돼요.<br>없으면 <b>직접 만들기</b>로 진행하세요.'
    },
    {
      el: () => document.getElementById('ns-name'),
      title: '과목 이름',
      body: '재무회계, 세법처럼 과목 이름을 적어주세요.'
    },
    {
      el: () => document.getElementById('ns-types'),
      title: '문제 유형 나누기',
      body: '이론·기본·심화처럼 유형을 나눠두면 학습 화면에서 색으로 구분돼요.<br>위 프리셋을 누르면 한 번에 채워집니다.'
    },
    {
      el: () => document.getElementById('ns-confirm'),
      title: '만들기',
      body: '누르면 과목이 바로 만들어져요.',
      action: { hint: '👆 눌러서 과목을 만들어보세요', until: () => !tutVisible('newsubj-modal') }
    },
    {
      before(){ if(typeof edIsCollapsed === 'function' && edIsCollapsed()) toggleEdSection(); },
      el: () => document.getElementById('nav-data'),
      title: '② 문제 등록',
      body: '장 이름과 문제 번호를 넣어요.<br><b>붙여넣기</b> 탭에는 엑셀에서 복사한 표를 그대로 붙여도 됩니다.'
    },
    {
      el: () => document.getElementById('nav-rand'),
      title: '③ 회독 배정',
      body: '며칠에 나눠 풀지 정하고 배정하면, 학습 탭에 <b>일차 타일</b>이 만들어져요.<br>같은 장이 한 일차에 몰리지 않게 알아서 흩어줍니다.',
      nextLabel: '다 됐어요',
      last: true
    }
  ];
}

// ── 실행 ────────────────────────────────────
async function startTutorial(){
  if(tutBusy) return;
  tutBusy = true;
  try{
    tutRestore = { nav: curNav, subj: curSubj, view: curView };
    await tutSeedSample();
    tutRun('학습 화면', tutStepsLearn());
  } finally { tutBusy = false; }
}
window.startTutorial = startTutorial;

/** 과목 등록만 다시 보기 — 이미 쓰고 있는 사람이 등록 방법만 확인할 때. */
async function startSetupTutorial(){
  if(tutBusy) return;
  tutRestore = { nav: curNav, subj: curSubj, view: curView };
  openSetup();
  tutRun('과목 등록', tutStepsSetup());
}
window.startSetupTutorial = startSetupTutorial;

function tutRun(chapter, steps){
  tutChapter = chapter;
  tutSteps = steps;
  tutIdx = -1;
  document.getElementById('tut').style.display = 'block';
  tutNext();
}

function tutNext(){
  tutStopWait();
  const prev = tutSteps[tutIdx];
  if(prev && prev.goSetup){ tutGoSetupChapter(); return; }
  if(prev && prev.last){ tutEnd(true); return; }
  // 대상이 없는 단계는 건너뛴다 (화면 구성이 달라도 튜토리얼이 멈추지 않게)
  for(let i = tutIdx + 1; i < tutSteps.length; i++){
    const st = tutSteps[i];
    try{ if(st.before) st.before(); }catch(_){}
    const el = st.el();
    if(el && el.getClientRects().length){ tutIdx = i; tutShow(st, el); return; }
  }
  tutEnd(true);
}
window.tutNext = tutNext;

/** 1챕터 → 2챕터: 샘플을 지우고 진짜 과목 설정으로 넘어간다. */
async function tutGoSetupChapter(){
  document.getElementById('tut').style.display = 'none';
  await tutRemoveSample();
  tutRestoreView();
  openSetup();
  setTimeout(() => tutRun('과목 등록', tutStepsSetup()), 120);
}

function tutShow(step, el){
  const card = document.getElementById('tut-card');
  document.getElementById('tut-title').innerHTML = step.title;
  document.getElementById('tut-body').innerHTML = step.body;
  document.getElementById('tut-step').textContent = tutChapter + ' ' + (tutIdx + 1) + '/' + tutSteps.length;

  const hint = document.getElementById('tut-hint');
  const next = document.getElementById('tut-next');
  const skip = document.getElementById('tut-skip');
  const overlay = document.getElementById('tut');
  if(step.action){
    // 직접 해보는 단계 — 오버레이가 클릭을 통과시키고, 실제로 하면 자동으로 넘어간다
    hint.textContent = step.action.hint; hint.style.display = '';
    next.style.display = 'none'; skip.style.display = '';
    overlay.classList.add('pass');
    tutStartWait(step.action.until);
  }else{
    hint.style.display = 'none';
    next.style.display = ''; skip.style.display = 'none';
    next.textContent = step.nextLabel || '다음';
    overlay.classList.remove('pass');
  }

  el.scrollIntoView({block:'center', behavior:'smooth'});
  // 스크롤이 끝난 뒤 위치를 잡아야 말풍선이 어긋나지 않는다
  setTimeout(() => tutPlace(el, card), 260);
}

// ── 직접 해보는 단계 대기 ─────────────────────
// 클릭 핸들러를 가로채는 대신 조건을 폴링한다 — 어떤 방식으로 하든(클릭·키보드) 똑같이 잡힌다.
function tutStartWait(until){
  tutStopWait();
  tutWaitTimer = setInterval(() => {
    let done = false;
    try{ done = !!until(); }catch(_){}
    if(done){ tutStopWait(); setTimeout(tutNext, 350); }
  }, 250);
}
function tutStopWait(){ if(tutWaitTimer){ clearInterval(tutWaitTimer); tutWaitTimer = null; } }

/** 스포트라이트 구멍과 말풍선을 대상 요소에 맞춘다. */
function tutPlace(el, card){
  const r = el.getBoundingClientRect();
  const pad = 6;
  const hole = document.getElementById('tut-hole');
  hole.style.left   = (r.left - pad) + 'px';
  hole.style.top    = (r.top - pad) + 'px';
  hole.style.width  = (r.width + pad * 2) + 'px';
  hole.style.height = (r.height + pad * 2) + 'px';

  const vw = window.innerWidth, vh = window.innerHeight, gap = 14;
  card.style.visibility = 'hidden';
  card.style.left = '0px'; card.style.top = '0px';
  const cw = card.offsetWidth, chh = card.offsetHeight;
  // 아래 공간이 부족하면 위로 붙인다
  const below = r.bottom + gap + chh <= vh - 8;
  const top = below ? r.bottom + gap : Math.max(8, r.top - gap - chh);
  let left = r.left + r.width / 2 - cw / 2;
  left = Math.max(12, Math.min(left, vw - cw - 12));
  card.style.left = left + 'px';
  card.style.top  = top + 'px';
  card.style.visibility = '';

  const arrow = document.getElementById('tut-arrow');
  const ax = Math.max(left + 14, Math.min(r.left + r.width / 2, left + cw - 14));
  arrow.style.left = (ax - 6) + 'px';
  arrow.style.top  = (below ? top - 6 : top + chh - 6) + 'px';
  arrow.style.display = 'block';
}

function tutReposition(){
  if(tutIdx < 0 || !tutSteps[tutIdx]) return;
  const el = tutSteps[tutIdx].el();
  if(el && el.getClientRects().length) tutPlace(el, document.getElementById('tut-card'));
}

/** 튜토리얼 시작 전 보던 화면으로 되돌린다. */
function tutRestoreView(){
  if(!tutRestore) return;
  const ids = SUBJECTS.map(s => s.id);
  curSubj = (tutRestore.subj === 'all' || ids.includes(tutRestore.subj)) ? tutRestore.subj
          : (SUBJECTS[0] ? SUBJECTS[0].id : 'all');
  curView = tutRestore.view;
  goSubj(curSubj); goView(curView); goNav(tutRestore.nav || 'study');
}

/** 튜토리얼 종료 — 끝까지 봤든 도중에 닫았든 샘플은 항상 지운다. */
async function tutEnd(completed){
  tutStopWait();
  const overlay = document.getElementById('tut');
  overlay.style.display = 'none';
  overlay.classList.remove('pass');
  document.getElementById('tut-arrow').style.display = 'none';
  const wasSetupChapter = tutChapter === '과목 등록';
  tutIdx = -1; tutSteps = []; tutChapter = '';
  try{ localStorage.setItem(TUT_DONE_KEY, '1'); }catch(_){}
  const hadSample = tutSeeded;
  await tutRemoveSample();
  // 과목 등록까지 마쳤으면 설정 화면에 그대로 두고, 그 외에는 보던 화면으로 되돌린다
  if(!(completed && wasSetupChapter)) tutRestoreView();
  tutRestore = null;
  if(completed && wasSetupChapter) showToast('🎉 준비 끝! 학습 탭에서 시작하세요');
  else if(!completed && hadSample) showToast('튜토리얼을 닫았어요');
}
window.tutEnd = tutEnd;

window.addEventListener('resize', tutReposition);
window.addEventListener('keydown', e => {
  if(document.getElementById('tut')?.style.display !== 'block') return;
  if(e.key === 'Escape') tutEnd(false);
  else if(e.key === 'Enter' && !tutWaitTimer) tutNext();
});
