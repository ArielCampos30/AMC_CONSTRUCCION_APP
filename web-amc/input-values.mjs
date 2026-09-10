export function createInputValues({fail}){
 const text=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
 const amount=v=>{if(!Number.isFinite(Number(v))||Number(v)<=0||Number(v)>1e10)fail(400,'Importe inválido.');return Math.round(Number(v)*100)/100;};
 const optionalAmount=v=>{if(!Number.isFinite(Number(v||0))||Number(v||0)<0||Number(v||0)>1e10)fail(400,'Importe inválido.');return Math.round(Number(v||0)*100)/100;};
 const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&!isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
 return {text,amount,optionalAmount,validDate};
}
