import {type ShipPlan,type Point,roomAt,partFootprint,validatePlan} from './ships'

export type MoveTarget={kind:'room'|'part'|'connection'|'mark';id:string}
// Move a connected opening as one object: both endpoints and its attached ladder.
// Room paint remains room-local; contained fixtures/marks and openings travel with it.
export function moveShipItem(plan:ShipPlan,deckId:string,target:MoveTarget,delta:Point):{plan:ShipPlan;error:string|null}{
 const fail=(error:string)=>({plan,error})
 if(!Number.isInteger(delta.x)||!Number.isInteger(delta.y))return fail('Moves must snap to whole grid cells.')
 if(!delta.x&&!delta.y)return {plan,error:null}
 const next=structuredClone(plan),deck=next.decks.find(d=>d.id===deckId)
 if(!deck)return fail('Choose a visible deck.')
 const shift=(p:Point)=>{p.x+=delta.x;p.y+=delta.y}
 const links=new Set<string>(),parts=new Set<string>()
 if(target.kind==='connection')links.add(target.id)
 if(target.kind==='part'){
  const linked=next.connections.find(c=>c.aperture?.ladder_part_id===target.id)
  if(linked)links.add(linked.id);else parts.add(target.id)
 }
 if(target.kind==='mark'){const mark=deck.marks.find(m=>m.id===target.id);if(!mark)return fail('Item unavailable.');shift(mark)}
 if(target.kind==='room'){
  const room=deck.rooms.find(r=>r.id===target.id);if(!room)return fail('Room unavailable.')
  const inside=(p:Point)=>p.x>=room.x&&p.x<room.x+room.width&&p.y>=room.y&&p.y<room.y+room.height
  for(const p of next.parts)if(p.deck_id===deckId&&(p.room_id===room.id||inside(p)))parts.add(p.id)
  for(const c of next.connections)if((c.from_deck===deckId&&inside(c.from))||(c.to_deck===deckId&&inside(c.to)))links.add(c.id)
  for(const mark of deck.marks)if(inside(mark))shift(mark)
  shift(room)
  if(deck.rooms.some(r=>r.id!==room.id&&room.x<r.x+r.width&&room.x+room.width>r.x&&room.y<r.y+r.height&&room.y+room.height>r.y))return fail('Rooms cannot overlap. Move into an empty area.')
 }
 for(const c of next.connections)if(links.has(c.id)){shift(c.from);shift(c.to);if(c.aperture?.ladder_part_id)parts.delete(c.aperture.ladder_part_id)}
 for(const p of next.parts){
  const linked=next.connections.find(c=>links.has(c.id)&&c.aperture?.ladder_part_id===p.id)
  if(linked){p.x=linked.from.x;p.y=linked.from.y;p.deck_id=linked.from_deck}
  else if(parts.has(p.id))shift(p)
  if(linked||parts.has(p.id)){const d=next.decks.find(d=>d.id===p.deck_id)!;p.room_id=roomAt(d,p)?.id??null;const size=partFootprint(p.type);if(p.x<0||p.y<0||p.x+size.width>d.width||p.y+size.height>d.height)return fail('The complete fixture must fit inside its deck.')}
 }
 const error=validatePlan(next)
 return error?fail(error):{plan:next,error:null}
}
