// Ship plans describe spaces and equipment only; no combat or power simulation.
export const QUALITIES = ['Junk', 'Secondhand', 'Store-bought', 'Outfitted', 'Specialized', 'Exotic'] as const
export const CONDITIONS = ['Working', 'Worn', 'Damaged', 'Broken'] as const
export type Point = { x: number; y: number }
export type Room = Point & { id: string; name: string; width: number; height: number; notes: string }
export type Mark = Point & { id: string; kind: 'wall' | 'door' | 'label'; name: string; vertical: boolean; length: number }
export type Deck = { id: string; name: string; width: number; height: number; height_ft?: number; rooms: Room[]; marks: Mark[] }
export type Part = Point & {
  id: string; deck_id: string; room_id: string | null; name: string; type: string
  quantity: number; quality: typeof QUALITIES[number]; black_market: boolean
  condition: typeof CONDITIONS[number]; notes: string
}
export type Connection = { id: string; name: string; kind: 'stairs' | 'lift'; from_deck: string; from: Point; to_deck: string; to: Point }
export type WindowSide = 'front' | 'rear' | 'port' | 'starboard'
export type ShipWindow = { id: string; deck_id: string; side: WindowSide; position: number }
export type ShipAppearance = { hull_color: string; accent_color: string; engine_color: string; marking: 'none' | 'stripe' | 'chevron'; windows: ShipWindow[] }
export const DEFAULT_APPEARANCE: ShipAppearance = { hull_color: '#718397', accent_color: '#d5b66e', engine_color: '#4bd7ee', marking: 'none', windows: [] }
export function shipAppearance(plan: ShipPlan): ShipAppearance { return plan.appearance ?? DEFAULT_APPEARANCE }
export type ShipPlan = { schema_version: 1; appearance?: ShipAppearance; decks: Deck[]; parts: Part[]; connections: Connection[] }
export type Ship = { id: string; name: string; description: string; owner_id: string | null; crew_ids: string[]; plan: ShipPlan; version: number }
export const newId = () => crypto.randomUUID()
export const DEFAULT_DECK_HEIGHT = 8
export function deckHeight(deck: Deck): number { return deck.height_ft ?? DEFAULT_DECK_HEIGHT }
export function normalizeShip(ship: Ship): Ship {
  return { ...ship, plan: { ...ship.plan, decks: ship.plan.decks.map(d => ({ ...d, height_ft: deckHeight(d) })) } }
}
export function newDeck(name = 'Main deck'): Deck {
  return { id: newId(), name, width: 24, height: 18, height_ft: 8, rooms: [], marks: [] }
}
export function emptyPlan(): ShipPlan {
  return { schema_version: 1, decks: [newDeck()], parts: [], connections: [] }
}
export function roomAt(deck: Deck, p: Point): Room | undefined {
  return deck.rooms.find(r => p.x >= r.x && p.y >= r.y && p.x < r.x + r.width && p.y < r.y + r.height)
}
// Visual footprints are derived from ordinary component types (schema v1 unchanged).
export function partFootprint(type: string) {
  if (type === 'Port wing' || type === 'Starboard wing') return { width: 4, height: 5 }
  if (type === 'Booster') return { width: 2, height: 3 }
  if (type === 'Hull panel') return { width: 2, height: 1 }
  return { width: 1, height: 1 }
}
export function movePart(plan: ShipPlan, id: string, deck: Deck, p: Point): ShipPlan {
  const size = partFootprint(plan.parts.find(part => part.id === id)?.type ?? '')
  const pos = { x: Math.max(0, Math.min(deck.width - size.width, p.x)), y: Math.max(0, Math.min(deck.height - size.height, p.y)) }
  return { ...plan, parts: plan.parts.map(part => part.id === id ? { ...part, ...pos, deck_id: deck.id, room_id: roomAt(deck, pos)?.id ?? null } : part) }
}
export function removeDeck(plan: ShipPlan, id: string): ShipPlan {
  if (plan.decks.length <= 1) return plan
  return { ...plan, ...(plan.appearance ? { appearance: { ...plan.appearance, windows: plan.appearance.windows.filter(w => w.deck_id !== id) } } : {}), decks: plan.decks.filter(d => d.id !== id), parts: plan.parts.filter(p => p.deck_id !== id), connections: plan.connections.filter(c => c.from_deck !== id && c.to_deck !== id) }
}
export function removeRoom(plan: ShipPlan, id: string): ShipPlan {
  return { ...plan, decks: plan.decks.map(d => ({ ...d, rooms: d.rooms.filter(r => r.id !== id) })), parts: plan.parts.map(p => p.room_id === id ? { ...p, room_id: null } : p) }
}
export function newPart(deck: Deck, p: Point): Part {
  return { id: newId(), deck_id: deck.id, room_id: roomAt(deck, p)?.id ?? null, ...p, name: 'New fixture', type: 'Fixture', quantity: 1, quality: 'Store-bought', black_market: false, condition: 'Working', notes: '' }
}
// Templates and the editor use the exact same plan format. Every instantiation
// regenerates all IDs/references; assignments and private notes never get copied.
export function copyPlan(source: ShipPlan): ShipPlan {
  const plan: ShipPlan = structuredClone(source)
  const ids = new Map<string, string>()
  const mapId = (id: string) => { if (!ids.has(id)) ids.set(id, newId()); return ids.get(id)! }
  plan.decks.forEach(d => { const old = d.id; d.id = mapId(old); d.rooms.forEach(r => { r.id = mapId(r.id) }); d.marks.forEach(m => { m.id = mapId(m.id) }) })
  plan.parts.forEach(p => { p.id = mapId(p.id); p.deck_id = mapId(p.deck_id); if (p.room_id) p.room_id = mapId(p.room_id) })
  plan.connections.forEach(c => { c.id = mapId(c.id); c.from_deck = mapId(c.from_deck); c.to_deck = mapId(c.to_deck) })
  if (plan.appearance) plan.appearance.windows.forEach(w => { w.id = mapId(w.id); w.deck_id = mapId(w.deck_id) })
  return plan
}
export function validatePlan(plan: ShipPlan): string | null {
  if (plan.schema_version !== 1 || !plan.decks.length || plan.decks.length > 20) return 'A ship needs 1–20 decks.'
  const ids = new Set<string>()
  const unique = (id: string) => { if (!id || ids.has(id)) return false; ids.add(id); return true }
  const inside = (d: Deck, p: Point) => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < d.width && p.y < d.height
  for (const d of plan.decks) {
    if (d.height_ft !== undefined && (!Number.isFinite(d.height_ft) || d.height_ft < 1 || d.height_ft > 100)) return 'Deck height must be between 1 and 100 feet.'
    if (!unique(d.id) || !d.name.trim() || !Number.isInteger(d.width) || !Number.isInteger(d.height) || d.width < 4 || d.height < 4 || d.width > 100 || d.height > 100) return 'Decks need unique IDs, names, and dimensions from 4 to 100.'
    for (const r of d.rooms) {
      if (!unique(r.id) || !r.name.trim() || !inside(d, r) || !Number.isInteger(r.width) || !Number.isInteger(r.height) || r.width < 1 || r.height < 1 || r.x + r.width > d.width || r.y + r.height > d.height) return 'Rooms must fit inside their deck.'
    }
    for (const m of d.marks) {
      if (!unique(m.id) || !inside(d, m) || !['wall', 'door', 'label'].includes(m.kind) || !Number.isInteger(m.length) || m.length < 1 || (m.vertical ? m.y + m.length > d.height : m.x + m.length > d.width)) return 'Walls, doors and labels must fit inside their deck.'
    }
  }
  for (const p of plan.parts) {
    const d = plan.decks.find(d => d.id === p.deck_id)
    const room = d?.rooms.find(r => r.id === p.room_id)
    if (!unique(p.id) || !d || !inside(d, p) || !p.name.trim() || !p.type.trim() || !Number.isInteger(p.quantity) || p.quantity < 1 || p.quantity > 100000 || !QUALITIES.includes(p.quality) || !CONDITIONS.includes(p.condition) || typeof p.black_market !== 'boolean') return 'Check component name, type, position, quantity, quality and condition.'
    if (p.room_id && (!room || p.x < room.x || p.y < room.y || p.x >= room.x + room.width || p.y >= room.y + room.height)) return 'A component must be positioned inside its linked room.'
  }
  if (plan.appearance !== undefined) {
    const a = plan.appearance
    if (!a || ![a.hull_color,a.accent_color,a.engine_color].every(c=>typeof c==='string' && /^#[0-9a-fA-F]{6}$/.test(c)) || !['none','stripe','chevron'].includes(a.marking) || !Array.isArray(a.windows) || a.windows.length>100) return 'Check hull colors, markings and windows (maximum 100).'
    for (const w of a.windows) if (!unique(w.id) || !plan.decks.some(d=>d.id===w.deck_id) || !['front','rear','port','starboard'].includes(w.side) || !Number.isFinite(w.position) || w.position<0 || w.position>1) return 'Windows need a valid deck, side and position from 0 to 100%.'
  }
  for (const c of plan.connections) {
    const a = plan.decks.find(d => d.id === c.from_deck), b = plan.decks.find(d => d.id === c.to_deck)
    if (!unique(c.id) || !c.name.trim() || !a || !b || a.id === b.id || !inside(a, c.from) || !inside(b, c.to) || !['stairs', 'lift'].includes(c.kind)) return 'Stairs/lifts must connect valid positions on two different decks.'
  }
  return null
}

// Normalized side placement follows the outermost occupied room boundary as a plan changes.
export function windowAnchor(deck: Deck, side: WindowSide, position: number) {
  const vertical = side === 'port' || side === 'starboard'
  const candidates: { x: number; y: number; vertical: boolean; roomId: string }[] = []
  for (let along=0;along<(vertical?deck.height:deck.width);along++) {
    const rooms=deck.rooms.filter(r=>vertical?along>=r.y&&along<r.y+r.height:along>=r.x&&along<r.x+r.width)
    if(!rooms.length)continue
    const coordinate=(r:Room)=>side==='port'?r.x:side==='starboard'?r.x+r.width:side==='front'?r.y:r.y+r.height
    rooms.sort((a,b)=>['port','front'].includes(side)?coordinate(a)-coordinate(b):coordinate(b)-coordinate(a))
    const r=rooms[0], edge=coordinate(r)
    candidates.push({x:vertical?edge:along+.5,y:vertical?along+.5:edge,vertical,roomId:r.id})
  }
  return candidates[Math.round(Math.max(0,Math.min(1,position))*(candidates.length-1))] ?? null
}
