import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { FactoryTaskKind } from "./orchestrator";
import { routeFactoryTask } from "./orchestrator";

export type ProviderWorkStatus="PLANNED"|"BLOCKED"|"COMPLETED"|"ERROR";
export type ProviderWorkItem={id:string;task:FactoryTaskKind;prompt:string;primary:string;fallback?:string;status:ProviderWorkStatus;executableNow:boolean;createdAt:string;updatedAt:string};
const file=path.join(process.cwd(),"runtime","provider-work.json"); const MAX=500;
let mutationQueue:Promise<void>=Promise.resolve();
async function readUnlocked():Promise<ProviderWorkItem[]>{try{const value=JSON.parse(await fs.readFile(file,"utf8"));return Array.isArray(value)?value:[];}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return[];throw e;}}
async function writeUnlocked(items:ProviderWorkItem[]){await fs.mkdir(path.dirname(file),{recursive:true});const tmp=`${file}.${process.pid}.${randomUUID()}.tmp`;try{await fs.writeFile(tmp,JSON.stringify(items,null,2)+"\n",{mode:0o600});await fs.rename(tmp,file);}finally{await fs.rm(tmp,{force:true}).catch(()=>{});}}
function locked<T>(fn:()=>Promise<T>):Promise<T>{const r=mutationQueue.then(fn,fn);mutationQueue=r.then(()=>undefined,()=>undefined);return r;}
export async function planProviderWork(task:FactoryTaskKind,prompt:string):Promise<ProviderWorkItem>{const clean=prompt.trim();if(!clean)throw new Error("Prompt required.");const route=routeFactoryTask(task);const now=new Date().toISOString();const item={id:randomUUID(),task,prompt:clean,primary:route.primary,fallback:route.fallback,status:(route.executableNow?"PLANNED":"BLOCKED") as ProviderWorkStatus,executableNow:route.executableNow,createdAt:now,updatedAt:now};return locked(async()=>{const items=await readUnlocked();items.unshift(item);if(items.length>MAX)items.length=MAX;await writeUnlocked(items);return item;});}
export async function getProviderWorkQueue(){await mutationQueue;return readUnlocked();}
