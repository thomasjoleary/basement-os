'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { useTravelAnimation } from './useTravelAnimation'

// Import LeafletMap dynamically to avoid SSR issues
const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-900">
      <p className="text-white text-xl animate-pulse">Loading map...</p>
    </div>
  ),
})

// Import FogControls dynamically
const FogControls = dynamic(() => import('./FogControls'), { ssr: false })

// Import PositionControls dynamically
const PositionControls = dynamic(() => import('./PositionControls'), { ssr: false })

// Import DistanceTool dynamically
const DistanceTool = dynamic(() => import('./DistanceTool'), { ssr: false })

// Import TravelControls dynamically
const TravelControls = dynamic(() => import('./TravelControls'), { ssr: false })

interface MapViewerProps {
  isGM: boolean
}

// Biome data for lookup
const BIOMES = [
  { id: 0, name: 'Marine', color: '#466eab' },
  { id: 1, name: 'Hot desert', color: '#fbe79f' },
  { id: 2, name: 'Cold desert', color: '#b5b887' },
  { id: 3, name: 'Savanna', color: '#d2d082' },
  { id: 4, name: 'Grassland', color: '#c8d68f' },
  { id: 5, name: 'Tropical seasonal forest', color: '#b6d95d' },
  { id: 6, name: 'Temperate deciduous forest', color: '#29bc56' },
  { id: 7, name: 'Tropical rainforest', color: '#7dcb35' },
  { id: 8, name: 'Temperate rainforest', color: '#409c43' },
  { id: 9, name: 'Taiga', color: '#4b6b32' },
  { id: 10, name: 'Tundra', color: '#96784b' },
  { id: 11, name: 'Glacier', color: '#d5e7eb' },
  { id: 12, name: 'Wetland', color: '#0b9131' },
]

// Marker type definitions with icons
const MARKER_TYPES = [
  { type: 'city', label: 'Cities', icon: '🏰' },
  { type: 'town', label: 'Towns', icon: '🏘️' },
  { type: 'volcanoes', label: 'Volcanoes', icon: '🌋' },
  { type: 'hot-springs', label: 'Hot Springs', icon: '♨️' },
  { type: 'water-sources', label: 'Water Sources', icon: '💧' },
  { type: 'dungeon', label: 'Dungeons', icon: '💀' },
]

