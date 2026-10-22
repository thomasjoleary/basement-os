import {newId,partFootprint,roomAt,validatePlan,type ShipPlan,type Point} from './ships'
import type {MoveTarget} from './ship-move'
import {EMPTY_SURFACES,defaultSection,type HullSide} from './ship-surfaces'
import {decodePaint,encodePaint,PAINT_STRIDE,type FootTile} from './ship-paint'

export type Symmetry = {x:number|null;y:number|null}
export type ShipClipboard = {plan:ShipPlan;deckId:string;target:MoveTarget}
export function copySelection(plan:ShipPlan,deckId:string,target:MoveTarget):ShipClipboard {
  return {plan:structuredClone(plan),deckId,target:{...target}}
}
// A clipboard is a snapshot, never a reference to a mutable editor document.
// Cross-deck openings need an explicit destination on two decks; do not guess.
export function pasteSelection(plan:ShipPlan,deckId:string,clip:ShipClipboard,at:Point,mirror?:{axis:'x'|'y';line:number}):{plan:ShipPlan;selection?:MoveTarget;error?:string}{
  const fail=(error:string)=>({plan,error}),source=clip.plan.decks.find(d=>d.id===clip.deckId),next=structuredClone(plan),deck=next.decks.find(d=>d.id===deckId)
  if(!source||!deck)return fail('Choose a destination deck.')
  const {kind,id}=clip.target
  if(kind==='connection')return fail('Connections span two decks. Add an opening with explicit endpoints instead.')
  const room=kind==='room'?source.rooms.find(r=>r.id===id):undefined
  const part=kind==='part'?clip.plan.parts.find(p=>p.id===id):undefined
  const mark=kind==='mark'?source.marks.find(m=>m.id===id):undefined
  const item=room??part??mark
  if(!item)return fail('The copied item is unavailable.')
  if(!Number.isInteger(at.x)||!Number.isInteger(at.y)||mirror&&(!Number.isFinite(mirror.line)||!Number.isInteger(mirror.line*2)))return fail('Use whole-cell positions and whole or half-cell symmetry lines.')
  const inside=(p:Point)=>!!room&&p.x>=room.x&&p.y>=room.y&&p.x<room.x+room.width&&p.y<room.y+room.height
  if(part&&clip.plan.connections.some(c=>c.aperture?.ladder_part_id===part.id)||room&&clip.plan.connections.some(c=>c.from_deck===source.id&&inside(c.from)||c.to_deck===source.id&&inside(c.to)))return fail('This selection contains a deck connection. Copy its fixtures separately or add a new opening explicitly.')
  const shift=(p:Point,w=0,h=0):Point=>mirror?{x:mirror.axis==='x'?2*mirror.line-p.x-w:p.x,y:mirror.axis==='y'?2*mirror.line-p.y-h:p.y}:{x:p.x+at.x-item.x,y:p.y+at.y-item.y}
  const parts=part?[part]:room?clip.plan.parts.filter(p=>p.deck_id===source.id&&(p.room_id===room.id||inside(p))):[]
  const marks=mark?[mark]:room?source.marks.filter(m=>inside(m)):[]
  const ids=new Map<string,string>(),map=(old:string)=>{if(!ids.has(old))ids.set(old,newId());return ids.get(old)!}
  if(room){const r={...room,...shift(room,room.width,room.height),id:map(room.id)}
    if(deck.rooms.some(a=>r.x<a.x+a.width&&r.x+r.width>a.x&&r.y<a.y+a.height&&r.y+r.height>a.y))return fail('The copied room overlaps an existing room. Choose an empty destination.')
    deck.rooms.push(r)
  }
  for(const p of parts){const size=partFootprint(p.type),position=shift(p,size.width,size.height),type=mirror?.axis==='x'?(p.type==='Port wing'?'Starboard wing':p.type==='Starboard wing'?'Port wing':p.type):p.type
    if(position.x<0||position.y<0||position.x+size.width>deck.width||position.y+size.height>deck.height)return fail('The complete copied fixture must fit inside the deck.')
    next.parts.push({...p,...position,type,id:map(p.id),deck_id:deckId,room_id:roomAt(deck,position)?.id??null})
  }
  for(const m of marks)deck.marks.push({...m,...shift(m,m.kind==='label'?0:m.vertical?0:m.length,m.kind==='label'?0:m.vertical?m.length:0),id:map(m.id)})
  const design=next.surface_design??structuredClone(EMPTY_SURFACES),old=clip.plan.surface_design??EMPTY_SURFACES
  const swap=(s:string)=>!mirror?s:mirror.axis==='x'?s.replace(/port|starboard/g,v=>v==='port'?'starboard':'port'):s.replace(/front|rear/g,v=>v==='front'?'rear':'front')
  if(room){
    for(const s of old.surfaces.filter(s=>s.room_id===room.id)){
      let paint=s.paint
      if(mirror&&s.paint.runs.length){
        const flat=['floor','ceiling','roof','underside'].includes(s.face),alongX=s.face.endsWith('front')||s.face.endsWith('rear'),tiles=decodePaint(s.paint),mapped=new Map<number,string>()
        // Cap bands and out-of-face stored paint have independent UVs. Preserve
        // them by refusing this transform rather than silently dropping paint.
        for(const [key,color] of tiles){const x=key%PAINT_STRIDE,y=Math.floor(key/PAINT_STRIDE),width=(flat||alongX?room.width:room.height)*5,height=flat?room.height*5:(source.height_ft??8)
          if(x>=width||y>=height)return fail('This room has cap or hidden surface paint. Paste it without mirroring to preserve all paint, or mirror its individual fixtures.')
          const u=(flat?mirror.axis==='x':alongX===(mirror.axis==='x'))?width-1-x:x,v=flat&&mirror.axis==='y'?height-1-y:y
          mapped.set(v*PAINT_STRIDE+u,color)
        }
        paint=encodePaint(mapped)
      }
      design.surfaces.push({...s,id:newId(),deck_id:deckId,room_id:map(room.id),face:swap(s.face) as typeof s.face,paint:structuredClone(paint)})
    }
    const sections=mirror?(['front','rear','port','starboard'] as HullSide[]).map(side=>old.sections.find(s=>s.room_id===room.id&&s.side===side)??defaultSection(side)):old.sections.filter(s=>s.room_id===room.id)
    for(const s of sections)design.sections.push({...s,id:newId(),deck_id:deckId,room_id:map(room.id),side:swap(s.side) as HullSide})
  }
  for(const c of old.components)if(ids.has(c.part_id))design.components.push({...structuredClone(c),id:newId(),part_id:map(c.part_id)})
  if(design.surfaces.length||design.sections.length||design.components.length)next.surface_design=design
  const error=validatePlan(next)
  return error?fail(error):{plan:next,selection:{kind,id:map(id)}}
}

