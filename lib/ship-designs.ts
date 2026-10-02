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

export {submissionChanges} from './ship-review-diff'
