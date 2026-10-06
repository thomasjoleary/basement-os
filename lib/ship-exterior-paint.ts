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

const EDGE_EPS=1e-4
function vertices(mesh:THREE.Mesh){return Array.from({length:4},(_,i)=>new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'),i).applyMatrix4(mesh.matrixWorld))}
export function exteriorSharedEdge(a:THREE.Mesh,b:THREE.Mesh){
 const av=vertices(a),bv=vertices(b)
 for(let i=0;i<4;i++)for(let j=0;j<4;j++){
  const start=av[i],end=av[(i+1)%4],direction=end.clone().sub(start),length=direction.length();if(length<EDGE_EPS)continue;direction.divideScalar(length)
  const c=bv[j],d=bv[(j+1)%4],bc=c.clone().sub(start),bd=d.clone().sub(start)
  if(bc.clone().cross(direction).length()>EDGE_EPS||bd.clone().cross(direction).length()>EDGE_EPS)continue
  const lo=Math.max(0,Math.min(bc.dot(direction),bd.dot(direction))),hi=Math.min(length,Math.max(bc.dot(direction),bd.dot(direction)))
  if(hi-lo>EDGE_EPS){const normal=(v:THREE.Vector3[],edge:number,m:THREE.Mesh)=>{const n=new THREE.Triangle(v[0],v[edge<2?1:2],v[edge<2?2:3]).getNormal(new THREE.Vector3()),out=new THREE.Vector3().fromBufferAttribute(m.geometry.getAttribute('normal'),edge);return n.dot(out)<0?n.negate():n};return {start:start.clone().addScaledVector(direction,lo),direction,fromNormal:normal(av,i,a),toNormal:normal(bv,j,b)}}
 }
 return null
}
export function exteriorMeshesTouch(a:THREE.Mesh,b:THREE.Mesh){return a===b||!!exteriorSharedEdge(a,b)}
// Rotate the brush's unfolded continuation around the shared physical edge.
// No face/deck-name assumptions and no projection onto the far side of the ship.
export function foldExteriorPoint(a:THREE.Mesh,b:THREE.Mesh,point:THREE.Vector3){
 const edge=exteriorSharedEdge(a,b);if(!edge)return null
 const {start,direction,fromNormal,toNormal}=edge
 const center=vertices(a).reduce((sum,v)=>sum.add(v),new THREE.Vector3()).multiplyScalar(.25),across=direction.clone().cross(fromNormal)
 if(point.clone().sub(start).dot(across)*center.sub(start).dot(across)>EDGE_EPS)return null
 const angle=Math.atan2(direction.dot(fromNormal.clone().cross(toNormal)),fromNormal.dot(toNormal))
 return point.clone().sub(start).applyAxisAngle(direction,angle).add(start)
}
function surfaceCoordinates(mesh:THREE.Mesh,point:THREE.Vector3){
 const v=vertices(mesh),uv=mesh.geometry.getAttribute('uv')
 for(const ids of [[0,1,2],[0,2,3]]){const triangle=new THREE.Triangle(...ids.map(i=>v[i]) as [THREE.Vector3,THREE.Vector3,THREE.Vector3]),near=triangle.closestPointToPoint(point,new THREE.Vector3());if(near.distanceTo(point)>EDGE_EPS)continue;const weights=triangle.getBarycoord(near,new THREE.Vector3());if(!weights)continue;const coords=new THREE.Vector2();ids.forEach((id,i)=>coords.addScaledVector(new THREE.Vector2(uv.getX(id),uv.getY(id)),weights.getComponent(i)));return {x:Math.floor(coords.x*mesh.userData.paintWidth),y:Math.floor(coords.y*mesh.userData.paintHeight)}}
 return null
}

// The first ray hit remains authoritative. Live geometry is a disposable stroke
// preview; finishing the stroke commits one atomic edit to the document/history.
export function attachExteriorPaint({canvas,camera,scene,objects,size,color,erase,underside,onCommit,onMessage,render,onOrbit,onGesture}:{canvas:HTMLCanvasElement;camera:THREE.Camera;scene:THREE.Scene;objects:THREE.Object3D[];size:number;color:string;erase:boolean;underside:boolean;onCommit:(stroke:ExteriorStroke,color:string|null)=>boolean|void;onMessage:(s:string)=>void;render:()=>void;onOrbit?:(dx:number,dy:number)=>void;onGesture?:(active:boolean)=>void}){
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),preview=new THREE.Group(),live=new THREE.Group(),settled=new THREE.Group();scene.add(preview,live,settled)
 type Entry={q:SurfaceQuad;mesh:THREE.Mesh;tiles:Map<number,FootTile>;overlay?:THREE.Mesh;dirty:boolean}
 type Pick={mesh:THREE.Mesh;q:SurfaceQuad;at:FootTile}
 let drag:{id:number;entries:Map<THREE.Mesh,Entry>;last:Pick|null;x:number;y:number;count:number}|null=null
 const committed=new Map<THREE.Mesh,Entry>()
 let alt=false,pointerState:{id:number;x:number;y:number}|null=null
 const hulls=objects.filter((o):o is THREE.Mesh=>o instanceof THREE.Mesh&&!!o.userData.surface?.hull),bounds=new Map(hulls.map(m=>[m,new THREE.Box3().setFromObject(m).expandByScalar(EDGE_EPS)])),adjacency=new Map<THREE.Mesh,THREE.Mesh[]>()
 function adjacent(mesh:THREE.Mesh){if(!adjacency.has(mesh))adjacency.set(mesh,hulls.filter(m=>m!==mesh&&bounds.get(mesh)!.intersectsBox(bounds.get(m)!)&&touching(mesh,m)));return adjacency.get(mesh)!}
 function seamConnected(a:THREE.Mesh,b:THREE.Mesh){if(touching(a,b))return true;const seen=new Set([a]),queue=[{mesh:a,depth:0}];for(const {mesh,depth} of queue){if(depth>=4)continue;for(const n of adjacent(mesh)){if(n===b)return true;if(n.userData.surface.cap&&!seen.has(n)){seen.add(n);queue.push({mesh:n,depth:depth+1})}}}return false}

 const visibility=new Map<THREE.Mesh,Map<number,boolean>>(),neighbors=new Map<string,boolean>()
 function touching(a:THREE.Mesh,b:THREE.Mesh){const key=[a.id,b.id].sort().join(':');if(!neighbors.has(key))neighbors.set(key,exteriorMeshesTouch(a,b));return neighbors.get(key)!}
 function clear(group:THREE.Group){for(const child of [...group.children]){const m=child as THREE.Mesh;m.geometry.dispose();(m.material as THREE.Material).dispose();group.remove(m)}}
 function cancel(){const id=pointerState?.id;pointerState=null;drag=null;clear(preview);clear(live);clear(settled);committed.clear();visibility.clear();delete canvas.dataset.paintFace;delete canvas.dataset.paintRoom;delete canvas.dataset.paintDeck;delete canvas.dataset.paintCap;delete canvas.dataset.paintOrbit;delete canvas.dataset.livePaintTiles;delete canvas.dataset.livePaintSurfaces;if(id!==undefined&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);if(id!==undefined)onGesture?.(false);render()}

 function hit(x:number,y:number){const rect=canvas.getBoundingClientRect();if(x<rect.left||y<rect.top||x>rect.right||y>rect.bottom)return null;pointer.set((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2);ray.setFromCamera(pointer,camera);const h=ray.intersectObjects(objects,false)[0],q=h?.object.userData.surface as SurfaceQuad|undefined;return h&&h.uv&&q?.hull?{h,q}:null}
 function point(mesh:THREE.Mesh,q:SurfaceQuad,x:number,y:number){const p=mesh.geometry.getAttribute('position'),a=new THREE.Vector3().fromBufferAttribute(p,0),b=new THREE.Vector3().fromBufferAttribute(p,1),c=new THREE.Vector3().fromBufferAttribute(p,2),d=new THREE.Vector3().fromBufferAttribute(p,3);const u=(x-q.uOffset)/q.width,v=(y-(q.vOffset??0))/q.height;return v<=u?a.addScaledVector(b.clone().sub(a),u).addScaledVector(c.sub(b),v):a.addScaledVector(d.clone().sub(a),v).addScaledVector(c.sub(d),u)}
 function projectedHit(p:THREE.Vector3){const center=p.clone().project(camera),r=canvas.getBoundingClientRect();return hit(r.left+(center.x+1)*r.width/2,r.top+(1-center.y)*r.height/2)}
 function local(h:NonNullable<ReturnType<typeof hit>>):Pick {const mesh=h.h.object as THREE.Mesh;return {mesh,q:h.q,at:{x:Math.floor(h.h.uv!.x*mesh.userData.paintWidth),y:Math.floor(h.h.uv!.y*mesh.userData.paintHeight)}}}
 function visible(mesh:THREE.Mesh,q:SurfaceQuad,tile:FootTile){
  let cache=visibility.get(mesh);if(!cache){cache=new Map();visibility.set(mesh,cache)}const key=tile.y*PAINT_STRIDE+tile.x
  if(!cache.has(key)){const p=point(mesh,q,Math.max(q.uOffset,Math.min(q.uOffset+q.width,tile.x+.5)),Math.max(q.vOffset??0,Math.min((q.vOffset??0)+q.height,tile.y+.5)));cache.set(key,projectedHit(p)?.h.object===mesh)}return cache.get(key)!
 }
 function geometry(mesh:THREE.Mesh,q:SurfaceQuad,tiles:Iterable<FootTile>){
  const normal=new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('normal'),0).multiplyScalar(.003),vertices:number[]=[]
  for(const tile of tiles){const x0=Math.max(q.uOffset,tile.x),x1=Math.min(q.uOffset+q.width,tile.x+1),y0=Math.max(q.vOffset??0,tile.y),y1=Math.min((q.vOffset??0)+q.height,tile.y+1);const points=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>point(mesh,q,x,y).add(normal));const outward=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).dot(normal)>=0;for(const i of outward?[0,1,2,0,2,3]:[0,2,1,0,3,2])vertices.push(...points[i].toArray())}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g
 }
 function flush(){
  if(drag)for(const entry of drag.entries.values())if(entry.dirty){
   if(entry.overlay){entry.overlay.geometry.dispose();entry.overlay.geometry=geometry(entry.mesh,entry.q,entry.tiles.values())}
   else{const material=(entry.mesh.material as THREE.MeshStandardMaterial).clone();material.map=null;material.color.set(erase?entry.q.color:color);material.side=THREE.FrontSide;entry.overlay=new THREE.Mesh(geometry(entry.mesh,entry.q,entry.tiles.values()),material);live.add(entry.overlay)}entry.dirty=false
  }
  if(drag){canvas.dataset.livePaintTiles=String(drag.count);canvas.dataset.livePaintSurfaces=JSON.stringify([...new Set([...drag.entries.values()].filter(e=>e.tiles.size).map(e=>e.q.deckId+'/'+e.q.face))])}render()
 }
 function brush(pick:Pick,record:boolean){
  const {mesh,q,at}=pick,half=Math.floor((size-1)/2),targets=new Map<THREE.Mesh,{q:SurfaceQuad;tiles:Map<number,FootTile>}>()
  function add(m:THREE.Mesh,s:SurfaceQuad,t:FootTile){if(!exteriorBrush(s,t,1).length||!visible(m,s,t))return;let target=targets.get(m);if(!target){target={q:s,tiles:new Map()};targets.set(m,target)}target.tiles.set(t.y*PAINT_STRIDE+t.x,t)}
  for(let y=at.y-half;y<at.y-half+size;y++)for(let x=at.x-half;x<at.x-half+size;x++){
   if(exteriorBrush(q,{x,y},1).length)add(mesh,q,{x,y})
   else{
    const queue=[{mesh,world:point(mesh,q,x+.5,y+.5),depth:0}],seen=new Set([mesh])
    for(const entry of queue){if(entry.depth>=6||seen.size>64)continue;for(const n of adjacent(entry.mesh)){if(seen.has(n))continue;const world=foldExteriorPoint(entry.mesh,n,entry.world);if(!world)continue;seen.add(n);const target=surfaceCoordinates(n,world),surface=n.userData.surface as SurfaceQuad;if(surface.face==='underside'&&!underside)continue;if(target)add(n,surface,target);else queue.push({mesh:n,world,depth:entry.depth+1})}}
   }
  }
  let count=0
  for(const [m,target] of targets){count+=target.tiles.size
   if(record&&drag){let entry=drag.entries.get(m);if(!entry){entry={q:target.q,mesh:m,tiles:new Map(),dirty:false};drag.entries.set(m,entry)}for(const [key,tile] of target.tiles)if(!entry.tiles.has(key)){entry.tiles.set(key,tile);entry.dirty=true;drag.count++}}
   else preview.add(new THREE.Mesh(geometry(m,target.q,target.tiles.values()),new THREE.MeshBasicMaterial({color:erase?'#fbbf24':color,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false})))
  }
  canvas.dataset.paintFace=q.face;canvas.dataset.paintRoom=q.roomId;canvas.dataset.paintDeck=q.deckId;canvas.dataset.paintCap=q.capSide??'';canvas.dataset.brushTiles=String(count)
  if(drag&&drag.count>50000){cancel();onMessage('Stroke exceeds 50,000 squares.');return false}return true
 }
 function sample(x:number,y:number,record:boolean):Pick|null{
  const picked=hit(x,y);if(!picked){delete canvas.dataset.paintFace;return null}
  if(picked.q.face==='underside'&&!underside){onMessage('Underside painting needs the reviewed underside migration. Other exterior faces remain available.');return null}
  const next=local(picked),last=drag?.last
  if(record&&last&&last.mesh!==next.mesh&&!seamConnected(last.mesh,next.mesh))return null
  if(record&&last?.mesh===next.mesh&&last.at.x===next.at.x&&last.at.y===next.at.y)return next
  if(record&&last?.mesh===next.mesh){for(const at of strokeTiles(last.at,next.at))if(!brush({...next,at},true))return null}
  else if(!brush(next,record))return null
  if(record&&drag)drag.last=next;return next
 }
 function begin(x:number,y:number){if(!pointerState)return;drag={id:pointerState.id,entries:new Map(),last:null,x,y,count:0};sample(x,y,true);flush()}
 function finishStroke(){const stroke=drag;if(!stroke)return;drag=null;clear(preview);const edits=[...stroke.entries.values()].map(s=>({q:s.q,tiles:[...s.tiles.values()]}));const accepted=edits.length&&onCommit(edits,erase?null:color)!==false
  if(accepted)for(const [mesh,entry] of stroke.entries){const prior=committed.get(mesh);if(prior){for(const [id,tile] of entry.tiles)prior.tiles.set(id,tile);if(prior.overlay){prior.overlay.geometry.dispose();prior.overlay.geometry=geometry(mesh,prior.q,prior.tiles.values())}}else{committed.set(mesh,entry);if(entry.overlay)settled.add(entry.overlay)}}
  clear(live);delete canvas.dataset.livePaintTiles;delete canvas.dataset.livePaintSurfaces
  if([...committed.values()].reduce((n,e)=>n+e.tiles.size,0)>50000){cancel();onMessage('Paint saved to the edit history. Start another drag to continue.')}render()
 }

 function down(e:PointerEvent){if(e.button!==0)return;e.preventDefault();e.stopImmediatePropagation();if(pointerState){cancel();return}canvas.focus?.({preventScroll:true});clear(preview);visibility.clear();alt=e.altKey;pointerState={id:e.pointerId,x:e.clientX,y:e.clientY};onGesture?.(true);canvas.setPointerCapture(e.pointerId);if(!alt)begin(e.clientX,e.clientY)}
 function move(e:PointerEvent){e.stopImmediatePropagation();clear(preview)
  if(!pointerState){visibility.clear();if(!e.altKey&&!alt)sample(e.clientX,e.clientY,false);render();return}if(pointerState.id!==e.pointerId)return
  const previous={x:pointerState.x,y:pointerState.y};pointerState.x=e.clientX;pointerState.y=e.clientY
  if(e.altKey||alt){finishStroke();if(!pointerState)return;onOrbit?.(e.clientX-previous.x,e.clientY-previous.y);visibility.clear();canvas.dataset.paintOrbit='true';render();return}
  delete canvas.dataset.paintOrbit
  if(!drag){begin(e.clientX,e.clientY);return}
  const start={x:drag.x,y:drag.y},steps=Math.max(1,Math.ceil(Math.hypot(e.clientX-start.x,e.clientY-start.y)));if(steps>4096){cancel();onMessage('Pointer moved beyond the paint view; start a new stroke.');return}for(let i=1;i<=steps&&drag;i++)sample(start.x+(e.clientX-start.x)*i/steps,start.y+(e.clientY-start.y)*i/steps,true);if(drag){drag.x=e.clientX;drag.y=e.clientY}flush()
 }
 function up(e:PointerEvent){e.stopImmediatePropagation();if(pointerState?.id!==e.pointerId)return;finishStroke();cancel()}
 function key(e:KeyboardEvent){if(e.key==='Escape'){cancel();onMessage('')}if(e.key==='Alt'&&(pointerState||document.activeElement===canvas)){e.preventDefault();alt=e.type==='keydown';if(alt)finishStroke();visibility.clear();clear(preview);render()}}
 function pointerCancelled(){cancel();onMessage('')}
 function blur(){alt=false;pointerCancelled()}
 canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move,true);canvas.addEventListener('pointerup',up,true);canvas.addEventListener('pointercancel',pointerCancelled);canvas.addEventListener('lostpointercapture',pointerCancelled);canvas.addEventListener('pointerleave',pointerCancelled);window.addEventListener('keydown',key);window.addEventListener('keyup',key);window.addEventListener('blur',blur)
 return()=>{cancel();scene.remove(preview,live,settled);canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointermove',move,true);canvas.removeEventListener('pointerup',up,true);canvas.removeEventListener('pointercancel',pointerCancelled);canvas.removeEventListener('lostpointercapture',pointerCancelled);canvas.removeEventListener('pointerleave',pointerCancelled);window.removeEventListener('keydown',key);window.removeEventListener('keyup',key);window.removeEventListener('blur',blur)}
}
