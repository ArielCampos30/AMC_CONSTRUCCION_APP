const DEFAULT_WINDOW_MS=15*60*1000,DEFAULT_MAX_SAMPLES=1000;
const percentile=(values,p)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),index=Math.max(0,Math.ceil(sorted.length*p)-1);return sorted[index];};

export function createPerformanceMonitor({clock=Date.now,windowMs=DEFAULT_WINDOW_MS,maxSamples=DEFAULT_MAX_SAMPLES}={}){
 const samples={state:[],media:[]};
 const category=path=>path==='/api/state'?'state':String(path||'').startsWith('/media/')?'media':null;
 const prune=(list,stamp)=>{const cutoff=stamp-windowMs;while(list.length&&list[0].at<cutoff)list.shift();if(list.length>maxSamples)list.splice(0,list.length-maxSamples);};
 const record=(path,durationMs)=>{
  const key=category(path),duration=Math.max(0,Math.round(Number(durationMs)||0));if(!key)return;
  const stamp=clock(),list=samples[key];list.push({at:stamp,duration});prune(list,stamp);
 };
 const stats=(key,stamp)=>{const list=samples[key];prune(list,stamp);const values=list.map(item=>item.duration);return {count:values.length,p95:percentile(values,.95),max:values.length?Math.max(...values):null};};
 const health=()=>{const stamp=clock(),state=stats('state',stamp),media=stats('media',stamp);return {
  stateRequests15m:state.count,stateP95Ms:state.p95,stateMaxMs:state.max,
  mediaRequests15m:media.count,mediaP95Ms:media.p95,mediaMaxMs:media.max
 };};
 return {record,health};
}
