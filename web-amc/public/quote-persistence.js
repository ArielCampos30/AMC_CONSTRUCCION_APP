const persistentWork=work=>({
 id:String(work?.id||''),description:String(work?.description||'').trim(),
 quantity:Number(work?.quantity||0),quantityExplicit:Boolean(work?.quantityExplicit),unit:String(work?.unit||''),unitPrice:Number(work?.unitPrice||0),
 materials:Number(work?.materials||0),tools:Number(work?.tools||0),other:Number(work?.other||0),labor:Number(work?.labor||0),costsConfirmed:Boolean(work?.costsConfirmed),
 workers:Number(work?.workers||0),days:Number(work?.days||0),hours:Number(work?.hours||0),
 tariffKey:String(work?.tariffKey||''),tariffTask:String(work?.tariffTask||''),tariffRubric:String(work?.tariffRubric||''),tariffUnit:String(work?.tariffUnit||''),tariffPrice:Number(work?.tariffPrice||0),tariffKind:String(work?.tariffKind||'')
});

export function quotePersistentDocument({requestId,externalId,number,works,travel,employeeDay,finalPrice,finalPriceManual,desiredMargin,payment='',notes='',snapshot}){
 const rows=(Array.isArray(works)?works:[]).map(persistentWork);
 return {
  schemaVersion:3,requestId:String(requestId||''),externalId:String(externalId||''),number:String(number||''),
  items:rows.map(work=>({description:work.description})),total:Number(finalPrice||0),validity:'10',payment:String(payment||''),notes:String(notes||''),
  internalCost:Number(snapshot?.internalCost||0),grossMargin:Number(snapshot?.gain||0),
  adminModel:{schemaVersion:1,works:rows,travel:Number(travel||0),employeeDay:Number(employeeDay||0),desiredMargin:Number(desiredMargin||0),finalPrice:Number(finalPrice||0),finalPriceManual:Boolean(finalPriceManual)}
 };
}

export async function quoteContentVersion(document){
 const bytes=new TextEncoder().encode(JSON.stringify(document));
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
