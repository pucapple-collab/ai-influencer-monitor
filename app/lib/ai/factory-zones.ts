import type { FactoryTaskKind } from "./orchestrator";
export type FactoryZoneId="control"|"reasoning"|"media"|"delivery";
export const factoryZones=[
 {id:"control",label:"Control",tasks:[] as FactoryTaskKind[],owns:["queue","dispatcher","audit","safety"]},
 {id:"reasoning",label:"Reasoning",tasks:["architecture","coding","research","bulk"] as FactoryTaskKind[],owns:["claude","gemini"]},
 {id:"media",label:"Media",tasks:["image","video"] as FactoryTaskKind[],owns:["higgsfield"]},
 {id:"delivery",label:"Delivery",tasks:[] as FactoryTaskKind[],owns:["review","publish"]},
] as const;
export function zoneForTask(task:FactoryTaskKind):FactoryZoneId{return factoryZones.find(z=>(z.tasks as readonly FactoryTaskKind[]).includes(task))?.id??"control";}
