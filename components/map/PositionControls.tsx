'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Character {
  id: string
  name: string
  user_id: string
}

interface PositionControlsProps {
  isGM: boolean
  selectedCharacterId: string | null
  onSelectCharacter: (id: string | null) => void
  isPlacing: boolean
  onTogglePlacing: (placing: boolean) => void
}

export default function PositionControls({
  isGM,
  selectedCharacterId,
  onSelectCharacter,
  isPlacing,
  onTogglePlacing
}: PositionControlsProps) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [positions, setPositions] = useState<Record<string, { x: number; y: number; location_name?: string }>>({})

  // Fetch main characters (not tames, not NPCs, alive)
  useEffect(() => {
    if (!isGM) return
    
    async function fetchCharacters() {
      const { data } = await supabase
        .from('characters')
        .select('id, name, user_id')
        .eq('is_tame', false)
        .eq('is_npc', false)
        .eq('is_dead', false)
        .order('name')
      
      if (data) {
        setCharacters(data)
      }
    }
    
    fetchCharacters()
  }, [isGM])

  // Fetch player positions
  useEffect(() => {
    if (!isGM) return
    
    async function fetchPositions() {
      const { data } = await supabase
        .from('player_positions')
        .select('character_id, x, y, location_name')
      
      if (data) {
        const posMap: Record<string, { x: number; y: number; location_name?: string }> = {}
        data.forEach(pos => {
          posMap[pos.character_id] = {
            x: pos.x,
            y: pos.y,
            location_name: pos.location_name || undefined
          }
        })
        setPositions(posMap)
      }
    }
    
    fetchPositions()
    
    // Subscribe to changes
    const subscription = supabase
      .channel('position_controls_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'player_positions' },
        () => fetchPositions()
      )
      .subscribe()
    
    return () => {
      subscription.unsubscribe()
    }
  }, [isGM])

  if (!isGM) return null

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-bold mb-3">Player Positions</h3>
      
      {/* Character selector */}
      <div className="mb-3">
        <label className="block text-sm text-gray-300 mb-1">Select Character:</label>
        <select
          value={selectedCharacterId || ''}
          onChange={(e) => onSelectCharacter(e.target.value || null)}
          className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
        >
          <option value="">-- None --</option>
          {characters.map(char => (
            <option key={char.id} value={char.id}>
              {char.name} {positions[char.id] ? '📍' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Placement toggle */}
      {selectedCharacterId && (
        <div className="mb-3">
          <button
            onClick={() => onTogglePlacing(!isPlacing)}
            className={`w-full px-4 py-2 rounded font-medium transition-colors ${
              isPlacing
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isPlacing ? '✓ Click Map to Place' : 'Set Position'}
          </button>
          <p className="text-xs text-gray-400 mt-1 text-center">
            {isPlacing ? 'Click anywhere on the map' : 'Click to start placing'}
          </p>
        </div>
      )}

      {/* Position info */}
      {selectedCharacterId && positions[selectedCharacterId] && (
        <div className="bg-gray-700 rounded p-2 text-xs">
          <p className="text-gray-300">
            <span className="font-medium">Current Position:</span>
          </p>
          <p className="text-gray-400 font-mono">
            X: {(positions[selectedCharacterId].x * 100).toFixed(1)}%, 
            Y: {(positions[selectedCharacterId].y * 100).toFixed(1)}%
          </p>
          {positions[selectedCharacterId].location_name && (
            <p className="text-gray-400 mt-1">
              📍 {positions[selectedCharacterId].location_name}
            </p>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <p className="text-xs text-gray-400">
          {Object.keys(positions).length} / {characters.length} positioned
        </p>
      </div>
    </div>
  )
}
