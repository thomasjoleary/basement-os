'use client'
import {useEffect,useMemo,useRef,useState} from 'react'
import {type SurfacePaint,type FootTile,EMPTY_PAINT,PAINT_STRIDE,MAX_PAINT_TILES,decodePaint,paintTiles,rectangleTiles,strokeTiles} from '@/lib/ship-paint'
import type {SurfaceQuad} from '@/lib/ship-surfaces'
type Tool='brush'|'erase'|'select'|'pan'
export default function SurfacePainter({surfaces,paint=EMPTY_PAINT,disabled,onChange}:{surfaces:SurfaceQuad[];paint?:SurfacePaint;disabled:boolean;onChange:(paint:SurfacePaint)=>void}){
  const canvas=useRef<HTMLCanvasElement>(null),[tool,setTool]=useState<Tool>('brush'),[color,setColor]=useState('#ef4444'),[zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0}),[selection,setSelection]=useState<Set<number>>(new Set()),[preview,setPreview]=useState<FootTile[]>([]),[message,setMessage]=useState(''),[cellX,setCellX]=useState(0),[cellY,setCellY]=useState(0)
  const drag=useRef<{id:number;rect:DOMRect;scale:number;pan:{x:number;y:number};start:FootTile;last:FootTile;tiles:Map<number,FootTile>;shift:boolean;clientX:number;clientY:number}|null>(null)
  const faces=useMemo(()=>surfaces.filter(s=>!s.cap),[surfaces]),width=Math.max(1,...faces.map(f=>f.uOffset+f.width)),height=Math.max(1,...faces.map(f=>f.height))
  const inside=(p:FootTile)=>Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&faces.some(f=>p.x<f.uOffset+f.width&&p.x+1>f.uOffset&&p.y<f.height)
  const scale=Math.min(600/width,280/height)*zoom
  useEffect(()=>{const el=canvas.current;if(!el)return;const ctx=el.getContext('2d')!;ctx.clearRect(0,0,640,320);ctx.fillStyle='#080f1e';ctx.fillRect(0,0,640,320)
    ctx.save();ctx.translate(20+pan.x,300+pan.y);ctx.scale(scale,-scale);ctx.beginPath();for(const f of faces)ctx.rect(f.uOffset,0,f.width,f.height);ctx.clip()
    ctx.fillStyle='#334155';ctx.fillRect(0,0,width,height)
    for(const [at,c] of decodePaint(paint)){ctx.fillStyle=c;ctx.fillRect(at%PAINT_STRIDE,Math.floor(at/PAINT_STRIDE),1,1)}
    ctx.fillStyle='rgba(34,211,238,.45)';for(const at of selection)ctx.fillRect(at%PAINT_STRIDE,Math.floor(at/PAINT_STRIDE),1,1)
    ctx.fillStyle=tool==='erase'?'#334155':tool==='select'?'rgba(34,211,238,.5)':color;for(const p of preview)ctx.fillRect(p.x,p.y,1,1)
    if(scale>=6){ctx.strokeStyle='#94a3b8';ctx.lineWidth=.5/scale;ctx.beginPath();for(let x=0;x<=width;x++){ctx.moveTo(x,0);ctx.lineTo(x,height)}for(let y=0;y<=height;y++){ctx.moveTo(0,y);ctx.lineTo(width,y)}ctx.stroke()}
    ctx.restore()
  },[faces,paint,selection,preview,tool,color,scale,pan,width,height])
  function apply(tiles:Iterable<FootTile>,erase=false){try{onChange(paintTiles(paint,tiles,erase?null:color));setMessage('')}catch(e){setMessage((e as Error).message)}}
  function cancel(){drag.current=null;setPreview([])}
  function tile(e:React.PointerEvent,rect:DOMRect,factor:number,offset:{x:number;y:number}):FootTile{return{x:Math.floor(((e.clientX-rect.x)*640/rect.width-20-offset.x)/factor),y:Math.floor((300+offset.y-(e.clientY-rect.y)*320/rect.height)/factor)}}
  function down(e:React.PointerEvent<HTMLCanvasElement>){if(drag.current){cancel();return}if(disabled||e.button!==0)return;const rect=e.currentTarget.getBoundingClientRect(),p=tile(e,rect,scale,pan);p.x=Math.max(-1,Math.min(Math.ceil(width),p.x));p.y=Math.max(-1,Math.min(Math.ceil(height),p.y));e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,rect,scale,pan:{...pan},start:p,last:p,tiles:new Map(),shift:e.shiftKey,clientX:e.clientX,clientY:e.clientY};if(tool!=='pan'&&inside(p)){drag.current.tiles.set(p.y*PAINT_STRIDE+p.x,p);setPreview([p])}}
  function move(e:React.PointerEvent){const d=drag.current;if(!d||d.id!==e.pointerId)return
    if(tool==='pan'){setPan({x:d.pan.x+(e.clientX-d.clientX)*640/d.rect.width,y:d.pan.y+(e.clientY-d.clientY)*320/d.rect.height});return}
    const p=tile(e,d.rect,d.scale,d.pan);p.x=Math.max(-1,Math.min(Math.ceil(width),p.x));p.y=Math.max(-1,Math.min(Math.ceil(height),p.y))
    const points=tool==='select'?rectangleTiles(d.start,p):strokeTiles(d.last,p);if(tool==='select')d.tiles.clear()
    for(const at of points){if(inside(at))d.tiles.set(at.y*PAINT_STRIDE+at.x,at);if(d.tiles.size>MAX_PAINT_TILES){setMessage('Selection exceeds 50,000 squares.');cancel();return}}
    d.last=p;setPreview([...d.tiles.values()])
  }
  function up(e:React.PointerEvent){if(disabled){cancel();return}const d=drag.current;if(!d||d.id!==e.pointerId)return;drag.current=null;setPreview([])
    if(tool==='select')setSelection(new Set([...(d.shift?selection:[]),...d.tiles.keys()]))
    else if(tool!=='pan')apply(d.tiles.values(),tool==='erase')
  }
  function fill(){if(selection.size){apply([...selection].map(at=>({x:at%PAINT_STRIDE,y:Math.floor(at/PAINT_STRIDE)})));return}
    if(Math.ceil(width)*Math.ceil(height)>MAX_PAINT_TILES){setMessage('Select a smaller area before filling this surface.');return}
    apply([...rectangleTiles({x:0,y:0},{x:Math.ceil(width)-1,y:Math.ceil(height)-1})].filter(inside))
  }
  return <fieldset disabled={disabled} className="min-w-0 space-y-2 border-t border-gray-700 pt-3"><legend>One-foot surface painting</legend>
    <p className="text-xs text-gray-400">Squares measure one foot along this face. Edges and door gaps clip paint; hidden paint returns when the face grows. Shift-drag adds to a selection. Closing caps use the section color.</p>
    <div className="flex flex-wrap gap-2">{(['brush','erase','select','pan'] as Tool[]).map(t=><button type="button" key={t} aria-pressed={tool===t} onClick={()=>{cancel();setTool(t)}} className={`rounded px-2 py-1 border ${tool===t?'border-cyan-400':'border-gray-600'}`}>{t}</button>)}<label className="text-xs">Paint color<input aria-label="Paint color" type="color" value={color} onChange={e=>setColor(e.target.value)}/></label><button type="button" onClick={fill}>Fill {selection.size?'selection':'surface'}</button><button type="button" onClick={()=>setSelection(new Set())}>Clear selection</button></div>
    <div className="flex gap-3 text-sm"><button type="button" aria-label="Zoom paint out" onClick={()=>{cancel();setZoom(z=>Math.max(.25,z/1.5))}}>−</button><button type="button" onClick={()=>{cancel();setZoom(1);setPan({x:0,y:0})}}>Fit surface</button><button type="button" aria-label="Zoom paint in" onClick={()=>{cancel();setZoom(z=>Math.min(64,z*1.5))}}>+</button><span>{selection.size} selected</span></div>
    <div className="flex flex-wrap items-end gap-2 text-xs"><label>Square x<input aria-label="Square x" type="number" min={0} max={Math.max(0,Math.ceil(width)-1)} value={cellX} onChange={e=>setCellX(Number(e.target.value))} className="block w-16 bg-gray-950 border border-gray-600 p-1"/></label><label>Square y<input aria-label="Square y" type="number" min={0} max={Math.max(0,Math.ceil(height)-1)} value={cellY} onChange={e=>setCellY(Number(e.target.value))} className="block w-16 bg-gray-950 border border-gray-600 p-1"/></label><button type="button" onClick={()=>{const p={x:cellX,y:cellY};if(inside(p))setSelection(old=>new Set([...old,cellY*PAINT_STRIDE+cellX]));else setMessage('This square is outside the visible face.')}}>Add square to selection</button><button type="button" onClick={()=>{const p={x:cellX,y:cellY};if(inside(p))apply([p],tool==='erase');else setMessage('This square is outside the visible face.')}}>Paint square</button></div>
    <canvas ref={canvas} width={640} height={320} role="img" aria-label="Flat one-foot surface grid" data-testid="surface-paint-canvas" tabIndex={0} onKeyDown={e=>{if(e.key==='Escape')cancel()}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} className="w-full bg-gray-950 touch-none border border-gray-700 rounded"/>
    <p className="text-xs text-gray-400">{width.toFixed(1)} × {height.toFixed(1)} feet · Use the editor Undo/Redo buttons for completed strokes.</p>{message&&<p role="status" className="text-amber-200 text-xs">{message}</p>}
  </fieldset>
}
