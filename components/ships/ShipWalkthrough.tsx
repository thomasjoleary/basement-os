'use client'
import {useEffect,useRef,useState} from 'react'
import * as THREE from 'three'
import type {ShipPlan,Point} from '@/lib/ships'
import {buildShipScene,type SceneOptions} from '@/lib/ship-scene'
import {sceneGeometry} from '@/lib/ship-geometry'
import {createSurfaceMeshes} from '@/lib/ship-surface-renderer'
import {walkWalls,walkSpawn,walkStep,ladderDestination} from '@/lib/ship-walk'
export default function ShipWalkthrough({plan,deckId,onDeck,onFallback}:{plan:ShipPlan;deckId:string;onDeck:(id:string)=>void;onFallback:()=>void}){
 const host=useRef<HTMLDivElement>(null),control=useRef<{enter:()=>void;exit:()=>void;use:(id:string)=>void;key:(key:string,down:boolean)=>void}|null>(null),arrival=useRef<{deck:string;position:Point}|null>(null),latest=useRef({onDeck})
 const [active,setActive]=useState(false),[message,setMessage]=useState(''),[failure,setFailure]=useState(false)
 useEffect(()=>{latest.current={onDeck}},[onDeck])
 const deck=plan.decks.find(d=>d.id===deckId)??plan.decks[0]
 useEffect(()=>{
  const container=host.current!;let renderer:THREE.WebGLRenderer
  try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'})}catch{queueMicrotask(()=>setFailure(true));return}
  const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','First-person ship walkthrough');canvas.dataset.testid='ship-walk-canvas';container.appendChild(canvas)
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor('#080f1e');renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.outputColorSpace=THREE.SRGBColorSpace
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#e8f4ff','#425168',3));const lamp=new THREE.PointLight('#ffffff',15,8);scene.add(lamp)
  const options:SceneOptions={deckId:deck.id,mode:'cutaway',roofs:true,allDecks:false,separated:false,walkthrough:true},data=buildShipScene(plan,options),surfaces=createSurfaceMeshes(plan,options,false)
  const geometries=new Map<string,THREE.BufferGeometry>(),materials:THREE.Material[]=[],targets:THREE.Object3D[]=[]
  for(const item of data.items){const material=new THREE.MeshStandardMaterial({color:item.color,roughness:.6});materials.push(material);const mesh=new THREE.Mesh(sceneGeometry(geometries,item.shape),material);mesh.position.fromArray(item.at);mesh.scale.fromArray(item.size);mesh.userData.connection=item.selection?.kind==='connection'?item.selection.id:undefined;scene.add(mesh);targets.push(mesh)}
  for(const mesh of surfaces.meshes){scene.add(mesh);targets.push(mesh)}
  const camera=new THREE.PerspectiveCamera(75,1,.025,1000),walls=walkWalls(deck),spawn=arrival.current?.deck===deck.id?arrival.current.position:walkSpawn(deck)
  arrival.current=null;let position=spawn??{x:0,y:0},yaw=0,pitch=0,enabled=false,frame=0,last=performance.now(),drag:{x:number;y:number;id:number;moved:boolean;distance:number}|null=null
  const keys=new Set<string>(),eye=Math.min(1.1,(deck.height_ft??8)/5*.7)
  function status(text:string){setMessage(text)}
  queueMicrotask(()=>{setActive(false);status(spawn?'Use Enter walkthrough, then WASD or arrow keys. Drag to look, or lock the mouse. Escape releases controls. Click a nearby ladder or use its button.':'No safe floor position on this deck. Choose another deck.')})
  function exit(){enabled=false;keys.clear();drag=null;if(document.pointerLockElement===canvas)document.exitPointerLock();setActive(false)}
  function enter(){if(!spawn)return;enabled=true;setActive(true);canvas.focus()}
  function travel(id:string){const c=plan.connections.find(c=>c.id===id),at=c?.from_deck===deck.id?c.from:c?.to_deck===deck.id?c.to:null;if(!at||Math.hypot(position.x-at.x-.5,position.y-at.y-.5)>2){status('Move within 10 feet of the ladder to use it.');return}const target=ladderDestination(plan,deck.id,id);if(!target){status('This ladder has no safe connected landing. Ask the designer to check its endpoints.');return}exit();arrival.current={deck:target.deck.id,position:target.position};latest.current.onDeck(target.deck.id)}
  function key(key:string,down:boolean){if(down&&enabled)keys.add(key.toLowerCase());else keys.delete(key.toLowerCase())}
  control.current={enter,exit,use:travel,key}
  function onKey(e:KeyboardEvent){if(e.key==='Escape'){exit();return}if(enabled&&['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())){e.preventDefault();key(e.key,e.type==='keydown')}}
  function down(e:PointerEvent){if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false,distance:0};canvas.setPointerCapture(e.pointerId)}
  function move(e:PointerEvent){if(!enabled)return;if(document.pointerLockElement===canvas){yaw-=e.movementX*.003;pitch=Math.max(-1.4,Math.min(1.4,pitch-e.movementY*.003));return}if(drag&&drag.id===e.pointerId){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.distance+=Math.hypot(dx,dy);if(drag.distance>3)drag.moved=true;yaw-=dx*.005;pitch=Math.max(-1.4,Math.min(1.4,pitch-dy*.005));drag.x=e.clientX;drag.y=e.clientY}}
  function cancel(){drag=null}
  function up(e:PointerEvent){const start=drag;drag=null;if(!start||start.id!==e.pointerId||start.moved)return;const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster(),p=document.pointerLockElement===canvas?new THREE.Vector2():new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);ray.setFromCamera(p,camera);const hit=ray.intersectObjects(targets,false)[0];if(hit?.object.userData.connection)travel(hit.object.userData.connection)}
  function blur(){exit()}
  function lockChange(){if(document.pointerLockElement!==canvas){keys.clear();enabled=false;setActive(false)}}
  function resize(){const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()}
  const observer=new ResizeObserver(resize);observer.observe(container);resize()
  function animate(now:number){const dt=Math.min(.05,(now-last)/1000);last=now;if(enabled){let forward=Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown')),side=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));const length=Math.hypot(forward,side);if(length){forward/=length;side/=length;position=walkStep(deck,position,(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*dt*1.6,(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*dt*1.6,walls)}}camera.position.set(position.x,eye,position.y);camera.rotation.set(pitch,yaw,0,'YXZ');lamp.position.copy(camera.position);canvas.dataset.position=`${position.x.toFixed(3)},${position.y.toFixed(3)}`;renderer.render(scene,camera);frame=requestAnimationFrame(animate)}
  frame=requestAnimationFrame(animate)
  window.addEventListener('keydown',onKey);window.addEventListener('keyup',onKey);window.addEventListener('blur',blur);document.addEventListener('pointerlockchange',lockChange);canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel)
  const lost=(e:Event)=>{e.preventDefault();exit();setFailure(true)};canvas.addEventListener('webglcontextlost',lost)
  const visibility=()=>{if(document.hidden)exit()};document.addEventListener('visibilitychange',visibility)
  return()=>{exit();control.current=null;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('keydown',onKey);window.removeEventListener('keyup',onKey);window.removeEventListener('blur',blur);document.removeEventListener('pointerlockchange',lockChange);document.removeEventListener('visibilitychange',visibility);surfaces.dispose();materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());canvas.removeEventListener('webglcontextlost',lost);renderer.dispose();renderer.forceContextLoss();canvas.remove()}
 },[plan,deck])
 return <section aria-label="Walkthrough" className="min-w-0 rounded-xl border border-gray-700 bg-gray-950 overflow-hidden"><div className="flex flex-wrap gap-3 p-3"><button onClick={()=>active?control.current?.exit():control.current?.enter()}>{active?'Exit walkthrough':'Enter walkthrough'}</button><button disabled={!active} onClick={()=>{const canvas=host.current?.querySelector('canvas');try{const result=canvas?.requestPointerLock();result?.catch(()=>setMessage('Mouse lock unavailable. Drag the canvas to look instead.'))}catch{setMessage('Mouse lock unavailable. Drag to look instead.')}}}>Lock mouse</button><span>WASD / arrows · drag to look · Escape to exit</span></div><p role="status" className="px-3 text-sm text-cyan-200">{message}</p>{failure?<button onClick={onFallback}>Walkthrough unavailable — return to 2D</button>:<div ref={host} className="h-[min(640px,65dvh)] min-h-[300px] relative touch-none"/>}<div className="flex flex-wrap gap-3 p-3">{['w','a','s','d'].map((k,i)=><button key={k} aria-label={['Walk forward','Walk left','Walk backward','Walk right'][i]} disabled={!active} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);control.current?.key(k,true)}} onPointerUp={()=>control.current?.key(k,false)} onPointerCancel={()=>control.current?.key(k,false)} onLostPointerCapture={()=>control.current?.key(k,false)} onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();control.current?.key(k,true)}}} onKeyUp={()=>control.current?.key(k,false)} className="border rounded p-2 touch-none">{['Forward','Left','Back','Right'][i]}</button>)}</div><div className="p-3 flex flex-wrap gap-3">{plan.connections.filter(c=>c.from_deck===deck.id||c.to_deck===deck.id).map(c=><button key={c.id} onClick={()=>control.current?.use(c.id)} className="underline">Use ladder: {c.name}</button>)}</div><p className="p-3 text-xs text-gray-400">Ladders use the saved connection destinations. Doors are open passages; walls and floor edges block movement. Exploring does not edit the ship.</p></section>
}
