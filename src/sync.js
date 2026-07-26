import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
         getRedirectResult, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
         doc, getDoc, setDoc, onSnapshot, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyD7X0NgYVXAN6hGv9nIutpxFCQK_PrYiDA",
  authDomain: "study-3f275.firebaseapp.com",
  projectId: "study-3f275",
  storageBucket: "study-3f275.firebasestorage.app",
  messagingSenderId: "365352183497",
  appId: "1:365352183497:web:3659e2fe9562dd5b79cf18"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
// 오프라인 지속성 — 끊겨도 쓰기가 쌓였다가 복구 시 전송됩니다.
// 시크릿 모드 등 IndexedDB를 못 쓰는 환경에서는 메모리 캐시로 물러납니다.
let db;
try{
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
}catch(e){
  console.warn('[sync] 오프라인 캐시 비활성:', e.message);
  db = initializeFirestore(app, {});
}

const PUSH_DEBOUNCE_MS = 2000;

let uid = null;          // 현재 로그인 사용자
let unsubDoc = null;     // onSnapshot 해제 함수
let pushTimer = null;
let suppress = 0;        // >0 이면 schedulePush 무시 (원격 적용 중)
let lastRev = null;      // 우리가 알고 있는 원격 문서의 rev
let reconciled = false;  // 최초 조정 완료 여부
let pendingConflict = null;

// ── 유틸 ────────────────────────────────────
const ref = () => doc(db, 'users', uid);
const newRev = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
// buildBlob()의 date는 호출할 때마다 갱신되므로 해시에서 제외해야 합니다.
// (포함하면 "로컬이 바뀌었다" 판정이 항상 참이 되어 매번 충돌로 오인합니다)
const hashOf = blob => { const { date, ...rest } = blob; return simpleHash(JSON.stringify(rest)); };

function deviceLabel(){
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad'
           : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac'
           : /Windows/.test(ua) ? 'Windows' : '기기';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome'
           : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : '';
  return (os + ' ' + br).trim();
}

function countChecked(blob){
  const p = blob.progress || {};
  return Object.keys(p).filter(k => p[k]).length;
}

function fmtTime(ms){
  if(!ms) return '시각 모름';
  const d = new Date(ms), n = new Date();
  const sameDay = d.toDateString() === n.toDateString();
  const hm = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  return sameDay ? ('오늘 ' + hm) : ((d.getMonth()+1) + '/' + d.getDate() + ' ' + hm);
}

// 원격 문서 → 백업 덩어리 (payload는 JSON 문자열로 저장되어 있음)
// 형식이 깨졌으면 null을 돌려주고 동기화를 건너뜁니다 — 로컬 데이터를 망가뜨리지 않기 위해서입니다.
function unpack(snap){
  try{
    const d = snap.data();
    if(!d || !d.payload) return null;
    const blob = validateBlob(JSON.parse(d.payload));
    const ts = d.updatedAt && d.updatedAt.toMillis ? d.updatedAt.toMillis() : (d.updatedAtMs || 0);
    return { blob, rev: d.rev || null, device: d.device || '다른 기기', at: ts };
  }catch(e){
    console.warn('[sync] 원격 데이터 형식 오류:', e.message);
    return null;
  }
}

// ── 동기화 메타 (IndexedDB) ─────────────────
// { uid, syncedHash, syncedRev, localTouchedAt }
const getMeta = async () => (await idbGet('cloud_meta')) || null;
const setMeta = m => idbSet('cloud_meta', m);

// ── UI 상태 표시 ────────────────────────────
function setChip(text, cls){
  const el = document.getElementById('sync-chip');
  if(!el) return;
  el.textContent = text;
  el.className = 'hdr-btn' + (cls ? ' ' + cls : '');
}
function setUserLabel(t){
  const el = document.getElementById('sync-user');
  if(el) el.textContent = t || '';
}

// Firestore 설정 누락도 원인이 화면에 안 드러나므로 한 번만 안내합니다
let warnedSetup = false;
function warnFirestoreSetup(e){
  const guide = {
    'permission-denied':
      '서버가 접근을 거부했습니다 — 보안 규칙이 아직 게시되지 않은 것 같습니다.\n\n' +
      'Firebase 콘솔 → Firestore Database → 규칙 탭에\n' +
      '저장소의 firestore.rules 내용을 붙여넣고 "게시"를 눌러주세요.',
    'not-found':
      'Firestore 데이터베이스가 아직 만들어지지 않았습니다.\n\n' +
      'Firebase 콘솔 → Firestore Database → 데이터베이스 만들기\n' +
      '(프로덕션 모드, 리전 asia-northeast3)'
  }[e.code];
  if(guide && !warnedSetup){ warnedSetup = true; alert(guide); }
}

