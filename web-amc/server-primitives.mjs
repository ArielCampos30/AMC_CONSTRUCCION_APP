import {randomUUID,createHash} from 'node:crypto';

export const now=()=>new Date().toISOString();
export const id=()=>randomUUID();
export const sha=value=>createHash('sha256').update(value).digest('hex');
export const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
