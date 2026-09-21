import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
export type ProviderAudit={id:string;workId?:string;mode:"dry_run"|"real";provider?:string;status:string;externalCallMade:boolean;paidUsageTriggered:boolean;requestId?:string;idempotencyKey?:string;error?:string;createdAt:string};
const file=path.join(process.cwd(),"runtime","provider-dispatch-audit.json"); const MAX=500;
let q:Promise<void>=Promise.resolve();
async function read(){try{const v=JSON.parse(await fs.readFile(file,"utf8"));return Array.isArray(v)?v as ProviderAudit[]:[];}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return[];if(e instanceof SyntaxError){await fs.rename(file,file+".corrupt."+Date.now()).catch(()=>{});return[];}throw e;}}
export async function appendProviderAudit(entry:Omit<ProviderAudit,"id"|"createdAt">){const item={...entry,id:randomUUID(),createdAt:new Date().toISOString()};const run=q.then(async()=>{const a=await read();a.unshift(item);if(a.length>MAX)a.length=MAX;await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+"."+process.pid+"."+randomUUID()+".tmp";await fs.writeFile(tmp,JSON.stringify(a,null,2)+"\n",{mode:0o600});await fs.rename(tmp,file);});q=run.then(()=>undefined,()=>undefined);await run;return item;}
export async function getProviderAudit(){await q;return read();}
// Audit entries intentionally exclude prompts and credentials; only execution metadata is persisted.
