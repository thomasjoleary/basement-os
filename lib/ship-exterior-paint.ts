import * as THREE from 'three'
import {type ShipPlan,newId,validatePlan} from './ships'
import {type SurfaceQuad,EMPTY_SURFACES} from './ship-surfaces'
import {type FootTile,EMPTY_PAINT,paintTiles,PAINT_STRIDE,strokeTiles} from './ship-paint'

export function exteriorBrush(q:SurfaceQuad,at:FootTile,size:number):FootTile[]{
 const result:FootTile[]=[],half=Math.floor((size-1)/2)
 for(let y=at.y-half;y<at.y-half+size;y++)for(let x=at.x-half;x<at.x-half+size;x++)if(x>=0&&y>=0&&x+1>q.uOffset&&x<q.uOffset+q.width&&y+1>(q.vOffset??0)&&y<(q.vOffset??0)+q.height)result.push({x,y})
 return result
}
export function paintExterior(plan:ShipPlan,q:SurfaceQuad,tiles:FootTile[],color:string|null){
 const design=plan.surface_design??EMPTY_SURFACES,old=design.surfaces.find(s=>s.room_id===q.roomId&&s.face===q.face)
 const paint=paintTiles(old?.paint??EMPTY_PAINT,tiles,color)
 if(JSON.stringify(paint)===JSON.stringify(old?.paint??EMPTY_PAINT))return plan
 const surface={...old,id:old?.id??newId(),room_id:q.roomId,deck_id:q.deckId,face:q.face,paint}
 const next={...plan,surface_design:{...design,surfaces:[...design.surfaces.filter(s=>s.room_id!==q.roomId||s.face!==q.face),surface]}}
 const error=validatePlan(next);if(error)throw new Error(error);return next
}

export type ExteriorStroke = { q: SurfaceQuad; tiles: FootTile[] }[]
export function paintExteriorStroke(plan:ShipPlan,stroke:ExteriorStroke,color:string|null){
 return stroke.reduce((next,s)=>paintExterior(next,s.q,s.tiles,color),plan)
}

// Actual shared edges, not overlapping screen bounds: separate ships/decks and
// surfaces across open space must never be connected by pointer interpolation.
export function exteriorMeshesTouch(a:THREE.Mesh,b:THREE.Mesh){
 if(a===b)return true
 const vertices=(m:THREE.Mesh)=>Array.from({length:4},(_,i)=>new THREE.Vector3().fromBufferAttribute(m.geometry.getAttribute('position'),i))
 const av=vertices(a),bv=vertices(b)
 return [[av,bv],[bv,av]].some(([from,to])=>from.some(p=>to.some((v,i)=>new THREE.Line3(v,to[(i+1)%4]).closestPointToPoint(p,true,new THREE.Vector3()).distanceToSquared(p)<1e-8)))
}

