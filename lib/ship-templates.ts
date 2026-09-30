import { type ShipPlan, type Deck, type Room, type Part, copyPlan } from './ships'

function deck(id: string, name: string, width: number, height: number, rooms: Room[]): Deck {
  return { id, name, width, height, rooms, marks: [] }
}
function room(id: string, name: string, x: number, y: number, width: number, height: number): Room {
  return { id, name, x, y, width, height, notes: '' }
}
function part(id: string, name: string, type: string, deck_id: string, room_id: string, x: number, y: number): Part {
  return { id, name, type, deck_id, room_id, x, y, quantity: 1, quality: 'Store-bought', black_market: false, condition: 'Working', notes: '' }
}
const fighter: ShipPlan = {
  schema_version: 1,
  decks: [deck('flight', 'Main deck', 12, 16, [room('cockpit', 'Cockpit', 3, 1, 6, 4), room('cabin', 'Bunk cabin', 2, 5, 5, 5), room('wc', 'Toilet', 7, 5, 3, 5), room('engine', 'Engineering', 2, 10, 8, 5)])],
  parts: [part('seat', 'Pilot console', 'Control', 'flight', 'cockpit', 5, 2), part('bed', 'Bunk', 'Furniture', 'flight', 'cabin', 3, 7), part('toilet', 'Toilet', 'Sanitation', 'flight', 'wc', 8, 7), part('thruster', 'Propulsion unit', 'Propulsion', 'flight', 'engine', 4, 13), part('power', 'Power unit', 'Power', 'flight', 'engine', 7, 13), part('air', 'Life support', 'Life support', 'flight', 'engine', 4, 11)],
  connections: [],
}
const freighter: ShipPlan = {
  schema_version: 1,
  decks: [
    deck('upper', 'Crew deck', 20, 18, [room('bridge', 'Cockpit', 5, 1, 10, 4), room('bedroom', 'Bedroom', 2, 5, 7, 6), room('galley', 'Kitchen', 11, 5, 7, 6), room('hall', 'Crew passage', 9, 5, 2, 11), room('wash', 'Washroom', 2, 11, 7, 5), room('stores', 'Stores', 11, 11, 7, 5)]),
    deck('lower', 'Cargo deck', 20, 18, [room('cargo', 'Cargo hold', 2, 1, 16, 10), room('engineering', 'Engineering', 2, 11, 16, 5)]),
  ],
  parts: [part('helm', 'Flight console', 'Control', 'upper', 'bridge', 8, 2), part('nav', 'Navigation console', 'Control', 'upper', 'bridge', 12, 2), part('bunk', 'Crew bunk', 'Furniture', 'upper', 'bedroom', 4, 7), part('stove', 'Cooking station', 'Appliance', 'upper', 'galley', 14, 7), part('water', 'Water recycler', 'Life support', 'upper', 'wash', 4, 13), part('wc', 'Toilet', 'Sanitation', 'upper', 'wash', 7, 13), part('crates', 'Cargo restraints', 'Cargo', 'lower', 'cargo', 5, 5), part('engine', 'Main propulsion', 'Propulsion', 'lower', 'engineering', 5, 13), part('reactor', 'Power unit', 'Power', 'lower', 'engineering', 10, 13), part('life', 'Life support', 'Life support', 'lower', 'engineering', 15, 13)],
  connections: [{ id: 'lift', name: 'Cargo lift', kind: 'lift', from_deck: 'upper', from: { x: 10, y: 13 }, to_deck: 'lower', to: { x: 10, y: 8 } }],
}
// Rooms provide perimeter walls; doors are explicit openings in those outlines.
fighter.decks[0].marks = [
  { id: 'f-door1', kind: 'door', name: 'Cockpit hatch', x: 4, y: 5, length: 2, vertical: false },
  { id: 'f-door2', kind: 'door', name: 'Toilet door', x: 7, y: 7, length: 1, vertical: true },
  { id: 'f-door3', kind: 'door', name: 'Engineering hatch', x: 4, y: 10, length: 2, vertical: false },
]
freighter.decks[0].marks = [
  { id: 'r-door1', kind: 'door', name: 'Bridge hatch', x: 9, y: 5, length: 2, vertical: false },
  { id: 'r-door2', kind: 'door', name: 'Bedroom door', x: 9, y: 8, length: 1, vertical: true },
  { id: 'r-door3', kind: 'door', name: 'Kitchen door', x: 11, y: 8, length: 1, vertical: true },
  { id: 'r-door4', kind: 'door', name: 'Washroom door', x: 9, y: 13, length: 1, vertical: true },
  { id: 'r-door5', kind: 'door', name: 'Stores door', x: 11, y: 13, length: 1, vertical: true },
]
freighter.decks[1].marks = [{ id: 'r-door6', kind: 'door', name: 'Engineering hatch', x: 9, y: 11, length: 2, vertical: false }]
export const SHIP_TEMPLATES = [
  { id: 'fighter', name: 'Compact fighter', description: 'One deck · cockpit, bunk, toilet and essential systems.', plan: fighter },
  { id: 'freighter', name: 'Freighter', description: 'Two decks · crew quarters, kitchen, cargo hold, engineering and a lift.', plan: freighter },
] as const
export function instantiateTemplate(id: string): ShipPlan {
  const template = SHIP_TEMPLATES.find(t => t.id === id)
  if (!template) throw new Error('Unknown ship template')
  return copyPlan(template.plan)
}
