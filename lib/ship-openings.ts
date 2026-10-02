import type {ShipPlan,Connection,Deck,Point} from './ships'
export type OpeningRect=Point&{width:number;height:number;connectionId:string}
export function apertureSize(c:Connection){return c.aperture??{width:1,height:1,ladder_part_id:null}}
export function hasLadder(plan:ShipPlan,c:Connection){return !c.aperture||!!plan.parts.find(p=>p.id===c.aperture!.ladder_part_id&&p.type==='Ladder')}
export function adjacent(plan:ShipPlan,c:Connection){return Math.abs(plan.decks.findIndex(d=>d.id===c.from_deck)-plan.decks.findIndex(d=>d.id===c.to_deck))===1}
export function fitsFloor(deck:Deck,at:Point,width:number,height:number){if(![at.x,at.y,width,height].every(Number.isInteger)||width<1||height<1||width>100||height>100||at.x<0||at.y<0||at.x+width>deck.width||at.y+height>deck.height)return false;for(let y=at.y;y<at.y+height;y++)for(let x=at.x;x<at.x+width;x++)if(!deck.rooms.some(r=>x>=r.x&&y>=r.y&&x<r.x+r.width&&y<r.y+r.height))return false;return true}
// Align connected deck plans by their saved endpoints. Never alter stored positions.
// Conflicting legacy alignments remain traversable but are explicitly not rendered
// as a false through-hole. New explicit apertures must have consistent alignment.
export function openingLayout(plan:ShipPlan){
 const offsets=new Map<string,Point>(),compatible=new Set<string>()
 for(const root of plan.decks){if(offsets.has(root.id))continue;offsets.set(root.id,{x:0,y:0});const queue=[root.id]
  while(queue.length){const id=queue.shift()!,base=offsets.get(id)!;for(const c of plan.connections){if(!adjacent(plan,c))continue;const forward=c.from_deck===id;if(!forward&&c.to_deck!==id)continue;const other=forward?c.to_deck:c.from_deck,a=forward?c.from:c.to,b=forward?c.to:c.from,next={x:base.x+a.x-b.x,y:base.y+a.y-b.y};if(!offsets.has(other)){offsets.set(other,next);queue.push(other)}if(offsets.get(other)!.x===next.x&&offsets.get(other)!.y===next.y)compatible.add(c.id)}}
 }
 return {offsets,compatible}
}
export function physicalOpening(plan:ShipPlan,c:Connection,compatible=openingLayout(plan).compatible){const a=plan.decks.find(d=>d.id===c.from_deck),b=plan.decks.find(d=>d.id===c.to_deck),size=apertureSize(c);return !!a&&!!b&&adjacent(plan,c)&&compatible.has(c.id)&&fitsFloor(a,c.from,size.width,size.height)&&fitsFloor(b,c.to,size.width,size.height)}
export function deckHoles(plan:ShipPlan,deckId:string,face:'floor'|'ceiling'|'roof'):OpeningRect[]{const index=plan.decks.findIndex(d=>d.id===deckId),compatible=openingLayout(plan).compatible;return plan.connections.flatMap(c=>{if(!physicalOpening(plan,c,compatible))return [];const from=c.from_deck===deckId;if(!from&&c.to_deck!==deckId)return [];const other=plan.decks.findIndex(d=>d.id===(from?c.to_deck:c.from_deck));if(face==='floor'?other<index:other>index)return [];return [{...(from?c.from:c.to),width:apertureSize(c).width,height:apertureSize(c).height,connectionId:c.id}]})}
export function openingError(plan:ShipPlan):string|null{
 const refs=new Set<string>(),compatible=openingLayout(plan).compatible
 for(const c of plan.connections){if(c.aperture===undefined)continue;const a=c.aperture
  if(!a||!Number.isInteger(a.width)||!Number.isInteger(a.height)||a.width<1||a.height<1||a.width>100||a.height>100||!(a.ladder_part_id===null||typeof a.ladder_part_id==='string'))return 'Openings need whole-cell dimensions from 1 to 100.'
  if(!physicalOpening(plan,c,compatible))return 'Openings must join adjacent decks, fit room floors at both ends, and align with other openings between those decks.'
  if(a.ladder_part_id){const p=plan.parts.find(p=>p.id===a.ladder_part_id);if(!p||p.type!=='Ladder'||p.deck_id!==c.from_deck||p.x!==c.from.x||p.y!==c.from.y||p.quantity!==1||refs.has(p.id))return 'Each ladder fixture must be anchored to exactly one opening source.';refs.add(p.id)}
 }
 return null
}
export function openingContains(h:OpeningRect,p:Point,padding=0){return p.x>h.x-padding&&p.y>h.y-padding&&p.x<h.x+h.width+padding&&p.y<h.y+h.height+padding}
export function subtractOpenings(rect:{x:number;y:number;width:number;height:number},holes:OpeningRect[]){let pieces=[rect];for(const h of holes){pieces=pieces.flatMap(r=>{const x=Math.max(r.x,h.x),y=Math.max(r.y,h.y),right=Math.min(r.x+r.width,h.x+h.width),bottom=Math.min(r.y+r.height,h.y+h.height);if(x>=right||y>=bottom)return [r];return [{x:r.x,y:r.y,width:r.width,height:y-r.y},{x:r.x,y:bottom,width:r.width,height:r.y+r.height-bottom},{x:r.x,y,width:x-r.x,height:bottom-y},{x:right,y,width:r.x+r.width-right,height:bottom-y}].filter(p=>p.width>0&&p.height>0)})}return pieces}