// The first ray hit remains authoritative. Live geometry is a disposable stroke
// preview; only pointerup commits a single atomic edit to the document/history.
export function attachExteriorPaint({canvas,camera,scene,objects,size,color,erase,underside,onCommit,onMessage,render}:{canvas:HTMLCanvasElement;camera:THREE.Camera;scene:THREE.Scene;objects:THREE.Object3D[];size:number;color:string;erase:boolean;underside:boolean;onCommit:(stroke:ExteriorStroke,color:string|null)=>void;onMessage:(s:string)=>void;render:()=>void}){
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),preview=new THREE.Group(),live=new THREE.Group();scene.add(preview,live)
 type Entry={q:SurfaceQuad;mesh:THREE.Mesh;tiles:Map<number,FootTile>;overlay?:THREE.Mesh;dirty:boolean}
 type Pick={mesh:THREE.Mesh;q:SurfaceQuad;at:FootTile}
 let drag:{id:number;entries:Map<THREE.Mesh,Entry>;last:Pick|null;x:number;y:number;count:number}|null=null
 const visibility=new Map<THREE.Mesh,Map<number,boolean>>(),neighbors=new Map<string,boolean>()
 function touching(a:THREE.Mesh,b:THREE.Mesh){const key=[a.id,b.id].sort().join(':');if(!neighbors.has(key))neighbors.set(key,exteriorMeshesTouch(a,b));return neighbors.get(key)!}
 function clear(group:THREE.Group){for(const child of [...group.children]){const m=child as THREE.Mesh;m.geometry.dispose();(m.material as THREE.Material).dispose();group.remove(m)}}
 function cancel(){const id=drag?.id;drag=null;clear(preview);clear(live);visibility.clear();delete canvas.dataset.paintFace;delete canvas.dataset.paintRoom;delete canvas.dataset.brushTiles;delete canvas.dataset.livePaintTiles;if(id!==undefined&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);render()}
 function hit(x:number,y:number){const rect=canvas.getBoundingClientRect();if(x<rect.left||y<rect.top||x>rect.right||y>rect.bottom)return null;pointer.set((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2);ray.setFromCamera(pointer,camera);const h=ray.intersectObjects(objects,false)[0],q=h?.object.userData.surface as SurfaceQuad|undefined;return h&&h.uv&&q?.hull&&!q.cap?{h,q}:null}
 function point(mesh:THREE.Mesh,q:SurfaceQuad,x:number,y:number){const p=mesh.geometry.getAttribute('position'),a=new THREE.Vector3().fromBufferAttribute(p,0),b=new THREE.Vector3().fromBufferAttribute(p,1),c=new THREE.Vector3().fromBufferAttribute(p,2),d=new THREE.Vector3().fromBufferAttribute(p,3);const u=(x-q.uOffset)/q.width,v=(y-(q.vOffset??0))/q.height;return a.lerp(b,u).lerp(d.lerp(c,u),v)}
 function projectedHit(p:THREE.Vector3){const center=p.clone().project(camera),r=canvas.getBoundingClientRect();return hit(r.left+(center.x+1)*r.width/2,r.top+(1-center.y)*r.height/2)}
 function local(h:NonNullable<ReturnType<typeof hit>>):Pick {const mesh=h.h.object as THREE.Mesh;return {mesh,q:h.q,at:{x:Math.floor(h.h.uv!.x*mesh.userData.paintWidth),y:Math.floor(h.h.uv!.y*mesh.userData.paintHeight)}}}
 function visible(mesh:THREE.Mesh,q:SurfaceQuad,tile:FootTile){
  let cache=visibility.get(mesh);if(!cache){cache=new Map();visibility.set(mesh,cache)}const key=tile.y*PAINT_STRIDE+tile.x
  if(!cache.has(key)){const p=point(mesh,q,Math.max(q.uOffset,Math.min(q.uOffset+q.width,tile.x+.5)),Math.max(q.vOffset??0,Math.min((q.vOffset??0)+q.height,tile.y+.5)));cache.set(key,projectedHit(p)?.h.object===mesh)}return cache.get(key)!
 }
 function geometry(mesh:THREE.Mesh,q:SurfaceQuad,tiles:Iterable<FootTile>){
  const normal=new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('normal'),0).multiplyScalar(.003),vertices:number[]=[]
  for(const tile of tiles){const x0=Math.max(q.uOffset,tile.x),x1=Math.min(q.uOffset+q.width,tile.x+1),y0=Math.max(q.vOffset??0,tile.y),y1=Math.min((q.vOffset??0)+q.height,tile.y+1);const points=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>point(mesh,q,x,y).add(normal));for(const i of [0,1,2,0,2,3])vertices.push(...points[i].toArray())}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g
 }
 function flush(){
  if(drag)for(const entry of drag.entries.values())if(entry.dirty){
   if(entry.overlay){entry.overlay.geometry.dispose();entry.overlay.geometry=geometry(entry.mesh,entry.q,entry.tiles.values())}
   else{const material=(entry.mesh.material as THREE.MeshStandardMaterial).clone();material.map=null;material.color.set(erase?entry.q.color:color);material.side=THREE.DoubleSide;entry.overlay=new THREE.Mesh(geometry(entry.mesh,entry.q,entry.tiles.values()),material);live.add(entry.overlay)}entry.dirty=false
  }
  if(drag)canvas.dataset.livePaintTiles=String(drag.count);render()
 }
 function brush(pick:Pick,record:boolean){
  const {mesh,q,at}=pick,half=Math.floor((size-1)/2),targets=new Map<THREE.Mesh,{q:SurfaceQuad;tiles:Map<number,FootTile>}>()
  function add(m:THREE.Mesh,s:SurfaceQuad,t:FootTile){if(!exteriorBrush(s,t,1).length||!visible(m,s,t))return;let target=targets.get(m);if(!target){target={q:s,tiles:new Map()};targets.set(m,target)}target.tiles.set(t.y*PAINT_STRIDE+t.x,t)}
  for(let y=at.y-half;y<at.y-half+size;y++)for(let x=at.x-half;x<at.x-half+size;x++){
   if(exteriorBrush(q,{x,y},1).length)add(mesh,q,{x,y})
   else{const world=point(mesh,q,x+.5,y+.5),neighbor=projectedHit(world);if(!neighbor||neighbor.q.face!==q.face||neighbor.h.point.distanceToSquared(world)>.0025)continue;const next=local(neighbor);if(touching(mesh,next.mesh))add(next.mesh,next.q,next.at)}
  }
  let count=0
  for(const [m,target] of targets){count+=target.tiles.size
   if(record&&drag){let entry=drag.entries.get(m);if(!entry){entry={q:target.q,mesh:m,tiles:new Map(),dirty:false};drag.entries.set(m,entry)}for(const [key,tile] of target.tiles)if(!entry.tiles.has(key)){entry.tiles.set(key,tile);entry.dirty=true;drag.count++}}
   else preview.add(new THREE.Mesh(geometry(m,target.q,target.tiles.values()),new THREE.MeshBasicMaterial({color:erase?'#fbbf24':color,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false})))
  }
  canvas.dataset.paintFace=q.face;canvas.dataset.paintRoom=q.roomId;canvas.dataset.brushTiles=String(count)
  if(drag&&drag.count>50000){cancel();onMessage('Stroke exceeds 50,000 squares.');return false}return true
 }
 function sample(x:number,y:number,record:boolean):Pick|null{
  const picked=hit(x,y);if(!picked){delete canvas.dataset.paintFace;return null}
  if(picked.q.face==='underside'&&!underside){onMessage('Underside painting needs the reviewed underside migration. Other exterior faces remain available.');return null}
  const next=local(picked),last=drag?.last
  if(record&&last&&last.mesh!==next.mesh&&!touching(last.mesh,next.mesh))return null
  if(record&&last?.mesh===next.mesh&&last.at.x===next.at.x&&last.at.y===next.at.y)return next
  if(record&&last?.mesh===next.mesh){for(const at of strokeTiles(last.at,next.at))if(!brush({...next,at},true))return null}
  else if(!brush(next,record))return null
  if(record&&drag)drag.last=next;return next
 }
 function down(e:PointerEvent){if(e.button!==0)return;e.preventDefault();e.stopImmediatePropagation();if(drag){cancel();return}clear(preview);visibility.clear();const picked=sample(e.clientX,e.clientY,false);if(!picked){render();return}clear(preview);drag={id:e.pointerId,entries:new Map(),last:null,x:e.clientX,y:e.clientY,count:0};canvas.setPointerCapture(e.pointerId);sample(e.clientX,e.clientY,true);flush()}
 function move(e:PointerEvent){e.stopImmediatePropagation();clear(preview);if(!drag){visibility.clear();sample(e.clientX,e.clientY,false);render();return}if(drag.id!==e.pointerId)return;const start={x:drag.x,y:drag.y},steps=Math.max(1,Math.ceil(Math.hypot(e.clientX-start.x,e.clientY-start.y)));if(steps>4096){cancel();onMessage('Pointer moved beyond the paint view; start a new stroke.');return}for(let i=1;i<=steps&&drag;i++)sample(start.x+(e.clientX-start.x)*i/steps,start.y+(e.clientY-start.y)*i/steps,true);if(drag){drag.x=e.clientX;drag.y=e.clientY}flush()}
 function up(e:PointerEvent){e.stopImmediatePropagation();const stroke=drag;if(!stroke||stroke.id!==e.pointerId)return;const edits=[...stroke.entries.values()].map(s=>({q:s.q,tiles:[...s.tiles.values()]}));cancel();if(edits.length)onCommit(edits,erase?null:color)}
 function key(e:KeyboardEvent){if(e.key==='Escape')cancel()}
 canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move,true);canvas.addEventListener('pointerup',up,true);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);canvas.addEventListener('pointerleave',cancel);window.addEventListener('keydown',key)
 return()=>{cancel();scene.remove(preview,live);canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointermove',move,true);canvas.removeEventListener('pointerup',up,true);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('lostpointercapture',cancel);canvas.removeEventListener('pointerleave',cancel);window.removeEventListener('keydown',key)}
}
