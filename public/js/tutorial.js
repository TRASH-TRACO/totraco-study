// ══════════════════════════════════════════
// 빠른 튜토리얼 — 실제 화면 위에 스포트라이트 + 말풍선으로 사용법을 짚어준다.
// ══════════════════════════════════════════
// 처음 쓰는 사람은 "과목 등록 → 문제 등록 → 회독 배정"을 마치기 전까지 학습 화면이 비어 있어
// 설명할 대상이 아예 없다. 그래서 튜토리얼을 시작하면 임시 '샘플 과목'을 깔고 그 위에서 안내한다.
// 샘플은 끝내거나 도중에 닫아도 항상 지워진다 — 사용자의 실제 데이터는 건드리지 않는다.

const TUT_SUBJ_ID = 'tutorial_sample';
const TUT_DONE_KEY = 'tutorialDone';

let tutSteps = [], tutIdx = -1, tutSeeded = false, tutRestore = null, tutBusy = false;

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
// el: 하이라이트할 요소(없으면 그 단계는 건너뛴다) · before: 그 요소가 보이게 화면을 미리 맞추는 훅
function tutBuildSteps(){
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
      el: () => q('#view-day') && q('button.rbtn.sec[onclick*="openRescheduleModal"]'),
      title: '밀렸을 때',
      body: '계획이 밀려도 괜찮아요. <b>남은 문제 조정하기</b>로 완료한 건 모아두고, 남은 문제만 1일차부터 다시 나눠줍니다.'
    },
    {
      el: () => document.getElementById('nt-cal'),
      title: '기록은 캘린더에',
      body: '며칠에 어떤 문제를 풀었는지 달력에 쌓여요. <b>오답노트</b> 탭에는 오답으로 표시한 문제만 모입니다.'
    },
    {
      el: () => document.getElementById('hdr-setup'),
      title: '이제 내 과목을 만들 차례',
      body: '<b>과목 설정</b>에서 과목을 만들고 문제를 등록해요.<br>문제집을 고르면 목차가 통째로 들어옵니다.',
      last: true
    }
  ];
}

// ── 실행 ────────────────────────────────────
async function startTutorial(){
  if(tutBusy) return;
  tutBusy = true;
  try{
    tutRestore = { nav: curNav, subj: curSubj, view: curView, day: curDay };
    await tutSeedSample();
    tutSteps = tutBuildSteps();
    tutIdx = -1;
    document.getElementById('tut').style.display = 'block';
    tutNext();
  } finally { tutBusy = false; }
}
window.startTutorial = startTutorial;

function tutNext(){
  // 대상이 없는 단계는 건너뛴다 (화면 구성이 달라도 튜토리얼이 멈추지 않게)
  for(let i = tutIdx + 1; i < tutSteps.length; i++){
    const st = tutSteps[i];
    try{ if(st.before) st.before(); }catch(_){}
    const el = st.el();
    if(el && el.getClientRects().length){ tutIdx = i; tutShow(st, el); return; }
  }
  tutFinish();
}
window.tutNext = tutNext;

function tutShow(step, el){
  const card = document.getElementById('tut-card');
  document.getElementById('tut-title').innerHTML = step.title;
  document.getElementById('tut-body').innerHTML = step.body;
  document.getElementById('tut-step').textContent = (tutIdx + 1) + ' / ' + tutSteps.length;
  document.getElementById('tut-next').textContent = step.last ? '시작하기' : '다음';
  el.scrollIntoView({block:'center', behavior:'smooth'});
  // 스크롤이 끝난 뒤 위치를 잡아야 말풍선이 어긋나지 않는다
  setTimeout(() => tutPlace(el, card), 260);
}

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

/** 마지막 단계까지 본 경우 — 샘플을 지우고 과목 설정으로 넘겨준다. */
async function tutFinish(){
  await tutEnd(true);
  openSetup();
  showToast('👋 이제 과목을 만들어보세요');
}

/** 튜토리얼 종료 — 끝까지 봤든 도중에 닫았든 샘플은 항상 지운다. */
async function tutEnd(completed){
  document.getElementById('tut').style.display = 'none';
  document.getElementById('tut-arrow').style.display = 'none';
  tutIdx = -1; tutSteps = [];
  try{ localStorage.setItem(TUT_DONE_KEY, '1'); }catch(_){}
  await tutRemoveSample();
  // 튜토리얼 시작 전 보던 화면으로 되돌린다
  if(tutRestore){
    const ids = SUBJECTS.map(s => s.id);
    curSubj = (tutRestore.subj === 'all' || ids.includes(tutRestore.subj)) ? tutRestore.subj : (SUBJECTS[0] ? SUBJECTS[0].id : 'all');
    curView = tutRestore.view;
    goSubj(curSubj); goView(curView); goNav(tutRestore.nav || 'study');
    tutRestore = null;
  }
  if(!completed) showToast('튜토리얼을 닫았어요');
}
window.tutEnd = tutEnd;

window.addEventListener('resize', tutReposition);
window.addEventListener('keydown', e => {
  if(document.getElementById('tut')?.style.display !== 'block') return;
  if(e.key === 'Escape') tutEnd(false);
  else if(e.key === 'Enter') tutNext();
});
