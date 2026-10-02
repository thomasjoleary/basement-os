'use client'
import {useMemo,useState} from 'react'
import {type ShipPlan,type Deck,type Room,newId,validatePlan} from '@/lib/ships'
import {type SurfaceFace,EMPTY_PAINT} from '@/lib/ship-paint'
import {type HullSection,type HullSide,EMPTY_SURFACES,SURFACE_FACES,defaultSection,roomSurfaces} from '@/lib/ship-surfaces'
import SurfacePainter from './SurfacePainter'
export default function ShipSurfaceEditor({plan,deck,room,face,onFace,disabled,onChange}:{plan:ShipPlan;deck:Deck;room:Room;face:SurfaceFace;onFace:(face:SurfaceFace)=>void;disabled:boolean;onChange:(plan:ShipPlan)=>void}){
  const [error,setError]=useState(''),design=plan.surface_design??EMPTY_SURFACES
  const surface=design.surfaces.find(s=>s.room_id===room.id&&s.face===face)
  const surfaces=useMemo(()=>roomSurfaces(plan,deck,room).filter(s=>s.face===face),[plan,deck,room,face])
  function commit(next:ShipPlan){if(disabled)return;const invalid=validatePlan(next);if(invalid){setError(invalid);return}setError('');onChange(next)}
  function style(patch:Partial<NonNullable<typeof surface>>){const next={id:newId(),deck_id:deck.id,room_id:room.id,face,paint:EMPTY_PAINT,...surface,...patch};commit({...plan,surface_design:{...design,surfaces:[...design.surfaces.filter(s=>s.room_id!==room.id||s.face!==face),next]}})}
  const side=face.startsWith('exterior-')?face.slice(9) as HullSide:null
  const section=side?design.sections.find(s=>s.room_id===room.id&&s.side===side):undefined
  function shape(patch:Partial<HullSection>){if(!side)return;const next={id:newId(),deck_id:deck.id,room_id:room.id,...defaultSection(side),...section,...patch};commit({...plan,surface_design:{...design,sections:[...design.sections.filter(s=>s.room_id!==room.id||s.side!==side),next]}})}
  return <div className="space-y-3 border-t border-gray-700 pt-3"><h3 className="font-semibold">Surface and hull section</h3>
    <label className="block text-xs">Surface<select aria-label="Surface" value={face} onChange={e=>onFace(e.target.value as SurfaceFace)} className="block bg-gray-950 border border-gray-600 w-full rounded p-2 mt-1">{SURFACE_FACES.map(f=><option key={f} value={f}>{f.replaceAll('-',' ')}</option>)}</select></label>
    <fieldset disabled={disabled} className="space-y-2"><label className="block text-xs">Section color<input aria-label="Section color" type="color" value={surface?.color??surfaces[0]?.color??'#718397'} onChange={e=>style({color:e.target.value})}/></label><button type="button" className="text-xs underline" onClick={()=>style({color:undefined})}>Use default color</button><button type="button" className="text-xs underline ml-3" onClick={()=>commit({...plan,surface_design:{...design,surfaces:design.surfaces.filter(s=>s.room_id!==room.id||s.face!==face)}})}>Clear surface customization</button>
    {side&&<><p className="text-xs text-gray-400">Shape this room’s exposed {side} section. Skin extends outward; usable room space stays unchanged. Adjacent sections have closed seams. Paint is clipped, not deleted, as dimensions change.</p>{([['extension_ft','Outward extension (feet)',0,10,.25],['slope','Side slope',0,1,.05],['taper','End taper',0,.8,.05],['bevel_ft','Roof bevel (feet)',0,2,.1]] as const).map(([key,label,min,max,step])=><label key={key} className="block text-xs">{label}<input aria-label={label} type="number" min={min} max={max} step={step} value={(section??defaultSection(side))[key]} onChange={e=>shape({[key]:Number(e.target.value)})} className="block w-full bg-gray-950 border border-gray-600 p-2 rounded mt-1"/></label>)}<button type="button" className="text-xs underline" onClick={()=>commit({...plan,surface_design:{...design,sections:design.sections.filter(s=>s.room_id!==room.id||s.side!==side)}})}>Reset section shape</button></>}
    </fieldset>
    {!surfaces.some(s=>!s.cap)?<p className="text-xs text-amber-200">This side has no exposed hull. Its saved customization is retained if the room layout exposes it later.</p>:<SurfacePainter key={`${room.id}/${face}`} surfaces={surfaces} paint={surface?.paint} disabled={disabled} onChange={paint=>style({paint})}/>}
    {error&&<p role="status" className="text-xs text-red-300">{error}</p>}
  </div>
}
