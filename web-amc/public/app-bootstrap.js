const head=document.head,nativeAppend=head.append,hadOwnAppend=Object.prototype.hasOwnProperty.call(head,'append');
head.append=function(...nodes){
 const allowed=nodes.filter(node=>!(node?.tagName==='LINK'&&node.getAttribute?.('href')==='/admin-v3.css'&&!node.dataset?.amcRoleStyle));
 if(allowed.length)return nativeAppend.apply(this,allowed);
};
try{await import('./app.js');}finally{if(hadOwnAppend)head.append=nativeAppend;else delete head.append;}
