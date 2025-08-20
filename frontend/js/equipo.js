async function initEquipo(force=false){
  if(!force && $('#membersList').dataset.ready) return;
  bindMemberForm();
  await renderMembers();
  $('#membersList').dataset.ready='1';
}

function bindMemberForm(){
  $('#memberForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = $('#mName').value.trim();
    const role = $('#mRole').value.trim();
    const email = $('#mEmail').value.trim();
    const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!name || !role || !email) return Swal.fire({icon:'warning', title:'Completa todos los campos'});
    if(!emailRegex.test(email)) return Swal.fire({icon:'error', title:'Correo inválido'});
    // Duplicados
    const dup = await (await fetch(`${API}/members?email=${encodeURIComponent(email)}`)).json();
    if(dup.length) return Swal.fire({icon:'error', title:'Correo duplicado', text:'Ya existe un miembro con ese correo'});
    const res = await fetch(`${API}/members`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, role, email})});
    if(res.ok){ e.target.reset(); Swal.fire({icon:'success', title:'Miembro agregado'}); loadMembersForSelects(); renderMembers(); }
  });
}

async function renderMembers(){
  const cont = $('#membersList'); cont.innerHTML='';
  const [members, tasks] = await Promise.all([
    (await fetch(`${API}/members`)).json(),
    (await fetch(`${API}/tasks`)).json()
  ]);
  for(const m of members){
    const count = tasks.filter(t=>t.assigneeId===m.id).length;
    const initials = m.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
    const el = document.createElement('div'); el.className='member';
    el.innerHTML = `
      <div class="avatar">${initials}</div>
      <div>
        <div><strong>${m.name}</strong></div>
        <div class="muted">${m.role} · ${m.email}</div>
      </div>
      <div class="actions">
        <span class="badge">Tareas: ${count}</span>
        <button class="btn btn-ghost" data-act="del">Eliminar</button>
      </div>
    `;
    el.querySelector('[data-act="del"]').addEventListener('click', async ()=>{
      const ok = await Swal.fire({icon:'warning', title:'¿Eliminar miembro?', text:'Sus tareas quedarán sin asignar', showCancelButton:true});
      if(!ok.isConfirmed) return;
      await fetch(`${API}/members/${m.id}`, {method:'DELETE'});
      // desasignar tareas
      const mts = tasks.filter(t=>t.assigneeId===m.id);
      await Promise.all(mts.map(t=>fetch(`${API}/tasks/${t.id}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({assigneeId:null})})));
      renderMembers(); loadMembersForSelects(); loadTasksBoard(true);
    });
    cont.appendChild(el);
  }
}
