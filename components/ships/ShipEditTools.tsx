'use client'
import {useEffect,useState} from 'react'
import {copySelection,pasteSelection,layoutWarnings,type ShipClipboard,type Symmetry} from '@/lib/ship-edit-tools'
import type {ShipPlan,Deck} from '@/lib/ships'
import type {Selection} from './ShipGrid'
export default function ShipEditTools({plan,deck,selection,disabled,guides,onGuides,onChange,onSelect,onMessage}:{plan:ShipPlan;deck:Deck;selection:Selection;disabled:boolean;guides:Symmetry;onGuides:(guides:Symmetry)=>void;onChange:(plan:ShipPlan)=>void;onSelect:(selection:Selection)=>void;onMessage:(message:string)=>void}){
  const [clipboard,setClipboard]=useState<ShipClipboard|null>(null),[x,setX]=useState(0),[y,setY]=useState(0)
  function paste(mirror?:'x'|'y'){
    if(disabled)return
    const clip=mirror&&selection?copySelection(plan,deck.id,selection):clipboard
    if(!clip)return
    const result=pasteSelection(plan,deck.id,clip,{x,y},mirror&&guides[mirror]!==null?{axis:mirror,line:guides[mirror]!}:undefined)
    if(result.error)onMessage(result.error);else {onChange(result.plan);onSelect(result.selection??null);onMessage(mirror?'Mirrored copy added.':'Selection pasted. Undo removes the whole copy.')}
  }
  function copy(){if(!disabled&&selection){setClipboard(copySelection(plan,deck.id,selection));onMessage('Selection copied. Set destination X/Y, then paste. Rooms include their fixtures, marks and surface finishes; connections require explicit endpoints.')}}
  useEffect(()=>{const key=(event:KeyboardEvent)=>{const target=event.target as HTMLElement;if(document.querySelector('dialog[open]')||disabled||!(event.ctrlKey||event.metaKey)||event.altKey||event.shiftKey||target.closest?.('input,textarea,select,[contenteditable="true"]')||window.getSelection()?.toString())return;if(event.code==='KeyC'&&selection){event.preventDefault();copy()}if(event.code==='KeyV'&&clipboard){event.preventDefault();paste()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)})
  const warnings=layoutWarnings(plan,deck.id)
  return <details className="mb-4 rounded border border-gray-700 p-3 min-w-0"><summary className="cursor-pointer text-sm">Layout tools · {warnings.length} advisory warnings</summary><div className="flex flex-wrap items-end gap-3 pt-3">
    {(['x','y'] as const).map(axis=><div key={axis} className="text-sm"><label><input type="checkbox" checked={guides[axis]!==null} disabled={disabled} onChange={e=>onGuides({...guides,[axis]:e.target.checked?(axis==='x'?deck.width:deck.height)/2:null})}/> {axis==='x'?'Vertical':'Horizontal'} symmetry line</label>{guides[axis]!==null&&<label className="block text-xs">{axis.toUpperCase()} (grid cells)<input aria-label={`Symmetry ${axis}`} type="number" min={0} max={axis==='x'?deck.width:deck.height} step={.5} value={guides[axis]!} disabled={disabled} onChange={e=>{const v=Number(e.target.value);if(Number.isFinite(v)&&Number.isInteger(v*2)&&v>=0&&v<=(axis==='x'?deck.width:deck.height))onGuides({...guides,[axis]:v})}} className="w-20 bg-gray-950 border border-gray-600 p-1 ml-2"/></label>}<button type="button" disabled={disabled||!selection||guides[axis]===null} onClick={()=>paste(axis)} className="block disabled:opacity-40">Mirror selection across {axis.toUpperCase()}</button></div>)}
    <button type="button" disabled={disabled||!selection} onClick={copy} className="disabled:opacity-40">Copy selection</button>
    <label className="text-xs">Paste X<input aria-label="Paste X" type="number" min={0} max={deck.width} value={x} onChange={e=>setX(Number(e.target.value))} className="block w-20 bg-gray-950 border border-gray-600 p-1"/></label><label className="text-xs">Paste Y<input aria-label="Paste Y" type="number" min={0} max={deck.height} value={y} onChange={e=>setY(Number(e.target.value))} className="block w-20 bg-gray-950 border border-gray-600 p-1"/></label><button type="button" disabled={disabled||!clipboard} onClick={()=>paste()} className="disabled:opacity-40">Paste selection</button>
  </div><p className="text-xs text-gray-400 mt-2">Ctrl/Cmd+C and Ctrl/Cmd+V use this editor clipboard outside text fields. Mirror creates an independent copy. Guides are per-deck editor preferences, measured from the top-left; they are not campaign data. Warnings are advisory and never prevent saving. Openings and linked ladders must be placed explicitly.</p>{warnings.length>0&&<ul className="text-xs text-amber-200 mt-2 max-h-32 overflow-auto">{warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>}</details>
}
