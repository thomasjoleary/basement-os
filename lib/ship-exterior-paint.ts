import * as THREE from 'three'
import {type ShipPlan,newId,validatePlan} from './ships'
import {type SurfaceQuad,EMPTY_SURFACES} from './ship-surfaces'
import {type FootTile,EMPTY_PAINT,paintTiles,PAINT_STRIDE} from './ship-paint'

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

// The first ray hit is authoritative, including non-paintable fixtures and caps.
// Never tunnel through those objects or a transparent hull to another surface.
export function attachExteriorPaint({canvas,camera,scene,objects,size,color,erase,underside,onCommit,onMessage,render}:{canvas:HTMLCanvasElement;camera:THREE.Camera;scene:THREE.Scene;objects:THREE.Object3D[];size:number;color:string;erase:boolean;underside:boolean;onCommit:(q:SurfaceQuad,tiles:FootTile[],color:string|null)=>void;onMessage:(s:string)=>void;render:()=>void}){
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),preview=new THREE.Group();scene.add(preview)
 let drag:{id:number;q:SurfaceQuad;tiles:Map<number,FootTile>;x:number;y:number}|null=null
 function clear(){for(const child of [...preview.children]){const m=child as THREE.Mesh;m.geometry.dispose();(m.material as THREE.Material).dispose();preview.remove(m)}}
 function cancel(){drag=null;clear();delete canvas.dataset.paintFace;delete canvas.dataset.brushTiles;render()}
 function hit(x:number,y:number){const rect=canvas.getBoundingClientRect();if(x<rect.left||y<rect.top||x>rect.right||y>rect.bottom)return null;pointer.set((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2);ray.setFromCamera(pointer,camera);const h=ray.intersectObjects(objects,false)[0],q=h?.object.userData.surface as SurfaceQuad|undefined;return h&&h.uv&&q?.hull&&!q.cap?{h,q}:null}
 function point(mesh:THREE.Mesh,q:SurfaceQuad,x:number,y:number){const p=mesh.geometry.getAttribute('position'),a=new THREE.Vector3().fromBufferAttribute(p,0),b=new THREE.Vector3().fromBufferAttribute(p,1),c=new THREE.Vector3().fromBufferAttribute(p,2),d=new THREE.Vector3().fromBufferAttribute(p,3);const u=(x-q.uOffset)/q.width,v=(y-(q.vOffset??0))/q.height;return a.lerp(b,u).lerp(d.lerp(c,u),v)}
 function sample(x:number,y:number,record:boolean){
  clear();const picked=hit(x,y);if(!picked){delete canvas.dataset.paintFace;render();return}
  const {h,q}=picked,mesh=h.object as THREE.Mesh
  if(q.face==='underside'&&!underside){onMessage('Underside painting needs the reviewed underside migration. Other exterior faces remain available.');render();return}
  if(drag&&(drag.q.roomId!==q.roomId||drag.q.face!==q.face)){render();return}
  const at={x:Math.floor(h.uv!.x*mesh.userData.paintWidth),y:Math.floor(h.uv!.y*mesh.userData.paintHeight)}
  const visible=exteriorBrush(q,at,size).filter(tile=>{const center=point(mesh,q,Math.max(q.uOffset,Math.min(q.uOffset+q.width,tile.x+.5)),Math.max(q.vOffset??0,Math.min((q.vOffset??0)+q.height,tile.y+.5))).project(camera),r=canvas.getBoundingClientRect();const first=hit(r.left+(center.x+1)*r.width/2,r.top+(1-center.y)*r.height/2);return first?.h.object===mesh})
  canvas.dataset.paintFace=q.face;canvas.dataset.brushTiles=String(visible.length)
  const normal=new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('normal'),0).multiplyScalar(.003)
  for(const tile of visible){const x0=Math.max(q.uOffset,tile.x),x1=Math.min(q.uOffset+q.width,tile.x+1),y0=Math.max(q.vOffset??0,tile.y),y1=Math.min((q.vOffset??0)+q.height,tile.y+1);const vertices=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].flatMap(([x,y])=>point(mesh,q,x,y).add(normal).toArray());const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex([0,1,2,0,2,3]);const marker=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:erase?'#fbbf24':color,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));preview.add(marker);if(record&&drag)drag.tiles.set(tile.y*PAINT_STRIDE+tile.x,tile)}
  if(drag&&drag.tiles.size>50000){cancel();onMessage('Stroke exceeds 50,000 squares.');return}
  render();return q
 }
 function down(e:PointerEvent){if(e.button!==0)return;e.preventDefault();e.stopImmediatePropagation();if(drag){cancel();return}const q=sample(e.clientX,e.clientY,false);if(!q)return;drag={id:e.pointerId,q,tiles:new Map(),x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);sample(e.clientX,e.clientY,true)}
 function move(e:PointerEvent){e.stopImmediatePropagation();if(!drag){sample(e.clientX,e.clientY,false);return}if(drag.id!==e.pointerId)return;const start={x:drag.x,y:drag.y},steps=Math.min(128,Math.max(1,Math.ceil(Math.hypot(e.clientX-start.x,e.clientY-start.y)/6)));for(let i=1;i<=steps&&drag;i++)sample(start.x+(e.clientX-start.x)*i/steps,start.y+(e.clientY-start.y)*i/steps,true);if(drag){drag.x=e.clientX;drag.y=e.clientY}}
 function up(e:PointerEvent){e.stopImmediatePropagation();const stroke=drag;if(!stroke||stroke.id!==e.pointerId)return;drag=null;clear();if(stroke.tiles.size)onCommit(stroke.q,[...stroke.tiles.values()],erase?null:color);render()}
 function key(e:KeyboardEvent){if(e.key==='Escape')cancel()}
 canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move,true);canvas.addEventListener('pointerup',up,true);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);canvas.addEventListener('pointerleave',cancel);window.addEventListener('keydown',key)
 return()=>{cancel();scene.remove(preview);canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointermove',move,true);canvas.removeEventListener('pointerup',up,true);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('lostpointercapture',cancel);canvas.removeEventListener('pointerleave',cancel);window.removeEventListener('keydown',key)}
}
