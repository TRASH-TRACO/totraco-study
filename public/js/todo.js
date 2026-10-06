// ══════════════════════════════════════════
// 할 일 (Todo)
// ══════════════════════════════════════════
// 공부와 직접 묶이지 않는 잡다한 할 일을 적어두는 탭.
// TODOS: [{ id, text, done, created, doneAt }] — 추가 순서대로 두되, 완료한 건 아래로 내린다.
let TODOS=[];
let _todoEditId=null;            // 수정 중인 항목
const TODO_MAX=200;              // 한 줄 길이 제한

function newTodoId(){ return 't'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

async function saveTodos(){
  try{ await idbSet('todos',TODOS); }
  catch(_){ try{ localStorage.setItem('todos',JSON.stringify(TODOS)); }catch(__){} }
  window.CloudSync?.schedulePush();
}
async function loadTodos(){
  try{ const v=await idbGet('todos'); if(Array.isArray(v))TODOS=v; }
  catch(_){ try{ const s=localStorage.getItem('todos'); if(s)TODOS=JSON.parse(s); }catch(__){} }
  if(!Array.isArray(TODOS))TODOS=[];
}

// ── 조작 ──────────────────────────────────
function addTodo(text){
  const t=(text||'').trim().slice(0,TODO_MAX);
  if(!t)return false;
  TODOS.push({id:newTodoId(),text:t,done:false,created:todayStr()});
  saveTodos();
  return true;
}
function updateTodo(id,text){
  const it=TODOS.find(x=>x.id===id); if(!it)return false;
  const t=(text||'').trim().slice(0,TODO_MAX);
  if(!t){ return removeTodo(id); }   // 비우면 삭제와 같다
  if(it.text===t)return false;
  it.text=t;saveTodos();return true;
}
function toggleTodo(id){
  const it=TODOS.find(x=>x.id===id); if(!it)return;
  it.done=!it.done;
  if(it.done)it.doneAt=todayStr(); else delete it.doneAt;
  saveTodos();
}
function removeTodo(id){
  const i=TODOS.findIndex(x=>x.id===id); if(i<0)return false;
  TODOS.splice(i,1);saveTodos();return true;
}
function clearDoneTodos(){
  const n=TODOS.filter(t=>t.done).length;
  if(!n){showToast('완료한 할 일이 없어요');return;}
  if(!confirm('완료한 '+n+'개를 지울까요?'))return;
  TODOS=TODOS.filter(t=>!t.done);saveTodos();renderTodos();
  showToast('🗑 완료한 '+n+'개를 지웠어요');
}
/** 미완료 먼저, 그 안에서는 추가한 순서대로 */
function todoOrder(){
  const undone=TODOS.filter(t=>!t.done);
  const done=TODOS.filter(t=>t.done);
  return undone.concat(done);
}

// ── 화면 ──────────────────────────────────
function todoAddFromInput(){
  const inp=document.getElementById('todo-input');
  if(!inp)return;
  if(!addTodo(inp.value)){ inp.focus(); return; }
  inp.value='';
  renderTodos();
  const again=document.getElementById('todo-input');
  if(again)again.focus();   // 연달아 적기 좋게 포커스를 유지한다
}
function todoInputKey(e){
  if(e.key==='Enter'){ e.preventDefault(); todoAddFromInput(); }
}
function startEditTodo(id){ _todoEditId=id; renderTodos(); }
function cancelEditTodo(){ _todoEditId=null; renderTodos(); }
function commitEditTodo(id){
  const inp=document.getElementById('todo-edit-input');
  if(inp)updateTodo(id,inp.value);
  _todoEditId=null;renderTodos();
}

function renderTodos(){
  const body=document.getElementById('todo-body');
  if(!body)return;
  const empty=document.getElementById('todo-empty');
  const list=todoOrder();
  const doneN=TODOS.filter(t=>t.done).length;
  if(empty)empty.style.display=TODOS.length?'none':'block';

  // 요약 + 완료 지우기
  const meta=document.getElementById('todo-meta');
  if(meta){
    meta.innerHTML='';
    if(TODOS.length){
      const sum=document.createElement('span');sum.className='todo-sum';
      sum.textContent=TODOS.length+'개 · '+doneN+'개 완료';
      meta.appendChild(sum);
      if(doneN){
        const cb=document.createElement('button');cb.type='button';cb.className='pu-btn';
        cb.textContent='완료 지우기';cb.onclick=clearDoneTodos;
        meta.appendChild(cb);
      }
    }
  }

  body.innerHTML='';
  list.forEach(t=>{
    const row=document.createElement('div');row.className='todo-item'+(t.done?' done':'');

    // 완료 체크
    const box=document.createElement('button');box.type='button';box.className='todo-check';
    box.title=t.done?'완료 해제':'완료';
    box.textContent=t.done?'✓':'';
    box.onclick=()=>{ toggleTodo(t.id); renderTodos(); };
    row.appendChild(box);

    if(_todoEditId===t.id){
      // 수정 모드 — 인풋 + 저장/취소
      const inp=document.createElement('input');inp.className='todo-edit';inp.id='todo-edit-input';
      inp.value=t.text;inp.maxLength=TODO_MAX;
      inp.onkeydown=e=>{
        if(e.key==='Enter'){ e.preventDefault(); commitEditTodo(t.id); }
        else if(e.key==='Escape'){ e.preventDefault(); cancelEditTodo(); }
      };
      row.appendChild(inp);
      const ok=document.createElement('button');ok.type='button';ok.className='pu-btn todo-act';
      ok.textContent='저장';ok.onclick=()=>commitEditTodo(t.id);
      const no=document.createElement('button');no.type='button';no.className='pu-btn todo-act';
      no.textContent='취소';no.onclick=cancelEditTodo;
      row.appendChild(ok);row.appendChild(no);
      setTimeout(()=>{ const el=document.getElementById('todo-edit-input'); if(el){el.focus();el.select();} },0);
    } else {
      const txt=document.createElement('div');txt.className='todo-text';txt.textContent=t.text;
      txt.title='눌러서 수정';
      txt.onclick=()=>startEditTodo(t.id);
      row.appendChild(txt);
      if(t.done&&t.doneAt){
        const d=document.createElement('span');d.className='todo-date';d.textContent=fmtSolvedDate(t.doneAt);
        row.appendChild(d);
      }
      const eb=document.createElement('button');eb.type='button';eb.className='pu-btn todo-act';
      eb.textContent='수정';eb.onclick=()=>startEditTodo(t.id);
      row.appendChild(eb);
      const xb=document.createElement('button');xb.type='button';xb.className='todo-del';
      xb.textContent='✕';xb.title='삭제';
      xb.onclick=()=>{ if(removeTodo(t.id))renderTodos(); };
      row.appendChild(xb);
    }
    body.appendChild(row);
  });
}
