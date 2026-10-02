import * as THREE from 'three'
// Real PostgreSQL (PGlite), isolated in memory. Never connects to Supabase.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { createRequire } from 'node:module'

// Compile the pure model modules in memory: no build artifacts or extra runtime.
const require = createRequire(import.meta.url)
const modelCache = new Map()
function model(name) {
  if (modelCache.has(name)) return modelCache.get(name)
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const exports = {}
  new Function('exports', 'require', code)(exports, id => id==='three'?THREE:id.startsWith('./') ? model(id.slice(2)) : require(id))
  modelCache.set(name, exports)
  return exports
}

const {paintTiles,decodePaint,rectangleTiles,strokeTiles,EMPTY_PAINT,paintError,recordPaint,undoPaint,redoPaint}=model('ship-paint')
const {roomSurfaces,surfaceModeActive}=model('ship-surfaces')
const {instantiateTemplate}=model('ship-templates')
const {validatePlan,copyPlan,removeRoom,removeDeck}=model('ships')
let count=0;function check(name,fn){fn();count++;console.log('PASS '+name)}
check('foot addressing stays stable across width changes, run encoding compresses fills',()=>{
 const paint=paintTiles(EMPTY_PAINT,rectangleTiles({x:2,y:3},{x:7,y:5}),'#FF0000')
 assert.equal(decodePaint(paint).size,18);assert.equal(paint.runs.length,3);assert.equal(decodePaint(paint).get(3*1024+2),'#ff0000')
 assert.equal(decodePaint(paintTiles(paint,[{x:2,y:3}],null)).size,17)
})
check('stroke interpolation, undo redo and branching preserve completed strokes',()=>{
 const points=[...strokeTiles({x:0,y:0},{x:5,y:2})];assert.equal(points.length,6)
 const first=paintTiles(EMPTY_PAINT,points,'#00ff00');let h=recordPaint({present:EMPTY_PAINT,past:[],future:[]},first)
 h=undoPaint(h);assert.deepEqual(h.present,EMPTY_PAINT);h=redoPaint(h);assert.deepEqual(h.present,first)
 h=recordPaint(undoPaint(h),paintTiles(EMPTY_PAINT,[{x:1,y:1}],'#ff0000'));assert.equal(h.future.length,0)
})
check('malformed paints and excessive fills fail without changing the prior draft',()=>{
 for(const paint of [{palette:['red'],runs:[]},{palette:['#ff0000'],runs:[[1,3,0],[2,1,0]]},{palette:['#ff0000'],runs:[[0,50001,0]]},{palette:['#ff0000'],runs:[[0,1,9]]}])assert.ok(paintError(paint))
 assert.throws(()=>paintTiles(EMPTY_PAINT,rectangleTiles({x:0,y:0},{x:500,y:100}),'#123456'),/50,000/);assert.deepEqual(EMPTY_PAINT,{palette:[],runs:[]})
})
const plan=instantiateTemplate('fighter'),deck=plan.decks[0],room=deck.rooms[0]
plan.surface_design={surfaces:[{id:'paint',deck_id:deck.id,room_id:room.id,face:'floor',paint:paintTiles(EMPTY_PAINT,[{x:1,y:1}],'#ff0000')}],sections:[{id:'shape',deck_id:deck.id,room_id:room.id,side:'front',extension_ft:6,slope:.5,taper:.25,bevel_ft:1}],components:[{id:'color',part_id:plan.parts[0].id,color:'#00ff00'}]}
check('surface references copy independently and cleanup removes only deleted references',()=>{
 assert.equal(validatePlan(plan),null);const copy=copyPlan(plan);assert.equal(validatePlan(copy),null);assert.notEqual(copy.surface_design.surfaces[0].id,'paint');assert.equal(copy.surface_design.surfaces[0].room_id,copy.decks[0].rooms[0].id)
 assert.equal(removeRoom(plan,room.id).surface_design.surfaces.length,0);assert.equal(removeRoom(plan,room.id).surface_design.sections.length,0)
 const bad=structuredClone(plan);bad.surface_design.sections[0].id='paint';assert.ok(validatePlan(bad))
})
check('surface dimensions are actual feet and slopes have physical hypotenuse length',()=>{
 const faces=roomSurfaces(plan,deck,room),floor=faces.find(f=>f.face==='floor')
 assert.equal(floor.width,room.width*5);assert.equal(floor.height,room.height*5)
 const front=faces.find(f=>f.face==='exterior-front'&&!f.cap);assert.equal(front.height,Math.hypot((deck.height_ft??8)-1,3))
 for(const q of faces)for(const point of q.vertices)assert.ok(point.every(Number.isFinite))
})
check('component colors alone never replace existing hull geometry',()=>{
 const only=structuredClone(plan);only.surface_design.surfaces=[];only.surface_design.sections=[]
 assert.equal(surfaceModeActive(only,'exterior'),false);assert.equal(surfaceModeActive(only,'cutaway'),false)
})
check('new skins retain openings instead of painting over doors',()=>{
 const testDeck={id:'deck',name:'Deck',width:10,height:10,height_ft:8,rooms:[{id:'room',name:'Room',x:1,y:1,width:4,height:4,notes:''}],marks:[{id:'door',kind:'door',name:'Door',x:2,y:1,length:1,vertical:false}]}
 const testPlan={schema_version:1,decks:[testDeck],parts:[],connections:[]}
 const faces=roomSurfaces(testPlan,testDeck,testDeck.rooms[0]).filter(f=>f.face==='interior-front')
 assert.equal(faces.length,2);assert.equal(faces.reduce((a,f)=>a+f.width,0),15)
})
check('review comparisons report geometry and surface changes by stable identity',()=>{
 const {submissionChanges}=model('ship-review-diff'),before={name:'Design',description:'',plan:structuredClone(plan)},after=structuredClone(before)
 after.plan.surface_design.sections[0].extension_ft=9;after.plan.surface_design.surfaces[0].paint=paintTiles(EMPTY_PAINT,[{x:0,y:0}],'#123456');after.plan.parts[0].name='Renamed console'
 const changes=submissionChanges(before,after);assert.ok(changes.some(c=>c.startsWith('Surface paint changed:')));assert.ok(changes.some(c=>c.startsWith('Hull section changed:')));assert.ok(changes.some(c=>c==='Component changed: Renamed console'))
})