export default function MapViewer({ isGM }: MapViewerProps) {
  const [showBiomes, setShowBiomes] = useState(false)
  const [showLegend, setShowLegend] = useState(false)
  const [showMarkers, setShowMarkers] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [markerFilters, setMarkerFilters] = useState<string[]>([])  // Empty = show all
  const [hoveredBiome, setHoveredBiome] = useState<number | null>(null)
  const [selectedMarker, setSelectedMarker] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editDescription, setEditDescription] = useState('')
  
  // Fog of War state
  const [showFog, setShowFog] = useState(true)
  const [selectedFogCharacter, setSelectedFogCharacter] = useState<string | null>(null)
  const [isFogEditing, setIsFogEditing] = useState(false)
  
  // Player Positions state
  const [showPositions, setShowPositions] = useState(true)
  const [selectedPositionCharacter, setSelectedPositionCharacter] = useState<string | null>(null)
  const [isPositionPlacing, setIsPositionPlacing] = useState(false)
  
  // Distance Tool state
  const [isDistanceMeasuring, setIsDistanceMeasuring] = useState(false)
  const [distanceWaypoints, setDistanceWaypoints] = useState<{ x: number; y: number }[]>([])
  
  // Travel System state
  const [isPlanningTravel, setIsPlanningTravel] = useState(false)
  const [travelWaypoints, setTravelWaypoints] = useState<{ x: number; y: number }[]>([])
  const [selectedTravelCharacter, setSelectedTravelCharacter] = useState<string | null>(null)
  const [activeTravels, setActiveTravels] = useState<any[]>([])
  
  // Marker creation state (GM only)
  const [isMarkerCreating, setIsMarkerCreating] = useState(false)
  const [createMarkerPos, setCreateMarkerPos] = useState<{ x: number, y: number } | null>(null)
  const [newMarkerName, setNewMarkerName] = useState('')
  const [newMarkerType, setNewMarkerType] = useState('city')
  const [newMarkerIcon, setNewMarkerIcon] = useState('🏰')
  
  // Marker editing state
  const [editIcon, setEditIcon] = useState('')
  const [isEditingIcon, setIsEditingIcon] = useState(false)
  
  // Marker refresh trigger
  const [markerRefresh, setMarkerRefresh] = useState(0)
  
  // Player visibility management (GM only)
  const [playerCharacters, setPlayerCharacters] = useState<any[]>([])
  const [markerVisibility, setMarkerVisibility] = useState<Set<string>>(new Set())
  const [showVisibilityPanel, setShowVisibilityPanel] = useState(false)
  
  // Auto-visible types don't need visibility management
  const AUTO_VISIBLE_TYPES = ['city', 'town']
  
  // Icon suggestions by type
  const ICON_SUGGESTIONS: Record<string, string[]> = {
    'city': ['🏰', '🏛️', '⛪', '🕌', '🗼'],
    'town': ['🏘️', '🏠', '🏚️', '⛺', '🛖'],
    'volcanoes': ['🌋', '🔥', '💥', '⛰️'],
    'hot-springs': ['♨️', '💨', '🧖', '💧'],
    'water-sources': ['💧', '🌊', '💦', '🏞️', '⛲'],
    'dungeon': ['🏚️', '💀', '⚔️', '🗝️', '🚪'],
  }
  
  // Fetch player characters for visibility management (GM only)
  useEffect(() => {
    if (!isGM) return
    
    async function fetchPlayers() {
      const { data } = await supabase
        .from('characters')
        .select('id, name, user_id')
        .eq('is_tame', false)
        .eq('is_npc', false)
        .eq('is_dead', false)
      
      setPlayerCharacters(data || [])
    }
    
    fetchPlayers()
  }, [isGM])
  
  // Fetch visibility for selected marker
  useEffect(() => {
    if (!selectedMarker || !isGM) {
      setMarkerVisibility(new Set())
      setShowVisibilityPanel(false)
      return
    }
    
    async function fetchVisibility() {
      const { data } = await supabase
        .from('player_marker_visibility')
        .select('character_id')
        .eq('marker_id', selectedMarker.id)
      
      setMarkerVisibility(new Set(data?.map(v => v.character_id) || []))
    }
    
    fetchVisibility()
  }, [selectedMarker, isGM])
  
  // Fetch active travels
  useEffect(() => {
    if (!isGM) return
    
    async function fetchTravels() {
      const { data } = await supabase
        .from('active_travels')
        .select('*, character:characters(name)')
        .neq('status', 'completed')
      
      if (data) setActiveTravels(data)
    }
    
    fetchTravels()
    
    // Subscribe to changes
    const sub = supabase
      .channel('map_travel_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_travels' }, fetchTravels)
      .subscribe()
    
    return () => { sub.unsubscribe() }
  }, [isGM])
  
  // Animate active travels (GM only)
  useTravelAnimation(isGM, activeTravels.length > 0)
  
  // Calculate distance between two points (in map units)
  const calculateDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    // Use Pythagorean theorem on normalized coordinates
    // Multiply by map dimensions to get actual distance
    const dx = (p2.x - p1.x) * 1707  // MAP_WIDTH
    const dy = (p2.y - p1.y) * 993   // MAP_HEIGHT
    return Math.sqrt(dx * dx + dy * dy)
  }
  
  // Calculate segment distances
  const segmentDistances = distanceWaypoints.length > 1
    ? distanceWaypoints.slice(1).map((wp, i) => 
        calculateDistance(distanceWaypoints[i], wp)
      )
    : []
  
  // Calculate total distance
  const totalDistance = segmentDistances.reduce((sum, dist) => sum + dist, 0)
  
  // Calculate travel route distances (including current position if character is selected)
  const getTravelRouteWithPosition = () => {
    if (travelWaypoints.length === 0) return []
    
    // Check if selected character has a position
    if (selectedTravelCharacter && playerCharacters.length > 0) {
      // We need to fetch the position - but we don't have direct access here
      // Instead, let's calculate it in the component that has positions
      // For now, return waypoints as-is and we'll fix this properly
    }
    
    return travelWaypoints
  }
  
  const [currentTravelPosition, setCurrentTravelPosition] = useState<{ x: number; y: number } | null>(null)
  
  // Fetch current position for selected travel character
  useEffect(() => {
    if (!selectedTravelCharacter) {
      setCurrentTravelPosition(null)
      return
    }
    
    async function fetchPosition() {
      const { data } = await supabase
        .from('player_positions')
        .select('x, y')
        .eq('character_id', selectedTravelCharacter)
        .single()
      
      setCurrentTravelPosition(data || null)
    }
    
    fetchPosition()
  }, [selectedTravelCharacter])
  
  // Build full travel route including current position
  const fullTravelRoute = currentTravelPosition && travelWaypoints.length > 0
    ? [currentTravelPosition, ...travelWaypoints]
    : travelWaypoints
  
  // Calculate travel route distances
  const travelSegmentDistances = fullTravelRoute.length > 1
    ? fullTravelRoute.slice(1).map((wp, i) => 
        calculateDistance(fullTravelRoute[i], wp)
      )
    : []
  
  const travelTotalDistance = travelSegmentDistances.reduce((sum, dist) => sum + dist, 0)

  return (
    <div className="relative w-full h-[calc(100vh-73px)]">
      {/* Controls */}
      <div className="absolute top-4 left-4 z-[1000] bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="markers"
            checked={showMarkers}
            onChange={(e) => setShowMarkers(e.target.checked)}
            className="w-4 h-4 accent-red-600 cursor-pointer"
          />
          <label htmlFor="markers" className="text-sm font-medium cursor-pointer select-none">
            Show Markers
          </label>
        </div>
        
        {showMarkers && (
          <div className="flex items-center gap-2 pl-4">
            <input
              type="checkbox"
              id="filters"
              checked={showFilters}
              onChange={(e) => setShowFilters(e.target.checked)}
              className="w-4 h-4 accent-red-600 cursor-pointer"
            />
            <label htmlFor="filters" className="text-sm font-medium cursor-pointer select-none">
              Filter Types
            </label>
          </div>
        )}
        
        {showMarkers && showFilters && (
          <div className="pl-4 space-y-1 max-h-40 overflow-y-auto border-l-2 border-gray-700 ml-2">
            {MARKER_TYPES.map(({ type, label, icon }) => (
              <div key={type} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`filter-${type}`}
                  checked={markerFilters.length === 0 || markerFilters.includes(type)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      // If was filtering, add this type
                      if (markerFilters.length > 0) {
                        setMarkerFilters([...markerFilters, type])
                      }
                    } else {
                      // Start filtering, or remove this type
                      if (markerFilters.length === 0) {
                        // First uncheck - filter to everything except this
                        setMarkerFilters(MARKER_TYPES.filter(t => t.type !== type).map(t => t.type))
                      } else {
                        setMarkerFilters(markerFilters.filter(t => t !== type))
                      }
                    }
                  }}
                  className="w-3 h-3 accent-red-600 cursor-pointer"
                />
                <label htmlFor={`filter-${type}`} className="text-xs cursor-pointer select-none flex items-center gap-1">
                  <span>{icon}</span> {label}
                </label>
              </div>
            ))}
            {markerFilters.length > 0 && (
              <button
                onClick={() => setMarkerFilters([])}
                className="text-xs text-red-400 hover:text-red-300 mt-1"
              >
                Reset filters
              </button>
            )}
          </div>
        )}
        
        {/* Fog toggle - GM only (players always have fog enabled) */}
        {isGM && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="fog"
              checked={showFog}
              onChange={(e) => setShowFog(e.target.checked)}
              className="w-4 h-4 accent-red-600 cursor-pointer"
            />
            <label htmlFor="fog" className="text-sm font-medium cursor-pointer select-none">
              Show Fog
            </label>
          </div>
        )}
        
        {/* Player Positions toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="positions"
            checked={showPositions}
            onChange={(e) => setShowPositions(e.target.checked)}
            className="w-4 h-4 accent-red-600 cursor-pointer"
          />
          <label htmlFor="positions" className="text-sm font-medium cursor-pointer select-none">
            Show Positions
          </label>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="biomes"
            checked={showBiomes}
            onChange={(e) => setShowBiomes(e.target.checked)}
            className="w-4 h-4 accent-red-600 cursor-pointer"
          />
          <label htmlFor="biomes" className="text-sm font-medium cursor-pointer select-none">
            Show Biomes
          </label>
        </div>
        
        {showBiomes && (
          <div className="flex items-center gap-2 pl-4">
            <input
              type="checkbox"
              id="legend"
              checked={showLegend}
              onChange={(e) => setShowLegend(e.target.checked)}
              className="w-4 h-4 accent-red-600 cursor-pointer"
            />
            <label htmlFor="legend" className="text-sm font-medium cursor-pointer select-none">
              Show Legend
            </label>
          </div>
        )}
        
        {/* GM: Add Marker button */}
        {isGM && (
          <div className="pt-2 border-t border-gray-700 mt-2">
            <button
              onClick={() => {
                const newState = !isMarkerCreating
                setIsMarkerCreating(newState)
                if (isMarkerCreating) {
                  setCreateMarkerPos(null)
                }
                // Auto-exit other modes when entering marker creation
                if (newState) {
                  setIsFogEditing(false)
                  setIsPositionPlacing(false)
                  setIsDistanceMeasuring(false)
                }
              }}
              className={`w-full px-3 py-1.5 text-sm rounded font-medium transition ${
                isMarkerCreating
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              }`}
            >
              {isMarkerCreating ? '✓ Click Map to Place' : '+ Add Marker'}
            </button>
          </div>
        )}
      </div>

      {/* Zoom Instructions */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-gray-800/90 border border-gray-700 rounded-lg px-4 py-2 text-xs text-gray-400">
        <span className="font-bold text-gray-300">Controls:</span> Scroll to zoom • Drag to pan
      </div>

      {/* Hovered Biome Display */}
      {showBiomes && hoveredBiome !== null && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[1000] bg-gray-800/95 border border-gray-600 rounded-lg px-4 py-2 flex items-center gap-3">
          <div 
            className="w-5 h-5 rounded border border-gray-500"
            style={{ backgroundColor: BIOMES[hoveredBiome]?.color || '#000' }}
          />
          <span className="text-sm font-medium text-white">
            {BIOMES[hoveredBiome]?.name || 'Unknown'}
          </span>
        </div>
      )}

      {/* Selected Marker Popup */}
      {selectedMarker && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1001] bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-4 min-w-[300px] max-w-[400px]">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              {/* Icon - clickable for GM to edit */}
              {isGM && isEditingIcon ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editIcon}
                    onChange={(e) => setEditIcon(e.target.value)}
                    className="w-12 text-center text-2xl bg-gray-700 border border-gray-600 rounded"
                    autoFocus
                  />
                  <button
                    onClick={async () => {
                      const { error } = await supabase
                        .from('map_markers')
                        .update({ icon: editIcon || '📍' })
                        .eq('id', selectedMarker.id)
                      
                      if (!error) {
                        setSelectedMarker({ ...selectedMarker, icon: editIcon || '📍' })
                        setIsEditingIcon(false)
                        setMarkerRefresh(r => r + 1)
                      }
                    }}
                    className="text-green-400 hover:text-green-300"
                  >✓</button>
                  <button
                    onClick={() => setIsEditingIcon(false)}
                    className="text-gray-400 hover:text-gray-300"
                  >✗</button>
                </div>
              ) : (
                <span 
                  className={`text-2xl ${isGM ? 'cursor-pointer hover:opacity-70' : ''}`}
                  onClick={() => {
                    if (isGM) {
                      setEditIcon(selectedMarker.icon || '📍')
                      setIsEditingIcon(true)
                    }
                  }}
                  title={isGM ? 'Click to change icon' : undefined}
                >
                  {selectedMarker.icon || '📍'}
                </span>
              )}
              <h3 className="text-lg font-bold text-white">{selectedMarker.name}</h3>
            </div>
            <button 
              onClick={() => { setSelectedMarker(null); setIsEditing(false); setIsEditingIcon(false); }}
              className="text-gray-400 hover:text-white text-xl leading-none"
            >
              ×
            </button>
          </div>
          
          {/* Icon suggestions for GM */}
          {isGM && isEditingIcon && ICON_SUGGESTIONS[selectedMarker.type] && (
            <div className="flex gap-1 mb-2 flex-wrap">
              {ICON_SUGGESTIONS[selectedMarker.type].map(icon => (
                <button
                  key={icon}
                  onClick={() => setEditIcon(icon)}
                  className={`text-xl p-1 rounded hover:bg-gray-700 ${editIcon === icon ? 'bg-gray-700' : ''}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          )}
          
          <div className="text-sm text-gray-400 mb-2 capitalize">{selectedMarker.type.replace(/-/g, ' ')}</div>
          
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Enter description..."
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const { error } = await supabase
                      .from('map_markers')
                      .update({ description: editDescription || null })
                      .eq('id', selectedMarker.id)
                    
                    if (!error) {
                      setSelectedMarker({ ...selectedMarker, description: editDescription || null })
                      setIsEditing(false)
                    } else {
                      console.error('Error updating marker:', error)
                      alert('Failed to save. Make sure you have GM permissions.')
                    }
                  }}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded"
                >
                  Save
                </button>
                <button
                  onClick={() => { setIsEditing(false); setEditDescription(selectedMarker.description || '') }}
                  className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {selectedMarker.description ? (
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedMarker.description}</p>
              ) : (
                <p className="text-sm text-gray-500 italic">No description</p>
              )}
              
              {isGM && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => { setIsEditing(true); setEditDescription(selectedMarker.description || '') }}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    ✏️ Edit description
                  </button>
                </div>
              )}
            </>
          )}
          
          {/* GM: Player visibility management (only for non-auto-visible types) */}
          {isGM && !isEditing && !AUTO_VISIBLE_TYPES.includes(selectedMarker.type) && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <button
                onClick={() => setShowVisibilityPanel(!showVisibilityPanel)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                👁️ Player Visibility ({markerVisibility.size})
                <span className="text-gray-500">{showVisibilityPanel ? '▼' : '▶'}</span>
              </button>
              
              {showVisibilityPanel && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {playerCharacters.length === 0 ? (
                    <p className="text-xs text-gray-500">No player characters found</p>
                  ) : (
                    playerCharacters.map(char => (
                      <label key={char.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-700 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={markerVisibility.has(char.id)}
                          onChange={async (e) => {
                            if (e.target.checked) {
                              // Grant visibility
                              const { error } = await supabase
                                .from('player_marker_visibility')
                                .insert({
                                  character_id: char.id,
                                  marker_id: selectedMarker.id,
                                })
                              
                              if (!error) {
                                setMarkerVisibility(new Set([...markerVisibility, char.id]))
                              }
                            } else {
                              // Revoke visibility
                              const { error } = await supabase
                                .from('player_marker_visibility')
                                .delete()
                                .eq('character_id', char.id)
                                .eq('marker_id', selectedMarker.id)
                              
                              if (!error) {
                                const newSet = new Set(markerVisibility)
                                newSet.delete(char.id)
                                setMarkerVisibility(newSet)
                              }
                            }
                          }}
                          className="w-3 h-3 accent-blue-500"
                        />
                        <span className="text-gray-300">{char.name}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Note for auto-visible types */}
          {isGM && !isEditing && AUTO_VISIBLE_TYPES.includes(selectedMarker.type) && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <p className="text-xs text-gray-500 italic">
                ℹ️ {selectedMarker.type === 'city' ? 'Cities' : 'Towns'} are auto-visible to players within their fog area
              </p>
            </div>
          )}
          
          {/* GM footer with ID and delete */}
          {isGM && !isEditing && (
            <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between items-center">
              <div className="text-xs text-gray-500">
                ID: {selectedMarker.id?.slice(0, 8)}...
                {!selectedMarker.is_visible && (
                  <span className="ml-2 text-yellow-500">(Hidden)</span>
                )}
              </div>
              <button
                onClick={async () => {
                  if (confirm(`Delete marker "${selectedMarker.name}"?`)) {
                    const { error } = await supabase
                      .from('map_markers')
                      .delete()
                      .eq('id', selectedMarker.id)
                    
                    if (!error) {
                      setSelectedMarker(null)
                      setMarkerRefresh(r => r + 1)
                    } else {
                      console.error('Error deleting marker:', error)
                      alert('Failed to delete.')
                    }
                  }
                }}
                className="text-xs text-red-500 hover:text-red-400"
              >
                🗑️ Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* Distance Tool (GM and Players) */}
      <div className="absolute top-4 right-4 z-[1000] w-64">
        <DistanceTool
          isActive={isDistanceMeasuring}
          onToggle={(active) => {
            setIsDistanceMeasuring(active)
            if (!active) {
              setDistanceWaypoints([])  // Clear waypoints when deactivating
            }
            // Auto-exit other modes
            if (active) {
              setIsFogEditing(false)
              setIsPositionPlacing(false)
              setIsMarkerCreating(false)
            }
          }}
          waypoints={distanceWaypoints}
          onClearWaypoints={() => setDistanceWaypoints([])}
          onUndoLastWaypoint={() => setDistanceWaypoints(prev => prev.slice(0, -1))}
          onUpdateWaypoint={(index, x, y) => {
            setDistanceWaypoints(prev => {
              const updated = [...prev]
              updated[index] = { x, y }
              return updated
            })
          }}
          totalDistance={totalDistance}
          segmentDistances={segmentDistances}
        />
      </div>

      {/* GM Travel Controls */}
      {isGM && (
        <div className="absolute bottom-4 left-4 z-[1000] w-80">
          <TravelControls
            isGM={isGM}
            isPlanningTravel={isPlanningTravel}
            onTogglePlanning={(planning) => {
              setIsPlanningTravel(planning)
              if (!planning) {
                setTravelWaypoints([])
              }
              // Auto-exit other modes
              if (planning) {
                setIsFogEditing(false)
                setIsPositionPlacing(false)
                setIsMarkerCreating(false)
                setIsDistanceMeasuring(false)
              }
            }}
            travelWaypoints={travelWaypoints}
            onClearWaypoints={() => setTravelWaypoints([])}
            selectedCharacterId={selectedTravelCharacter}
            onSelectCharacter={setSelectedTravelCharacter}
            segmentDistances={travelSegmentDistances}
            totalDistance={travelTotalDistance}
          />
        </div>
      )}

      {/* GM Position Controls */}
      {isGM && (
        <div className="absolute bottom-4 right-4 z-[1000] w-64">
          <PositionControls
            isGM={isGM}
            selectedCharacterId={selectedPositionCharacter}
            onSelectCharacter={(id) => {
              setSelectedPositionCharacter(id)
              setIsPositionPlacing(false)  // Reset placement mode when changing character
            }}
            isPlacing={isPositionPlacing}
            onTogglePlacing={(placing) => {
              setIsPositionPlacing(placing)
              // Auto-exit other modes when entering position placement
              if (placing) {
                setIsFogEditing(false)
                setIsDistanceMeasuring(false)
                setIsMarkerCreating(false)
              }
            }}
          />
        </div>
      )}

      {/* GM Fog Controls - only show when fog is enabled */}
      {isGM && showFog && (
        <div className="absolute top-80 left-4 z-[1000] w-64">
          <FogControls
            isGM={isGM}
            selectedCharacterId={selectedFogCharacter}
            onSelectCharacter={(id) => {
              setSelectedFogCharacter(id)
              setIsFogEditing(false)  // Reset editing when changing character
            }}
            isEditing={isFogEditing}
            onToggleEditing={(editing) => {
              setIsFogEditing(editing)
              // Auto-exit other modes when entering fog editing
              if (editing) {
                setIsPositionPlacing(false)
                setIsDistanceMeasuring(false)
                setIsMarkerCreating(false)
              }
            }}
            onClearPolygon={async () => {
            if (selectedFogCharacter && confirm('Clear this character\'s fog polygon?')) {
              await supabase
                .from('player_fog_polygons')
                .delete()
                .eq('character_id', selectedFogCharacter)
              // Force a page-level state refresh by toggling fog
              setShowFog(false)
              setTimeout(() => setShowFog(true), 50)
            }
          }}
          onUndoPoint={async () => {
            if (!selectedFogCharacter) return
            
            // Get current polygon
            const { data } = await supabase
              .from('player_fog_polygons')
              .select('id, polygon')
              .eq('character_id', selectedFogCharacter)
              .single()
            
            if (data && data.polygon && data.polygon.length > 0) {
              const newPoints = data.polygon.slice(0, -1)  // Remove last point
              
              if (newPoints.length === 0) {
                await supabase
                  .from('player_fog_polygons')
                  .delete()
                  .eq('id', data.id)
              } else {
                await supabase
                  .from('player_fog_polygons')
                  .update({ polygon: newPoints })
                  .eq('id', data.id)
              }
              
              // Force refresh
              setShowFog(false)
              setTimeout(() => setShowFog(true), 50)
            }
          }}
          />
        </div>
      )}

      {/* Create Marker Modal */}
      {createMarkerPos && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1001] bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-4 min-w-[320px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white">Create Marker</h3>
            <button 
              onClick={() => {
                setCreateMarkerPos(null)
                setNewMarkerName('')
                setNewMarkerType('city')
                setNewMarkerIcon('🏰')
              }}
              className="text-gray-400 hover:text-white text-xl leading-none"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-3">
            {/* Name */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={newMarkerName}
                onChange={(e) => setNewMarkerName(e.target.value)}
                placeholder="Marker name..."
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                autoFocus
              />
            </div>
            
            {/* Type */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type</label>
              <select
                value={newMarkerType}
                onChange={(e) => {
                  setNewMarkerType(e.target.value)
                  // Update icon suggestion based on type
                  const typeIcons: Record<string, string> = {
                    city: '🏰', town: '🏘️', volcanoes: '🌋', 
                    'hot-springs': '♨️', 'water-sources': '💧', dungeon: '💀'
                  }
                  setNewMarkerIcon(typeIcons[e.target.value] || '📍')
                }}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
              >
                {MARKER_TYPES.map(({ type, label, icon }) => (
                  <option key={type} value={type}>{icon} {label}</option>
                ))}
              </select>
            </div>
            
            {/* Icon */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Icon</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMarkerIcon}
                  onChange={(e) => setNewMarkerIcon(e.target.value)}
                  className="w-16 text-center text-2xl bg-gray-700 border border-gray-600 rounded py-1"
                />
                {ICON_SUGGESTIONS[newMarkerType] && (
                  <div className="flex gap-1">
                    {ICON_SUGGESTIONS[newMarkerType].map(icon => (
                      <button
                        key={icon}
                        onClick={() => setNewMarkerIcon(icon)}
                        className={`text-xl p-1 rounded hover:bg-gray-700 ${newMarkerIcon === icon ? 'bg-gray-700' : ''}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Position info */}
            <div className="text-xs text-gray-500">
              Position: ({(createMarkerPos.x * 100).toFixed(1)}%, {(createMarkerPos.y * 100).toFixed(1)}%)
            </div>
            
            {/* Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  if (!newMarkerName.trim()) {
                    alert('Please enter a name')
                    return
                  }
                  
                  const { error } = await supabase
                    .from('map_markers')
                    .insert({
                      x: createMarkerPos.x,
                      y: createMarkerPos.y,
                      name: newMarkerName.trim(),
                      type: newMarkerType,
                      icon: newMarkerIcon,
                      is_visible: true,
                    })
                  
                  if (!error) {
                    setCreateMarkerPos(null)
                    setNewMarkerName('')
                    setIsMarkerCreating(false)
                    setMarkerRefresh(r => r + 1)
                  } else {
                    console.error('Error creating marker:', error)
                    alert('Failed to create marker.')
                  }
                }}
                className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded font-medium"
              >
                Create Marker
              </button>
              <button
                onClick={() => {
                  setCreateMarkerPos(null)
                  setNewMarkerName('')
                }}
                className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaflet Map */}
      <LeafletMap 
        isGM={isGM} 
        showBiomes={showBiomes} 
        showLegend={showLegend}
        showMarkers={showMarkers}
        markerFilters={markerFilters}
        showFog={isGM ? showFog : true}  // Players always have fog enabled
        selectedFogCharacter={selectedFogCharacter}
        isFogEditing={isFogEditing}
        isMarkerCreating={isMarkerCreating}
        showPositions={showPositions}
        selectedPositionCharacter={selectedPositionCharacter}
        isPositionPlacing={isPositionPlacing}
        isDistanceMeasuring={isDistanceMeasuring}
        distanceWaypoints={distanceWaypoints}
        onDistanceWaypointDrag={(index, x, y) => {
          setDistanceWaypoints(prev => {
            const updated = [...prev]
            updated[index] = { x, y }
            return updated
          })
        }}
        isPlanningTravel={isPlanningTravel}
        travelWaypoints={travelWaypoints}
        travelCurrentPosition={currentTravelPosition}
        activeTravels={activeTravels}
        onBiomeHover={setHoveredBiome}
        onMarkerClick={setSelectedMarker}
        onMapClick={(x, y) => {
          if (isMarkerCreating) {
            setCreateMarkerPos({ x, y })
          } else if (isPositionPlacing) {
            setIsPositionPlacing(false)  // Exit placement mode after placing
          } else if (isDistanceMeasuring) {
            setDistanceWaypoints(prev => [...prev, { x, y }])  // Add waypoint
          } else if (isPlanningTravel) {
            setTravelWaypoints(prev => [...prev, { x, y }])  // Add travel waypoint
          }
        }}
        key={markerRefresh}  // Force refresh when markers change
      />
    </div>
  )
}
