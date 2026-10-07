import type {Part,ShipPlan} from './ships'
export type FixtureColors = {trim?:string;detail?:string}
export type FixtureRegion = {key:'trim'|'detail';name:string;defaultColor:string}
export function fixtureRegions(type:string):FixtureRegion[]{
 const trim=(name:string,defaultColor:string):FixtureRegion=>({key:'trim',name,defaultColor})
 const detail=(name:string,defaultColor:string):FixtureRegion=>({key:'detail',name,defaultColor})
 if(type==='Control'||type==='Seat')return [trim('Metal frame','#9aabb5'),detail('Seat upholstery','#526b82')]
 if(type==='Cargo')return [trim('Rack frame','#a2aeb5'),detail('Cargo containers','#a99064')]
 if(type==='Propulsion')return [trim('Intake collar','#9eabb4'),detail('Exhaust housing','#394957')]
 if(type==='Power'||type==='Life support')return [trim('Service band',type==='Power'?'#ddb864':'#73c7ac')]
 if(type==='Furniture')return [trim('Mattress','#8b9cab'),detail('Pillow','#d6dde0')]
 if(type==='Sanitation')return [trim('Bowl and seat','#e0e8eb'),detail('Tank','#bbcdd5')]
 if(type==='Ladder')return [trim('Ladder rungs','#dfb95e')]
 if(type==='Booster')return [trim('Intake collar','#9ba8b4')]
 if(type==='Port wing'||type==='Starboard wing')return [trim('Wing marking','#d5b66e')]
 if(type==='Hull panel')return [trim('Panel inset','#94a5b5')]
 return [trim('Top panel','#a6b5bd')]
}
export function fixtureTint(part:Part){return part.condition==='Broken'?'#74545b':part.condition==='Damaged'?'#937155':part.type==='Sanitation'?'#c7d4d9':part.type==='Ladder'?'#b8c8d0':'#586e82'}
export function fixtureStyle(plan:ShipPlan,part:Part){const saved=plan.surface_design?.components.find(c=>c.part_id===part.id);return {color:saved?.color??fixtureTint(part),materials:saved?.materials??{}}}
export function fixtureColorsError(colors:unknown){return !colors||typeof colors!=='object'||Array.isArray(colors)||Object.entries(colors).some(([k,v])=>!['trim','detail'].includes(k)||typeof v!=='string'||!/^#[0-9a-fA-F]{6}$/.test(v))}
