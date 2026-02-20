'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Character {
  id: string
  name: string
  user_id: string
}

interface ActiveTravel {
  id: string
  character_id: string
  waypoints: { x: number; y: number }[]
  speed_mph: number
  started_at: string
  paused_at: string | null
  current_segment: number
  segment_progress: number
  status: 'active' | 'paused' | 'completed'
  character?: { name: string }
}

interface TravelControlsProps {
  isGM: boolean
  isPlanningTravel: boolean
  onTogglePlanning: (planning: boolean) => void
  travelWaypoints: { x: number; y: number }[]
  onClearWaypoints: () => void
  selectedCharacterId: string | null
  onSelectCharacter: (id: string | null) => void
  segmentDistances: number[]
  totalDistance: number
}

export default function TravelControls({
  isGM,
  isPlanningTravel,
  onTogglePlanning,
  travelWaypoints,
  onClearWaypoints,
  selectedCharacterId,
  onSelectCharacter,
  segmentDistances,
  totalDistance
}: TravelControlsProps) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [activeTravels, setActiveTravels] = useState<ActiveTravel[]>([])
  const [speedMph, setSpeedMph] = useState(3)  // Default walking speed
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})

  // Fetch characters
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
      
      if (data) setCharacters(data)
    }
    
    fetchCharacters()
  }, [isGM])

  // Fetch positions
  useEffect(() => {
    if (!isGM) return
    
    async function fetchPositions() {
      const { data } = await supabase
        .from('player_positions')
        .select('character_id, x, y')
      
      if (data) {
        const posMap: Record<string, { x: number; y: number }> = {}
        data.forEach(pos => {
          posMap[pos.character_id] = { x: pos.x, y: pos.y }
        })
        setPositions(posMap)
      }
    }
    
    fetchPositions()
  }, [isGM])

  // Fetch active travels
  useEffect(() => {
    if (!isGM) return
    
    async function fetchTravels() {
      const { data } = await supabase
        .from('active_travels')
        .select('*, character:characters(name)')
        .neq('status', 'completed')
      
      if (data) setActiveTravels(data as any)
    }
    
    fetchTravels()
    
    // Subscribe to changes
    const sub = supabase
      .channel('travel_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_travels' }, fetchTravels)
      .subscribe()
    
    return () => { sub.unsubscribe() }
  }, [isGM])

  // Convert distance to real-world miles (same scale as distance tool)
  const convertDistance = (mapDist: number) => {
    return (mapDist * 75 / 100)  // 100 map units = 75 miles
  }

  const realDistance = convertDistance(totalDistance)
  const travelTimeHours = speedMph > 0 ? realDistance / speedMph : 0

  // Start a new travel
  const startTravel = async () => {
    if (!selectedCharacterId || travelWaypoints.length < 1) {
      alert('Please select a character and plot a route with at least 1 waypoint')
      return
    }

    // Get current position or use first waypoint
    const currentPos = positions[selectedCharacterId]
    
    // Prepend current position if it exists
    const fullRoute = currentPos 
      ? [currentPos, ...travelWaypoints]
      : travelWaypoints

    const { error } = await supabase
      .from('active_travels')
      .insert({
        character_id: selectedCharacterId,
        waypoints: fullRoute,
        speed_mph: speedMph,
        status: 'active',
        current_segment: 0,
        segment_progress: 0,
      })

    if (error) {
      console.error('Error starting travel:', error)
      alert('Failed to start travel: ' + error.message)
    } else {
      onClearWaypoints()
      onTogglePlanning(false)
      alert('Travel started!')
    }
  }

  // Pause travel
  const pauseTravel = async (travelId: string) => {
    const { error } = await supabase
      .from('active_travels')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString()
      })
      .eq('id', travelId)

    if (error) console.error('Error pausing travel:', error)
  }

  // Resume travel
  const resumeTravel = async (travelId: string) => {
    // Get current travel data
    const { data: travel } = await supabase
      .from('active_travels')
      .select('started_at, paused_at')
      .eq('id', travelId)
      .single()
    
    if (!travel || !travel.paused_at) return
    
    // Calculate pause duration
    const pausedAt = new Date(travel.paused_at).getTime()
    const now = Date.now()
    const pauseDuration = now - pausedAt
    
    // Adjust started_at to account for pause (effectively "fast-forward" the start time)
    const originalStart = new Date(travel.started_at).getTime()
    const adjustedStart = new Date(originalStart + pauseDuration).toISOString()
    
    const { error } = await supabase
      .from('active_travels')
      .update({
        status: 'active',
        paused_at: null,
        started_at: adjustedStart  // Adjust start time to skip paused duration
      })
      .eq('id', travelId)

    if (error) console.error('Error resuming travel:', error)
  }

  // Stop travel (mark as completed and remove)
  const stopTravel = async (travelId: string) => {
    if (!confirm('Stop this travel? The character will stay at their current position.')) return

    const { error } = await supabase
      .from('active_travels')
      .delete()
      .eq('id', travelId)

    if (error) console.error('Error stopping travel:', error)
  }

  if (!isGM) return null

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-bold mb-3">🚶 Travel System</h3>

      {/* Active Travels */}
      {activeTravels.length > 0 && (
        <div className="mb-4 pb-4 border-b border-gray-700">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Active Travels:</h4>
          <div className="space-y-2">
            {activeTravels.map(travel => (
              <div key={travel.id} className="bg-gray-700 rounded p-2 text-xs">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-white">
                    {travel.character?.name || 'Unknown'}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    travel.status === 'active' ? 'bg-green-600' : 'bg-yellow-600'
                  }`}>
                    {travel.status}
                  </span>
                </div>
                <div className="text-gray-400 mb-2">
                  {travel.speed_mph} mph • Segment {travel.current_segment + 1}/{travel.waypoints.length - 1}
                </div>
                <div className="flex gap-1">
                  {travel.status === 'active' ? (
                    <button
                      onClick={() => pauseTravel(travel.id)}
                      className="flex-1 px-2 py-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-xs"
                    >
                      ⏸ Pause
                    </button>
                  ) : (
                    <button
                      onClick={() => resumeTravel(travel.id)}
                      className="flex-1 px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs"
                    >
                      ▶ Resume
                    </button>
                  )}
                  <button
                    onClick={() => stopTravel(travel.id)}
                    className="flex-1 px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs"
                  >
                    ⏹ Stop
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Travel Planning */}
      <div className="space-y-3">
        {/* Character selector */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Character:</label>
          <select
            value={selectedCharacterId || ''}
            onChange={(e) => onSelectCharacter(e.target.value || null)}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
            disabled={isPlanningTravel}
          >
            <option value="">-- Select Character --</option>
            {characters.map(char => (
              <option key={char.id} value={char.id}>
                {char.name} {positions[char.id] ? '📍' : '(no position)'}
              </option>
            ))}
          </select>
        </div>

        {/* Speed input */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Speed (mph):</label>
          <input
            type="number"
            value={speedMph}
            onChange={(e) => setSpeedMph(Number(e.target.value) || 3)}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
            min="0.1"
            step="0.5"
            disabled={isPlanningTravel}
          />
          <p className="text-xs text-gray-500 mt-1">
            Walking: ~3 mph • Horse: ~8 mph • Fast horse: ~15 mph
          </p>
        </div>

        {/* Planning toggle */}
        <button
          onClick={() => onTogglePlanning(!isPlanningTravel)}
          disabled={!selectedCharacterId}
          className={`w-full px-4 py-2 rounded font-medium transition-colors ${
            isPlanningTravel
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white disabled:bg-gray-800 disabled:text-gray-600'
          }`}
        >
          {isPlanningTravel ? '✓ Click Map to Plot Route' : 'Plan Travel Route'}
        </button>

        {/* Route info */}
        {travelWaypoints.length > 0 && (
          <div className="bg-gray-700 rounded p-2 text-xs space-y-1">
            {selectedCharacterId && positions[selectedCharacterId] && (
              <div className="text-blue-400 mb-1">
                📍 From current position
              </div>
            )}
            <div className="flex justify-between text-gray-300">
              <span>Stops:</span>
              <span className="font-medium">{travelWaypoints.length}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Total Distance:</span>
              <span className="font-medium">{realDistance.toFixed(1)} miles</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Travel Time:</span>
              <span className="font-medium">
                {travelTimeHours < 1 
                  ? `${(travelTimeHours * 60).toFixed(0)} min`
                  : `${travelTimeHours.toFixed(1)} hr`
                }
              </span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {isPlanningTravel && travelWaypoints.length >= 1 && (
          <div className="flex gap-2">
            <button
              onClick={startTravel}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-medium"
            >
              Start Travel
            </button>
            <button
              onClick={() => {
                onClearWaypoints()
                onTogglePlanning(false)
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
            >
              Cancel
            </button>
          </div>
        )}

        {isPlanningTravel && travelWaypoints.length === 0 && (
          <p className="text-xs text-gray-400 text-center">
            Click the map to plot your travel route
          </p>
        )}
      </div>
    </div>
  )
}
