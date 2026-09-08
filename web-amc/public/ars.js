(function(root){
  function parse(value){
    const digits=String(value??'').replace(/[^0-9]/g,'');
    return digits?Number(digits):0;
  }
  function format(value){
    const amount=Math.max(0,Math.round(Number(value)||0));
    return amount?'$ '+new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(amount):'';
  }
  root.AMCArs={parse,format};
})(globalThis);