check('shaped isolated hull has matching closed seams, including bevel end caps',()=>{
 const d={id:'d',name:'D',width:10,height:10,height_ft:8,rooms:[{id:'r',name:'R',x:2,y:2,width:4,height:4,notes:''}],marks:[]}
 const p={schema_version:1,decks:[d],parts:[],connections:[],surface_design:{surfaces:[],components:[],sections:['front','rear','port','starboard'].map((side,i)=>({id:'s'+i,deck_id:'d',room_id:'r',side,extension_ft:3,slope:.5,taper:.2,bevel_ft:1}))}}
 const surfaces=roomSurfaces(p,d,d.rooms[0]).filter(q=>q.hull),edges=new Map()
 surfaces.push({vertices:[[10,0,10],[30,0,10],[30,0,30],[10,0,30]]})
 const point=p=>p.map(v=>v.toFixed(6)).join(',')
 for(const q of surfaces)for(let i=0;i<4;i++){const key=[point(q.vertices[i]),point(q.vertices[(i+1)%4])].sort().join('|');edges.set(key,(edges.get(key)??0)+1)}
 for(const [edge,n] of edges)assert.equal(n,2,'unmatched hull seam '+edge)
})
check('moving/resizing preserves anchored paint and physical geometry follows the room',()=>{
 const moved=structuredClone(plan),paint=JSON.stringify(moved.surface_design.surfaces[0].paint)
 moved.decks[0].rooms[0].x++;moved.decks[0].rooms[0].width--
 assert.equal(JSON.stringify(moved.surface_design.surfaces[0].paint),paint)
 const a=roomSurfaces(plan,deck,room).find(s=>s.face==='floor'),b=roomSurfaces(moved,moved.decks[0],moved.decks[0].rooms[0]).find(s=>s.face==='floor')
 assert.equal(b.vertices[0][0]-a.vertices[0][0],5);assert.equal(a.width-b.width,5)
 const restored=structuredClone(moved);restored.decks[0].rooms[0].width++
 assert.deepEqual(restored.surface_design.surfaces[0].paint,plan.surface_design.surfaces[0].paint)
})
check('surface renderer bounds texture memory and never creates a mesh per paint square',()=>{
 const previous=globalThis.document
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillStyle:'',fillRect(){}})})}
 try{
  const {createSurfaceMeshes}=model('ship-surface-renderer')
  const decks=Array.from({length:20},(_,i)=>({id:'d'+i,name:'D',width:100,height:100,height_ft:8,rooms:[{id:'r'+i,name:'R',x:0,y:0,width:100,height:100,notes:''}],marks:[]}))
  const large={schema_version:1,decks,parts:[],connections:[],surface_design:{surfaces:decks.map((d,i)=>({id:'f'+i,deck_id:d.id,room_id:d.rooms[0].id,face:'roof',paint:{palette:['#ff0000'],runs:[[0,1,0]]}})),sections:[],components:[]}}
  const result=createSurfaceMeshes(large,{deckId:'d0',mode:'exterior',roofs:true,allDecks:true,separated:false},false)
  assert.ok(result.omitted>0);assert.ok(result.meshes.length<=2000)
  const pixels=result.meshes.reduce((n,m)=>n+(m.material.map?m.material.map.image.width*m.material.map.image.height:0),0)
  assert.ok(pixels<=16*1024*1024);result.dispose()
 }finally{globalThis.document=previous}
})
console.log(count+' paint and surface checks passed.')

