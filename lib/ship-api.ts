import { supabase } from './supabase'
import { type Ship, validatePlan, normalizeShip } from './ships'
export type Profile = { id: string; username: string; role?: string }
export function shipError(error: { message: string; code?: string }): string {
  if (['42P01', 'PGRST202', 'PGRST205'].includes(error.code ?? '')) return 'Ship storage is not installed yet. Ask the GM to apply sql/v2_005_ships.sql.'
  if (error.message === 'Invalid deck') return 'The ship could not be saved. Deck height support requires the ship_deck_heights migration; ask the GM to finish setup. Your edits are still here.'
  return error.message
}
export async function shipAccess() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data, error } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  if (error) throw new Error(shipError(error))
  return { isGM: data?.role === 'gm', userId: session.user.id }
}
export async function saveShip(ship: Ship, notes: string): Promise<Ship> {
  const invalid = validatePlan(ship.plan)
  if (invalid) throw new Error(invalid)
  const { data, error } = await supabase.rpc('v2_save_ship', {
    ship_id: ship.id, expected_version: ship.version, ship_name: ship.name.trim(), ship_description: ship.description,
    ship_owner: ship.owner_id, ship_crew: ship.crew_ids, ship_plan: ship.plan, private_notes: notes,
  })
  if (error) throw new Error(shipError(error))
  return normalizeShip(data as Ship)
}
