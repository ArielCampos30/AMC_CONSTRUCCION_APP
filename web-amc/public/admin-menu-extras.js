const dedupeAdminExtras=()=>{
 if(location.hash!=='#mas-admin'||!document.body.classList.contains('admin-v3'))return;
 const links=[...document.querySelectorAll('.admin-v3-more a[href="#portada"]')];
 links.slice(1).forEach(link=>link.remove());
};
const app=document.getElementById('app');
if(app)new MutationObserver(dedupeAdminExtras).observe(app,{childList:true});
window.addEventListener('hashchange',()=>queueMicrotask(dedupeAdminExtras));
queueMicrotask(dedupeAdminExtras);
