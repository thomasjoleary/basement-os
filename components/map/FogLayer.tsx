'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface FogPolygon {
  id: string
  character_id: string
  polygon: number[][]  // Array of [x, y] normalized coordinates
  character?: {
    id: string
    name: string
    user_id: string
  }
}

interface FogLayerProps {
  map: any
  L: any
  isGM: boolean
  userId: string | null
  mapWidth: number
  mapHeight: number
  selectedCharacterId: string | null
  isEditing: boolean
  onPolygonUpdate?: () => void
}

// Generate a color for each character (for GM view)
function getCharacterColor(index: number): string {
  const colors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', 
    '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'
  ]
  return colors[index % colors.length]
}

export default function FogLayer({
  map,
  L,
  isGM,
  userId,
  mapWidth,
  mapHeight,
  selectedCharacterId,
  isEditing,
  onPolygonUpdate
}: FogLayerProps) {
  const [fogPolygons, setFogPolygons] = useState<FogPolygon[]>([])
  const [playerCharacterId, setPlayerCharacterId] = useState<string | null>(null)
  const [fogLayer, setFogLayer] = useState<any>(null)
  const [editLayer, setEditLayer] = useState<any>(null)
  const [editPoints, setEditPoints] = useState<number[][]>([])

  // Fetch player's main character ID (for non-GM view)
  useEffect(() => {
    if (isGM || !userId) return
    
    async function fetchPlayerCharacter() {
      const { data } = await supabase
        .from('characters')
        .select('id')
        .eq('user_id', userId)
        .eq('is_tame', false)
        .eq('is_npc', false)
        .eq('is_dead', false)
        .single()
      
      if (data) {
        setPlayerCharacterId(data.id)
      }
    }
    
    fetchPlayerCharacter()
  }, [isGM, userId])

  // Fetch fog polygons
  useEffect(() => {
    async function fetchFogPolygons() {
      let query = supabase
        .from('player_fog_polygons')
        .select('*, character:characters(id, name, user_id)')
      
      // Non-GMs only see their own polygon
      if (!isGM && playerCharacterId) {
        query = query.eq('character_id', playerCharacterId)
      }
      
      const { data, error } = await query
      
      if (error) {
        console.error('Error fetching fog polygons:', error)
        return
      }
      
      setFogPolygons(data || [])
    }
    
    fetchFogPolygons()
    
    // Subscribe to realtime changes
    const subscription = supabase
      .channel('fog_polygons_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'player_fog_polygons' },
        () => fetchFogPolygons()
      )
      .subscribe()
    
    return () => {
      subscription.unsubscribe()
    }
  }, [isGM, playerCharacterId])

  // Convert normalized coords to map coords
  const toMapCoords = useCallback((point: number[]): [number, number] => {
    const x = point[0] * mapWidth
    const y = (1 - point[1]) * mapHeight  // Flip Y
    return [y, x]  // Leaflet uses [lat, lng]
  }, [mapWidth, mapHeight])

  // Convert map coords to normalized
  const toNormalizedCoords = useCallback((latlng: any): number[] => {
    const x = latlng.lng / mapWidth
    const y = 1 - (latlng.lat / mapHeight)  // Flip Y back
    return [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))]
  }, [mapWidth, mapHeight])

  // Render fog overlay for players
  useEffect(() => {
    if (!map || !L || isGM) return
    
    // Remove existing fog layer
    if (fogLayer) {
      map.removeLayer(fogLayer)
    }
    
    // Find player's polygon
    const playerPolygon = fogPolygons.find(fp => fp.character_id === playerCharacterId)
    
    if (!playerPolygon || playerPolygon.polygon.length < 3) {
      // No polygon = full fog (or we could show nothing)
      return
    }
    
    // Create fog using SVG overlay
    // The fog covers everything EXCEPT the polygon
    const points = playerPolygon.polygon.map(p => toMapCoords(p))
    
    // Create an inverted polygon (fog everywhere except the visible area)
    // We do this by creating a large rectangle and cutting out the polygon
    const bounds = map.getBounds()
    const pad = 1000  // Extra padding
    const outerBounds: [number, number][] = [
      [bounds.getSouth() - pad, bounds.getWest() - pad],
      [bounds.getSouth() - pad, bounds.getEast() + pad],
      [bounds.getNorth() + pad, bounds.getEast() + pad],
      [bounds.getNorth() + pad, bounds.getWest() - pad],
    ]
    
    // Create polygon with hole (outer = fog, hole = visible)
    const fogPoly = L.polygon([outerBounds, points], {
      color: 'transparent',
      fillColor: '#000',
      fillOpacity: 0.7,
      interactive: false,
    }).addTo(map)
    
    setFogLayer(fogPoly)
    
    return () => {
      if (fogPoly) map.removeLayer(fogPoly)
    }
  }, [map, L, isGM, fogPolygons, playerCharacterId, toMapCoords])

  // Render GM edit view
  useEffect(() => {
    if (!map || !L || !isGM) return
    
    // Remove existing edit layer
    if (editLayer) {
      map.removeLayer(editLayer)
    }
    
    if (!selectedCharacterId) return
    
    // Find selected character's polygon
    const selectedPolygon = fogPolygons.find(fp => fp.character_id === selectedCharacterId)
    const points = selectedPolygon?.polygon || []
    
    if (points.length < 3) {
      setEditPoints(points)
      return
    }
    
    const mapPoints = points.map(p => toMapCoords(p))
    
    // Create editable polygon
    const poly = L.polygon(mapPoints, {
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.2,
      weight: 2,
      dashArray: isEditing ? '5, 5' : undefined,
    }).addTo(map)
    
    setEditLayer(poly)
    setEditPoints(points)
    
    return () => {
      if (poly) map.removeLayer(poly)
    }
  }, [map, L, isGM, fogPolygons, selectedCharacterId, isEditing, toMapCoords])

  // Handle map clicks for editing
  useEffect(() => {
    if (!map || !isGM || !isEditing || !selectedCharacterId) return
    
    const handleClick = async (e: any) => {
      const newPoint = toNormalizedCoords(e.latlng)
      const newPoints = [...editPoints, newPoint]
      setEditPoints(newPoints)
      
      // Save to database
      const existingPolygon = fogPolygons.find(fp => fp.character_id === selectedCharacterId)
      
      if (existingPolygon) {
        await supabase
          .from('player_fog_polygons')
          .update({ polygon: newPoints })
          .eq('id', existingPolygon.id)
      } else {
        await supabase
          .from('player_fog_polygons')
          .insert({
            character_id: selectedCharacterId,
            polygon: newPoints
          })
      }
      
      if (onPolygonUpdate) onPolygonUpdate()
    }
    
    map.on('click', handleClick)
    
    return () => {
      map.off('click', handleClick)
    }
  }, [map, isGM, isEditing, selectedCharacterId, editPoints, fogPolygons, toNormalizedCoords, onPolygonUpdate])

  return null
}
