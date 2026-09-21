import { randomUUID } from "crypto";

export type PublishPlatform = "instagram" | "tiktok" | "youtube";
export type PublishInput = { jobId:string; mediaUrl:string; caption?:string; idempotencyKey?:string };
export type PublishResult = { platform:PublishPlatform; status:"NOT_CONFIGURED"|"READY"|"PUBLISHED"|"ERROR"; externalCallMade:boolean; requestId?:string; postId?:string; error?:string };

export interface PublishAdapter {
  configured(): boolean;
  publish(input: PublishInput): Promise<PublishResult>;
}

function envConfigured(...names:string[]){ return names.every(name=>Boolean(process.env[name]?.trim())); }
function placeholder(platform:PublishPlatform, required:string[]):PublishAdapter{
  return {
    configured:()=>envConfigured(...required),
    async publish(){
      if(!envConfigured(...required)) return {platform,status:"NOT_CONFIGURED",externalCallMade:false,error:`${platform} credentials are not configured.`};
      return {platform,status:"READY",externalCallMade:false,requestId:randomUUID(),error:`${platform} credentials detected, but external posting implementation is intentionally not enabled yet.`};
    }
  };
}

export const publishAdapters:Record<PublishPlatform,PublishAdapter>={
  instagram:placeholder("instagram",["INSTAGRAM_ACCESS_TOKEN","INSTAGRAM_ACCOUNT_ID"]),
  tiktok:placeholder("tiktok",["TIKTOK_ACCESS_TOKEN"]),
  youtube:placeholder("youtube",["YOUTUBE_ACCESS_TOKEN"]),
};

export function getPublishReadiness(){
  return Object.entries(publishAdapters).map(([platform,adapter])=>({platform:platform as PublishPlatform,configured:adapter.configured(),implementationReady:false}));
}
