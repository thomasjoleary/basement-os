import * as THREE from 'three'
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {createRequire} from 'node:module'
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


const {emptyPlan,newPart,newId,validatePlan}=model('ships')
const {copySelection,pasteSelection,mirroredTiles,layoutWarnings}=model('ship-edit-tools')
const {paintTiles,EMPTY_PAINT,decodePaint}=model('ship-paint')
let count=0;function check(name,fn){fn();count++;console.log('PASS '+name)}
const plan=emptyPlan(),deck=plan.decks[0];deck.width=40;deck.height=30
const room={id:newId(),name:'Workshop',x:1,y:1,width:5,height:5,notes:'public'};deck.rooms.push(room)
const part={...newPart(deck,{x:2,y:2}),name:'Cabinet'};plan.parts.push(part)
plan.surface_design={surfaces:[{id:newId(),deck_id:deck.id,room_id:room.id,face:'floor',paint:paintTiles(EMPTY_PAINT,[{x:1,y:2}],'#112233')}],sections:[],components:[{id:newId(),part_id:part.id,color:'#123456',materials:{trim:'#654321'}}]}
check('room clipboard copies children, paint, colors and references without aliasing',()=>{
 const clip=copySelection(plan,deck.id,{kind:'room',id:room.id}),result=pasteSelection(plan,deck.id,clip,{x:10,y:10});assert.equal(result.error,undefined);assert.equal(validatePlan(result.plan),null)
 const copied=result.plan.parts.at(-1);assert.equal(copied.x,11);assert.equal(copied.y,11);assert.notEqual(copied.id,part.id);assert.equal(copied.room_id,result.selection.id)
 assert.deepEqual(result.plan.surface_design.components.at(-1).materials,{trim:'#654321'});assert.equal(result.plan.surface_design.surfaces.at(-1).room_id,result.selection.id)
 result.plan.parts[0].name='changed';assert.equal(plan.parts[0].name,'Cabinet');assert.equal(clip.plan.parts[0].name,'Cabinet')
})
check('repeat paste uses fresh ids and failed overlap is atomic',()=>{
 const clip=copySelection(plan,deck.id,{kind:'room',id:room.id});const a=pasteSelection(plan,deck.id,clip,{x:10,y:10}),b=pasteSelection(a.plan,deck.id,clip,{x:20,y:10});assert.notEqual(a.selection.id,b.selection.id);const bad=pasteSelection(b.plan,deck.id,clip,{x:20,y:10});assert.ok(bad.error);assert.equal(bad.plan,b.plan)
})
check('mirror swaps wing type, accounts for footprint and copies material regions',()=>{
 const source=structuredClone(plan);source.parts[0].type='Port wing';const result=pasteSelection(source,deck.id,copySelection(source,deck.id,{kind:'part',id:part.id}),{x:0,y:0},{axis:'x',line:15});assert.equal(result.error,undefined);assert.equal(result.plan.parts.at(-1).x,24);assert.equal(result.plan.parts.at(-1).type,'Starboard wing');assert.equal(result.plan.surface_design.components.at(-1).materials.trim,'#654321')
})
check('room mirroring reflects floor squares and preserves originals',()=>{
 const result=pasteSelection(plan,deck.id,copySelection(plan,deck.id,{kind:'room',id:room.id}),{x:0,y:0},{axis:'x',line:10});assert.equal(result.error,undefined);assert.equal(result.plan.decks[0].rooms.at(-1).x,14);assert.equal(decodePaint(result.plan.surface_design.surfaces.at(-1).paint).get(2*1024+23),'#112233');assert.equal(decodePaint(plan.surface_design.surfaces[0].paint).get(2*1024+1),'#112233')
})
check('invalid destinations and explicit connections do not mutate document',()=>{
 for(const at of [{x:-2,y:2},{x:40,y:30},{x:1.2,y:0}]){const r=pasteSelection(plan,deck.id,copySelection(plan,deck.id,{kind:'part',id:part.id}),at);assert.ok(r.error);assert.equal(r.plan,plan)}
 const r=pasteSelection(plan,deck.id,copySelection(plan,deck.id,{kind:'connection',id:newId()}),{x:0,y:0});assert.match(r.error,/two decks/)
})
check('mirrored painting includes both axes, clips gaps, and deduplicates line cells',()=>{
 const visible=p=>p.x<10&&p.y<10&&!(p.x===8&&p.y===7);const points=mirroredTiles([{x:1,y:2}],{x:5,y:5},visible);assert.equal(points.length,3);assert.ok(points.some(p=>p.x===8&&p.y===2));assert.equal(mirroredTiles([{x:4,y:4}],{x:4.5,y:4.5},()=>true).length,1)
})
check('layout warnings are advisory and original model remains valid',()=>{assert.ok(layoutWarnings(plan,deck.id).some(w=>w.includes('door')));assert.equal(validatePlan(plan),null)})
console.log(`${count} editor convenience checks passed`)

