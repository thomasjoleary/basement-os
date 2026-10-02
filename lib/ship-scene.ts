import { type ShipPlan, type Deck, deckHeight, partFootprint } from './ships'

// Display scale only, not a movement/combat rule. Plan x/y map to world x/z.
export const CELL_FEET = 5
export const SCENE_LIMIT = 6000
export type SceneSelection = { kind: 'room' | 'mark' | 'part' | 'connection'; id: string }
export type SceneItem = { at: [number, number, number]; size: [number, number, number]; color: string; shape?: 'port' | 'starboard' | 'engine'; selection?: SceneSelection; deckId: string }
export type SceneOptions = { deckId: string; mode: 'cutaway' | 'exterior'; roofs: boolean; allDecks: boolean; separated: boolean }
// Fit the complete interior assembly, including caps/screens, below the ceiling.
// Exterior hull, wings and engines intentionally use their own dimensions.
export function fitEquipmentHeight(items: SceneItem[], floor: number, height: number): SceneItem[] {
  const top = Math.max(0, ...items.map(i => i.at[1] + i.size[1] / 2 - floor))
  const available = height - Math.min(.1, height * .1)
  const scale = top > 0 ? Math.min(1, available / top) : 1
  return items.map(i => ({ ...i, at: [i.at[0], floor + (i.at[1] - floor) * scale, i.at[2]], size: [i.size[0], i.size[1] * scale, i.size[2]] }))
}
export function deckElevations(decks: Deck[], separated = false) {
  const elevations = new Map<string, number>(); let y = 0
  for (const d of [...decks].reverse()) { elevations.set(d.id, y); y += deckHeight(d) / CELL_FEET + .12 + (separated ? 2 : 0) }
  return elevations
}
export function buildShipScene(plan: ShipPlan, options: SceneOptions) {
  const items: SceneItem[] = []; let omitted = 0
  const elevations = deckElevations(plan.decks, options.separated)
  const add = (item: SceneItem) => { if (items.length < SCENE_LIMIT) items.push(item); else omitted++ }
  // Active deck first ensures large overviews retain its inspectable detail.
  const decks = plan.decks.filter(d => options.allDecks || d.id === options.deckId).sort((a,b) => Number(b.id === options.deckId) - Number(a.id === options.deckId))
  for (const d of decks) {
    if (items.length >= SCENE_LIMIT) { omitted++; continue }
    const base = options.allDecks ? elevations.get(d.id)! : 0, h = deckHeight(d) / CELL_FEET
    const exterior = options.mode === 'exterior'
    const box = (x: number, y: number, z: number, w: number, height: number, depth: number, color: string, selection?: SceneSelection, shape?: SceneItem['shape']) => add({ at: [x,y,z], size: [w,height,depth], color, selection, shape, deckId: d.id })
    const occupied = new Uint8Array(d.width * d.height)
    const edges = new Map<string, { vertical: boolean; x: number; z: number; selection: SceneSelection }>()
    const edge = (vertical: boolean, x: number, z: number, selection: SceneSelection) => edges.set(`${vertical}:${x}:${z}`, { vertical, x, z, selection })
    for (const r of d.rooms) {
      const selection: SceneSelection = { kind: 'room', id: r.id }
      box(r.x+r.width/2, base-.06, r.y+r.height/2, r.width,.12,r.height, exterior ? '#475569' : '#334e63', selection)
      if (options.roofs) {
        box(r.x+r.width/2,base+h+.04,r.y+r.height/2,r.width-.04,.12,r.height-.04,'#718397',selection)
        if (exterior) box(r.x+r.width/2,base+h+.11,r.y+r.height/2,Math.max(.1,r.width-.3),.025,.045,'#a6b7c8',selection)
      }
      for (let x=r.x;x<r.x+r.width;x++) for(let z=r.y;z<r.y+r.height;z++) occupied[z*d.width+x]=1
      for(let x=r.x;x<r.x+r.width;x++){edge(false,x,r.y,selection);edge(false,x,r.y+r.height,selection)}
      for(let z=r.y;z<r.y+r.height;z++){edge(true,r.x,z,selection);edge(true,r.x+r.width,z,selection)}
    }
    const filled=(x:number,z:number)=>x>=0&&z>=0&&x<d.width&&z<d.height&&occupied[z*d.width+x]===1
    if(exterior) for(const [key,e] of edges) {
      if(e.vertical ? filled(e.x-1,e.z)&&filled(e.x,e.z) : filled(e.x,e.z-1)&&filled(e.x,e.z)) edges.delete(key)
    }
    for(const m of d.marks.filter(m=>m.kind==='wall')) for(let i=0;i<m.length;i++) {
      if(!exterior) edge(m.vertical,m.x+(m.vertical?0:i),m.y+(m.vertical?i:0),{kind:'mark',id:m.id})
    }
    for(const m of d.marks.filter(m=>m.kind==='door')) {
      for(let i=0;i<m.length;i++) edges.delete(`${m.vertical}:${m.x+(m.vertical?0:i)}:${m.y+(m.vertical?i:0)}`)
      box(m.x+(m.vertical?0:m.length/2),base+(exterior?h*.42:.035),m.y+(m.vertical?m.length/2:0),m.vertical?.12:m.length,exterior?h*.84:.07,m.vertical?m.length:.12,'#dbb66c',{kind:'mark',id:m.id})
    }
    for(const e of edges.values()) {
      const wh=exterior?h:h*.45
      box(e.x+(e.vertical?0:.5),base+wh/2,e.z+(e.vertical?.5:0),e.vertical?.1:(exterior?.97:1),wh,e.vertical?(exterior?.97:1):.1,exterior?'#64788d':'#b9c8d2',e.selection)
    }
    for(const p of plan.parts.filter(p=>p.deck_id===d.id)) {
      if(items.length>=SCENE_LIMIT){omitted++;continue}
      const size=partFootprint(p.type), s: SceneSelection={kind:'part',id:p.id}, x=p.x+size.width/2,z=p.y+size.height/2
      const tint=p.condition==='Broken'?'#74545b':p.condition==='Damaged'?'#937155':'#586e82'
      if(p.type==='Port wing'||p.type==='Starboard wing') {
        box(x,base+.25,z,size.width,.2,size.height,tint,s,p.type==='Port wing'?'port':'starboard')
        box(x,base+.37,z,.09,.035,size.height*.65,'#c5a560',s)
      } else if(p.type==='Booster') {
        box(x,base+.5,z,1.25,1.25,2.5,tint,s,'engine')
        box(x,base+.5,z+1.28,.85,.85,.12,'#4bd7ee',s,'engine')
        box(x,base+.5,z-.8,1.5,1.5,.18,'#9ba8b4',s,'engine')
      } else if(p.type==='Hull panel') {
        box(x,base+.4,z,size.width,.5,size.height,tint,s)
        box(x,base+.66,z,size.width*.8,.035,size.height*.7,'#94a5b5',s)
      } else {
        const ph=Math.min(h*.65,p.type==='Power'?.9:p.type==='Furniture'?.35:.6)
        const equipment: SceneItem[] = [
          { at:[x,base+ph/2,z], size:[.7,ph,.7], color:tint, selection:s, deckId:d.id },
          { at:[x,base+ph+.025,z], size:[.52,.05,.48], color:p.type==='Control'?'#31bfd9':p.type==='Power'?'#ddbe68':p.type==='Life support'?'#72ba9e':'#a6b5bd', selection:s, deckId:d.id },
        ]
        fitEquipmentHeight(equipment,base,h).forEach(add)
      }
    }
    for(const c of plan.connections) {
      const at=c.from_deck===d.id?c.from:c.to_deck===d.id?c.to:null
      if(at) box(at.x+.5,base+.06,at.y+.5,.8,.12,.8,'#ab8edc',{kind:'connection',id:c.id})
    }
    if(!d.rooms.length) box(d.width/2,base-.1,d.height/2,d.width,.05,d.height,'#182634')
  }
  return { items, omitted }
}
