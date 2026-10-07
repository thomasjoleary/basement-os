'use client'
import {useEffect,useState} from 'react'
import {type Part,type ShipPlan,newId,shipAppearance} from '@/lib/ships'
import {fixtureStyle,fixtureRegions,type FixtureColors} from '@/lib/ship-fixture-colors'
import {EMPTY_SURFACES} from '@/lib/ship-surfaces'
import {supabase} from '@/lib/supabase'
export default function ShipFixtureColors({plan,part,disabled,onChange}:{plan:ShipPlan;part:Part;disabled:boolean;onChange:(p:ShipPlan)=>void}){
 const [ready,setReady]=useState(false),[region,setRegion]=useState<'trim'|'detail'>('trim')
 useEffect(()=>{let active=true;void supabase.rpc('v2_ship_check_surfaces',{p:{decks:[],parts:[{id:'fixture-probe'}],surface_design:{surfaces:[],sections:[],components:[{id:'fixture-color-probe',part_id:'fixture-probe',color:'#586e82',materials:{trim:'#123456'}}]}}}).then(({error})=>{if(active)setReady(!error)});return()=>{active=false}},[])
 const style=fixtureStyle(plan,part),regions=fixtureRegions(part.type),selected=regions.find(r=>r.key===region)??regions[0]
 const defaultColor=(part.type==='Port wing'||part.type==='Starboard wing')?shipAppearance(plan).accent_color:selected.defaultColor
 function update(color:string,materials:FixtureColors){const design=plan.surface_design??EMPTY_SURFACES,old=design.components.find(c=>c.part_id===part.id);onChange({...plan,surface_design:{...design,components:[...design.components.filter(c=>c.part_id!==part.id),{id:old?.id??newId(),part_id:part.id,color,...(Object.keys(materials).length?{materials}:{})}]}})}
 return <div className="space-y-2" aria-label="Fixture paint options">
  <label className="block text-xs">Casing color<input aria-label="Component color" type="color" disabled={disabled} value={style.color} onChange={e=>update(e.target.value,style.materials)}/></label>
  <fieldset disabled={disabled||!ready} className="space-y-2"><label className="block text-xs">Paintable part<select aria-label="Paintable fixture part" className="block w-full rounded bg-gray-950 border border-gray-600 p-2" value={selected.key} onChange={e=>setRegion(e.target.value as 'trim'|'detail')}>{regions.map(r=><option key={r.key} value={r.key}>{r.name}</option>)}</select></label>
   <label className="flex items-center gap-2 text-xs">{selected.name} color<input aria-label="Fixture part color" type="color" value={style.materials[selected.key]??defaultColor} onChange={e=>update(style.color,{...style.materials,[selected.key]:e.target.value})}/><span style={{background:style.materials[selected.key]??defaultColor}} className="inline-block h-5 w-5 border border-white/30" aria-hidden="true"/></label>
   <button type="button" className="text-xs underline" onClick={()=>{const materials={...style.materials};delete materials[selected.key];update(style.color,materials)}}>Reset selected part color</button>
  </fieldset>
  {!ready&&<p role="status" className="text-xs text-amber-200">Per-part colors need fixture-color setup. Casing color is still available.</p>}
  <p className="text-xs text-gray-400">Preview colors in Cutaway, Exterior or Walkthrough. Screens and engine glow keep their functional colors.</p>
  <button type="button" disabled={disabled} className="text-xs underline" onClick={()=>{const design=plan.surface_design??EMPTY_SURFACES;onChange({...plan,surface_design:{...design,components:design.components.filter(c=>c.part_id!==part.id)}})}}>Use default component color</button>
 </div>
}