export function mirroredTiles(tiles:Iterable<FootTile>,guides:Symmetry,visible:(p:FootTile)=>boolean):FootTile[]{
  const result=new Map<number,FootTile>()
  for(const p of tiles)for(const x of guides.x===null?[p.x]:[p.x,2*guides.x-1-p.x])for(const y of guides.y===null?[p.y]:[p.y,2*guides.y-1-p.y]){
    const at={x,y};if(Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<PAINT_STRIDE&&y<PAINT_STRIDE&&visible(at))result.set(y*PAINT_STRIDE+x,at)
  }
  return [...result.values()]
}

export function layoutWarnings(plan:ShipPlan,deckId:string):string[]{
  const deck=plan.decks.find(d=>d.id===deckId);if(!deck)return []
  const warnings:string[]=[],parts=plan.parts.filter(p=>p.deck_id===deckId)
  for(const p of parts){const size=partFootprint(p.type),room=deck.rooms.find(r=>r.id===p.room_id)
    if(room&&(p.x+size.width>room.x+room.width||p.y+size.height>room.y+room.height))warnings.push(`${p.name}: footprint crosses its room boundary.`)
  }
  let overlaps=0
  for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){const a=parts[i],b=parts[j],sa=partFootprint(a.type),sb=partFootprint(b.type);if(a.x<b.x+sb.width&&a.x+sa.width>b.x&&a.y<b.y+sb.height&&a.y+sa.height>b.y)overlaps++}
  if(overlaps)warnings.push(`${overlaps} overlapping component pair${overlaps===1?'':'s'}; intentional hull/booster overlaps are allowed.`)
  if(plan.decks.length>1&&!plan.connections.some(c=>c.from_deck===deckId||c.to_deck===deckId))warnings.push('This deck has no connection to another deck.')
  for(const r of deck.rooms)if(!deck.marks.some(m=>m.kind==='door'&&(m.vertical?(m.x===r.x||m.x===r.x+r.width)&&m.y<r.y+r.height&&m.y+m.length>r.y:(m.y===r.y||m.y===r.y+r.height)&&m.x<r.x+r.width&&m.x+m.length>r.x)))warnings.push(`${r.name}: no door marked on the room boundary.`)
  return warnings.slice(0,100)
}