const {walkWalls,walkable,walkSpawn,walkStep,ladderDestination}=model('ship-walk')
check('walk collision sweep blocks tunneling, opens only real doors, and never leaves floors',()=>{
 const p=instantiateTemplate('freighter'),d=p.decks[0];d.rooms=[{...d.rooms[0],x:2,y:2,width:2,height:4},{...d.rooms[1],x:4,y:2,width:2,height:4}];d.marks=[]
 assert.ok(walkSpawn(d));assert.equal(walkable(d,{x:0,y:0}),false)
 let at=walkStep(d,{x:3,y:3},20,0);assert.ok(at.x<4)
 d.marks=[{id:'door',kind:'door',name:'Door',x:4,y:3,length:1,vertical:true}];at=walkStep(d,{x:3,y:3.5},2,0);assert.ok(at.x>4.9)
 assert.ok(walkStep(d,{x:3,y:3.5},20,0).x<6);assert.equal(walkable(d,{x:4,y:2.5}),false)
})
check('ladder destinations are existing endpoints only and reject missing or unsafe landings',()=>{
 const p=instantiateTemplate('freighter'),c=p.connections[0],d=p.decks[0],to=p.decks[1];assert.equal(ladderDestination(p,d.id,'absent'),null)
 c.to={x:to.rooms[0].x+1,y:to.rooms[0].y+1};const dest=ladderDestination(p,d.id,c.id);assert.equal(dest.deck.id,to.id);assert.ok(walkable(to,dest.position))
 c.to={x:0,y:0};assert.equal(ladderDestination(p,d.id,c.id),null);c.to_deck='absent';assert.equal(ladderDestination(p,d.id,c.id),null)
})
console.log(`${count} checks passed including walking`)

const {deckFloorTiles,paintDeckFloors}=model('ship-floor-paint')
check('deck paint preserves room coordinates, off-footprint colors and independent palettes',()=>{
 const p=instantiateTemplate('freighter'),d=p.decks[0],r=d.rooms[0],other=d.rooms[1];const surfaces=[]
 for(const [i,room] of [r,other].entries()){const cells=new Map();for(let n=0;n<40;n++)cells.set(n%10+Math.floor(n/10)*1024,`#${(i*40+n+1).toString(16).padStart(6,'0')}`);if(!i)cells.set(900*1024+900,'#ffffff');surfaces.push({id:crypto.randomUUID(),deck_id:d.id,room_id:room.id,face:'floor',paint:model('ship-paint').encodePaint(cells)})}
 p.surface_design={surfaces,sections:[],components:[]};const global=deckFloorTiles(p,d);assert.equal(new Set(global.values()).size,80);global.set(r.y*5*1024+r.x*5,'#ff0000');const next=paintDeckFloors(p,d,global);assert.equal(validatePlan(next),null);const local=decodePaint(next.surface_design.surfaces.find(s=>s.room_id===r.id).paint);assert.equal(local.get(0),'#ff0000');assert.equal(local.get(900*1024+900),'#ffffff');assert.equal(decodePaint(p.surface_design.surfaces[0].paint).get(0),'#000001')
})
console.log(`${count} total surface, paint and walkthrough checks passed`)
