const addAdminExtras=()=>{
 if(location.hash!=='#mas-admin'||!document.body.classList.contains('admin-v3'))return;
 const sections=[...document.querySelectorAll('.admin-v3-more')];
 const tools=sections.find(section=>section.querySelector('h2')?.textContent.trim()==='Herramientas');
 if(!tools||tools.querySelector('a[href="#portada"]'))return;
 const link=document.createElement('a');
 link.href='#portada';
 link.innerHTML='<span>Portada pública</span><b>›</b>';
 tools.append(link);
};
const app=document.getElementById('app');
if(app)new MutationObserver(addAdminExtras).observe(app,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>queueMicrotask(addAdminExtras));
queueMicrotask(addAdminExtras);
