export function createAppStateRuntime({api,applyState,cacheEmployeeSnapshot}){
 let sessionEpoch=0,offlineSnapshotSignature='';
 async function syncEmployeeOffline(next){
  if(next?.user?.role!=='employee')return;
  const signature=JSON.stringify((next.assignments||[]).map(task=>[task.id,task.status,task.day,task.time,task.address,task.instructions]));
  if(signature===offlineSnapshotSignature)return;
  offlineSnapshotSignature=signature;
  try{await cacheEmployeeSnapshot(next);}catch{}
 }
 async function reload(){
  const epoch=sessionEpoch;
  const next=await api('/api/state',null,'GET');
  if(epoch===sessionEpoch){applyState(next);syncEmployeeOffline(next);}
  return next;
 }
 return {
  reload,
  captureSession:()=>sessionEpoch,
  isSessionCurrent:epoch=>epoch===sessionEpoch,
  advanceSession:()=>++sessionEpoch
 };
}
