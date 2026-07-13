// Shared types & constants for the Battlefield feature.

export type EntityKind = 'player' | 'tame' | 'enemy' | 'object' | 'wall' | 'door'

export interface Battlefield {
  id: string
  name: string
  cols: number
  rows: number
  bg_color: string
  border_type: 'indoor' | 'outdoor'
  gm_notes: string
  round: number
  turn_entity_id: string | null
  is_archived: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface BattlefieldEntity {
  id: string
  battlefield_id: string
  kind: EntityKind
  character_id: string | null
  label: string
  x: number
  y: number
  width: number
  height: number
  color: string
  icon: string | null
  hp_current: number | null
  hp_max: number | null
  mana_current: number | null
  mana_max: number | null
  move_ft: number
  conditions: string[]
  initiative: number | null
  hidden_until_revealed: boolean
  notes: string
  created_at: string
  updated_at: string
}

// One grid square = 5 feet.
export const FEET_PER_SQUARE = 5

// Base pixel size of a square at 100% zoom.
export const BASE_CELL_PX = 46

export const ENTITY_KINDS: { kind: EntityKind; label: string; icon: string; color: string }[] = [
  { kind: 'player', label: 'Player', icon: '🧑', color: '#3b82f6' },
  { kind: 'tame', label: 'Tame', icon: '🐾', color: '#22c55e' },
  { kind: 'enemy', label: 'Enemy', icon: '👹', color: '#ef4444' },
  { kind: 'object', label: 'Object', icon: '🪵', color: '#a16207' },
  { kind: 'wall', label: 'Wall', icon: '🧱', color: '#6b7280' },
  { kind: 'door', label: 'Door', icon: '🚪', color: '#92400e' },
]

export function kindMeta(kind: EntityKind) {
  return ENTITY_KINDS.find(k => k.kind === kind) ?? ENTITY_KINDS[2]
}

// Token colour palette for quick picking.
export const TOKEN_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#78716c', '#0ea5e9',
]

export const BG_COLORS = [
  '#334155', '#1f2937', '#0f172a', '#3f2d1e', '#1e3a2f',
  '#3b2f45', '#44403c', '#1e293b', '#4c1d1d', '#0c4a6e',
]

// Status conditions available as toggleable badges on tokens.
export const CONDITIONS: { id: string; label: string; icon: string }[] = [
  { id: 'poisoned', label: 'Poisoned', icon: '🤢' },
  { id: 'prone', label: 'Prone', icon: '🛌' },
  { id: 'stunned', label: 'Stunned', icon: '💫' },
  { id: 'blinded', label: 'Blinded', icon: '🙈' },
  { id: 'charmed', label: 'Charmed', icon: '💗' },
  { id: 'frightened', label: 'Frightened', icon: '😱' },
  { id: 'grappled', label: 'Grappled', icon: '🤼' },
  { id: 'restrained', label: 'Restrained', icon: '⛓️' },
  { id: 'concentrating', label: 'Concentrating', icon: '🧠' },
  { id: 'unconscious', label: 'Unconscious', icon: '😵' },
  { id: 'invisible', label: 'Invisible', icon: '👻' },
  { id: 'burning', label: 'Burning', icon: '🔥' },
  { id: 'hasted', label: 'Hasted', icon: '⚡' },
  { id: 'slowed', label: 'Slowed', icon: '🐌' },
  { id: 'blessed', label: 'Blessed', icon: '✨' },
  { id: 'cursed', label: 'Cursed', icon: '☠️' },
]

export function conditionMeta(id: string) {
  return CONDITIONS.find(c => c.id === id)
}

// A minimal shape of the characters row we need for live HP/mana on linked tokens.
export interface CharacterLite {
  id: string
  name: string
  hp_current: number | null
  hp_max: number | null
  mana_current: number | null
  mana_max: number | null
  is_tame?: boolean
}

// Resolve the HP/mana an entity should display.
// Linked player/tame tokens read live values from the character; others use their own manual fields.
export function resolveVitals(
  entity: BattlefieldEntity,
  characters: Record<string, CharacterLite>
): { hp: number | null; hpMax: number | null; mana: number | null; manaMax: number | null; live: boolean } {
  if (entity.character_id && characters[entity.character_id]) {
    const c = characters[entity.character_id]
    return { hp: c.hp_current, hpMax: c.hp_max, mana: c.mana_current, manaMax: c.mana_max, live: true }
  }
  return { hp: entity.hp_current, hpMax: entity.hp_max, mana: entity.mana_current, manaMax: entity.mana_max, live: false }
}

// Display name for an entity.
export function entityName(entity: BattlefieldEntity, characters: Record<string, CharacterLite>): string {
  if (entity.character_id && characters[entity.character_id]) return characters[entity.character_id].name
  if (entity.label) return entity.label
  return kindMeta(entity.kind).label
}

// D&D 5e "every square = 5ft" distance (diagonals count the same as orthogonals).
export function gridDistanceFeet(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by)) * FEET_PER_SQUARE
}

// Chebyshev distance in squares between the closest cells of two footprints.
export function footprintDistanceSquares(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): number {
  const dx = Math.max(0, a.x - (b.x + b.width - 1), b.x - (a.x + a.width - 1))
  const dy = Math.max(0, a.y - (b.y + b.height - 1), b.y - (a.y + a.height - 1))
  return Math.max(dx, dy)
}
