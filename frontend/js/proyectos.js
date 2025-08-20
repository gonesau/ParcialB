let currentProject = null;
let membersCache = [];
let tasksCache = [];
let boardByPriority = false;

async function initProjects(force=false){
  if(!force && $('#projectsList').dataset.ready) return;
  await loadMembersForSelects();
  bindProjectForm();
  bindSearch();
  bindTaskForm();
  bindFilters();
  bindBoardToggle();
  await renderProjects();
  $('#projectsList').dataset.ready = '1';
}

async function loadMembersForSelects(){
  const res = await fetch(`${API}/members`);
  membersCache = await res.json();
  const ownerSel = $('#pOwner'); const tAssignee = $('#tAssignee'); const fAssignee = $('#fAssignee');
  ownerSel.innerHTML = membersCache.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
  tAssignee.innerHTML = membersCache.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
  fAssignee.innerHTML = `<option value="">Asignado (todos)</option>`+membersCache.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
}

function bindProjectForm(){
  $('#projectForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = $('#pName').value.trim();
    const desc = $('#pDesc').value.trim();
    const deadline = $('#pDeadline').value;
    const priority = $('#pPriority').value;
    const responsibleId = parseInt($('#pOwner').value,10);
    if(!name) return Swal.fire({icon:'warning', title:'Nombre requerido'});
    if(!deadline || dayjs(deadline).isBefore(dayjs().startOf('day')))
      return Swal.fire({icon:'error', title:'Fecha inválida', text:'No se permiten fechas pasadas'});
    const payload = { name, description:desc, deadline, priority, responsibleId, createdAt:new Date().toISOString() };
    const res = await fetch(`${API}/projects`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    if(res.ok){
      Swal.fire({icon:'success', title:'Proyecto creado'});
      e.target.reset();
      renderProjects();
    }else{
      Swal.fire({icon:'error', title:'No se pudo crear'});
    }
  });
}

function bindSearch(){
  $('#searchProject').addEventListener('input', ()=>renderProjects());
}

async function renderProjects(){
  showSpinner();
  const list = $('#projectsList'); list.innerHTML='';
  const [projects, tasks] = await Promise.all([
    (await fetch(`${API}/projects`)).json(),
    (await fetch(`${API}/tasks`)).json()
  ]);
  tasksCache = tasks;

  const term = $('#searchProject').value.toLowerCase();
  for(const p of projects){
    const pTasks = tasks.filter(t=>t.projectId===p.id);
    const done = pTasks.filter(t=>t.status==='Completada' || t.completed).length;
    const progress = pTasks.length? Math.round(done*100/pTasks.length):0;
    const resp = membersCache.find(m=>m.id===p.responsibleId)?.name ?? '—';
    if(term && !(`${p.name} ${resp}`.toLowerCase().includes(term))) continue;

    const progClass = progress<34?'low':progress<67?'mid':'high';
    const row = document.createElement('div'); row.className='project fade-in';
    row.innerHTML = `
      <div>
        <div><strong>${p.name}</strong></div>
        <div class="muted">${p.description??''}</div>
      </div>
      <div>
        <div class="progress ${progClass}"><span style="width:${progress}%"></span></div>
        <small class="muted">${progress}%</small>
      </div>
      <div>
        <div>Limite: <strong>${p.deadline}</strong></div>
        <div>Prioridad: <span class="badge">${p.priority}</span></div>
      </div>
      <div class="actions">
        <span class="badge">${resp}</span>
        <button class="btn btn-ghost" data-act="view">Ver detalles</button>
        <button class="btn btn-ghost" data-act="edit">Editar</button>
        <button class="btn btn-danger" data-act="delete">Eliminar</button>
      </div>
    `;
    row.querySelector('[data-act="view"]').addEventListener('click', ()=>openProject(p));
    row.querySelector('[data-act="edit"]').addEventListener('click', ()=>editProject(p));
    row.querySelector('[data-act="delete"]').addEventListener('click', ()=>deleteProject(p));
    list.appendChild(row);

    // Notificación >80%
    if(progress>=80){
      toast.fire({icon:'info', title:`${p.name}: >80% completado`});
    }
  }
  hideSpinner();
}

