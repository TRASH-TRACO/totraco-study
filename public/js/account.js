// ══════════════════════════════════════════
// 사용자 이름 (로그인 후 1회 수집 · 동기화됨)
// ══════════════════════════════════════════
let userName='';
async function loadUserName(){
  try{ const n=await idbGet('user_name'); if(typeof n==='string') userName=n; }catch(_){}
}
window.getUserName=()=>userName;

/** 로그인 직후 이름이 없으면 입력 모달을 띄운다(구글 표시이름을 기본값으로). */
function ensureUserName(googleName){
  if(userName&&userName.trim())return;
  const inp=document.getElementById('name-input');
  if(inp)inp.value=(googleName||'').trim();
  const m=document.getElementById('name-modal');
  if(m)m.style.display='flex';
  setTimeout(()=>{ if(inp)inp.focus(); },100);
}
window.ensureUserName=ensureUserName;

async function saveUserName(){
  const inp=document.getElementById('name-input');
  const v=(inp?inp.value:'').trim();
  if(!v){ closeNameModal(); return; }
  userName=v;
  try{ await idbSet('user_name', userName); }catch(_){}
  closeNameModal();
  if(typeof window.__refreshUserLabel==='function') window.__refreshUserLabel();
  if(window.CloudSync&&window.CloudSync.schedulePush) window.CloudSync.schedulePush();
  showToast('반가워요, '+v+'님!');
}
function skipUserName(){ closeNameModal(); }
function closeNameModal(){ const m=document.getElementById('name-modal'); if(m)m.style.display='none'; }
window.saveUserName=saveUserName;
window.skipUserName=skipUserName;

// ══════════════════════════════════════════
// 로그아웃 (동기화 중단 · 이 기기 데이터 유지/삭제 선택)
// ══════════════════════════════════════════
function openLogoutModal(){ const m=document.getElementById('logout-modal'); if(m)m.style.display='flex'; }
function closeLogoutModal(){ const m=document.getElementById('logout-modal'); if(m)m.style.display='none'; }
window.openLogoutModal=openLogoutModal;
window.closeLogoutModal=closeLogoutModal;

/**
 * wipe=false: 로그아웃만 — 이 기기 데이터는 그대로 둔다(로컬 계속 사용 가능).
 * wipe=true : 로그아웃 + 이 기기 앱 데이터(IndexedDB·localStorage) 전체 삭제 후 새로고침.
 *             클라우드(계정) 데이터는 건드리지 않으므로 다시 로그인하면 되돌아온다.
 */
async function doLogout(wipe){
  closeLogoutModal();
  if(wipe && !confirm('이 기기의 진도·과목·설정을 지우고 로그아웃할까요?\n클라우드에 저장된 데이터는 그대로라 다시 로그인하면 불러옵니다.')) return;
  // 1) 동기화 중단(로그아웃). 이후 pull/push가 로컬을 덮어쓰지 않게 먼저 끊는다.
  try{ await window.CloudSync?.signOut?.(); }catch(_){}
  if(!wipe){ showToast('로그아웃됐어요 — 이 기기 데이터는 그대로예요'); return; }
  // 2) 이 기기 앱 데이터 전체 삭제 후 깨끗한 상태로 새로고침
  try{ await idbClear(); }catch(_){}
  try{ localStorage.clear(); }catch(_){}
  showToast('🗑 이 기기 데이터를 지웠어요');
  setTimeout(()=>location.reload(), 500);
}
window.doLogout=doLogout;

function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2500);}


// ══════════════════════════════════════════
// 데이터 로드
// ══════════════════════════════════════════
// 공개 서비스에서는 예시 데이터를 주입하지 않는다.
// 사용자가 직접 등록한 과목·문제만 다루며, 저장된 값은 loadData()가 읽는다.
async function fetchData(){
  SUBJECTS.forEach(s=>{ if(!DEFAULTS[s.id]) DEFAULTS[s.id]=[]; });
  syncLegacy();
}
