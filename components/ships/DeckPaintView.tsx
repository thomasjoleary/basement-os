'use client'
import {useMemo,useState} from 'react'
import type {ShipPlan,Deck} from '@/lib/ships'
import {validatePlan} from '@/lib/ships'
import {deckFloorTiles,paintDeckFloors} from '@/lib/ship-floor-paint'
import {EMPTY_SURFACES} from '@/lib/ship-surfaces'
import SurfacePainter from './SurfacePainter'
export default function DeckPaintView({plan,deck,disabled,onChange}:{plan:ShipPlan;deck:Deck;disabled:boolean;onChange:(plan:ShipPlan)=>void}){
 const [error,setError]=useState(''),design=plan.surface_design??EMPTY_SURFACES
 const paint=useMemo(()=>deckFloorTiles(plan,deck),[plan,deck])
 function change(cells:Map<number,string>){if(disabled)return;const next=paintDeckFloors(plan,deck,cells),invalid=validatePlan(next);setError(invalid??'');if(!invalid)onChange(next)}
 return <section aria-label="Deck painting" className="min-w-0 rounded-xl border border-gray-700 bg-gray-950 p-4"><h2 className="font-semibold">Paint — {deck.name}</h2><p className="text-sm text-gray-400">Top-down floor plan. Choose Pan to move the canvas; Brush and Erase change only floor squares. Completed strokes share the editor undo history across views.</p>{!deck.rooms.length?<p>Add rooms in 2D to paint this deck.</p>:<SurfacePainter key={deck.id} large surfaces={[]} regions={deck.rooms.map(r=>({x:r.x*5,y:r.y*5,width:r.width*5,height:r.height*5,label:r.name,color:design.surfaces.find(s=>s.room_id===r.id&&s.face==='floor')?.color??'#334e63'}))} tileMap={paint} disabled={disabled} onChange={()=>{}} onTiles={change}/ >}{error&&<p role="status">{error}</p>}</section>
}