async function editProject(p){
  const { value: formValues } = await Swal.fire({
    title: 'Editar proyecto',
    html: `
    <input id="swName" class="swal2-input" placeholder="Nombre" value="${p.name}">
    <input id="swDeadline" class="swal2-input" type="date" value="${p.deadline}">
    <select id="swPriority" class="swal2-input">
      <option ${p.priority==='Alta'?'selected':''}>Alta</option>
      <option ${p.priority==='Media'?'selected':''}>Media</option>
      <option ${p.priority==='Baja'?'selected':''}>Baja</option>
    </select>
    `,
    focusConfirm: false,
    preConfirm: () => {
      const name = document.getElementById('swName').value.trim();
      const deadline = document.getElementById('swDeadline').value;
      const priority = document.getElementById('swPriority').value;
      if(!name || !deadline) Swal.showValidationMessage('Nombre y fecha requeridos');
      if(dayjs(deadline).isBefore(dayjs().startOf('day'))) Swal.showValidationMessage('Fecha inválida');
      return {name, deadline, priority};
    }
  });
  if(!formValues) return;
  await fetch(`${API}/projects/${p.id}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(formValues)});
  renderProjects();
}

async function deleteProject(p){
  const ok = await Swal.fire({icon:'warning', title:'¿Eliminar proyecto?', showCancelButton:true});
  if(!ok.isConfirmed) return;
  // Elimina tareas del proyecto
  const tasks = await (await fetch(`${API}/tasks?projectId=${p.id}`)).json();
  await Promise.all(tasks.map(t=>fetch(`${API}/tasks/${t.id}`,{method:'DELETE'})));
  await fetch(`${API}/projects/${p.id}`,{method:'DELETE'});
  renderProjects();
}

function openProject(p){
  currentProject = p;
  $('#projectDetails').hidden = false;
  $('#pdTitle').textContent = `Proyecto: ${p.name}`;
  $('#exportJsonBtn').onclick = exportProjectTasks;
  loadTasksBoard();
}

function bindTaskForm(){
  $('#taskForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(!currentProject) return Swal.fire({icon:'info', title:'Primero abre un proyecto'});
    const title = $('#tTitle').value.trim();
    const assigneeId = parseInt($('#tAssignee').value,10);
    const dueDate = $('#tDue').value;
    const status = $('#tStatus').value;
    const label = $('#tLabel').value.trim() || 'General';
    const priority = $('#tPriority').value;
    if(!title) return Swal.fire({icon:'warning', title:'Título requerido'});
    if(dayjs(dueDate).isBefore(dayjs().startOf('day'))) return Swal.fire({icon:'error', title:'Fecha inválida'});
    const payload = { projectId: currentProject.id, title, assigneeId, dueDate, status, label, priority, completed: status==='Completada', subtasks: [] };
    const res = await fetch(`${API}/tasks`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    if(res.ok){ e.target.reset(); toast.fire({icon:'success', title:'Tarea creada'}); loadTasksBoard(true); }
  });
}

function bindFilters(){
  $('#fStatus').addEventListener('change',()=>loadTasksBoard());
  $('#fPriority').addEventListener('change',()=>loadTasksBoard());
  $('#fAssignee').addEventListener('change',()=>loadTasksBoard());
  $('#clearFilters').addEventListener('click', ()=>{
    $('#fStatus').value=''; $('#fPriority').value=''; $('#fAssignee').value='';
    loadTasksBoard();
  });
}

function bindBoardToggle(){
  $('#boardModeToggle').addEventListener('change', (e)=>{
    boardByPriority = e.target.checked;
    renderBoardColumns();
    loadTasksBoard();
  });
}

function renderBoardColumns(){
  const kanban = $('#kanban');
  if(boardByPriority){
    kanban.innerHTML = `
      <div class="column" data-col="Alta"><h3>Alta</h3><div class="dropzone" data-accept="Alta"></div></div>
      <div class="column" data-col="Media"><h3>Media</h3><div class="dropzone" data-accept="Media"></div></div>
      <div class="column" data-col="Baja"><h3>Baja</h3><div class="dropzone" data-accept="Baja"></div></div>
    `;
  }else{
    kanban.innerHTML = `
      <div class="column" data-col="Pendiente"><h3>Pendiente</h3><div class="dropzone" data-accept="Pendiente"></div></div>
      <div class="column" data-col="En Progreso"><h3>En Progreso</h3><div class="dropzone" data-accept="En Progreso"></div></div>
      <div class="column" data-col="Completada"><h3>Completada</h3><div class="dropzone" data-accept="Completada"></div></div>
    `;
  }
}

async function loadTasksBoard(noSpinner){
  if(!currentProject) return;
  if(!noSpinner) showSpinner();
  try{
    let tasks = await (await fetch(`${API}/tasks?projectId=${currentProject.id}`)).json();
    tasksCache = tasks;
    // Filtros
    const fs = $('#fStatus').value; const fp = $('#fPriority').value; const fa = $('#fAssignee').value;
    tasks = tasks.filter(t=>(!fs || t.status===fs) && (!fp || t.priority===fp) && (!fa || String(t.assigneeId)===fa));
    // Render
    $$('.dropzone').forEach(z=>z.innerHTML='');
    for(const t of tasks){
      const card = renderTaskCard(t);
      const colKey = boardByPriority ? t.priority : t.status;
      const dz = $(`.dropzone[data-accept="${colKey}"]`);
      if(dz) dz.appendChild(card);
      // alerta tareas próximas a vencer (<2 días)
      if(dayjs(t.dueDate).diff(dayjs(),'day')<=2 && t.status!=='Completada'){
        toast.fire({icon:'warning', title:`${t.title} vence pronto`});
      }
    }
    // DnD
    enableDnD();
    // Refresh proyectos para progreso
    renderProjects();
  } finally { if(!noSpinner) hideSpinner(); }
}

function renderTaskCard(t){
  const assignee = membersCache.find(m=>m.id===t.assigneeId)?.name ?? '—';
  const el = document.createElement('div'); el.className='task'; el.draggable = true; el.dataset.id = t.id; el.dataset.priority = t.priority;
  el.innerHTML = `
    <div class="row">
      <div><input type="checkbox" ${t.completed?'checked':''} data-act="done"> <strong>${t.title}</strong></div>
      <div class="actions">
        <span class="badge">${t.label}</span>
        <button class="btn btn-ghost" data-act="sub">Subtareas</button>
        <button class="btn btn-ghost" data-act="edit">Editar</button>
        <button class="btn btn-danger" data-act="del">Eliminar</button>
      </div>
    </div>
    <div class="row">
      <small class="muted">Asignado: ${assignee}</small>
      <small class="muted">Límite: ${t.dueDate}</small>
      <small class="badge">${t.status}</small>
      <small class="badge">${t.priority}</small>
    </div>
  `;
  el.querySelector('[data-act="done"]').addEventListener('change', async (e)=>{
    const completed = e.target.checked;
    const status = completed ? 'Completada' : (t.status==='Completada' ? 'Pendiente' : t.status);
    await fetch(`${API}/tasks/${t.id}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ completed, status })});
    el.classList.add('task-completed');
    loadTasksBoard(true);
  });
  el.querySelector('[data-act="del"]').addEventListener('click', async ()=>{
    const ok = await Swal.fire({icon:'warning', title:'¿Eliminar tarea?', showCancelButton:true});
    if(!ok.isConfirmed) return;
    await fetch(`${API}/tasks/${t.id}`,{method:'DELETE'});
    loadTasksBoard(true);
  });
  el.querySelector('[data-act="edit"]').addEventListener('click', ()=>editTask(t));
  el.querySelector('[data-act="sub"]').addEventListener('click', ()=>manageSubtasks(t));
  return el;
}

