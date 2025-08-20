const API = 'http://localhost:3001';
const $ = (sel, parent=document) => parent.querySelector(sel);
const $$ = (sel, parent=document) => [...parent.querySelectorAll(sel)];

const spinner = $('#spinner');
const toast = Swal.mixin({ toast:true, position:'top-end', showConfirmButton:false, timer:2200, timerProgressBar:true });

function showSpinner(){ spinner.classList.remove('hidden'); }
function hideSpinner(){ spinner.classList.add('hidden'); }

function setThemeFromStorage(){
  const t = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', t);
}
setThemeFromStorage();

document.addEventListener('DOMContentLoaded', () => {
  // Navegación tabs
  $$('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('.tab-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
      const tab = btn.dataset.tab;
      $$('.tab-section').forEach(s=>s.classList.remove('visible'));
      $(`#tab-${tab}`).classList.add('visible');
      if(tab==='estadisticas') renderCharts();
    });
  });

  $('#cycleThemeBtn')?.addEventListener('click', ()=>{
    const themes=['light','dark','blue'];
    const html=document.documentElement;
    const next = themes[(themes.indexOf(html.getAttribute('data-theme'))+1)%themes.length];
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });

  $('#mobileToggle')?.addEventListener('click', ()=>$('.sidebar').classList.toggle('open'));
  $('#logoutBtn')?.addEventListener('click', logout);
  $('#resetAppBtn')?.addEventListener('click', resetApp);

  // Inicializaciones específicas
  initProjects();
  initEquipo();
  // Charts lazy al abrir tab
});

async function resetApp(){
  const ok = await Swal.fire({icon:'warning', title:'¿Reiniciar datos?', text:'Esto borrará proyectos, tareas y miembros.', showCancelButton:true, confirmButtonText:'Sí, borrar'});
  if(!ok.isConfirmed) return;

  showSpinner();
  try{
    // Borra tasks
    let tasks = await (await fetch(`${API}/tasks`)).json();
    await Promise.all(tasks.map(t=>fetch(`${API}/tasks/${t.id}`,{method:'DELETE'})));
    // Borra projects
    let projects = await (await fetch(`${API}/projects`)).json();
    await Promise.all(projects.map(p=>fetch(`${API}/projects/${p.id}`,{method:'DELETE'})));
    // Borra members (no usuarios del login)
    let members = await (await fetch(`${API}/members`)).json();
    await Promise.all(members.map(m=>fetch(`${API}/members/${m.id}`,{method:'DELETE'})));
    toast.fire({icon:'success', title:'Datos reiniciados'});
    // Opcional: resembrar 3 miembros demo
    await fetch(`${API}/members`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:"María López", role:"Front-end", email:"maria@demo.com"})});
    await fetch(`${API}/members`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:"Carlos Ruiz", role:"Back-end", email:"carlos@demo.com"})});
    await fetch(`${API}/members`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:"Ana Torres", role:"QA", email:"ana@demo.com"})});
    initProjects(true);
    initEquipo(true);
  }catch(e){
    Swal.fire({icon:'error', title:'Error al reiniciar', text:e.message});
  }finally{ hideSpinner(); }
}
