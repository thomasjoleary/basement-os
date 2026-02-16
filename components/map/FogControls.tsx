'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Character {
  id: string
  name: string
  user_id: string
}

interface FogControlsProps {
  isGM: boolean
  selectedCharacterId: string | null
  onSelectCharacter: (id: string | null) => void
  isEditing: boolean
  onToggleEditing: (editing: boolean) => void
  onClearPolygon: () => void
  onUndoPoint: () => void
}

export default function FogControls({
  isGM,
  selectedCharacterId,
  onSelectCharacter,
  isEditing,
  onToggleEditing,
  onClearPolygon,
  onUndoPoint
}: FogControlsProps) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [fogData, setFogData] = useState<Record<string, number>>({})  // characterId -> point count

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

  // Fetch fog polygon point counts
  useEffect(() => {
    if (!isGM) return
    
    async function fetchFogData() {
      const { data } = await supabase
        .from('player_fog_polygons')
        .select('character_id, polygon')
      
      if (data) {
        const counts: Record<string, number> = {}
        data.forEach(fp => {
          const polygon = fp.polygon as number[][]
          counts[fp.character_id] = polygon?.length || 0
        })
        setFogData(counts)
      }
    }
    
    fetchFogData()
    
    // Subscribe to changes
    const subscription = supabase
      .channel('fog_controls_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'player_fog_polygons' },
        () => fetchFogData()
      )
      .subscribe()
    
    return () => {
      subscription.unsubscribe()
    }
  }, [isGM])

  if (!isGM) return null

  return (
    <div className="absolute top-4 right-4 z-[1000] bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 w-64">
      <h3 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wide flex items-center gap-2">
        🌫️ Fog of War
      </h3>
      
      {/* Character Selection */}
      <div className="mb-3">
        <label className="text-xs text-gray-500 uppercase tracking-wide">Select Character</label>
        <select
          value={selectedCharacterId || ''}
          onChange={(e) => {
            onSelectCharacter(e.target.value || null)
            onToggleEditing(false)
          }}
          className="w-full mt-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-red-500"
        >
          <option value="">-- None --</option>
          {characters.map(char => (
            <option key={char.id} value={char.id}>
              {char.name} {fogData[char.id] ? `(${fogData[char.id]} pts)` : '(no fog)'}
            </option>
          ))}
        </select>
      </div>
      
      {/* Edit Controls */}
      {selectedCharacterId && (
        <div className="space-y-2 pt-2 border-t border-gray-700">
          <button
            onClick={() => onToggleEditing(!isEditing)}
            className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors ${
              isEditing
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {isEditing ? '✓ Done Editing' : '✏️ Edit Polygon'}
          </button>
          
          {isEditing && (
            <div className="text-xs text-gray-400 bg-gray-900 p-2 rounded">
              <p className="mb-1">• <strong>Click map</strong> to add points</p>
              <p>• Points: {fogData[selectedCharacterId] || 0}</p>
            </div>
          )}
          
          {(fogData[selectedCharacterId] || 0) > 0 && (
            <button
              onClick={onUndoPoint}
              className="w-full px-3 py-1.5 rounded text-xs bg-gray-700 text-yellow-400 hover:bg-gray-600 transition-colors"
            >
              ↩️ Undo Last Point
            </button>
          )}
          
          <button
            onClick={onClearPolygon}
            className="w-full px-3 py-1.5 rounded text-xs bg-gray-700 text-red-400 hover:bg-gray-600 transition-colors"
          >
            🗑️ Clear Polygon
          </button>
        </div>
      )}
      
      {!selectedCharacterId && (
        <p className="text-xs text-gray-500 italic">
          Select a character to edit their visible map area
        </p>
      )}
    </div>
  )
}
