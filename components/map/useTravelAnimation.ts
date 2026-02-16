import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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
}

// Calculate distance between two points (in map units)
const calculateDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
  const dx = (p2.x - p1.x) * 1707  // MAP_WIDTH
  const dy = (p2.y - p1.y) * 993   // MAP_HEIGHT
  return Math.sqrt(dx * dx + dy * dy)
}

// Convert map distance to miles (same scale as distance tool)
const convertDistance = (mapDist: number) => {
  return (mapDist * 75 / 100)  // 100 map units = 75 miles
}

/**
 * Hook that syncs active travels by calculating progress based on elapsed time
 * Works even after browser refresh - travel continues independently
 * Travel progress is calculated from started_at timestamp, accounting for pauses
 */
export function useTravelAnimation(isGM: boolean, hasActiveTravels: boolean) {
  useEffect(() => {
    if (!isGM || !hasActiveTravels) return

    // Initial sync when component mounts (in case of refresh)
    syncTravels()

    // Sync interval (every 2 seconds to reduce load)
    const interval = setInterval(syncTravels, 2000)

    async function syncTravels() {
      // Fetch fresh data to avoid stale closure issues
      const { data: travels } = await supabase
        .from('active_travels')
        .select('*')
        .eq('status', 'active')
      
      if (!travels || travels.length === 0) return
      
      const now = Date.now()
      
      for (const travel of travels) {
        // Skip paused travels
        if (travel.status !== 'active') continue

        const { waypoints, speed_mph, started_at } = travel

        // Calculate total route distance and segment distances
        const segmentDistances: number[] = []
        for (let i = 1; i < waypoints.length; i++) {
          segmentDistances.push(calculateDistance(waypoints[i - 1], waypoints[i]))
        }
        
        const totalDistance = segmentDistances.reduce((sum, d) => sum + d, 0)
        const totalMiles = convertDistance(totalDistance)
        
        // Calculate elapsed time since start
        const startTime = new Date(started_at).getTime()
        const elapsedMs = now - startTime
        const elapsedHours = elapsedMs / (60 * 60 * 1000)
        
        // Calculate distance traveled
        const distanceTraveled = speed_mph * elapsedHours
        const distanceTraveledMapUnits = (distanceTraveled / 75) * 100  // Convert back to map units
        
        // Check if travel is complete
        if (distanceTraveled >= totalMiles) {
          await completeTravelSequence(travel)
          continue
        }
        
        // Find current segment and progress within segment
        let accumulatedDistance = 0
        let currentSegment = 0
        let segmentProgress = 0
        
        for (let i = 0; i < segmentDistances.length; i++) {
          const segmentDist = segmentDistances[i]
          
          if (accumulatedDistance + segmentDist >= distanceTraveledMapUnits) {
            // We're in this segment
            currentSegment = i
            const distanceIntoSegment = distanceTraveledMapUnits - accumulatedDistance
            segmentProgress = distanceIntoSegment / segmentDist
            break
          }
          
          accumulatedDistance += segmentDist
        }
        
        // Clamp segment progress
        segmentProgress = Math.max(0, Math.min(1, segmentProgress))
        
        // Calculate current position
        const segmentStart = waypoints[currentSegment]
        const segmentEnd = waypoints[currentSegment + 1]
        
        const currentX = segmentStart.x + (segmentEnd.x - segmentStart.x) * segmentProgress
        const currentY = segmentStart.y + (segmentEnd.y - segmentStart.y) * segmentProgress
        
        // Update travel progress in database
        await supabase
          .from('active_travels')
          .update({
            current_segment: currentSegment,
            segment_progress: segmentProgress
          })
          .eq('id', travel.id)
        
        // Update character position
        await supabase
          .from('player_positions')
          .upsert({
            character_id: travel.character_id,
            x: currentX,
            y: currentY,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'character_id'
          })
      }
    }

    return () => clearInterval(interval)
  }, [isGM, hasActiveTravels])
}

// Complete a travel sequence
async function completeTravelSequence(travel: ActiveTravel) {
  const finalWaypoint = travel.waypoints[travel.waypoints.length - 1]
  
  // Update final position
  await supabase
    .from('player_positions')
    .upsert({
      character_id: travel.character_id,
      x: finalWaypoint.x,
      y: finalWaypoint.y,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'character_id'
    })
  
  // Mark travel as completed and delete
  await supabase
    .from('active_travels')
    .delete()
    .eq('id', travel.id)
  
  console.log(`Travel completed for character ${travel.character_id}`)
}
