(()=>{
 if(window.parent===window||!new URLSearchParams(location.search).has('embed'))return;
 const style=document.createElement('style');style.id='amc-estimator-shell-inner-style';style.textContent=`
 body[data-amc-estimator-shell-view="tariff"]{overflow:auto!important}
 body[data-amc-estimator-shell-view="tariff"] .app{max-width:none!important;padding:12px!important}
 body[data-amc-estimator-shell-view="tariff"] .app>*{display:none!important}
 body[data-amc-estimator-shell-view="tariff"] #view-tariff{display:block!important}
 body[data-amc-estimator-shell-view="tariff"] #view-tariff .table-wrap{max-height:none!important;overflow:auto!important}
 body[data-amc-estimator-shell-view="tariff"] #view-tariff table{min-width:760px}
 `;document.head.append(style);
 function activate(view){
  if(view==='tariff'){
   document.body.dataset.amcEstimatorShellView='tariff';
   try{window.nav?.('tariff');}catch{}
   const tariff=document.getElementById('view-tariff');if(tariff){document.querySelectorAll('.view').forEach(node=>node.classList.remove('active'));tariff.classList.add('active');}
   scrollTo(0,0);document.getElementById('tariff-search')?.focus({preventScroll:true});return;
  }
  delete document.body.dataset.amcEstimatorShellView;
  try{window.nav?.('quote');}catch{}
  scrollTo(0,0);
 }
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='amc:estimator-view')return;
  if(!['quote','tariff'].includes(event.data.view))return;
  activate(event.data.view);
 });
 parent.postMessage({type:'amc:estimator-ready'},location.origin);
})();
