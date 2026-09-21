import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { FactoryTaskKind } from "./orchestrator";
import { routeFactoryTask } from "./orchestrator";

export type ProviderWorkStatus="PLANNED"|"RUNNING"|"BLOCKED"|"COMPLETED"|"ERROR";
export type ProviderWorkItem={id:string;task:FactoryTaskKind;prompt:string;primary:string;fallback?:string;status:ProviderWorkStatus;executableNow:boolean;attempts?:number;lastProvider?:string;lastError?:string;externalCallMade?:boolean;providerRequestId?:string;idempotencyKey?:string;createdAt:string;updatedAt:string};
const file=path.join(process.cwd(),"runtime","provider-work.json"); const MAX=500;
let mutationQueue:Promise<void>=Promise.resolve();
async function readUnlocked():Promise<ProviderWorkItem[]>{try{const value=JSON.parse(await fs.readFile(file,"utf8"));return Array.isArray(value)?value:[];}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return[];if(e instanceof SyntaxError){const bad=`${file}.corrupt.${Date.now()}`;await fs.rename(file,bad).catch(()=>{});return[];}throw e;}}
async function writeUnlocked(items:ProviderWorkItem[]){await fs.mkdir(path.dirname(file),{recursive:true});const tmp=`${file}.${process.pid}.${randomUUID()}.tmp`;try{await fs.writeFile(tmp,JSON.stringify(items,null,2)+"\n",{mode:0o600});await fs.rename(tmp,file);}finally{await fs.rm(tmp,{force:true}).catch(()=>{});}}
function locked<T>(fn:()=>Promise<T>):Promise<T>{const r=mutationQueue.then(fn,fn);mutationQueue=r.then(()=>undefined,()=>undefined);return r;}
export async function planProviderWork(task:FactoryTaskKind,prompt:string):Promise<ProviderWorkItem>{const clean=prompt.trim();if(!clean)throw new Error("Prompt required.");const route=routeFactoryTask(task);const now=new Date().toISOString();const item={id:randomUUID(),task,prompt:clean,primary:route.primary,fallback:route.fallback,status:(route.executableNow?"PLANNED":"BLOCKED") as ProviderWorkStatus,executableNow:route.executableNow,createdAt:now,updatedAt:now};return locked(async()=>{const items=await readUnlocked();items.unshift(item);if(items.length>MAX)items.length=MAX;await writeUnlocked(items);return item;});}
export async function getProviderWorkQueue(){await mutationQueue;return readUnlocked();}
export async function updateProviderWork(id:string,patch:Partial<Pick<ProviderWorkItem,"status"|"executableNow"|"attempts"|"lastProvider"|"lastError"|"externalCallMade"|"providerRequestId"|"idempotencyKey">>){return locked(async()=>{const items=await readUnlocked();const index=items.findIndex(x=>x.id===id);if(index<0)return null;items[index]={...items[index],...patch,updatedAt:new Date().toISOString()};await writeUnlocked(items);return items[index];});}
export async function getProviderWorkSummary(){const items=await getProviderWorkQueue();return {total:items.length,planned:items.filter(x=>x.status==="PLANNED").length,running:items.filter(x=>x.status==="RUNNING").length,blocked:items.filter(x=>x.status==="BLOCKED").length,completed:items.filter(x=>x.status==="COMPLETED").length,errors:items.filter(x=>x.status==="ERROR").length,byProvider:items.reduce<Record<string,number>>((a,x)=>(a[x.primary]=(a[x.primary]??0)+1,a),{})};}

export async function pruneProviderWorkQueue(keepCompleted=100){return locked(async()=>{const items=await readUnlocked();let terminal=0;const kept=items.filter(x=>{if(x.status==="COMPLETED"||x.status==="ERROR"){terminal+=1;return terminal<=keepCompleted;}return true;});if(kept.length!==items.length)await writeUnlocked(kept);return {removed:items.length-kept.length,remaining:kept.length};});}
