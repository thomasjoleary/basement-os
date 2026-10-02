'use client'
import {useMemo,useState} from 'react'
import type {ShipPlan,Deck} from '@/lib/ships'
import {newId,validatePlan} from '@/lib/ships'
import {deckFloorTiles,paintDeckFloors} from '@/lib/ship-floor-paint'
import {EMPTY_PAINT,type SurfaceFace} from '@/lib/ship-paint'
import {deckHoles,subtractOpenings} from '@/lib/ship-openings'
import {EMPTY_SURFACES,roomSurfaces,SURFACE_FACES} from '@/lib/ship-surfaces'
import SurfacePainter from './SurfacePainter'
export default function DeckPaintView({plan,deck,disabled,onChange}:{plan:ShipPlan;deck:Deck;disabled:boolean;onChange:(plan:ShipPlan)=>void}){
 const [error,setError]=useState(''),[target,setTarget]=useState('deck'),[face,setFace]=useState<SurfaceFace>('floor'),design=plan.surface_design??EMPTY_SURFACES
 const paint=useMemo(()=>deckFloorTiles(plan,deck),[plan,deck])
 function change(cells:Map<number,string>){if(disabled)return;const next=paintDeckFloors(plan,deck,cells),invalid=validatePlan(next);setError(invalid??'');if(!invalid)onChange(next)}
 const room=deck.rooms.find(r=>r.id===target),surface=design.surfaces.find(s=>s.room_id===room?.id&&s.face===face),quads=room?roomSurfaces(plan,deck,room).filter(q=>q.face===face):[]
 function paintFace(paint:typeof EMPTY_PAINT){if(disabled||!room)return;const item={...surface,id:surface?.id??newId(),deck_id:deck.id,room_id:room.id,face,paint},next={...plan,surface_design:{...design,surfaces:[...design.surfaces.filter(s=>s.room_id!==room.id||s.face!==face),item]}},invalid=validatePlan(next);setError(invalid??'');if(!invalid)onChange(next)}
 const topDown=face==='floor'||face==='roof'||face==='ceiling'
 return <section aria-label="Deck painting" className="min-w-0 rounded-xl border border-gray-700 bg-gray-950 p-4"><h2 className="font-semibold">Paint — {deck.name}</h2><div className="flex flex-wrap gap-4 py-3"><label>Paint target<select aria-label="Paint target" value={room?room.id:'deck'} onChange={e=>setTarget(e.target.value)} className="block bg-gray-800 border border-gray-600 rounded p-2"><option value="deck">All deck floors</option>{deck.rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>{room&&<label>Paint face<select aria-label="Paint face" value={face} onChange={e=>setFace(e.target.value as SurfaceFace)} className="block bg-gray-800 border border-gray-600 rounded p-2">{SURFACE_FACES.map(f=><option key={f} value={f}>{f.replaceAll('-',' ')}</option>)}</select></label>}</div>
 <p className="text-sm text-gray-400">{room?`${room.name} · ${face.replaceAll('-',' ')}. ${topDown?'Plan orientation: front at top, port at left. Ceiling is unfolded into plan orientation.':'Unfolded elevation: bottom is floor level, top is ceiling. Left-to-right follows port → starboard on front/rear faces, front → rear on side faces.'}`:'Top-down floors: front at top, port at left.'} Choose Pan to move the canvas. Completed strokes share undo history across views. Openings remain unpainted gaps.</p>
 {!deck.rooms.length?<p>Add rooms in 2D to paint this deck.</p>:room?(quads.some(q=>!q.cap)?<SurfacePainter key={`${deck.id}/${room.id}/${face}`} large topDown={topDown} surfaces={quads} paint={surface?.paint} disabled={disabled} onChange={paintFace}/>:<p role="status">This face has no visible surface. Stored paint is retained.</p>):<SurfacePainter key={deck.id} large surfaces={[]} regions={deck.rooms.flatMap(r=>subtractOpenings(r,deckHoles(plan,deck.id,'floor')).map(piece=>({x:piece.x*5,y:piece.y*5,width:piece.width*5,height:piece.height*5,label:r.name,color:design.surfaces.find(s=>s.room_id===r.id&&s.face==='floor')?.color??'#334e63'})))} tileMap={paint} disabled={disabled} onChange={()=>{}} onTiles={change}/>}{error&&<p role="status">{error}</p>}</section>
}