// ── 업로드 ──────────────────────────────────
async function push(){
  if(!uid || !reconciled) return;
  const blob = buildBlob();
  const hash = hashOf(blob);
  const meta = await getMeta();
  if(meta && meta.uid === uid && meta.syncedHash === hash){ // 바뀐 게 없음
    setChip('동기화됨', 'ok');
    return;
  }
  setChip('저장 중', 'busy');
  const rev = newRev();
  try{
    await setDoc(ref(), {
      version:   4,
      rev,
      device:    deviceLabel(),
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
      payload:   JSON.stringify(blob)
    });
    lastRev = rev;
    await setMeta({ uid, syncedHash: hash, syncedRev: rev, localTouchedAt: Date.now() });
    setChip('동기화됨', 'ok');
  }catch(e){
    // 오프라인이면 Firestore가 큐에 쌓아두었다가 복구 시 보냅니다
    console.warn('[sync] 업로드 실패:', e.code || e.message);
    setChip('오프라인', 'err');
    warnFirestoreSetup(e);
  }
}

// ── 다운로드(원격 → 로컬) ───────────────────
async function pull(remote){
  suppress++;
  try{
    await applyBlob(remote.blob);
    lastRev = remote.rev;
    await setMeta({ uid, syncedHash: hashOf(buildBlob()), syncedRev: remote.rev, localTouchedAt: Date.now() });
  } finally { suppress--; }
  setChip('동기화됨', 'ok');
}

// ── 진도 합집합 병합 ────────────────────────
// 체크된 진도는 양쪽 다 살리고, 과목 설정·문제 데이터는 더 최근 쪽을 씁니다.
function mergeBlobs(local, remote, remoteIsNewer){
  const base = JSON.parse(JSON.stringify(remoteIsNewer ? remote : local));
  const prog = {};
  for(const k in (local.progress  || {})) if(local.progress[k])  prog[k] = true;
  for(const k in (remote.progress || {})) if(remote.progress[k]) prog[k] = true;
  base.progress = prog;
  return base;
}

// ── 충돌 모달 ───────────────────────────────
function showConflict(local, remote, localTouchedAt){
  // buildBlob()은 S·SUBJECTS·DATA를 참조로 담으므로, 모달이 떠 있는 동안
  // 로컬 상태가 바뀌어도 흔들리지 않도록 스냅샷을 떠 둡니다.
  pendingConflict = { local: JSON.parse(JSON.stringify(local)), remote, localTouchedAt };
  document.getElementById('cf-local').innerHTML =
    '<b>📱 이 기기</b> (' + escapeHtml(deviceLabel()) + ')<br>' +
    '체크 ' + countChecked(local) + '개<br>' +
    '<span style="color:var(--text3);">' + fmtTime(localTouchedAt) + '</span>';
  document.getElementById('cf-remote').innerHTML =
    '<b>☁️ 서버</b> (' + escapeHtml(remote.device) + ')<br>' +
    '체크 ' + countChecked(remote.blob) + '개<br>' +
    '<span style="color:var(--text3);">' + fmtTime(remote.at) + '</span>';
  document.getElementById('conflict-modal').style.display = 'flex';
  setChip('확인 필요', 'busy');
}

window.resolveConflict = async function(choice){
  const c = pendingConflict;
  if(!c) return;
  document.getElementById('conflict-modal').style.display = 'none';
  pendingConflict = null;
  reconciled = true;

  if(choice === 'remote'){
    await pull(c.remote);
    showToast('☁️ 서버 데이터로 맞췄어요');
  }else if(choice === 'local'){
    lastRev = null;
    await push();
    showToast('📱 이 기기 데이터로 맞췄어요');
  }else{ // merge
    const remoteNewer = c.remote.at > (c.localTouchedAt || 0);
    const merged = mergeBlobs(c.local, c.remote.blob, remoteNewer);
    suppress++;
    try{ await applyBlob(merged); } finally { suppress--; }
    await push();
    showToast('🤝 합쳤어요 — 체크 ' + countChecked(merged) + '개');
  }
  subscribe();
};

