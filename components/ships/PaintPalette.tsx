'use client'
import {useState,useSyncExternalStore} from 'react'
const key='basement-ship-palette-v1',event='ship-palette-change'
const read=()=>{try{return localStorage.getItem(key)??'[]'}catch{return '[]'}}
const subscribe=(notify:()=>void)=>{window.addEventListener('storage',notify);window.addEventListener(event,notify);return()=>{window.removeEventListener('storage',notify);window.removeEventListener(event,notify)}}
export default function PaintPalette({color,onColor,disabled=false}:{color:string;onColor:(color:string)=>void;disabled?:boolean}){
  const [message,setMessage]=useState('')
  const stored=useSyncExternalStore(subscribe,read,()=>'[]')
  let colors:string[]=[];try{const data:unknown=JSON.parse(stored);if(Array.isArray(data))colors=data.filter((c):c is string=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c)).slice(0,24)}catch{}
  function save(next:string[]){try{localStorage.setItem(key,JSON.stringify(next));window.dispatchEvent(new Event(event));setMessage('')}catch{setMessage('This browser could not save the palette. Current paint is unchanged.')}}
  return <div className="flex flex-wrap items-center gap-2 text-xs" aria-label="Saved paint palette"><button type="button" disabled={disabled||colors.includes(color.toLowerCase())||colors.length>=24} onClick={()=>save([...colors,color.toLowerCase()])}>Save color to palette</button>{colors.map(c=><span className="inline-flex items-center gap-1" key={c}><button type="button" disabled={disabled} aria-label={`Use saved color ${c}`} title={c} onClick={()=>onColor(c)} className="w-7 h-7 rounded border border-gray-400" style={{background:c}}/><button type="button" disabled={disabled} aria-label={`Remove saved color ${c}`} onClick={()=>save(colors.filter(v=>v!==c))}>×</button></span>)}<span className="text-gray-400">Saved in this browser (24 colors).</span>{message&&<span role="status">{message}</span>}</div>
}