const {exportDeckSvg,deckExportFilename}=model('ship-deck-export')
check('deck export escapes labels and excludes notes, account assignments and other decks',()=>{
 const ship={id:newId(),name:'<script>alert(1)</script>',description:'DESCRIPTION-PRIVATE',owner_id:'OWNER-PRIVATE',crew_ids:['CREW-PRIVATE'],plan:structuredClone(plan),version:9};ship.plan.parts[0].notes='PART-NOTES';ship.plan.decks[0].rooms[0].notes='ROOM-NOTES';const svg=exportDeckSvg(ship,ship.plan.decks[0],true)
 assert.ok(svg.includes('&lt;script&gt;'));assert.ok(svg.includes('UNSAVED DRAFT'));assert.ok(svg.includes('R1'));assert.ok(svg.includes('P1'));assert.ok(svg.includes('25 ft'))
 for(const secret of ['<script>','DESCRIPTION-PRIVATE','OWNER-PRIVATE','CREW-PRIVATE','PART-NOTES','ROOM-NOTES'])assert.ok(!svg.includes(secret))
 assert.equal(deckExportFilename('../Ship: *','A/B'),'Ship-A-B');assert.ok(exportDeckSvg({...ship,name:'Test'},ship.plan.decks[0]).includes('Saved revision 9'))
})
console.log(`${count} total editor and export checks passed`)

check('mirroring hidden cap paint and copying linked openings fail atomically',()=>{
 const source=structuredClone(plan);source.surface_design.surfaces[0].face='exterior-front';source.surface_design.surfaces[0].paint=paintTiles(EMPTY_PAINT,[{x:1,y:128}],'#112233')
 const clip=copySelection(source,deck.id,{kind:'room',id:room.id}),result=pasteSelection(source,deck.id,clip,{x:10,y:10},{axis:'x',line:10});assert.match(result.error,/cap or hidden/);assert.equal(result.plan,source)
 const pasted=pasteSelection(source,deck.id,clip,{x:10,y:10});assert.equal(pasted.error,undefined);assert.ok(decodePaint(pasted.plan.surface_design.surfaces.at(-1).paint).has(128*1024+1))
 source.connections.push({id:newId(),name:'Opening',kind:'stairs',from_deck:deck.id,to_deck:newId(),from:{x:2,y:2},to:{x:2,y:2}});const linked=pasteSelection(source,deck.id,copySelection(source,deck.id,{kind:'room',id:room.id}),{x:10,y:10});assert.match(linked.error,/deck connection/);assert.equal(linked.plan,source)
})
console.log(`${count} final editor and export checks passed`)

check('room reflection swaps implicit hull defaults as well as explicit sections',()=>{
 const result=pasteSelection(plan,deck.id,copySelection(plan,deck.id,{kind:'room',id:room.id}),{x:0,y:0},{axis:'y',line:10});assert.equal(result.error,undefined);const sections=result.plan.surface_design.sections.filter(s=>s.room_id===result.selection.id);assert.equal(sections.find(s=>s.side==='rear').extension_ft,6.5);assert.equal(sections.find(s=>s.side==='front').extension_ft,0)
})
console.log(`${count} final editor and export checks passed`)
