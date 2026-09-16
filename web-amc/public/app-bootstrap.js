const head=document.head,nativeAppend=head.append;
head.append=function(...nodes){
 const allowed=nodes.filter(node=>!(node?.tagName==='LINK'&&node.getAttribute?.('href')==='/admin-v3.css'&&!node.dataset?.amcRoleStyle));
 if(allowed.length)return nativeAppend.apply(this,allowed);
};
try{await import('./app.js');}finally{head.append=nativeAppend;}
