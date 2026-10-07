import {type FixtureColors,fixtureColorsError} from './ship-fixture-colors'
import {deckHoles,subtractOpenings} from './ship-openings'
import type {ShipPlan,Deck,Room} from './ships'
import {type PaintedSurface,type SurfaceFace,paintError,MAX_PAINT_TILES,MAX_PAINT_RUNS} from './ship-paint'
export type HullSide='front'|'rear'|'port'|'starboard'
export type HullSection={id:string;deck_id:string;room_id:string;side:HullSide;extension_ft:number;slope:number;taper:number;bevel_ft:number}
export type SurfaceDesign={surfaces:PaintedSurface[];sections:HullSection[];components:{id:string;part_id:string;color:string;materials?:FixtureColors}[]}
export const SURFACE_FACES:SurfaceFace[]=['underside','floor','ceiling','roof','interior-front','interior-rear','interior-port','interior-starboard','exterior-front','exterior-rear','exterior-port','exterior-starboard']
export const EMPTY_SURFACES:SurfaceDesign={surfaces:[],sections:[],components:[]}
export function defaultSection(side:HullSide):Omit<HullSection,'id'|'deck_id'|'room_id'>{return {side,extension_ft:side==='front'?6.5:side==='rear'?0:2.5,slope:.6,taper:side==='front'?.44:0,bevel_ft:0}}
export function surfaceDesignError(plan:ShipPlan,unique:(id:string)=>boolean):string|null{
  const s=plan.surface_design;if(s===undefined)return null;if(!s)return 'Invalid surface customization.'
  if(!Array.isArray(s.surfaces)||!Array.isArray(s.sections)||!Array.isArray(s.components)||s.surfaces.length>2000||s.sections.length>2000||s.components.length>2000)return 'Surface customization exceeds limits.'
  const keys=new Set<string>();let count=0,runs=0
  const room=(deck:string,id:string)=>plan.decks.find(d=>d.id===deck)?.rooms.some(r=>r.id===id)
  const color=(value:unknown)=>typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value)
  for(const f of s.surfaces){const key=`${f.room_id}:${f.face}`
    if(!unique(f.id)||!room(f.deck_id,f.room_id)||!SURFACE_FACES.includes(f.face)||keys.has(key)||(f.color!==undefined&&!color(f.color))||paintError(f.paint))return 'Invalid surface or paint.'
    keys.add(key);count+=f.paint.runs.reduce((sum,r)=>sum+r[1],0);runs+=f.paint.runs.length
  }
  if(count>MAX_PAINT_TILES||runs>MAX_PAINT_RUNS)return 'Ship paint exceeds 50,000 squares or 10,000 runs.'
  for(const section of s.sections){const key=`shape:${section.room_id}:${section.side}`
    if(!unique(section.id)||!room(section.deck_id,section.room_id)||!['front','rear','port','starboard'].includes(section.side)||keys.has(key)||![section.extension_ft,section.slope,section.taper,section.bevel_ft].every(Number.isFinite)||section.extension_ft<0||section.extension_ft>10||section.slope<0||section.slope>1||section.taper<0||section.taper>.8||section.bevel_ft<0||section.bevel_ft>2)return 'Invalid hull section.'
    keys.add(key)
  }
  for(const component of s.components){if(!unique(component.id)||!plan.parts.some(p=>p.id===component.part_id)||!color(component.color)||(component.materials!==undefined&&fixtureColorsError(component.materials))||keys.has(`part:${component.part_id}`))return 'Invalid component color.';keys.add(`part:${component.part_id}`)}
  return null
}
export function pruneSurfaces(plan:ShipPlan):ShipPlan{
  if(!plan.surface_design)return plan
  const rooms=new Set(plan.decks.flatMap(d=>d.rooms.map(r=>r.id))),parts=new Set(plan.parts.map(p=>p.id))
  return {...plan,surface_design:{surfaces:plan.surface_design.surfaces.filter(s=>rooms.has(s.room_id)),sections:plan.surface_design.sections.filter(s=>rooms.has(s.room_id)),components:plan.surface_design.components.filter(c=>parts.has(c.part_id))}}
}
export type Vec3=[number,number,number]
export type SurfaceQuad={key:string;roomId:string;deckId:string;face:SurfaceFace;vertices:[Vec3,Vec3,Vec3,Vec3];width:number;height:number;uOffset:number;vOffset?:number;hull:boolean;color:string;paint?:PaintedSurface['paint'];cap?:boolean;capSide?:'start'|'end'|'top'|'bottom'}
// All coordinates here are feet, then converted by the viewer's 5 ft/cell scale.
// Each exposed contiguous side has capped outward skin. Room space is unchanged.
export function roomSurfaces(plan:ShipPlan,deck:Deck,room:Room):SurfaceQuad[]{
  const result:SurfaceQuad[]=[],height=deck.height_ft??8,design=plan.surface_design??EMPTY_SURFACES
  const style=(face:SurfaceFace)=>design.surfaces.find(s=>s.room_id===room.id&&s.face===face)
  const add=(face:SurfaceFace,v:[Vec3,Vec3,Vec3,Vec3],width:number,h:number,uOffset=0,cap=false)=>{const paint=style(face),hull=face==='underside'||face==='roof'||face.startsWith('exterior');result.push({key:`${room.id}/${face}/${result.length}`,roomId:room.id,deckId:deck.id,face,vertices:v,width,height:h,uOffset,hull,color:paint?.color??(hull?plan.appearance?.hull_color??'#718397':face==='floor'?'#334e63':'#b9c8d2'),paint:paint?.paint,cap})}
  const x=room.x*5,z=room.y*5,w=room.width*5,l=room.height*5
  for(const face of ['underside','floor','roof','ceiling'] as const){const y=face==='underside'?0:face==='floor'?.02:face==='roof'?height:height-.03;for(const rect of subtractOpenings({x:room.x,y:room.y,width:room.width,height:room.height},deckHoles(plan,deck.id,face==='underside'?'floor':face))){const px=rect.x*5,pz=rect.y*5,pw=rect.width*5,ph=rect.height*5;add(face,[[px,y,pz],[px+pw,y,pz],[px+pw,y,pz+ph],[px,y,pz+ph]],pw,ph,px-x);result[result.length-1].vOffset=pz-z}}
  for(const side of ['front','rear','port','starboard'] as HullSide[]){
    const vertical=side==='port'||side==='starboard',span=vertical?room.height:room.width
    const outward=side==='front'||side==='port'?-1:1,edge=side==='port'?x:side==='starboard'?x+w:side==='front'?z:z+l
    const along=vertical?z:x
    const point=(at:number,y:number,offset:number):Vec3=>vertical?[edge+outward*offset,y,along+at]:[along+at,y,edge+outward*offset]
    const door=(i:number)=>deck.marks.some(m=>m.kind==='door'&&m.vertical===vertical&&(vertical?m.x*5===edge&&(room.y+i)>=m.y&&(room.y+i)<m.y+m.length:m.y*5===edge&&(room.x+i)>=m.x&&(room.x+i)<m.x+m.length))
    for(let i=0;i<span;){if(door(i)){i++;continue}const start=i;while(i<span&&!door(i))i++;add(`interior-${side}`,[point(start*5,0,-.06),point(i*5,0,-.06),point(i*5,height,-.06),point(start*5,height,-.06)],(i-start)*5,height,start*5)}
    let capCursor=0
    const section=design.sections.find(s=>s.room_id===room.id&&s.side===side)??defaultSection(side)
    const exposed=(i:number)=>!door(i)&&!deck.rooms.some(r=>r.id!==room.id&&(vertical?
      room.y+i>=r.y&&room.y+i<r.y+r.height&&(side==='port'?r.x+r.width===room.x:r.x===room.x+room.width):
      room.x+i>=r.x&&room.x+i<r.x+r.width&&(side==='front'?r.y+r.height===room.y:r.y===room.y+room.height)))
    for(let i=0;i<span;){if(!exposed(i)){i++;continue}const start=i;while(i<span&&exposed(i))i++
      const length=(i-start)*5,inset=length*section.taper/2,a=start*5+inset,b=i*5-inset
      const bevel=Math.min(section.bevel_ft,height/2),wallHeight=height-bevel,outer=section.extension_ft,top=outer*(1-section.slope)
      const p0=point(a,0,outer),p1=point(b,0,outer),p2=point(b,wallHeight,top),p3=point(a,wallHeight,top)
      const face:SurfaceFace=`exterior-${side}`,slopeHeight=Math.hypot(wallHeight,outer-top)
      add(face,[p0,p1,p2,p3],b-a,slopeHeight,a)
      // Existing sparse surface paint also stores the seam caps in reserved bands.
      // Main-wall UVs stay unchanged; bands fit the existing 1024-foot address space.
      const cap=(side:'start'|'end'|'top'|'bottom',u:number,v:number)=>{const q=result[result.length-1];q.capSide=side;q.uOffset=u;q.vOffset=v}
      add(face,[point(start*5,0,0),p0,p3,point(start*5,height,0)],Math.max(.01,Math.hypot(inset,outer)),wallHeight,0,true);cap('start',capCursor,128)
      add(face,[p1,point(i*5,0,0),point(i*5,height,0),p2],Math.max(.01,Math.hypot(inset,outer)),wallHeight,0,true);cap('end',capCursor,256);capCursor+=Math.ceil(Math.max(.01,Math.hypot(inset,outer)))
      add(face,[p3,p2,point(i*5,height,0),point(start*5,height,0)],length,Math.max(.01,Math.hypot(bevel,top)),0,true);cap('top',start*5,384)
      add(face,[point(start*5,0,0),point(i*5,0,0),p1,p0],length,Math.max(.01,outer),0,true);cap('bottom',start*5,512)
    }
  }
  return result
}

export function surfaceModeActive(plan:ShipPlan,mode:'cutaway'|'exterior',force=false){
  if(mode==='exterior'&&force)return true
  if(mode==='cutaway'&&plan.connections.some(c=>deckHoles(plan,c.from_deck,'floor').length||deckHoles(plan,c.from_deck,'ceiling').length))return true
  const design=plan.surface_design
  return !!design&&(mode==='exterior'?design.sections.length>0||design.surfaces.some(s=>s.face==='underside'||s.face==='roof'||s.face.startsWith('exterior')):design.surfaces.some(s=>s.face!=='underside'&&s.face!=='roof'&&!s.face.startsWith('exterior')))
}
