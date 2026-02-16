'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Character {
  id: string
  name: string
  user_id: string
}

interface FogPolygon {
  id: string
  character_id: string
  polygon: number[][]
  label: string
  is_active: boolean
}

interface FogControlsProps {
  isGM: boolean
  selectedCharacterId: string | null
  onSelectCharacter: (id: string | null) => void
  selectedPolygonId: string | null
  onSelectPolygon: (id: string | null) => void
  isEditing: boolean
  onToggleEditing: (editing: boolean) => void
  onClearPolygon: () => void
  onUndoPoint: () => void
}

export default function FogControls({
  isGM,
  selectedCharacterId,
  onSelectCharacter,
  selectedPolygonId,
  onSelectPolygon,
  isEditing,
  onToggleEditing,
  onClearPolygon,
  onUndoPoint
}: FogControlsProps) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [polygons, setPolygons] = useState<FogPolygon[]>([])
  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')

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

  // Fetch fog polygons for selected character
  useEffect(() => {
    if (!isGM || !selectedCharacterId) {
      setPolygons([])
      return
    }
    
    async function fetchPolygons() {
      const { data, error } = await supabase
        .from('player_fog_polygons')
        .select('*')
        .eq('character_id', selectedCharacterId)
        .order('label')
      
      if (error) {
        console.error('Error fetching polygons:', error)
        return
      }
      
      setPolygons(data || [])
    }
    
    fetchPolygons()
    
    // Subscribe to changes
    const subscription = supabase
      .channel('fog_controls_changes')
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'player_fog_polygons',
          filter: `character_id=eq.${selectedCharacterId}`
        },
        () => fetchPolygons()
      )
      .subscribe()
    
    return () => {
      subscription.unsubscribe()
    }
  }, [isGM, selectedCharacterId])

  // Auto-select first polygon when character changes
  useEffect(() => {
    if (polygons.length > 0 && !selectedPolygonId) {
      onSelectPolygon(polygons[0].id)
    } else if (polygons.length === 0) {
      onSelectPolygon(null)
    }
  }, [polygons, selectedPolygonId, onSelectPolygon])

  const handleCreatePolygon = async () => {
    if (!selectedCharacterId) return
    
    const polygonCount = polygons.length
    const label = `Area ${polygonCount + 1}`
    
    const { error } = await supabase
      .from('player_fog_polygons')
      .insert({
        character_id: selectedCharacterId,
        polygon: [],
        label,
        is_active: true
      })
    
    if (error) {
      console.error('Error creating polygon:', error)
      alert('Failed to create polygon')
    }
  }

  const handleDeletePolygon = async (polygonId: string) => {
    if (!confirm('Delete this fog polygon? This cannot be undone.')) return
    
    const { error } = await supabase
      .from('player_fog_polygons')
      .delete()
      .eq('id', polygonId)
    
    if (error) {
      console.error('Error deleting polygon:', error)
      alert('Failed to delete polygon')
    } else {
      // If we deleted the selected polygon, clear selection
      if (selectedPolygonId === polygonId) {
        onSelectPolygon(null)
        onToggleEditing(false)
      }
    }
  }

  const handleToggleActive = async (polygonId: string, currentState: boolean) => {
    const { error } = await supabase
      .from('player_fog_polygons')
      .update({ is_active: !currentState })
      .eq('id', polygonId)
    
    if (error) {
      console.error('Error toggling polygon:', error)
    }
  }

  const handleRenamePolygon = async (polygonId: string) => {
    if (!newLabel.trim()) return
    
    const { error } = await supabase
      .from('player_fog_polygons')
      .update({ label: newLabel.trim() })
      .eq('id', polygonId)
    
    if (error) {
      console.error('Error renaming polygon:', error)
    } else {
      setEditingLabel(null)
      setNewLabel('')
    }
  }

  const selectedPolygon = polygons.find(p => p.id === selectedPolygonId)

  if (!isGM) return null

  return (
    <div className="absolute top-4 right-4 z-[2100] bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 w-80 max-h-[90vh] overflow-y-auto">
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
            onSelectPolygon(null)
            onToggleEditing(false)
          }}
          className="w-full mt-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-red-500"
        >
          <option value="">-- None --</option>
          {characters.map(char => {
            const charPolygons = polygons.filter(p => p.character_id === char.id)
            const totalPoints = charPolygons.reduce((sum, p) => sum + (p.polygon?.length || 0), 0)
            return (
              <option key={char.id} value={char.id}>
                {char.name} {charPolygons.length > 0 ? `(${charPolygons.length} areas, ${totalPoints} pts)` : '(no fog)'}
              </option>
            )
          })}
        </select>
      </div>
      
      {/* Polygon List */}
      {selectedCharacterId && (
        <>
          <div className="pt-2 border-t border-gray-700 mb-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 uppercase tracking-wide">Fog Areas</label>
              <button
                onClick={handleCreatePolygon}
                className="px-2 py-1 rounded text-xs bg-green-600 text-white hover:bg-green-500 transition-colors"
                title="Create new fog polygon"
              >
                ➕ New Area
              </button>
            </div>
            
            {polygons.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No fog areas yet. Create one!</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {polygons.map(poly => (
                  <div
                    key={poly.id}
                    className={`p-2 rounded border transition-colors ${
                      selectedPolygonId === poly.id
                        ? 'bg-gray-700 border-red-500'
                        : 'bg-gray-750 border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      {editingLabel === poly.id ? (
                        <input
                          type="text"
                          value={newLabel}
                          onChange={(e) => setNewLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenamePolygon(poly.id)
                            if (e.key === 'Escape') {
                              setEditingLabel(null)
                              setNewLabel('')
                            }
                          }}
                          onBlur={() => handleRenamePolygon(poly.id)}
                          className="flex-1 bg-gray-600 text-white text-sm px-1 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setEditingLabel(poly.id)
                            setNewLabel(poly.label)
                          }}
                          className="flex-1 text-left text-sm font-medium text-white hover:text-gray-300 transition-colors"
                          title="Click to rename"
                        >
                          {poly.label}
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleToggleActive(poly.id, poly.is_active)}
                        className={`ml-2 text-xs px-2 py-0.5 rounded transition-colors ${
                          poly.is_active
                            ? 'bg-green-600 text-white hover:bg-green-500'
                            : 'bg-gray-600 text-gray-400 hover:bg-gray-500'
                        }`}
                        title={poly.is_active ? 'Active (click to disable)' : 'Disabled (click to enable)'}
                      >
                        {poly.is_active ? '👁️' : '🚫'}
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{(poly.polygon?.length || 0)} points</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            onSelectPolygon(poly.id)
                            onToggleEditing(false)
                          }}
                          className={`px-2 py-0.5 rounded transition-colors ${
                            selectedPolygonId === poly.id
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                          }`}
                        >
                          {selectedPolygonId === poly.id ? '✓ Selected' : 'Select'}
                        </button>
                        <button
                          onClick={() => handleDeletePolygon(poly.id)}
                          className="px-2 py-0.5 rounded bg-gray-600 text-red-400 hover:bg-red-600 hover:text-white transition-colors"
                          title="Delete polygon"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Edit Controls */}
      {selectedPolygonId && selectedPolygon && (
        <div className="space-y-2 pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-400 mb-2">
            <strong>Editing:</strong> {selectedPolygon.label}
          </div>
          
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
              <p className="mb-1">• <strong>Drag vertices</strong> to move</p>
              <p>• Points: {selectedPolygon.polygon?.length || 0}</p>
            </div>
          )}
          
          {(selectedPolygon.polygon?.length || 0) > 0 && (
            <>
              <button
                onClick={onUndoPoint}
                className="w-full px-3 py-1.5 rounded text-xs bg-gray-700 text-yellow-400 hover:bg-gray-600 transition-colors"
              >
                ↩️ Undo Last Point
              </button>
              
              <button
                onClick={onClearPolygon}
                className="w-full px-3 py-1.5 rounded text-xs bg-gray-700 text-red-400 hover:bg-gray-600 transition-colors"
              >
                🗑️ Clear All Points
              </button>
            </>
          )}
        </div>
      )}
      
      {!selectedCharacterId && (
        <p className="text-xs text-gray-500 italic">
          Select a character to manage their fog areas
        </p>
      )}
    </div>
  )
}
