'use client'
import {useEffect,useMemo,useRef,useState} from 'react'
import {type SurfacePaint,type FootTile,EMPTY_PAINT,PAINT_STRIDE,MAX_PAINT_TILES,decodePaint,paintTiles,rectangleTiles,strokeTiles} from '@/lib/ship-paint'
import type {SurfaceQuad} from '@/lib/ship-surfaces'
export type PaintRegion={x:number;y:number;width:number;height:number;color:string;label:string}
type Tool='brush'|'erase'|'select'|'pan'
export default function SurfacePainter({surfaces,paint=EMPTY_PAINT,disabled,onChange,regions,large=false,tileMap,onTiles}:{tileMap?:Map<number,string>;onTiles?:(tiles:Map<number,string>)=>void;regions?:PaintRegion[];large?:boolean;surfaces:SurfaceQuad[];paint?:SurfacePaint;disabled:boolean;onChange:(paint:SurfacePaint)=>void}){
  const W=large?1200:640,H=large?620:320
  const [brushSize,setBrushSize]=useState(1),[hover,setHover]=useState<FootTile|null>(null)
  const canvas=useRef<HTMLCanvasElement>(null),[tool,setTool]=useState<Tool>('brush'),[color,setColor]=useState('#ef4444'),[zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0}),[selection,setSelection]=useState<Set<number>>(new Set()),[preview,setPreview]=useState<FootTile[]>([]),[message,setMessage]=useState(''),[cellX,setCellX]=useState(0),[cellY,setCellY]=useState(0)
  const drag=useRef<{id:number;rect:DOMRect;scale:number;pan:{x:number;y:number};start:FootTile;last:FootTile;tiles:Map<number,FootTile>;shift:boolean;clientX:number;clientY:number}|null>(null)
  const faces=useMemo(()=>surfaces.filter(s=>!s.cap),[surfaces]),width=Math.max(1,...faces.map(f=>f.uOffset+f.width)),height=Math.max(1,...faces.map(f=>f.height))
  const inside=(p:FootTile)=>Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&faces.some(f=>p.x<f.uOffset+f.width&&p.x+1>f.uOffset&&p.y<f.height)
  const areas=regions??faces.map(f=>({x:f.uOffset,y:0,width:f.width,height:f.height,color:'#334155',label:''}))
  const fullWidth=regions?Math.max(1,...regions.map(r=>r.x+r.width)):width,fullHeight=regions?Math.max(1,...regions.map(r=>r.y+r.height)):height
  const visible=(p:FootTile)=>regions?Number.isInteger(p.x)&&Number.isInteger(p.y)&&areas.some(r=>p.x>=r.x&&p.y>=r.y&&p.x<r.x+r.width&&p.y<r.y+r.height):inside(p)
  const footprint=(p:FootTile)=>[...rectangleTiles({x:p.x-Math.floor((brushSize-1)/2),y:p.y-Math.floor((brushSize-1)/2)},{x:p.x+Math.ceil((brushSize-1)/2),y:p.y+Math.ceil((brushSize-1)/2)})].filter(visible)
  const scale=Math.min((W-40)/fullWidth,(H-40)/fullHeight)*zoom
  useEffect(()=>{const el=canvas.current;if(!el)return;const ctx=el.getContext('2d')!;ctx.clearRect(0,0,W,H);ctx.fillStyle='#080f1e';ctx.fillRect(0,0,W,H)
    ctx.save();ctx.translate(20+pan.x,(large?20:H-20)+pan.y);ctx.scale(scale,large?scale:-scale);ctx.beginPath();for(const r of areas)ctx.rect(r.x,r.y,r.width,r.height);ctx.clip()
    for(const r of areas){ctx.fillStyle=r.color;ctx.fillRect(r.x,r.y,r.width,r.height)}
    for(const [at,c] of (tileMap??decodePaint(paint))){ctx.fillStyle=c;ctx.fillRect(at%PAINT_STRIDE,Math.floor(at/PAINT_STRIDE),1,1)}
    ctx.fillStyle='rgba(34,211,238,.45)';for(const at of selection)ctx.fillRect(at%PAINT_STRIDE,Math.floor(at/PAINT_STRIDE),1,1)
    ctx.fillStyle=tool==='erase'?'#334155':tool==='select'?'rgba(34,211,238,.5)':color;for(const p of preview)ctx.fillRect(p.x,p.y,1,1)
    if(hover&&!drag.current&&(tool==='brush'||tool==='erase')){ctx.fillStyle='rgba(255,255,255,.5)';for(const p of footprint(hover))ctx.fillRect(p.x,p.y,1,1)}
    if(scale>=6){ctx.strokeStyle='#94a3b8';ctx.lineWidth=.5/scale;ctx.beginPath();for(let x=0;x<=fullWidth;x++){ctx.moveTo(x,0);ctx.lineTo(x,fullHeight)}for(let y=0;y<=fullHeight;y++){ctx.moveTo(0,y);ctx.lineTo(fullWidth,y)}ctx.stroke()}
    if(large){ctx.strokeStyle='#d8e6ee';ctx.lineWidth=1.5/scale;for(const r of areas)ctx.strokeRect(r.x,r.y,r.width,r.height)}
    ctx.restore();if(large){ctx.fillStyle="#e2e8f0";ctx.font="12px sans-serif";for(const r of areas)ctx.fillText(r.label,22+pan.x+r.x*scale,34+pan.y+r.y*scale,Math.max(20,r.width*scale-4))}
  })
  function apply(tiles:Iterable<FootTile>,erase=false){if(disabled)return;try{if(tileMap&&onTiles){const next=new Map(tileMap);for(const p of tiles){const at=p.y*PAINT_STRIDE+p.x;if(erase)next.delete(at);else next.set(at,color);if(next.size>MAX_PAINT_TILES)throw new Error('Paint exceeds 50,000 squares.')}if(next.size!==tileMap.size||[...next].some(([at,c])=>tileMap.get(at)!==c))onTiles(next)}else {const next=paintTiles(paint,tiles,erase?null:color);if(JSON.stringify(next)!==JSON.stringify(paint))onChange(next)};setMessage('')}catch(e){setMessage((e as Error).message)}}
  function cancel(){drag.current=null;setPreview([])}
  function tile(e:React.PointerEvent,rect:DOMRect,factor:number,offset:{x:number;y:number}):FootTile{return{x:Math.floor(((e.clientX-rect.x)*W/rect.width-20-offset.x)/factor),y:Math.floor((large?((e.clientY-rect.y)*H/rect.height-20-offset.y):H-20+offset.y-(e.clientY-rect.y)*H/rect.height)/factor)}}
  function down(e:React.PointerEvent<HTMLCanvasElement>){if(drag.current){cancel();return}if((disabled&&tool!=='pan')||e.button!==0)return;const rect=e.currentTarget.getBoundingClientRect(),p=tile(e,rect,scale,pan);p.x=Math.max(-1,Math.min(Math.ceil(fullWidth),p.x));p.y=Math.max(-1,Math.min(Math.ceil(fullHeight),p.y));e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,rect,scale,pan:{...pan},start:p,last:p,tiles:new Map(),shift:e.shiftKey,clientX:e.clientX,clientY:e.clientY};if(tool!=='pan'&&visible(p)){for(const at of tool==='select'?[p]:footprint(p))drag.current.tiles.set(at.y*PAINT_STRIDE+at.x,at);setPreview([...drag.current.tiles.values()])}}
  function move(e:React.PointerEvent){const d=drag.current;if(!d){setHover(tile(e,e.currentTarget.getBoundingClientRect(),scale,pan));return}if(d.id!==e.pointerId)return
    if(tool==='pan'){setPan({x:d.pan.x+(e.clientX-d.clientX)*W/d.rect.width,y:d.pan.y+(e.clientY-d.clientY)*H/d.rect.height});return}
    const p=tile(e,d.rect,d.scale,d.pan);p.x=Math.max(-1,Math.min(Math.ceil(fullWidth),p.x));p.y=Math.max(-1,Math.min(Math.ceil(fullHeight),p.y))
    const points=tool==='select'?rectangleTiles(d.start,p):strokeTiles(d.last,p);if(tool==='select')d.tiles.clear()
    for(const at of tool==='select'?points:[...points].flatMap(footprint)){if(visible(at))d.tiles.set(at.y*PAINT_STRIDE+at.x,at);if(d.tiles.size>MAX_PAINT_TILES){setMessage('Selection exceeds 50,000 squares.');cancel();return}}
    d.last=p;setPreview([...d.tiles.values()])
  }
  function up(e:React.PointerEvent){if(disabled){cancel();return}const d=drag.current;if(!d||d.id!==e.pointerId)return;drag.current=null;setPreview([])
    if(tool==='select')setSelection(new Set([...(d.shift?selection:[]),...d.tiles.keys()]))
    else if(tool!=='pan')apply(d.tiles.values(),tool==='erase')
  }
  function fill(){if(selection.size){apply([...selection].map(at=>({x:at%PAINT_STRIDE,y:Math.floor(at/PAINT_STRIDE)})));return}
    if(Math.ceil(fullWidth)*Math.ceil(fullHeight)>MAX_PAINT_TILES){setMessage('Select a smaller area before filling this surface.');return}
    apply([...rectangleTiles({x:0,y:0},{x:Math.ceil(fullWidth)-1,y:Math.ceil(fullHeight)-1})].filter(visible))
  }
  return <fieldset className="min-w-0 space-y-2 border-t border-gray-700 pt-3"><legend>One-foot surface painting</legend>
    <p className="text-xs text-gray-400">Squares measure one foot along this face. Edges and door gaps clip paint; hidden paint returns when the face grows. Shift-drag adds to a selection. Closing caps use the section color.</p>
    <div className="flex flex-wrap gap-2">{(['brush','erase','select','pan'] as Tool[]).map(t=><button type="button" key={t} disabled={disabled&&t!=='pan'} aria-pressed={tool===t} onClick={()=>{cancel();setTool(t)}} className={`rounded px-2 py-1 border ${tool===t?'border-cyan-400':'border-gray-600'}`}>{t}</button>)}<label className="text-xs">Paint color<input aria-label="Paint color" disabled={disabled} type="color" value={color} onChange={e=>setColor(e.target.value)}/></label><button type="button" disabled={disabled} onClick={fill}>Fill {selection.size?'selection':'surface'}</button><button type="button" onClick={()=>setSelection(new Set())}>Clear selection</button></div>
    <label className="flex items-center gap-3 text-sm">Brush size: {brushSize} ft<input aria-label="Brush size" type="range" min={1} max={20} value={brushSize} onChange={e=>{cancel();setBrushSize(Number(e.target.value))}}/><span>{brushSize} × {brushSize} squares</span></label>
    <div className="flex gap-3 text-sm"><button type="button" aria-label="Zoom paint out" onClick={()=>{cancel();setZoom(z=>Math.max(.25,z/1.5))}}>−</button><button type="button" onClick={()=>{cancel();setZoom(1);setPan({x:0,y:0})}}>Fit surface</button><button type="button" aria-label="Zoom paint in" onClick={()=>{cancel();setZoom(z=>Math.min(64,z*1.5))}}>+</button><span>{selection.size} selected</span></div>
    <div className="flex flex-wrap items-end gap-2 text-xs"><label>Square x<input aria-label="Square x" type="number" min={0} max={Math.max(0,Math.ceil(fullWidth)-1)} value={cellX} onChange={e=>setCellX(Number(e.target.value))} className="block w-16 bg-gray-950 border border-gray-600 p-1"/></label><label>Square y<input aria-label="Square y" type="number" min={0} max={Math.max(0,Math.ceil(fullHeight)-1)} value={cellY} onChange={e=>setCellY(Number(e.target.value))} className="block w-16 bg-gray-950 border border-gray-600 p-1"/></label><button type="button" onClick={()=>{const p={x:cellX,y:cellY};if(visible(p))setSelection(old=>new Set([...old,cellY*PAINT_STRIDE+cellX]));else setMessage('This square is outside the visible face.')}}>Add square to selection</button><button type="button" disabled={disabled} onClick={()=>{const p={x:cellX,y:cellY};if(visible(p))apply([p],tool==='erase');else setMessage('This square is outside the visible face.')}}>Paint square</button></div>
    <canvas ref={canvas} width={W} height={H} role="img" aria-label="Flat one-foot surface grid" data-testid="surface-paint-canvas" tabIndex={0} onKeyDown={e=>{if(e.key==='Escape')cancel()}} onPointerLeave={()=>setHover(null)} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} className="w-full bg-gray-950 touch-none border border-gray-700 rounded"/>
    <p className="text-xs text-gray-400">{fullWidth.toFixed(1)} × {fullHeight.toFixed(1)} feet · Use the editor Undo/Redo buttons for completed strokes.</p>{message&&<p role="status" className="text-amber-200 text-xs">{message}</p>}
  </fieldset>
}
