'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {attachExteriorPaint,paintExteriorStroke} from '@/lib/ship-exterior-paint'
import {supabase} from '@/lib/supabase'
import {sceneGeometry} from '@/lib/ship-geometry'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {createSurfaceMeshes} from '@/lib/ship-surface-renderer'
import {type SurfaceFace} from '@/lib/ship-paint'
import { type ShipPlan, shipAppearance } from '@/lib/ships'
import { buildShipScene, type SceneItem, type SceneSelection } from '@/lib/ship-scene'

type Props = { editable?:boolean; onChange?:(plan:ShipPlan)=>void; plan: ShipPlan; deckId: string; mode: 'cutaway' | 'exterior'; selection: SceneSelection | null; onSelect: (s: SceneSelection | null, deckId?: string) => void; onFallback: () => void; onSurface?: (face: SurfaceFace) => void }
export default function ShipViewer3D({ plan, deckId, mode, selection, onSelect, onFallback, onSurface, editable=false, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const actions = useRef<{ reset: () => void; zoom: (factor: number) => void; highlight: () => void; underside:()=>void } | null>(null)
  const latest = useRef({ selection, onSelect, onSurface, onChange, plan })
  const [gesturePlan,setGesturePlan]=useState<ShipPlan|null>(null)
  const scenePlan=gesturePlan??plan
  const [paintTool,setPaintTool]=useState<'orbit'|'brush'|'erase'>('orbit'),[brushSize,setBrushSize]=useState(1),[paintColor,setPaintColor]=useState('#ef4444'),[paintMessage,setPaintMessage]=useState(''),[undersideReady,setUndersideReady]=useState(false)
  useEffect(()=>{if(!editable||mode!=='exterior')return;let active=true;void supabase.rpc('v2_ship_check_surfaces',{p:{decks:[{id:'probe-deck',rooms:[{id:'probe-room'}]}],parts:[],surface_design:{surfaces:[{id:'probe-face',deck_id:'probe-deck',room_id:'probe-room',face:'underside',paint:{palette:[],runs:[]}}],sections:[],components:[]}}}).then(({error})=>{if(active)setUndersideReady(!error)});return()=>{active=false}},[editable,mode])
  const cameraMemory = useRef<{ key: string; position: THREE.Vector3; target: THREE.Vector3; zoom: number } | null>(null)
  const [roofs, setRoofs] = useState(mode === 'exterior'), [allDecks, setAllDecks] = useState(mode === 'exterior'), [explodeRequested, setSeparated] = useState(false)
  const [hiddenDeckIds, setHiddenDeckIds] = useState<string[]>([]), [transparentHull, setTransparentHull] = useState(false)
  const painting=mode==='exterior'&&editable&&paintTool!=='orbit'&&!transparentHull
  const visibleDeckCount = allDecks ? plan.decks.filter(d => !hiddenDeckIds.includes(d.id)).length : 1
  const separated = explodeRequested && visibleDeckCount > 1
  const [failure, setFailure] = useState(false)
  const sceneData = useMemo(() => buildShipScene(scenePlan, { deckId, mode, roofs, allDecks, separated, hiddenDeckIds, forceSurfaces:mode==='exterior' }), [scenePlan, deckId, mode, roofs, allDecks, separated, hiddenDeckIds])
  useEffect(() => { latest.current = { selection, onSelect, onSurface, onChange, plan }; actions.current?.highlight() }, [selection, onSelect, onSurface, onChange, plan])
  useEffect(() => {
    const container = host.current!
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' }) }
    catch { queueMicrotask(() => setFailure(true)); return }
    const canvas = renderer.domElement
    canvas.setAttribute('aria-label', `${mode === 'cutaway' ? 'Cutaway' : 'Exterior'} ship view`)
    canvas.tabIndex=0;canvas.setAttribute('role', 'img'); canvas.dataset.testid = 'ship-3d-canvas'
    container.appendChild(canvas)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setClearColor('#080f1e'); renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.localClippingEnabled=true
    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight('#d7efff', '#27354a', 2.8))
    const sun = new THREE.DirectionalLight('#fff0d7', 3.4); sun.position.set(-20,35,-18); scene.add(sun)
    const below=new THREE.DirectionalLight('#d7efff',2.8);below.position.set(0,-25,10);scene.add(below)
    const rim = new THREE.DirectionalLight('#80cfff', 2); rim.position.set(15,8,25); scene.add(rim)
    const geometries = new Map<string, THREE.BufferGeometry>()
    const grouped = new Map<string,SceneItem[]>()
    for(const item of sceneData.items) { const key=(item.shape??'box')+(item.glow?':glow':'')+(item.hull?':hull':''); if(!grouped.has(key))grouped.set(key,[]); grouped.get(key)!.push(item) }
    const material = new THREE.MeshStandardMaterial({ roughness:.56, metalness:mode==='exterior'?.48:.15 })
    const glowMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: shipAppearance(scenePlan).engine_color, emissiveIntensity: 1.4, roughness: .35 })
    const hullMaterial = material.clone(); hullMaterial.transparent = transparentHull; hullMaterial.opacity = transparentHull ? .18 : 1; hullMaterial.depthWrite = !transparentHull
    const meshes: THREE.InstancedMesh[] = []
    const matrix=new THREE.Matrix4(), quaternion=new THREE.Quaternion(), position=new THREE.Vector3(), scale=new THREE.Vector3()
    for(const [shape,items] of grouped) {
      const mesh=new THREE.InstancedMesh(sceneGeometry(geometries,shape.split(':')[0]),shape.includes(':hull')?hullMaterial:shape.includes(':glow')?glowMaterial:material,items.length)
      items.forEach((item,i)=>{matrix.compose(position.fromArray(item.at),quaternion,scale.fromArray(item.size));mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,new THREE.Color(item.color))})
      mesh.userData.items=items;mesh.userData.hull=shape.includes(':hull'); mesh.computeBoundingSphere(); scene.add(mesh); meshes.push(mesh)
    }
    const surfaces=createSurfaceMeshes(scenePlan,{deckId,mode,roofs,allDecks,separated,hiddenDeckIds,forceSurfaces:mode==='exterior'},transparentHull)
    for(const mesh of [...surfaces.meshes,...surfaces.backings])scene.add(mesh)
    const surfaceNotice=document.createElement('span');surfaceNotice.className='absolute bottom-2 left-2 text-xs text-amber-200 bg-gray-950 p-1';surfaceNotice.textContent='Surface detail limit reached. Select a single deck to inspect paint.';surfaceNotice.hidden=!surfaces.omitted;container.appendChild(surfaceNotice)
    const bounds=new THREE.Box3()
    surfaces.meshes.forEach(mesh=>bounds.expandByObject(mesh))
    for(const item of sceneData.items) bounds.expandByPoint(new THREE.Vector3(...item.at).addScaledVector(new THREE.Vector3(...item.size),.5)).expandByPoint(new THREE.Vector3(...item.at).addScaledVector(new THREE.Vector3(...item.size),-.5))
    if(bounds.isEmpty())bounds.set(new THREE.Vector3(0,0,0),new THREE.Vector3(20,2,20))
    const center=bounds.getCenter(new THREE.Vector3()), span=Math.max(4,bounds.getSize(new THREE.Vector3()).length())
    const camera=mode==='cutaway'?new THREE.OrthographicCamera(-span,span,span,-span,.1,2000):new THREE.PerspectiveCamera(38,1,.1,2000)
    const controls=new OrbitControls(camera,canvas)
    controls.enableDamping=false; controls.minDistance=2; controls.maxDistance=1500; controls.minZoom=.2; controls.maxZoom=12; controls.maxPolarAngle=mode==='exterior'?Math.PI-.01:Math.PI*.49; controls.enabled=!painting
    controls.target.copy(center)
    let disposed=false, frame=0
    const labels: { element: HTMLSpanElement; point: THREE.Vector3 }[]=[]
    if(mode==='cutaway' && !roofs && !allDecks) for(const room of (scenePlan.decks.find(d=>d.id===deckId)?.rooms??[]).slice(0,24)) {
      const element=document.createElement('span');element.textContent=room.name;element.className='pointer-events-none absolute text-[10px] text-slate-200 bg-slate-950/80 rounded px-1 max-w-28 truncate'
      container.appendChild(element);labels.push({element,point:new THREE.Vector3(room.x+room.width/2,.08,room.y+room.height/2)})
    }
    function render() {
      frame=0;if(disposed)return
      canvas.dataset.cameraY=String(camera.position.y-controls.target.y);canvas.dataset.cameraPosition=camera.position.toArray().join(',');canvas.dataset.cameraTarget=controls.target.toArray().join(',');renderer.render(scene,camera)
      for(const label of labels){const p=label.point.clone().project(camera);label.element.style.left=`${(p.x+1)*container.clientWidth/2}px`;label.element.style.top=`${(1-p.y)*container.clientHeight/2}px`;label.element.style.transform='translate(-50%,-50%)';label.element.hidden=p.z>1||p.z< -1}
    }
    function requestRender(){if(!frame&&!disposed)frame=requestAnimationFrame(render)}
    function reset(){controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(.7,.85,1).normalize().multiplyScalar(span*1.2));camera.zoom=1;camera.updateProjectionMatrix();controls.update();requestRender()}
    const key=`${mode}:${allDecks?'all':deckId}:${allDecks}:${separated}`
    reset()
    if(cameraMemory.current?.key===key){camera.position.copy(cameraMemory.current.position);controls.target.copy(cameraMemory.current.target);camera.zoom=cameraMemory.current.zoom;controls.update()}
    function resize(){const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h);if(camera instanceof THREE.PerspectiveCamera)camera.aspect=w/h;else{camera.left=-span*w/h/2;camera.right=span*w/h/2;camera.top=span/2;camera.bottom=-span/2}camera.updateProjectionMatrix();requestRender()}
    const observer=new ResizeObserver(resize);observer.observe(container);resize()
    function highlight(){for(const mesh of surfaces.meshes)(mesh.material as THREE.MeshStandardMaterial).emissive.set(mesh.userData.selection.id===latest.current.selection?.id?'#103040':'#000000');for(const mesh of meshes){(mesh.userData.items as SceneItem[]).forEach((item,i)=>mesh.setColorAt(i,new THREE.Color(item.color).lerp(new THREE.Color('#36d8ee'),latest.current.selection&&item.selection?.id===latest.current.selection.id? .15:0)));if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true}requestRender()}
    actions.current={reset,underside:()=>{controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(.3,-1,.4).normalize().multiplyScalar(span*1.2));controls.update();requestRender()},zoom:(factor)=>{camera.zoom=Math.max(.2,Math.min(12,camera.zoom*factor));camera.updateProjectionMatrix();requestRender()},highlight};highlight()
    controls.addEventListener('change',requestRender)
    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2()
    let press: { x:number; y:number; id:number; moved:boolean } | null=null
    function down(e:PointerEvent){if(painting)return;if(e.button!==0||press){press=null;return}press={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false}}
    function move(e:PointerEvent){if(press&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>=6)press.moved=true}
    function cancel(){press=null}
    function up(e:PointerEvent){if(painting)return;const start=press;press=null;if(!start||start.moved||start.id!==e.pointerId)return
      const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera)
      const hit=ray.intersectObjects([...meshes,...surfaces.meshes].filter(m=>!(transparentHull&&m.userData.hull)),false).find(h=>h.object.userData.clipY===undefined||h.point.y<=h.object.userData.clipY)
      const item=hit&&hit.instanceId!==undefined?(hit.object.userData.items as SceneItem[])[hit.instanceId]:hit?.object.userData
      if(hit?.object.userData.face)latest.current.onSurface?.(hit.object.userData.face)
      latest.current.onSelect(item?.selection??null,item?.deckId)
    }
    const stopPainting=painting?attachExteriorPaint({canvas,camera,scene,objects:[...meshes,...surfaces.meshes,...surfaces.backings],size:brushSize,color:paintColor,erase:paintTool==='erase',underside:undersideReady,onCommit:(stroke,color)=>{try{const next=paintExteriorStroke(latest.current.plan,stroke,color);if(next===latest.current.plan)return false;latest.current.plan=next;latest.current.onChange?.(next);setPaintMessage('');return true}catch(error){setPaintMessage((error as Error).message);return false}},onMessage:setPaintMessage,render:requestRender,onGesture:(active)=>setGesturePlan(active?latest.current.plan:null),onOrbit:(dx,dy)=>{const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));spherical.theta-=dx*.006;spherical.phi=Math.max(.01,Math.min(Math.PI-.01,spherical.phi+dy*.006));camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();camera.updateMatrixWorld();requestRender()}}):()=>{}
    function lost(e:Event){e.preventDefault();setFailure(true)}
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);canvas.addEventListener('webglcontextlost',lost)
    return()=>{stopPainting();cameraMemory.current={key,position:camera.position.clone(),target:controls.target.clone(),zoom:camera.zoom};disposed=true;cancelAnimationFrame(frame);actions.current=null;observer.disconnect();controls.dispose();canvas.removeEventListener('webglcontextlost',lost);surfaces.dispose();surfaceNotice.remove();renderer.dispose();renderer.forceContextLoss();geometries.forEach(g=>g.dispose());material.dispose();glowMaterial.dispose();hullMaterial.dispose();meshes.forEach(m=>m.dispose());canvas.remove();labels.forEach(l=>l.element.remove())}
  },[sceneData,scenePlan,deckId,mode,roofs,allDecks,separated,transparentHull,hiddenDeckIds,painting,paintTool,brushSize,paintColor,undersideReady])
  return <section className="min-w-0 rounded-xl border border-gray-700 bg-gray-950 overflow-hidden" aria-label="3D ship viewer">
    <div className="flex flex-wrap gap-3 items-center p-3 text-sm border-b border-gray-700">
      <button onClick={()=>actions.current?.reset()}>Reset view</button>{mode==='exterior'&&<button onClick={()=>actions.current?.underside()}>View underside</button>}<button aria-label="Zoom 3D out" onClick={()=>actions.current?.zoom(.8)}>-</button><button aria-label="Zoom 3D in" onClick={()=>actions.current?.zoom(1.25)}>+</button>
      <label><input type="checkbox" checked={roofs} onChange={e=>setRoofs(e.target.checked)} /> Roofs</label>
      <label><input type="checkbox" checked={transparentHull} onChange={e=>setTransparentHull(e.target.checked)} /> Transparent hull</label>
      <label><input type="checkbox" checked={allDecks} onChange={e=>setAllDecks(e.target.checked)} /> Show all decks</label>
      <label><input type="checkbox" checked={separated} disabled={visibleDeckCount <= 1} onChange={e=>setSeparated(e.target.checked)} /> Exploded view</label>
    </div>
    {mode==='exterior'&&editable&&<div className="flex flex-wrap items-center gap-3 p-3 border-b border-gray-700 text-sm" aria-label="Exterior painting">
      {(['orbit','brush','erase'] as const).map(t=><button key={t} aria-pressed={paintTool===t} disabled={transparentHull&&t!=='orbit'} onClick={()=>{setPaintTool(t);setPaintMessage('')}} className={`rounded border px-3 py-2 ${paintTool===t?'border-cyan-400 bg-cyan-950':'border-gray-600'}`}>{t==='orbit'?'Orbit':t==='brush'?'Paint exterior':'Erase exterior'}</button>)}
      <label>Brush size <input aria-label="Exterior brush size" type="number" min="1" max="20" value={brushSize} onChange={e=>setBrushSize(Math.min(20,Math.max(1,Number(e.target.value)||1)))} className="w-16 bg-gray-900 border border-gray-600 p-1"/> ft</label>
      <label>Color <input aria-label="Exterior paint color" type="color" value={paintColor} onChange={e=>setPaintColor(e.target.value)}/></label>
      <span className="text-xs text-gray-400">{transparentHull?'Disable Transparent hull to paint.':painting?'Drag to paint. Alt ends the stroke and lets you drag to rotate. Release Alt to paint a new stroke. Esc cancels the current stroke.':'Drag to orbit, including below the ship. Select Paint exterior to brush.'}</span>
      {!undersideReady&&<span className="text-xs text-amber-200">Underside paint setup pending; wall and roof painting are available.</span>}
      {paintMessage&&<span role="status" className="text-xs text-amber-200">{paintMessage}</span>}
    </div>}
    {allDecks && <fieldset aria-label="Visible decks" className="flex flex-wrap gap-x-4 gap-y-2 px-3 py-2 text-xs border-b border-gray-800"><legend className="sr-only">Visible decks</legend>{plan.decks.map(d=><label key={d.id} className="min-w-0 max-w-full break-all"><input type="checkbox" aria-label={`Show deck ${d.name}`} checked={!hiddenDeckIds.includes(d.id)} onChange={e=>setHiddenDeckIds(ids=>e.target.checked?ids.filter(id=>id!==d.id):[...ids,d.id])} /> {d.name}</label>)}<button onClick={()=>setHiddenDeckIds([])}>Restore hidden decks</button></fieldset>}
    {allDecks && plan.decks.every(d=>hiddenDeckIds.includes(d.id)) && <p role="status" className="p-3 text-sm text-amber-200">No decks visible. Choose a deck above or use Restore hidden decks.</p>}
    {failure ? <div role="status" className="h-[380px] md:h-[520px] flex flex-col gap-4 items-center justify-center p-6 text-center"><p>3D is unavailable on this device. Your ship and unsaved edits are safe.</p><button onClick={onFallback} className="rounded bg-cyan-800 px-4 py-2">Return to 2D</button></div> : <div ref={host} className="relative h-[380px] md:h-[520px] overflow-hidden touch-none" />}
    <p className="p-3 text-xs text-gray-400 border-t border-gray-800">Drag to orbit; scroll to zoom; click to inspect. 5 ft per grid cell for display. Decks stack in list order, top first. Connections show endpoints, not physical shafts.</p>
    {sceneData.omitted>0&&<p role="status" className="px-3 pb-3 text-xs text-amber-300">Large plan: 3D detail is limited. Use an individual deck or the 2D plan and inventory to inspect all items.</p>}
  </section>
}