// ── 최초 조정 ───────────────────────────────
async function reconcile(){
  setChip('동기화 중', 'busy');
  const local = buildBlob();
  const localHash = hashOf(local);
  const meta = await getMeta();
  const sameAccount = meta && meta.uid === uid;

  let snap;
  try{ snap = await getDoc(ref()); }
  catch(e){
    console.warn('[sync] 원격 조회 실패:', e.code || e.message);
    setChip('오프라인', 'err');
    warnFirestoreSetup(e);
    reconciled = true; subscribe(); return;
  }

  const remote = snap.exists() ? unpack(snap) : null;

  // 원격에 아무것도 없음 → 이 기기 상태를 올림
  if(!remote){
    reconciled = true;
    lastRev = null;
    await push();
    subscribe();
    return;
  }

  // 이 기기에서 이 계정으로 처음 동기화 — 공통 조상이 없음
  if(!sameAccount){
    if(countChecked(local) === 0){
      // 로컬이 사실상 비어 있으면 그냥 서버 것을 받으면 됩니다
      reconciled = true;
      await pull(remote);
      subscribe();
      showToast('☁️ 서버에서 불러왔어요');
    }else{
      showConflict(local, remote, null);
    }
    return;
  }

  const localChanged  = localHash !== meta.syncedHash;
  const remoteChanged = remote.rev !== meta.syncedRev;

  if(localChanged && remoteChanged){
    showConflict(local, remote, meta.localTouchedAt);
    return;
  }

  reconciled = true;
  if(remoteChanged){
    await pull(remote);
    showToast('☁️ 다른 기기의 변경을 받았어요');
  }else if(localChanged){
    await push();
  }else{
    lastRev = remote.rev;
    setChip('동기화됨', 'ok');
  }
  subscribe();
}

// ── 실시간 구독 ─────────────────────────────
function subscribe(){
  if(unsubDoc) unsubDoc();
  unsubDoc = onSnapshot(ref(), snap => {
    if(!snap.exists()) return;
    if(snap.metadata.hasPendingWrites) return;   // 우리가 방금 쓴 것
    const remote = unpack(snap);
    if(!remote || remote.rev === lastRev) return; // 이미 반영됨
    pull(remote)
      .then(() => showToast('☁️ 다른 기기의 변경을 받았어요'))
      .catch(e => { console.warn('[sync] 적용 실패:', e.message); setChip('동기화 오류', 'err'); });
  }, err => {
    console.warn('[sync] 구독 오류:', err.code || err.message);
    setChip('오프라인', 'err');
    warnFirestoreSetup(err);
  });
}

// ── 로그인 / 로그아웃 ───────────────────────
async function login(){
  setChip('로그인 중', 'busy');
  const provider = new GoogleAuthProvider();
  try{
    await signInWithPopup(auth, provider);
  }catch(e){
    // 모바일에서 팝업이 막히는 경우가 많아 리디렉션으로 대체
    if(['auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request',
        'auth/operation-not-supported-in-this-environment'].includes(e.code)){
      try{ await signInWithRedirect(auth, provider); return; }catch(_){}
    }
    console.warn('[sync] 로그인 실패:', e.code || e.message);
    setChip('로그인', '');
    // 콘솔 설정 누락은 원인이 화면에 안 드러나면 찾기 어려우므로 해결 방법까지 안내합니다
    const guide = {
      'auth/operation-not-allowed':
        'Google 로그인이 아직 켜져 있지 않습니다.\n\n' +
        'Firebase 콘솔 → Authentication → Sign-in method →\n' +
        'Google → 사용 설정 → 지원 이메일 선택 → 저장',
      'auth/unauthorized-domain':
        '이 도메인(' + location.hostname + ')이 Firebase에 등록되어 있지 않습니다.\n\n' +
        'Firebase 콘솔 → Authentication → 설정 → 승인된 도메인에\n' +
        location.hostname + ' 을 추가해주세요.',
      'auth/configuration-not-found':
        'Authentication이 아직 시작되지 않았습니다.\n\n' +
        'Firebase 콘솔 → Authentication → 시작하기 를 먼저 눌러주세요.'
    }[e.code];
    if(guide) alert(guide);
    else if(e.code) showToast('로그인 실패 — ' + e.code);
  }
}

window.onSyncChipClick = function(){
  if(!uid){ login(); return; }
  if(confirm('로그아웃할까요?\n이 기기의 데이터는 그대로 남고, 동기화만 멈춥니다.')) signOut(auth);
};

// ── 진입점 ──────────────────────────────────
window.CloudSync = {
  schedulePush(){
    if(!uid || suppress > 0 || !reconciled) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, PUSH_DEBOUNCE_MS);
  }
};

getRedirectResult(auth).catch(() => {});

onAuthStateChanged(auth, async user => {
  // 앱의 최초 로드(init)가 끝난 뒤에 조정해야 buildBlob()이 올바른 상태를 봅니다
  await window.__appReady.catch(() => {});

  if(unsubDoc){ unsubDoc(); unsubDoc = null; }
  clearTimeout(pushTimer);
  reconciled = false;
  lastRev = null;

  if(!user){
    uid = null;
    setChip('로그인', '');
    setUserLabel('');
    return;
  }
  uid = user.uid;
  setUserLabel(user.email || '');
  try{
    await reconcile();
  }catch(e){
    console.warn('[sync] 조정 실패:', e.message);
    setChip('동기화 오류', 'err');
  }
});
