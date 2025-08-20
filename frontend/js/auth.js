const API_AUTH = 'http://localhost:3001';

function requireAuth(){
  const s = JSON.parse(localStorage.getItem('session')||'null');
  if(!s) window.location.href = './login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  // si estamos en login.html
  if(document.location.pathname.endsWith('/login.html') || document.location.pathname.endsWith('login.html')){
    const form = document.getElementById('loginForm');
    form?.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();
      if(!email || !password){
        Swal.fire({icon:'warning', title:'Campos requeridos', text:'Completa email y contraseña'});
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if(!emailRegex.test(email)){
        Swal.fire({icon:'error', title:'Email inválido', text:'Revisa el formato del correo'});
        return;
      }
      document.getElementById('spinner').classList.remove('hidden');
      try{
        const res = await fetch(`${API_AUTH}/users?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
        const data = await res.json();
        if(data.length){
          const user = data[0];
          localStorage.setItem('session', JSON.stringify({ userId:user.id, name:user.name, roleId:user.roleId, email:user.email, loginAt:Date.now() }));
          Swal.fire({icon:'success', title:'Acceso concedido', timer:1200, showConfirmButton:false});
          setTimeout(()=>{ window.location.href='./index.html'; }, 800);
        }else{
          Swal.fire({icon:'error', title:'Credenciales inválidas', text:'Verifica email/contraseña'});
        }
      }catch(err){
        Swal.fire({icon:'error', title:'Error de conexión', text: err.message});
      }finally{
        document.getElementById('spinner').classList.add('hidden');
      }
    });
  }else{
    // páginas protegidas
    requireAuth();
  }
});

function logout(){
  localStorage.removeItem('session');
  window.location.href='./login.html';
}
