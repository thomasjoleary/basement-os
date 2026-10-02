import type {ShipPlan} from './ships'
export function submissionChanges(before:{name:string;description:string;plan:ShipPlan},after:{name:string;description:string;plan:ShipPlan}):string[]{
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
  const surfaces=(plan:ShipPlan)=>{const names=new Map(plan.decks.flatMap(d=>d.rooms.map(r=>[r.id,r.name] as const)));return (plan.surface_design?.surfaces??[]).map(s=>({...s,name:`${names.get(s.room_id)??'Room'} ${s.face}`}))}
  const sections=(plan:ShipPlan)=>{const names=new Map(plan.decks.flatMap(d=>d.rooms.map(r=>[r.id,r.name] as const)));return (plan.surface_design?.sections??[]).map(s=>({...s,name:`${names.get(s.room_id)??'Room'} ${s.side}`}))}
  compare('Surface paint',surfaces(before.plan),surfaces(after.plan));compare('Hull section',sections(before.plan),sections(after.plan))
  compare('Component color',before.plan.surface_design?.components??[],after.plan.surface_design?.components??[])
  return changes
}
