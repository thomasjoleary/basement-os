'use client'
import { type ShipPlan, type ShipAppearance, type WindowSide, shipAppearance, newId } from '@/lib/ships'
const input='block w-full min-w-0 bg-gray-950 border border-gray-600 rounded px-2 py-2 text-sm text-gray-200 mt-1 disabled:opacity-60'
export default function ShipAppearanceEditor({plan,deckId,disabled,onChange}:{plan:ShipPlan;deckId:string;disabled:boolean;onChange:(plan:ShipPlan)=>void}) {
  const appearance=shipAppearance(plan)
  const patch=(values:Partial<ShipAppearance>)=>{if(!disabled)onChange({...plan,appearance:{...appearance,...values}})}
  return <fieldset disabled={disabled} className="min-w-0 space-y-3 border-t border-gray-700 pt-4">
    <legend className="font-semibold">Exterior appearance</legend>
    {([['hull_color','Hull color'],['accent_color','Marking color'],['engine_color','Engine glow color']] as const).map(([key,label])=><label key={key} className="block text-xs text-gray-400">{label}<input className="block w-full h-10 rounded bg-gray-950 mt-1" type="color" aria-label={label} value={appearance[key]} onChange={e=>patch({[key]:e.target.value})} /></label>)}
    <label className="block text-xs text-gray-400">Marking style<select aria-label="Marking style" className={input} value={appearance.marking} onChange={e=>patch({marking:e.target.value as ShipAppearance['marking']})}><option value="none">None</option><option value="stripe">Stripe</option><option value="chevron">Chevron</option></select></label>
    <p className="text-xs text-gray-400">Windows follow the outer room boundary on a chosen side. Position runs from front to rear on port/starboard, or port to starboard on front/rear.</p>
    {appearance.windows.map((w,i)=><div key={w.id} className="border border-gray-700 rounded p-2 space-y-2">
      <label className="block text-xs">Window {i+1} deck<select aria-label={`Window ${i+1} deck`} className={input} value={w.deck_id} onChange={e=>patch({windows:appearance.windows.map(a=>a.id===w.id?{...a,deck_id:e.target.value}:a)})}>{plan.decks.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label className="block text-xs">Window {i+1} side<select aria-label={`Window ${i+1} side`} className={input} value={w.side} onChange={e=>patch({windows:appearance.windows.map(a=>a.id===w.id?{...a,side:e.target.value as WindowSide}:a)})}>{(['front','rear','port','starboard'] as const).map(side=><option key={side} value={side}>{side}</option>)}</select></label>
      <label className="block text-xs">Window {i+1} position: {Math.round(w.position*100)}%<input aria-label={`Window ${i+1} position`} className="block w-full mt-2" type="range" min={0} max={100} value={w.position*100} onChange={e=>patch({windows:appearance.windows.map(a=>a.id===w.id?{...a,position:Number(e.target.value)/100}:a)})} /></label>
      {!plan.decks.find(d=>d.id===w.deck_id)?.rooms.length&&<p className="text-xs text-amber-200">Add rooms on this deck to give this window a hull boundary.</p>}
      <button type="button" className="text-xs text-red-300" aria-label={`Remove window ${i+1}`} onClick={()=>patch({windows:appearance.windows.filter(a=>a.id!==w.id)})}>Remove window</button>
    </div>)}
    {!disabled&&<button type="button" className="rounded border border-gray-600 px-3 py-2 text-sm disabled:opacity-50" disabled={appearance.windows.length>=100} onClick={()=>patch({windows:[...appearance.windows,{id:newId(),deck_id:deckId,side:'front',position:.5}]})}>Add window</button>}
  </fieldset>
}
