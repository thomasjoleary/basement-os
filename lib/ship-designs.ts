import { supabase } from './supabase'
import { type Ship, type ShipPlan, normalizeShip } from './ships'
export type Design = { id: string; author_id: string; name: string; description: string; plan: ShipPlan; status: 'draft'|'submitted'|'changes_requested'|'accepted'; version: number; current_submission: number|null; accepted_ship_id: string|null; accepted_ship_version: number|null }
export type ReviewEvent = { id: string; version: number; submission_version: number|null; action: string; feedback: string; actor_id: string|null; created_at: string }
export function designShip(d: Pick<Design,'id'|'name'|'description'|'plan'|'version'>): Ship {
  return normalizeShip({id:d.id,name:d.name,description:d.description,plan:d.plan,version:d.version,owner_id:null,crew_ids:[]})
}
export function designError(error: {message:string;code?:string}) {
  return ['42P01','PGRST202','PGRST205'].includes(error.code??'') ? 'Design review is not installed yet. Your playable ships are unchanged. Ask the GM to finish design-review setup.' : error.message
}
export async function designAction(id:string,version:number,action:string,payload:object={}) {
  const {data,error}=await supabase.rpc('v2_design_action',{design_id:id,expected_version:version,action,payload})
  if(error)throw new Error(designError(error))
  return data as Design
}

export function submissionChanges(before:Pick<Design,'name'|'description'|'plan'>,after:Pick<Design,'name'|'description'|'plan'>):string[]{
  const changes:string[]=[]
  if(before.name!==after.name)changes.push('Ship name changed')
  if(before.description!==after.description)changes.push('Public description changed')
  const compare=(label:string,a:{id:string;name?:string}[],b:{id:string;name?:string}[])=>{
    const previous=new Map(a.map(item=>[item.id,item])),current=new Set(b.map(item=>item.id))
    for(const item of b){const old=previous.get(item.id);if(!old)changes.push(`${label} added: ${item.name??item.id}`);else if(JSON.stringify(old)!==JSON.stringify(item))changes.push(`${label} changed: ${item.name??item.id}`)}
    for(const item of a)if(!current.has(item.id))changes.push(`${label} removed: ${item.name??item.id}`)
  }
  compare('Deck',before.plan.decks.map(({rooms,marks,...d})=>({...d,roomCount:rooms.length,markCount:marks.length})),after.plan.decks.map(({rooms,marks,...d})=>({...d,roomCount:rooms.length,markCount:marks.length})))
  compare('Room',before.plan.decks.flatMap(d=>d.rooms),after.plan.decks.flatMap(d=>d.rooms))
  compare('Wall/door/label',before.plan.decks.flatMap(d=>d.marks),after.plan.decks.flatMap(d=>d.marks))
  compare('Component',before.plan.parts,after.plan.parts);compare('Connection',before.plan.connections,after.plan.connections)
  if(JSON.stringify(before.plan.appearance)!==JSON.stringify(after.plan.appearance))changes.push('Exterior appearance changed')
  return changes
}
