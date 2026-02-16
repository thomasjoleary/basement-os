'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface MapMarker {
  id: string
  x: number
  y: number
  type: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  size: string
  is_visible: boolean
  wiki_page_id: string | null
}

interface MarkerLayerProps {
  map: any  // Leaflet map instance
  L: any    // Leaflet library
  isGM: boolean
  mapWidth: number
  mapHeight: number
  onMarkerClick?: (marker: MapMarker) => void
}

export default function MarkerLayer({ 
  map, 
  L, 
  isGM, 
  mapWidth, 
  mapHeight,
  onMarkerClick 
}: MarkerLayerProps) {
  const [markers, setMarkers] = useState<MapMarker[]>([])
  const [leafletMarkers, setLeafletMarkers] = useState<any[]>([])

  // Fetch markers from database
  useEffect(() => {
    async function fetchMarkers() {
      const { data, error } = await supabase
        .from('map_markers')
        .select('*')
        .order('type')
      
      if (error) {
        console.error('Error fetching markers:', error)
        return
      }
      
      // Filter based on visibility (GMs see all)
      const visibleMarkers = isGM 
        ? data 
        : data.filter((m: MapMarker) => m.is_visible)
      
      setMarkers(visibleMarkers || [])
    }
    
    fetchMarkers()
    
    // Subscribe to realtime changes
    const subscription = supabase
      .channel('map_markers_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'map_markers' },
        () => fetchMarkers()
      )
      .subscribe()
    
    return () => {
      subscription.unsubscribe()
    }
  }, [isGM])

  // Create/update Leaflet markers when data changes
  useEffect(() => {
    if (!map || !L || markers.length === 0) return
    
    // Clear existing markers
    leafletMarkers.forEach(m => m.remove())
    
    // Size multipliers
    const sizes: Record<string, number> = {
      small: 16,
      medium: 24,
      large: 32,
    }
    
    // Create new markers
    const newMarkers = markers.map(marker => {
      // Convert normalized coords to map coords
      const x = marker.x * mapWidth  // lng
      const y = (1 - marker.y) * mapHeight  // lat (flip Y)
      
      const size = sizes[marker.size] || 24
      
      // Create custom icon with emoji
      const icon = L.divIcon({
        className: 'map-marker-icon',
        html: `
          <div style="
            font-size: ${size}px;
            text-shadow: 0 0 3px black, 0 0 3px black;
            cursor: pointer;
            transform: translate(-50%, -50%);
            filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5));
          ">
            ${marker.icon || '📍'}
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })
      
      const leafletMarker = L.marker([y, x], { icon })
        .addTo(map)
      
      // Tooltip on hover
      leafletMarker.bindTooltip(marker.name, {
        direction: 'top',
        offset: [0, -size / 2],
        className: 'map-marker-tooltip',
      })
      
      // Click handler
      leafletMarker.on('click', () => {
        if (onMarkerClick) {
          onMarkerClick(marker)
        }
      })
      
      // Visual indicator for hidden markers (GM only)
      if (!marker.is_visible) {
        leafletMarker.setOpacity(0.5)
      }
      
      return leafletMarker
    })
    
    setLeafletMarkers(newMarkers)
    
    // Cleanup on unmount
    return () => {
      newMarkers.forEach(m => m.remove())
    }
  }, [map, L, markers, mapWidth, mapHeight, onMarkerClick])

  return null  // Markers are added directly to the map
}
