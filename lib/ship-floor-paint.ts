import type {ShipPlan,Deck} from './ships'
import {newId} from './ships'
import {decodePaint,encodePaint,EMPTY_PAINT,PAINT_STRIDE} from './ship-paint'
import {EMPTY_SURFACES} from './ship-surfaces'
// The deck view is an ephemeral global map. Each stored room retains its own
// palette and fixed local coordinates, including temporarily hidden paint.
export function deckFloorTiles(plan:ShipPlan,deck:Deck){
 const cells=new Map<number,string>()
 for(const room of deck.rooms){const surface=plan.surface_design?.surfaces.find(s=>s.room_id===room.id&&s.face==='floor');for(const [at,color] of decodePaint(surface?.paint??EMPTY_PAINT)){const x=at%PAINT_STRIDE,y=Math.floor(at/PAINT_STRIDE);if(x<room.width*5&&y<room.height*5)cells.set((room.y*5+y)*PAINT_STRIDE+room.x*5+x,color)}}return cells
}
export function paintDeckFloors(plan:ShipPlan,deck:Deck,cells:Map<number,string>):ShipPlan{
 const design=plan.surface_design??EMPTY_SURFACES,before=deckFloorTiles(plan,deck),changes=new Map<number,string|null>()
 for(const [at,color] of cells)if(before.get(at)!==color)changes.set(at,color)
 for(const at of before.keys())if(!cells.has(at))changes.set(at,null)
 const surfaces=[...design.surfaces]
 for(const room of deck.rooms){
  const old=design.surfaces.find(s=>s.room_id===room.id&&s.face==='floor'),local=decodePaint(old?.paint??EMPTY_PAINT);let changed=false
  for(const [at,color] of changes){const x=at%PAINT_STRIDE-room.x*5,y=Math.floor(at/PAINT_STRIDE)-room.y*5;if(x>=0&&y>=0&&x<room.width*5&&y<room.height*5){if(color===null)local.delete(y*PAINT_STRIDE+x);else local.set(y*PAINT_STRIDE+x,color);changed=true}}
  if(changed){const next={...old,id:old?.id??newId(),deck_id:deck.id,room_id:room.id,face:'floor' as const,paint:encodePaint(local)},index=surfaces.findIndex(s=>s.room_id===room.id&&s.face==='floor');if(index>=0)surfaces[index]=next;else surfaces.push(next)}
 }
 return {...plan,surface_design:{...design,surfaces}}
}
