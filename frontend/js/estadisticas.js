let charts = {};

async function renderCharts(){
  const [tasks, members, projects] = await Promise.all([
    (await fetch(`${API}/tasks`)).json(),
    (await fetch(`${API}/members`)).json(),
    (await fetch(`${API}/projects`)).json()
  ]);

  // 1) Completadas vs Pendientes
  const done = tasks.filter(t=>t.status==='Completada'||t.completed).length;
  const pending = tasks.length - done;
  drawChart('chartDone', {
    type:'doughnut',
    data:{ labels:['Completadas','Pendientes'], datasets:[{ data:[done,pending] }] }
  });

  // 2) Por prioridad
  const pri = c => tasks.filter(t=>t.priority===c).length;
  drawChart('chartPriority', {
    type:'bar',
    data:{ labels:['Alta','Media','Baja'], datasets:[{ label:'Tareas', data:[pri('Alta'), pri('Media'), pri('Baja')] }] },
    options:{ scales:{ y:{ beginAtZero:true } } }
  });

  // 3) Progreso por miembro (% tareas completadas de las asignadas)
  const perMember = members.map(m=>{
    const mine = tasks.filter(t=>t.assigneeId===m.id);
    const d = mine.filter(t=>t.status==='Completada'||t.completed).length;
    const pct = mine.length? Math.round(d*100/mine.length):0;
    return {name:m.name, pct};
  });
  drawChart('chartMembers', {
    type:'bar',
    data:{ labels: perMember.map(x=>x.name), datasets:[{ label:'% completado', data: perMember.map(x=>x.pct) }] },
    options:{ scales:{ y:{ beginAtZero:true, max:100 } } }
  });

  // 4) Proyectos por prioridad
  const pPri = k=> projects.filter(p=>p.priority===k).length;
  drawChart('chartProjects', {
    type:'pie',
    data:{ labels:['Alta','Media','Baja'], datasets:[{ data:[pPri('Alta'),pPri('Media'),pPri('Baja')] }] }
  });
}

function drawChart(id, cfg){
  const ctx = document.getElementById(id);
  if(charts[id]) charts[id].destroy();
  charts[id] = new Chart(ctx, cfg);
}
