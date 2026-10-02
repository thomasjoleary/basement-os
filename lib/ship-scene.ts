import {surfaceModeActive,roomSurfaces} from './ship-surfaces'
import { type ShipPlan, type Deck, deckHeight, partFootprint, shipAppearance, windowAnchor } from './ships'

// Display scale only, not a movement/combat rule. Plan x/y map to world x/z.
export const CELL_FEET = 5
export const SCENE_LIMIT = 6000
export type SceneSelection = { kind: 'room' | 'mark' | 'part' | 'connection'; id: string }
export type SceneItem = { at: [number, number, number]; size: [number, number, number]; color: string; shape?: 'port' | 'starboard' | 'engine' | 'nose' | 'slope-port' | 'slope-starboard' | 'upright' | 'chevron'; selection?: SceneSelection; deckId: string; hull?: boolean; glow?: boolean }
export type SceneOptions = { deckId: string; mode: 'cutaway' | 'exterior'; roofs: boolean; allDecks: boolean; separated: boolean; hiddenDeckIds?: string[] }
// Fit the complete interior assembly, including caps/screens, below the ceiling.
// Exterior hull, wings and engines intentionally use their own dimensions.
export function fitEquipmentHeight(items: SceneItem[], floor: number, height: number): SceneItem[] {
  const top = Math.max(0, ...items.map(i => i.at[1] + i.size[1] / 2 - floor))
  const available = height - Math.min(.1, height * .1)
  const scale = top > 0 ? Math.min(1, available / top) : 1
  return items.map(i => ({ ...i, at: [i.at[0], floor + (i.at[1] - floor) * scale, i.at[2]], size: [i.size[0], i.size[1] * scale, i.size[2]] }))
}
export function equipmentModel(type: string, tint: string, selection: SceneSelection, deckId: string, x: number, floor: number, z: number): SceneItem[] {
  const items: SceneItem[]=[]
  const piece=(dx:number,y:number,dz:number,w:number,h:number,depth:number,color=tint,shape?:SceneItem['shape'])=>items.push({at:[x+dx,floor+y,z+dz],size:[w,h,depth],color,shape,selection,deckId})
  const seat=()=>{
    piece(0,.17,.24,.08,.34,.08,'#9aabb5');piece(0,.035,.24,.38,.07,.32)
    piece(0,.35,.24,.38,.12,.34,'#526b82');piece(0,.52,.4,.38,.4,.08,'#526b82')
  }
  if(type==='Control') {
    piece(-.25,.2,-.2,.07,.4,.08);piece(.25,.2,-.2,.07,.4,.08)
    piece(0,.42,-.2,.68,.12,.35);piece(0,.65,-.32,.6,.35,.08)
    piece(0,.65,-.269,.5,.25,.025,'#37c7df');piece(0,.49,-.14,.4,.025,.12,'#a8b6bb');seat()
  } else if(type==='Seat') seat()
  else if(type==='Cargo') {
    for(const dx of [-.36,.36])for(const dz of [-.32,.32])piece(dx,.65,dz,.06,1.3,.06,'#a2aeb5')
    for(const y of [.08,.5,.92]) {
      piece(0,y,0,.78,.07,.72)
      for(const dx of [-.19,.19]) {piece(dx,y+.18,0,.31,.29,.51,'#a99064');piece(dx,y+.18,.262,.04,.29,.02,'#cfbd92')}
    }
  } else if(type==='Propulsion') {
    piece(0,.09,0,.72,.18,.85);piece(0,.42,0,.58,.58,.78,tint,'engine')
    piece(0,.42,.4,.42,.42,.08,'#394957','engine');piece(0,.42,-.25,.68,.68,.1,'#9eabb4','engine')
  } else if(type==='Power'||type==='Life support') {
    piece(0,.07,0,.7,.14,.7);piece(0,.55,0,.55,.95,.55,tint,'upright')
    piece(0,.9,0,.61,.07,.61,type==='Power'?'#ddb864':'#73c7ac','upright')
  } else if(type==='Furniture') {
    piece(0,.12,0,.63,.24,.86);piece(0,.29,0,.65,.14,.88,'#8b9cab');piece(0,.39,-.27,.47,.07,.24,'#d6dde0')
  } else if(type==='Sanitation') {
    piece(0,.18,.1,.35,.36,.4,'#c7d4d9','upright');piece(0,.39,.1,.46,.07,.46,'#e0e8eb','upright');piece(0,.4,-.23,.42,.65,.17,'#bbcdd5')
  } else {
    piece(0,.3,0,.7,.6,.7);piece(0,.625,0,.52,.05,.48,'#a6b5bd')
  }
  return items
}
export function deckElevations(decks: Deck[], separated = false) {
  const elevations = new Map<string, number>(); let y = 0
  for (const d of [...decks].reverse()) { elevations.set(d.id, y); y += deckHeight(d) / CELL_FEET + .12 + (separated ? 2 : 0) }
  return elevations
}
export function buildShipScene(plan: ShipPlan, options: SceneOptions) {
  const items: SceneItem[] = []; let omitted = 0
  const surfaceSkin=surfaceModeActive(plan,options.mode)
  const appearance=shipAppearance(plan), skin=(fallback:string)=>plan.appearance?.hull_color??fallback
  const elevations = deckElevations(plan.decks, options.separated)
  const add = (item: SceneItem) => { if (items.length < SCENE_LIMIT) items.push(item); else omitted++ }
  // Active deck first ensures large overviews retain its inspectable detail.
  const decks = plan.decks.filter(d => options.allDecks ? !options.hiddenDeckIds?.includes(d.id) : d.id === options.deckId).sort((a,b) => Number(b.id === options.deckId) - Number(a.id === options.deckId))
  for (const d of decks) {
    if (items.length >= SCENE_LIMIT) { omitted++; continue }
    const base = options.allDecks ? elevations.get(d.id)! : 0, h = deckHeight(d) / CELL_FEET
    const exterior = options.mode === 'exterior'
    const box = (x: number, y: number, z: number, w: number, height: number, depth: number, color: string, selection?: SceneSelection, shape?: SceneItem['shape'], hull = false, glow = false) => add({ at: [x,y,z], size: [w,height,depth], color, selection, shape, deckId: d.id, hull, glow })
    const occupied = new Uint8Array(d.width * d.height)
    const edges = new Map<string, { vertical: boolean; x: number; z: number; selection: SceneSelection }>()
    const edge = (vertical: boolean, x: number, z: number, selection: SceneSelection) => edges.set(`${vertical}:${x}:${z}`, { vertical, x, z, selection })
    for (const r of d.rooms) {
      const selection: SceneSelection = { kind: 'room', id: r.id }
      box(r.x+r.width/2, base-.06, r.y+r.height/2, r.width,.12,r.height, exterior ? '#475569' : '#334e63', selection)
      if (options.roofs && !surfaceSkin) {
        box(r.x+r.width/2,base+h+.04,r.y+r.height/2,r.width-.04,.12,r.height-.04,skin('#718397'),selection,undefined,true)
        if (exterior) box(r.x+r.width/2,base+h+.11,r.y+r.height/2,Math.max(.1,r.width-.3),.025,.045,'#a6b7c8',selection,undefined,true)
        if(exterior && appearance.marking!=='none') box(r.x+r.width/2,base+h+.135,r.y+r.height/2,appearance.marking==='stripe'?.22:r.width*.55,.02,Math.min(r.height*.65,2),appearance.accent_color,selection,appearance.marking==='chevron'?'chevron':undefined,true)
      }
      if(surfaceSkin&&options.roofs&&exterior&&appearance.marking!=='none')box(r.x+r.width/2,base+h+.025,r.y+r.height/2,appearance.marking==='stripe'?.22:r.width*.55,.02,Math.min(r.height*.65,2),appearance.accent_color,selection,appearance.marking==='chevron'?'chevron':undefined,true)
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
      box(m.x+(m.vertical?0:m.length/2),base+(exterior?h*.42:.035),m.y+(m.vertical?m.length/2:0),m.vertical?.12:m.length,exterior?h*.84:.07,m.vertical?m.length:.12,'#dbb66c',{kind:'mark',id:m.id},undefined,true)
    }
    for(const e of edges.values()) {
      if(surfaceSkin&&e.selection.kind==='room')continue
      const wh=exterior?h:h*.45
      box(e.x+(e.vertical?0:.5),base+wh/2,e.z+(e.vertical?.5:0),e.vertical?.1:(exterior?.97:1),wh,e.vertical?(exterior?.97:1):.1,exterior?skin('#64788d'):'#b9c8d2',e.selection,undefined,true)
    }
    if(exterior && d.rooms.length && !surfaceSkin) {
      // Fairing skin extends outward only: never carve into saved room footprints.
      for(const e of edges.values()) if(e.vertical) {
        const port=filled(e.x,e.z)
        box(e.x+(port?-.25:.25),base+h/2,e.z+.5,.5,h,1,skin('#60778e'),e.selection,port?'slope-port':'slope-starboard',true)
      }
      const bow=Math.min(...d.rooms.map(r=>r.y))
      for(let x=0;x<d.width;) {
        if(!filled(x,bow)){x++;continue}
        const start=x;while(x<d.width&&filled(x,bow))x++
        const room=d.rooms.find(r=>r.y===bow&&start>=r.x&&start<r.x+r.width)
        box((start+x)/2,base+h/2,bow-.65,x-start,h,1.3,skin('#788b9e'),room?{kind:'room',id:room.id}:undefined,'nose',true)
      }
    }
    for(const p of plan.parts.filter(p=>p.deck_id===d.id)) {
      if(items.length>=SCENE_LIMIT){omitted++;continue}
      const size=partFootprint(p.type), s: SceneSelection={kind:'part',id:p.id}, x=p.x+size.width/2,z=p.y+size.height/2
      const tint=plan.surface_design?.components.find(c=>c.part_id===p.id)?.color??(p.condition==='Broken'?'#74545b':p.condition==='Damaged'?'#937155':'#586e82')
      if(p.type==='Port wing'||p.type==='Starboard wing') {
        box(x,base+.25,z,size.width,.2,size.height,tint,s,p.type==='Port wing'?'port':'starboard')
        box(x,base+.37,z,.09,.035,size.height*.65,appearance.accent_color,s)
        if(exterior) {
          const port=p.type==='Port wing', root=port?p.x+size.width:p.x
          // Add a root fairing only when the wing actually meets occupied hull.
          const adjacent=Array.from({length:size.height},(_,i)=>filled(port?Math.floor(root):Math.floor(root)-1,p.y+i)).some(Boolean)
          if(adjacent) box(root+(port?-.4:.4),base+Math.min(h,.9)/2,z,.8,Math.min(h,.9),size.height*.82,tint,s,port?'slope-port':'slope-starboard',true)
        }
      } else if(p.type==='Booster') {
        box(x,base+.5,z,1.25,1.25,2.5,tint,s,'engine')
        box(x,base+.5,z+1.28,.85,.85,.12,appearance.engine_color,s,'engine',false,true)
        box(x,base+.5,z-.8,1.5,1.5,.18,'#9ba8b4',s,'engine')
      } else if(p.type==='Hull panel') {
        box(x,base+.4,z,size.width,.5,size.height,tint,s)
        box(x,base+.66,z,size.width*.8,.035,size.height*.7,'#94a5b5',s)
      } else {
        fitEquipmentHeight(equipmentModel(p.type,tint,s,d.id,x,base,z),base,h).forEach(add)
      }
    }
    if(exterior) for(const w of appearance.windows.filter(w=>w.deck_id===d.id)) {
      const at=windowAnchor(d,w.side,w.position)
      if(!at)continue
      let wd=at.vertical?.7:.06
      let wx=at.x,wz=at.y,wy=base+h*.6,ww=at.vertical?.06:.7,wh=Math.min(.4,h*.23)
      if(w.side==='port')wx-=.34
      if(w.side==='starboard')wx+=.34
      if(w.side==='rear')wz+=.06
      if(w.side==='front') {
        const bow=Math.min(...d.rooms.map(r=>r.y))
        if(at.y===bow) {
          let left=Math.floor(at.x),right=left+1
          while(left>0&&filled(left-1,bow))left--
          while(right<d.width&&filled(right,bow))right++
          const center=(left+right)/2;wx=center+(wx-center)*.56;wz-=1.33;wy=base+h*.22;wh=Math.min(.25,h*.2);ww=.36
        } else wz-=.06
      }
      if(surfaceSkin){
        const room=d.rooms.find(r=>r.id===at.roomId)!
        const along=(at.vertical?at.y-room.y:at.x-room.x)*5
        const faces=roomSurfaces(plan,d,room).filter(f=>f.face===`exterior-${w.side}`&&!f.cap)
        const face=faces.find(f=>along>=f.uOffset&&along<=f.uOffset+f.width)??faces[0]
        if(!face)continue
        const t=Math.max(.1,Math.min(.9,(along-face.uOffset)/face.width)),a=face.vertices[0],b=face.vertices[1],c=face.vertices[3]
        wx=(a[0]+(b[0]-a[0])*t+(c[0]-a[0])*.6)/5;wy=base+(a[1]+(b[1]-a[1])*t+(c[1]-a[1])*.6)/5;wz=(a[2]+(b[2]-a[2])*t+(c[2]-a[2])*.6)/5
        if(w.side==='port')wx-=.035;if(w.side==='starboard')wx+=.035;if(w.side==='front')wz-=.035;if(w.side==='rear')wz+=.035
        if(at.vertical)wd=Math.min(.7,face.width/5*.6);else ww=Math.min(.7,face.width/5*.6)
        wh=Math.min(.4,(d.height_ft??8)/5*.2)
      }
      box(wx,wy,wz,ww,wh,wd,'#39adc9',{kind:'room',id:at.roomId},undefined,true)
    }
    for(const c of plan.connections) {
      const at=c.from_deck===d.id?c.from:c.to_deck===d.id?c.to:null
      if(at) box(at.x+.5,base+.06,at.y+.5,.8,.12,.8,'#ab8edc',{kind:'connection',id:c.id})
    }
    if(!d.rooms.length) box(d.width/2,base-.1,d.height/2,d.width,.05,d.height,'#182634')
  }
  return { items, omitted }
}