function enableDnD(){
  $$('.task').forEach(task=>{
    task.addEventListener('dragstart', e=>{ e.dataTransfer.setData('text/plain', task.dataset.id); });
  });
  $$('.dropzone').forEach(zone=>{
    zone.addEventListener('dragover', e=>{ e.preventDefault(); zone.style.background='rgba(0,0,0,.06)'; });
    zone.addEventListener('dragleave', ()=> zone.style.background='transparent');
    zone.addEventListener('drop', async (e)=>{
      e.preventDefault(); zone.style.background='transparent';
      const id = e.dataTransfer.getData('text/plain');
      const accept = zone.dataset.accept;
      const task = tasksCache.find(x=>String(x.id)===String(id));
      if(!task) return;
      const patch = boardByPriority ? { priority: accept } : { status: accept, completed: accept==='Completada' };
      await fetch(`${API}/tasks/${id}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(patch)});
      loadTasksBoard(true);
    });
  });
}

async function editTask(t){
  const { value: vals } = await Swal.fire({
    title:'Editar tarea',
    html: `
      <input id="stTitle" class="swal2-input" value="${t.title}">
      <input id="stDue" type="date" class="swal2-input" value="${t.dueDate}">
      <select id="stStatus" class="swal2-input">
        <option ${t.status==='Pendiente'?'selected':''}>Pendiente</option>
        <option ${t.status==='En Progreso'?'selected':''}>En Progreso</option>
        <option ${t.status==='Completada'?'selected':''}>Completada</option>
      </select>
      <select id="stPriority" class="swal2-input">
        <option ${t.priority==='Alta'?'selected':''}>Alta</option>
        <option ${t.priority==='Media'?'selected':''}>Media</option>
        <option ${t.priority==='Baja'?'selected':''}>Baja</option>
      </select>
    `,
    preConfirm: ()=>{
      const title = $('#stTitle').value.trim();
      const dueDate = $('#stDue').value;
      const status = $('#stStatus').value;
      const priority = $('#stPriority').value;
      if(!title || !dueDate) Swal.showValidationMessage('Título y fecha requeridos');
      if(dayjs(dueDate).isBefore(dayjs().startOf('day'))) Swal.showValidationMessage('Fecha inválida');
      return {title, dueDate, status, priority, completed: status==='Completada'};
    }
  });
  if(!vals) return;
  await fetch(`${API}/tasks/${t.id}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(vals)});
  loadTasksBoard(true);
}

async function manageSubtasks(t){
  const { value: title } = await Swal.fire({input:'text', inputLabel:'Nueva subtarea', inputPlaceholder:'Descripción', showCancelButton:true});
  if(!title) return;
  const subs = t.subtasks || [];
  subs.push({ id: Date.now(), title, done:false });
  await fetch(`${API}/tasks/${t.id}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({subtasks: subs})});
  loadTasksBoard(true);
}

async function exportProjectTasks(){
  const tasks = await (await fetch(`${API}/tasks?projectId=${currentProject.id}`)).json();
  const blob = new Blob([JSON.stringify(tasks, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${currentProject.name.replace(/\s+/g,'_')}_tareas.json`;
  a.click();
}
