'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { supabase } from '@/lib/supabase'
import polygonClipping from 'polygon-clipping'

// Biome data from MapOfWorld.map
const BIOMES = [
  { id: 0, name: 'Marine', color: '#466eab', threshold: 0 },
  { id: 1, name: 'Hot desert', color: '#fbe79f', threshold: 4 },
  { id: 2, name: 'Cold desert', color: '#b5b887', threshold: 10 },
  { id: 3, name: 'Savanna', color: '#d2d082', threshold: 22 },
  { id: 4, name: 'Grassland', color: '#c8d68f', threshold: 30 },
  { id: 5, name: 'Tropical seasonal forest', color: '#b6d95d', threshold: 50 },
  { id: 6, name: 'Temperate deciduous forest', color: '#29bc56', threshold: 100 },
  { id: 7, name: 'Tropical rainforest', color: '#7dcb35', threshold: 80 },
  { id: 8, name: 'Temperate rainforest', color: '#409c43', threshold: 90 },
  { id: 9, name: 'Taiga', color: '#4b6b32', threshold: 12 },
  { id: 10, name: 'Tundra', color: '#96784b', threshold: 4 },
  { id: 11, name: 'Glacier', color: '#d5e7eb', threshold: 0 },
  { id: 12, name: 'Wetland', color: '#0b9131', threshold: 12 },
]

interface LeafletMapProps {
  isGM: boolean
  showBiomes: boolean
  showLegend: boolean
  showMarkers: boolean
  markerFilters?: string[]  // Empty array = show all
  showFog?: boolean
  selectedFogCharacter?: string | null
  selectedPolygonId?: string | null
  isFogEditing?: boolean
  isMarkerCreating?: boolean  // GM mode: click to create marker
  showPositions?: boolean
  selectedPositionCharacter?: string | null
  isPositionPlacing?: boolean
  isDistanceMeasuring?: boolean
  distanceWaypoints?: { x: number; y: number }[]
  onDistanceWaypointDrag?: (index: number, x: number, y: number) => void
  isPlanningTravel?: boolean
  travelWaypoints?: { x: number; y: number }[]
  travelCurrentPosition?: { x: number; y: number } | null
  activeTravels?: any[]
  onBiomeHover?: (biomeId: number | null) => void
  onMarkerClick?: (marker: any) => void
  onMapClick?: (x: number, y: number) => void  // Normalized coords
}

// Store map and layer references globally for this component
let mapInstance: any = null
let biomeLayerInstance: any = null
let biomeLookupCtx: CanvasRenderingContext2D | null = null
let markersLayerGroup: any = null
let fogLayerGroup: any = null
let positionsLayerGroup: any = null
let distanceLayerGroup: any = null
let travelLayerGroup: any = null
let leafletLib: any = null

// Biome lookup image dimensions (must match generate-biome-lookup.js)
const LOOKUP_WIDTH = 1707
const LOOKUP_HEIGHT = 993
const MAP_WIDTH = 1707
const MAP_HEIGHT = 993

// Point-in-polygon check (ray casting algorithm)
// polygon: array of [x, y] normalized coordinates
// point: [x, y] normalized coordinates
function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  if (!polygon || polygon.length < 3) return false
  
  const [px, py] = point
  let inside = false
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi)
    
    if (intersect) inside = !inside
  }
  
  return inside
}

export default function LeafletMap({ 
  isGM, 
  showBiomes, 
  showLegend, 
  showMarkers, 
  markerFilters = [], 
  showFog = true,
  selectedFogCharacter = null,
  selectedPolygonId = null,
  isFogEditing = false,
  isMarkerCreating = false,
  showPositions = true,
  selectedPositionCharacter = null,
  isPositionPlacing = false,
  isDistanceMeasuring = false,
  distanceWaypoints = [],
  onDistanceWaypointDrag,
  isPlanningTravel = false,
  travelWaypoints = [],
  travelCurrentPosition = null,
  activeTravels = [],
  onBiomeHover, 
  onMarkerClick,
  onMapClick
}: LeafletMapProps) {
  const initializedRef = useRef(false)
  const lookupLoadedRef = useRef(false)
  const [markers, setMarkers] = useState<any[]>([])
  const [fogPolygons, setFogPolygons] = useState<any[]>([])
  const [fogLoaded, setFogLoaded] = useState(false)  // Track if fog data has loaded
  const [userId, setUserId] = useState<string | null>(null)
  const [playerCharacterId, setPlayerCharacterId] = useState<string | null>(null)
  const [playerVisibleMarkers, setPlayerVisibleMarkers] = useState<Set<string>>(new Set())
  const [positions, setPositions] = useState<any[]>([])
  const [screenPolygons, setScreenPolygons] = useState<{x: number, y: number}[][]>([])  // Array of polygons
  const [unionedPolygon, setUnionedPolygon] = useState<any>(null)  // Store the unioned result
  const [fogPath, setFogPath] = useState<string>('')  // SVG path for fog
  const fogCanvasRef = useRef<HTMLCanvasElement>(null)
  
  // Marker types that are auto-visible (within fog polygon)
  // Other types require explicit GM grant via player_marker_visibility
  const AUTO_VISIBLE_TYPES = ['city', 'town']
  
  // Get current user and their main character
  useEffect(() => {
    async function getUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUserId(session.user.id)
        
        // Get player's main character (for fog)
        if (!isGM) {
          const { data: char } = await supabase
            .from('characters')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('is_tame', false)
            .eq('is_npc', false)
            .eq('is_dead', false)
            .single()
          
          if (char) setPlayerCharacterId(char.id)
        }
      }
    }
    getUser()
  }, [isGM])
  
  // Fetch player's granted marker visibility (for non-auto-visible markers)
  useEffect(() => {
    if (isGM || !playerCharacterId) return
    
    async function fetchVisibility() {
      const { data, error } = await supabase
        .from('player_marker_visibility')
        .select('marker_id')
        .eq('character_id', playerCharacterId)
      
      if (error) {
        console.error('Error fetching marker visibility:', error)
        return
      }
      
      setPlayerVisibleMarkers(new Set(data?.map(v => v.marker_id) || []))
    }
    
    fetchVisibility()
    
    // Subscribe to realtime changes
    const sub = supabase
      .channel('marker_visibility_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'player_marker_visibility' },
        fetchVisibility
      )
      .subscribe()
    
    return () => { sub.unsubscribe() }
  }, [isGM, playerCharacterId])

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
        : data?.filter((m: any) => m.is_visible) || []
      
      setMarkers(visibleMarkers)
    }
    
    fetchMarkers()
  }, [isGM])
  
  // Fetch fog polygons
  useEffect(() => {
    async function fetchFog() {
      const { data, error } = await supabase
        .from('player_fog_polygons')
        .select('*, character:characters(id, name)')
      
      if (error) {
        console.error('Error fetching fog:', error)
        setFogLoaded(true)  // Mark as loaded even on error (will show full fog)
        return
      }
      
      setFogPolygons(data || [])
      setFogLoaded(true)  // Fog data is now loaded
    }
    
    fetchFog()
    
    // Subscribe to realtime
    const sub = supabase
      .channel('fog_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_fog_polygons' }, fetchFog)
      .subscribe()
    
    return () => { sub.unsubscribe() }
  }, [])
  
  // Fetch player positions
  useEffect(() => {
    async function fetchPositions() {
      const { data, error } = await supabase
        .from('player_positions')
        .select('*, character:characters(id, name)')
      
      if (error) {
        console.error('Error fetching positions:', error)
        return
      }
      
      // Filter based on permissions
      let visiblePositions = data || []
      if (!isGM && playerCharacterId) {
        // Players can only see their own position
        visiblePositions = visiblePositions.filter((p: any) => p.character_id === playerCharacterId)
      }
      
      setPositions(visiblePositions)
    }
    
    fetchPositions()
    
    // Subscribe to realtime
    const sub = supabase
      .channel('position_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_positions' }, fetchPositions)
      .subscribe()
    
    return () => { sub.unsubscribe() }
  }, [isGM, playerCharacterId])
  
  // Compute union of screen polygons (players only)
  useEffect(() => {
    if (isGM || screenPolygons.length === 0) {
      setUnionedPolygon(null)
      return
    }
    
    try {
      // Convert screen polygons to polygon-clipping format
      const clippingPolygons = screenPolygons
        .filter(poly => poly.length >= 3)
        .map(poly => [poly.map(p => [p.x, p.y])])
      
      if (clippingPolygons.length === 0) {
        setUnionedPolygon(null)
        return
      }
      
      // Union all polygons (explicit type to satisfy TypeScript)
      let unionResult: any = clippingPolygons[0]
      for (let i = 1; i < clippingPolygons.length; i++) {
        unionResult = polygonClipping.union(unionResult as any, clippingPolygons[i] as any)
      }
      
      console.log('🌫️ UNION COMPUTED:', {
        inputPolygons: clippingPolygons.length,
        multiPolygons: unionResult.length,
        firstRingPoints: unionResult[0]?.[0]?.length,
        allPoints: unionResult[0]?.[0]
      })
      
      // Generate CSS polygon() string from unioned polygon
      // This will be used with clip-path
      const clipPolygonStr = unionResult[0]?.[0]
        ?.map(([x, y]: [number, number]) => `${x}px ${y}px`)
        .join(', ')
      
      console.log('🌫️ CLIP POLYGON generated, points:', unionResult[0]?.[0]?.length)
      
      setUnionedPolygon(unionResult)
      setFogPath(clipPolygonStr || '')
    } catch (error) {
      console.error('Error computing union:', error)
      setUnionedPolygon(null)
    }
  }, [isGM, screenPolygons])
  
  // Render unioned polygon to canvas (redraws on window resize too)
  useEffect(() => {
    if (!unionedPolygon || !fogCanvasRef.current) return
    
    const renderCanvas = () => {
    
    const canvas = fogCanvasRef.current
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return
    
    // Get device pixel ratio for sharp rendering
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    
    // Set actual canvas size (with pixel ratio)
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    
    // Scale context to match
    ctx.scale(dpr, dpr)
    
    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height)
    
    // Fill with black fog
    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, rect.width, rect.height)
    
    // Cut out the unioned polygon
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(255, 255, 255, 1)'
    
    unionedPolygon.forEach((multiPoly: any) => {
      multiPoly.forEach((ring: any) => {
        ctx.beginPath()
        ring.forEach(([x, y]: [number, number], i: number) => {
          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        })
        ctx.closePath()
        ctx.fill()
      })
    })
    
      console.log('🌫️ Canvas rendered:', rect.width, 'x', rect.height, '@', dpr, 'dpr')
    }
    
    renderCanvas()
    
    // Re-render on window resize
    window.addEventListener('resize', renderCanvas)
    return () => window.removeEventListener('resize', renderCanvas)
  }, [unionedPolygon])
  
  // Update screen-space polygons for viewport-fixed fog overlay (players only)
  useEffect(() => {
    if (isGM || !mapInstance || !playerCharacterId || !fogLoaded) {
      setScreenPolygons([])
      return
    }
    
    const updateScreenPolygons = () => {
      // Get ALL active polygons for this player's character
      const playerPolygons = fogPolygons.filter(
        fp => fp.character_id === playerCharacterId && fp.is_active && fp.polygon?.length >= 3
      )
      
      if (playerPolygons.length === 0) {
        setScreenPolygons([])
        return
      }
      
      // Convert each polygon's normalized coords → map coords → screen pixels
      const allScreenPolygons = playerPolygons.map(fogPoly => {
        return fogPoly.polygon.map((p: number[]) => {
          const x = p[0] * MAP_WIDTH
          const y = (1 - p[1]) * MAP_HEIGHT
          const point = mapInstance.latLngToContainerPoint([y, x])
          return { x: point.x, y: point.y }
        })
      })
      
      setScreenPolygons(allScreenPolygons)
    }
    
    // Initial update
    updateScreenPolygons()
    
    // Update on map move/zoom - multiple events to catch it ASAP
    mapInstance.on('move', updateScreenPolygons)
    mapInstance.on('movestart', updateScreenPolygons)
    mapInstance.on('moveend', updateScreenPolygons)
    mapInstance.on('zoom', updateScreenPolygons)
    mapInstance.on('zoomstart', updateScreenPolygons)
    mapInstance.on('zoomanim', updateScreenPolygons)  // Fires during zoom animation
    mapInstance.on('zoomend', updateScreenPolygons)
    mapInstance.on('viewreset', updateScreenPolygons)
    
    return () => {
      mapInstance.off('move', updateScreenPolygons)
      mapInstance.off('movestart', updateScreenPolygons)
      mapInstance.off('moveend', updateScreenPolygons)
      mapInstance.off('zoom', updateScreenPolygons)
      mapInstance.off('zoomstart', updateScreenPolygons)
      mapInstance.off('zoomanim', updateScreenPolygons)
      mapInstance.off('zoomend', updateScreenPolygons)
      mapInstance.off('viewreset', updateScreenPolygons)
    }
  }, [isGM, mapInstance, playerCharacterId, fogPolygons, fogLoaded])

  // Initialize map once
  useEffect(() => {
    if (initializedRef.current) return
    
    // Import Leaflet only on client side
    import('leaflet').then((L) => {
      // Remove existing map if any
      const container = document.getElementById('map')
      if (container && (container as any)._leaflet_id) {
        return // Map already initialized
      }

      initializedRef.current = true

      // Map dimensions (native PNG is 1707x993)
      const mapWidth = 1707
      const mapHeight = 993
      const tileSize = 256
      
      // Tile zoom 6 = native resolution (1707x993)
      // Use zoomOffset so map zoom 0 = tile zoom 6 (native), map zoom 2 = tile zoom 8 (4x upscale)
      const zoomOffset = 6
      const minMapZoom = 0   // tile zoom 6 (native resolution, no zoom out)
      const maxMapZoom = 2   // tile zoom 8 (4x upscale for zooming in)
      
      // Coordinate space = actual map dimensions
      const coordWidth = mapWidth
      const coordHeight = mapHeight
      
      // Custom CRS with Y-axis flipped
      const customCRS = L.extend({}, L.CRS.Simple, {
        transformation: new L.Transformation(1, 0, -1, coordHeight)
      })
      
      const bounds = L.latLngBounds([0, 0], [coordHeight, coordWidth])

      // Initialize map at zoom 0 (native resolution 1707x993)
      // Players get restricted zoom to prevent seeing past fog
      const map = L.map('map', {
        crs: customCRS,
        minZoom: isGM ? minMapZoom : 0,  // Players can't zoom out past native resolution
        maxZoom: maxMapZoom,
        zoom: 0,  // Native resolution - scroll to zoom in/out
        center: [coordHeight / 2, coordWidth / 2],
        zoomControl: false,
        attributionControl: false,
        maxBoundsViscosity: isGM ? 0.5 : 1.0,  // Players get stricter bounds (can't drag outside)
        dragging: true,  // Viewport-fixed fog handles rendering during drags
        zoomAnimation: isGM,  // Players get instant zoom (no animation flash), GMs keep smooth zoom
      })
      
      mapInstance = map
      leafletLib = L
      
      // Create layer group for markers
      markersLayerGroup = L.layerGroup().addTo(map)
      
      // Create custom pane for fog with high z-index to prevent tile flash
      const fogPane = map.createPane('fogPane')
      fogPane.style.zIndex = '650'  // Above tiles (400) and overlays (600)
      
      // Create layer group for fog
      fogLayerGroup = L.layerGroup().addTo(map)
      
      // Create layer group for player positions
      positionsLayerGroup = L.layerGroup().addTo(map)
      
      // Create layer group for distance measurements
      distanceLayerGroup = L.layerGroup().addTo(map)
      
      // Create layer group for travel routes
      travelLayerGroup = L.layerGroup().addTo(map)
      
      // Set max bounds - stricter for players to prevent panning past fog
      // GMs get more freedom, players are restricted to prevent seeing past fog
      if (isGM) {
        map.setMaxBounds(bounds.pad(0.3))  // GMs can pan a bit outside
      } else {
        map.setMaxBounds(bounds.pad(0.1))  // Players locked to map area
      }

      // Base tile layer
      L.tileLayer('/maps/tiles/{z}/{x}/{y}.png', {
        tileSize: tileSize,
        zoomOffset: zoomOffset,
        minZoom: minMapZoom,
        maxZoom: maxMapZoom,
        noWrap: true,
        attribution: '',
      }).addTo(map)
      
      // Create biome overlay layer (not added yet)
      biomeLayerInstance = L.tileLayer('/maps/biome-tiles/{z}/{x}/{y}.png', {
        tileSize: tileSize,
        zoomOffset: zoomOffset,
        minZoom: minMapZoom,
        maxZoom: maxMapZoom,
        noWrap: true,
        attribution: '',
        opacity: 0.5,  // Semi-transparent overlay
      })
      
      // Log initial state
      map.whenReady(() => {
        console.log(`Map ready: zoom ${map.getZoom()} (tile zoom ${map.getZoom() + zoomOffset}), range [${minMapZoom}, ${maxMapZoom}]`)
      })
      
      // Load biome lookup image for hover detection
      if (!lookupLoadedRef.current) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = LOOKUP_WIDTH
          canvas.height = LOOKUP_HEIGHT
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0)
            biomeLookupCtx = ctx
            console.log('Biome lookup image loaded')
          }
        }
        img.src = '/maps/biome-lookup.png'
        lookupLoadedRef.current = true
      }
      
      // Handle mouse move for biome hover detection
      map.on('mousemove', (e: any) => {
        if (!biomeLookupCtx || !onBiomeHover) return
        
        // Get map coordinates (0 to MAP_WIDTH/HEIGHT)
        const mapX = e.latlng.lng
        const mapY = MAP_HEIGHT - e.latlng.lat  // Flip Y back
        
        // Convert to lookup image coordinates
        const lookupX = Math.floor((mapX / MAP_WIDTH) * LOOKUP_WIDTH)
        const lookupY = Math.floor((mapY / MAP_HEIGHT) * LOOKUP_HEIGHT)
        
        // Bounds check
        if (lookupX < 0 || lookupX >= LOOKUP_WIDTH || lookupY < 0 || lookupY >= LOOKUP_HEIGHT) {
          onBiomeHover(null)
          return
        }
        
        // Sample pixel
        const pixel = biomeLookupCtx.getImageData(lookupX, lookupY, 1, 1).data
        const biomeId = pixel[0]  // Red channel = biome ID
        const isValid = pixel[1] === 255  // Green channel = 255 means valid
        
        if (isValid) {
          onBiomeHover(biomeId)
        } else {
          onBiomeHover(null)
        }
      })
      
      map.on('mouseout', () => {
        if (onBiomeHover) onBiomeHover(null)
      })

      // Add zoom control to top right
      L.control.zoom({ position: 'topright' }).addTo(map)

      // Add scale
      L.control.scale({
        position: 'bottomleft',
        imperial: false,
        metric: true,
      }).addTo(map)

      // Cleanup on unmount
      return () => {
        map.remove()
        mapInstance = null
        biomeLayerInstance = null
        markersLayerGroup = null
        fogLayerGroup = null
        leafletLib = null
      }
    })
  }, [])
  
  // Render markers when data or visibility changes
  useEffect(() => {
    if (!mapInstance || !leafletLib || !markersLayerGroup) return
    
    // Clear existing markers
    markersLayerGroup.clearLayers()
    
    if (!showMarkers || markers.length === 0) return
    
    // Filter markers by type if filters are active
    let filteredMarkers = markerFilters.length > 0
      ? markers.filter(m => markerFilters.includes(m.type))
      : markers
    
    // For players: apply visibility rules
    // - Cities/Towns: auto-visible if within ANY active fog polygon
    // - Other types (volcanoes, hot springs, water sources, dungeons): need GM grant + within fog
    // - While loading: show no markers (prevent spoilers)
    if (!isGM) {
      // While loading, show no markers
      if (!playerCharacterId || !fogLoaded) {
        filteredMarkers = []
      } else {
        // Get ALL active polygons for this player's character
        const playerPolygons = fogPolygons.filter(
          fp => fp.character_id === playerCharacterId && fp.is_active && fp.polygon?.length >= 3
        )
        
        if (playerPolygons.length > 0) {
          filteredMarkers = filteredMarkers.filter(marker => {
            // Check if marker is within ANY active fog polygon
            const isInAnyPolygon = playerPolygons.some(fogPoly => 
              isPointInPolygon([marker.x, marker.y], fogPoly.polygon)
            )
            
            if (!isInAnyPolygon) {
              return false  // Not in any revealed area
            }
            
            // Auto-visible types (cities, towns) - just need to be in fog
            if (AUTO_VISIBLE_TYPES.includes(marker.type)) {
              return true
            }
            // Other types - need explicit GM grant
            return playerVisibleMarkers.has(marker.id)
          })
        } else {
          // No active polygons = no revealed area = no markers visible
          filteredMarkers = []
        }
      }
    }
    
    const L = leafletLib
    const sizes: Record<string, number> = { small: 16, medium: 24, large: 32 }
    
    filteredMarkers.forEach(marker => {
      // Convert normalized coords to map coords
      const x = marker.x * MAP_WIDTH  // lng
      const y = (1 - marker.y) * MAP_HEIGHT  // lat (flip Y)
      
      const size = sizes[marker.size] || 24
      
      // Create custom icon with emoji
      const icon = L.divIcon({
        className: 'map-marker-icon',
        html: `
          <div style="
            font-size: ${size}px;
            line-height: 1;
            text-shadow: 0 0 3px black, 0 0 3px black;
            cursor: pointer;
            filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5));
          ">
            ${marker.icon || '📍'}
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })
      
      const leafletMarker = L.marker([y, x], { icon })
      
      // Tooltip on hover
      leafletMarker.bindTooltip(marker.name, {
        direction: 'top',
        offset: [0, -size / 2 - 4],
        className: 'map-marker-tooltip',
      })
      
      // Click handler
      if (onMarkerClick) {
        leafletMarker.on('click', () => onMarkerClick(marker))
      }
      
      // Visual indicator for hidden markers (GM only)
      if (!marker.is_visible) {
        leafletMarker.setOpacity(0.5)
      }
      
      markersLayerGroup.addLayer(leafletMarker)
    })
    
    console.log(`Rendered ${filteredMarkers.length} markers`)
  }, [showMarkers, markers, markerFilters, onMarkerClick, isFogEditing, isGM, playerCharacterId, fogPolygons, fogLoaded, playerVisibleMarkers])
  
  // Disable marker interaction during fog editing
  useEffect(() => {
    if (!markersLayerGroup) return
    
    markersLayerGroup.eachLayer((layer: any) => {
      if (isFogEditing) {
        layer.getElement()?.style.setProperty('pointer-events', 'none')
      } else {
        layer.getElement()?.style.removeProperty('pointer-events')
      }
    })
  }, [isFogEditing])
  
  // Render player positions
  useEffect(() => {
    if (!mapInstance || !leafletLib || !positionsLayerGroup) return
    if (!showPositions) return
    
    // Clear existing positions
    positionsLayerGroup.clearLayers()
    
    const L = leafletLib
    
    positions.forEach(pos => {
      // Convert normalized coords to map coords
      const x = pos.x * MAP_WIDTH
      const y = (1 - pos.y) * MAP_HEIGHT  // Flip Y
      
      const size = 32
      
      // Highlight selected character's position
      const isSelected = selectedPositionCharacter === pos.character_id
      
      // Create custom icon for player position
      const icon = L.divIcon({
        className: 'player-position-icon',
        html: `
          <div style="
            position: relative;
            width: ${size}px;
            height: ${size}px;
          ">
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              font-size: ${size}px;
              line-height: 1;
              text-shadow: 0 0 4px black, 0 0 4px black, 0 0 8px black;
              cursor: ${isGM ? 'pointer' : 'default'};
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));
              ${isSelected ? 'animation: pulse 2s ease-in-out infinite;' : ''}
            ">
              🧍
            </div>
            ${isSelected ? `
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: ${size + 20}px;
                height: ${size + 20}px;
                border: 3px solid #22c55e;
                border-radius: 50%;
                animation: ping 2s ease-in-out infinite;
              "></div>
            ` : ''}
          </div>
          <style>
            @keyframes pulse {
              0%, 100% { transform: translate(-50%, -50%) scale(1); }
              50% { transform: translate(-50%, -50%) scale(1.1); }
            }
            @keyframes ping {
              0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
            }
          </style>
        `,
        iconSize: [size + 20, size + 20],
        iconAnchor: [(size + 20) / 2, (size + 20) / 2],
      })
      
      const marker = L.marker([y, x], { icon })
      
      // Tooltip with character name
      const characterName = pos.character?.name || 'Unknown'
      const tooltipText = pos.location_name 
        ? `${characterName}\n📍 ${pos.location_name}`
        : characterName
        
      marker.bindTooltip(tooltipText, {
        direction: 'top',
        offset: [0, -(size + 20) / 2 - 4],
        className: 'player-position-tooltip',
      })
      
      positionsLayerGroup.addLayer(marker)
    })
    
    console.log(`Rendered ${positions.length} player positions`)
  }, [showPositions, positions, selectedPositionCharacter, isGM])
  
  // Render distance measurement waypoints and path
  useEffect(() => {
    if (!mapInstance || !leafletLib || !distanceLayerGroup) return
    
    // Clear existing distance visuals
    distanceLayerGroup.clearLayers()
    
    if (!isDistanceMeasuring || distanceWaypoints.length === 0) return
    
    const L = leafletLib
    
    // Draw path lines between waypoints
    if (distanceWaypoints.length > 1) {
      const pathCoords = distanceWaypoints.map(wp => {
        const x = wp.x * MAP_WIDTH
        const y = (1 - wp.y) * MAP_HEIGHT
        return [y, x]
      })
      
      L.polyline(pathCoords, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.8,
        dashArray: '10, 5',
      }).addTo(distanceLayerGroup)
    }
    
    // Draw waypoint markers
    distanceWaypoints.forEach((wp, index) => {
      const x = wp.x * MAP_WIDTH
      const y = (1 - wp.y) * MAP_HEIGHT
      
      const icon = L.divIcon({
        className: 'distance-waypoint-icon',
        html: `
          <div style="
            width: 24px;
            height: 24px;
            background: #3b82f6;
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: bold;
            color: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            cursor: move;
          ">
            ${index + 1}
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })
      
      const marker = L.marker([y, x], { 
        icon,
        draggable: true  // Make waypoints draggable
      })
      
      marker.bindTooltip(`Waypoint ${index + 1}`, {
        direction: 'top',
        offset: [0, -16],
        className: 'distance-waypoint-tooltip',
      })
      
      // Handle drag end event
      marker.on('dragend', () => {
        const newLatLng = marker.getLatLng()
        const newX = newLatLng.lng / MAP_WIDTH
        const newY = 1 - (newLatLng.lat / MAP_HEIGHT)
        
        // Clamp to valid range
        const clampedX = Math.max(0, Math.min(1, newX))
        const clampedY = Math.max(0, Math.min(1, newY))
        
        // Notify parent component of the drag
        if (onDistanceWaypointDrag) {
          onDistanceWaypointDrag(index, clampedX, clampedY)
        }
      })
      
      distanceLayerGroup.addLayer(marker)
    })
    
    console.log(`Rendered ${distanceWaypoints.length} distance waypoints`)
  }, [isDistanceMeasuring, distanceWaypoints, onDistanceWaypointDrag])
  
  // Render travel planning route and active travel routes
  useEffect(() => {
    if (!mapInstance || !leafletLib || !travelLayerGroup) return
    
    // Clear existing travel visuals
    travelLayerGroup.clearLayers()
    
    const L = leafletLib
    
    // Render planning route (if planning)
    if (isPlanningTravel && travelWaypoints.length > 0) {
      // Build full route including current position
      const fullRoute = travelCurrentPosition 
        ? [travelCurrentPosition, ...travelWaypoints]
        : travelWaypoints
      
      // Draw path lines
      if (fullRoute.length > 1) {
        const pathCoords = fullRoute.map(wp => {
          const x = wp.x * MAP_WIDTH
          const y = (1 - wp.y) * MAP_HEIGHT
          return [y, x]
        })
        
        L.polyline(pathCoords, {
          color: '#10b981',  // Green for travel
          weight: 3,
          opacity: 0.8,
          dashArray: '10, 5',
        }).addTo(travelLayerGroup)
      }
      
      // Draw current position marker (if exists)
      if (travelCurrentPosition) {
        const x = travelCurrentPosition.x * MAP_WIDTH
        const y = (1 - travelCurrentPosition.y) * MAP_HEIGHT
        
        const icon = L.divIcon({
          className: 'travel-start-icon',
          html: `
            <div style="
              width: 28px;
              height: 28px;
              background: #3b82f6;
              border: 3px solid white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 14px;
              font-weight: bold;
              color: white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">
              📍
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        })
        
        const marker = L.marker([y, x], { icon })
        
        marker.bindTooltip('Current Position', {
          direction: 'top',
          offset: [0, -18],
          className: 'travel-start-tooltip',
        })
        
        travelLayerGroup.addLayer(marker)
      }
      
      // Draw waypoint markers
      travelWaypoints.forEach((wp, index) => {
        const x = wp.x * MAP_WIDTH
        const y = (1 - wp.y) * MAP_HEIGHT
        
        const icon = L.divIcon({
          className: 'travel-waypoint-icon',
          html: `
            <div style="
              width: 24px;
              height: 24px;
              background: #10b981;
              border: 3px solid white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 11px;
              font-weight: bold;
              color: white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              cursor: pointer;
            ">
              ${index + 1}
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
        
        const marker = L.marker([y, x], { icon })
        
        marker.bindTooltip(`Stop ${index + 1}`, {
          direction: 'top',
          offset: [0, -16],
          className: 'travel-waypoint-tooltip',
        })
        
        travelLayerGroup.addLayer(marker)
      })
    }
    
    // Render active travel routes
    activeTravels.forEach(travel => {
      if (!travel.waypoints || travel.waypoints.length < 2) return
      
      // Draw full route path (gray, dashed)
      const routeCoords = travel.waypoints.map((wp: any) => {
        const x = wp.x * MAP_WIDTH
        const y = (1 - wp.y) * MAP_HEIGHT
        return [y, x]
      })
      
      L.polyline(routeCoords, {
        color: '#6b7280',  // Gray for remaining route
        weight: 2,
        opacity: 0.5,
        dashArray: '5, 5',
      }).addTo(travelLayerGroup)
      
      // Draw completed portion (solid green)
      if (travel.current_segment > 0 || travel.segment_progress > 0) {
        const completedCoords = []
        
        // Add all completed segments
        for (let i = 0; i <= travel.current_segment; i++) {
          const wp = travel.waypoints[i]
          const x = wp.x * MAP_WIDTH
          const y = (1 - wp.y) * MAP_HEIGHT
          completedCoords.push([y, x])
        }
        
        // Add current position
        if (travel.current_segment < travel.waypoints.length - 1) {
          const segStart = travel.waypoints[travel.current_segment]
          const segEnd = travel.waypoints[travel.current_segment + 1]
          const currentX = segStart.x + (segEnd.x - segStart.x) * travel.segment_progress
          const currentY = segStart.y + (segEnd.y - segStart.y) * travel.segment_progress
          completedCoords.push([(1 - currentY) * MAP_HEIGHT, currentX * MAP_WIDTH])
        }
        
        L.polyline(completedCoords, {
          color: '#10b981',  // Green for completed
          weight: 3,
          opacity: 0.8,
        }).addTo(travelLayerGroup)
      }
    })
    
    console.log(`Rendered ${travelWaypoints.length} travel waypoints, ${activeTravels.length} active travels`)
  }, [isPlanningTravel, travelWaypoints, travelCurrentPosition, activeTravels])
  
  // Toggle biome layer based on showBiomes prop
  useEffect(() => {
    if (!mapInstance || !biomeLayerInstance) return
    
    if (showBiomes) {
      if (!mapInstance.hasLayer(biomeLayerInstance)) {
        biomeLayerInstance.addTo(mapInstance)
        console.log('Biome layer added')
      }
    } else {
      if (mapInstance.hasLayer(biomeLayerInstance)) {
        mapInstance.removeLayer(biomeLayerInstance)
        console.log('Biome layer removed')
      }
    }
  }, [showBiomes])
  
  // Render fog of war
  useEffect(() => {
    if (!mapInstance || !leafletLib || !fogLayerGroup) return
    
    // Clear existing fog
    fogLayerGroup.clearLayers()
    
    if (!showFog) return
    
    const L = leafletLib
    
    // For GMs: show ALL polygons for selected character
    if (isGM && selectedFogCharacter) {
      const charPolygons = fogPolygons.filter(fp => fp.character_id === selectedFogCharacter)
      
      // Render all polygons for this character
      charPolygons.forEach(fogPoly => {
        const points = fogPoly.polygon || []
        const isSelected = fogPoly.id === selectedPolygonId
        const isActive = fogPoly.is_active
        
        if (points.length >= 3) {
          const mapPoints = points.map((p: number[]) => {
            const x = p[0] * MAP_WIDTH
            const y = (1 - p[1]) * MAP_HEIGHT
            return [y, x]
          })
          
          // Different colors for selected vs other polygons
          const color = isSelected ? '#ef4444' : (isActive ? '#22c55e' : '#6b7280')
          const fillOpacity = isSelected ? 0.3 : (isActive ? 0.15 : 0.05)
          
          L.polygon(mapPoints, {
            color: color,
            fillColor: color,
            fillOpacity: fillOpacity,
            weight: isSelected ? 3 : 2,
            dashArray: (isSelected && isFogEditing) ? '5, 5' : undefined,
            pane: 'fogPane',
          }).addTo(fogLayerGroup)
        }
        
        // Show draggable vertex markers ONLY for the selected polygon when editing
        if (isSelected && isFogEditing && points.length > 0) {
          points.forEach((p: number[], index: number) => {
            const x = p[0] * MAP_WIDTH
            const y = (1 - p[1]) * MAP_HEIGHT
            
            const vertexIcon = L.divIcon({
              className: 'fog-vertex',
              html: `<div style="
                width: 12px;
                height: 12px;
                background: #ef4444;
                border: 2px solid white;
                border-radius: 50%;
                cursor: move;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              "></div>`,
              iconSize: [12, 12],
              iconAnchor: [6, 6],
            })
            
            const vertexMarker = L.marker([y, x], {
              icon: vertexIcon,
              draggable: true,
            }).addTo(fogLayerGroup)
            
            // Show point number on hover
            vertexMarker.bindTooltip(`Point ${index + 1}`, {
              direction: 'top',
              offset: [0, -8],
            })
            
            // Handle drag end - update polygon
            vertexMarker.on('dragend', async (e: any) => {
              const newLatLng = e.target.getLatLng()
              const newX = newLatLng.lng / MAP_WIDTH
              const newY = 1 - (newLatLng.lat / MAP_HEIGHT)
              const newPoint = [
                Math.max(0, Math.min(1, newX)),
                Math.max(0, Math.min(1, newY))
              ]
              
              // Update the polygon
              const newPoints = [...points]
              newPoints[index] = newPoint
              
              // Save to database
              await supabase
                .from('player_fog_polygons')
                .update({ polygon: newPoints })
                .eq('id', fogPoly.id)
              
              // Update local state
              setFogPolygons(prev => prev.map(fp => 
                fp.id === fogPoly.id 
                  ? { ...fp, polygon: newPoints }
                  : fp
              ))
            })
          })
        }
      })
      
      return  // GM viewing mode - don't show full fog
    }
    
    // For players: fog is now handled by viewport-fixed overlay with unioned polygons
    // Skip Leaflet fog rendering for players
    if (!isGM) {
      return  // Players use viewport-fixed overlay instead
      // While loading (no character ID yet or fog not loaded), show full black fog
      if (!playerCharacterId || !fogLoaded) {
        // Use extremely large static coordinates
        const huge = 1000000
        L.rectangle([[-huge, -huge], [huge, huge]], {
          color: 'transparent',
          fillColor: '#000000',
          fillOpacity: 1,
          interactive: false,
          pane: 'fogPane',
        }).addTo(fogLayerGroup)
        return  // Exit early
      }
      
      // Get ALL active polygons for this player's character
      const playerPolygons = fogPolygons.filter(
        fp => fp.character_id === playerCharacterId && fp.is_active && fp.polygon?.length >= 3
      )
      
      if (playerPolygons.length > 0) {
        // Convert all polygons to map coordinates
        const allPolygonCoords = playerPolygons.map(fogPoly => {
          return fogPoly.polygon.map((p: number[]) => {
            const x = p[0] * MAP_WIDTH
            const y = (1 - p[1]) * MAP_HEIGHT
            return [y, x] as [number, number]
          })
        })
        
        // Create inverted fog - extremely large outer bounds with holes for each polygon
        const huge = 1000000
        const outerBounds: [number, number][] = [
          [-huge, -huge],
          [-huge, huge],
          [huge, huge],
          [huge, -huge],
        ]
        
        // Use MultiPolygon with outer bounds and all fog polygons as holes
        L.polygon([outerBounds, ...allPolygonCoords], {
          color: 'transparent',
          fillColor: '#000000',
          fillOpacity: 1,
          interactive: false,
          pane: 'fogPane',
        }).addTo(fogLayerGroup)
      } else {
        // No active polygons = full fog
        const huge = 1000000
        L.rectangle([[-huge, -huge], [huge, huge]], {
          color: 'transparent',
          fillColor: '#000000',
          fillOpacity: 1,
          interactive: false,
          pane: 'fogPane',
        }).addTo(fogLayerGroup)
      }
    }
  }, [showFog, isGM, fogPolygons, fogLoaded, playerCharacterId, selectedFogCharacter, selectedPolygonId, isFogEditing])
  
  // Handle fog polygon editing (GM only)
  useEffect(() => {
    console.log('Fog edit check:', { 
      hasMap: !!mapInstance, 
      isGM, 
      isFogEditing, 
      selectedPolygonId 
    })
    
    if (!mapInstance || !isGM || !isFogEditing || !selectedPolygonId) {
      return
    }
    
    console.log('Fog edit mode ACTIVE for polygon:', selectedPolygonId)
    
    // Change cursor to crosshair during editing
    mapInstance.getContainer().style.cursor = 'crosshair'
    
    const handleClick = async (e: any) => {
      // Prevent if clicking on a control
      if (e.originalEvent?.target?.closest('.leaflet-control')) {
        console.log('Clicked on control, ignoring')
        return
      }
      
      console.log('FOG CLICK at:', e.latlng)
      
      // Convert click to normalized coordinates
      const x = e.latlng.lng / MAP_WIDTH
      const y = 1 - (e.latlng.lat / MAP_HEIGHT)
      const newPoint = [
        Math.max(0, Math.min(1, x)),
        Math.max(0, Math.min(1, y))
      ]
      
      console.log('Normalized point:', newPoint)
      
      // Get existing polygon - refetch to avoid stale data
      const { data: currentFog } = await supabase
        .from('player_fog_polygons')
        .select('id, polygon')
        .eq('id', selectedPolygonId)
        .single()
      
      const currentPoints = currentFog?.polygon || []
      const newPoints = [...currentPoints, newPoint]
      
      console.log('Saving points:', newPoints.length, 'total')
      
      // Save to database
      const result = await supabase
        .from('player_fog_polygons')
        .update({ polygon: newPoints })
        .eq('id', selectedPolygonId)
      
      if (result.error) {
        console.error('Error saving fog:', result.error)
      } else {
        console.log(`✓ Added fog point #${newPoints.length}`)
        
        // Update local state immediately for real-time visual feedback
        setFogPolygons(prev => prev.map(fp => 
          fp.id === selectedPolygonId 
            ? { ...fp, polygon: newPoints }
            : fp
        ))
      }
    }
    
    mapInstance.on('click', handleClick)
    
    return () => {
      mapInstance.off('click', handleClick)
      if (mapInstance.getContainer()) {
        mapInstance.getContainer().style.cursor = ''
      }
    }
  }, [isGM, isFogEditing, selectedPolygonId, fogPolygons])
  
  // Handle marker creation mode (GM only)
  useEffect(() => {
    if (!mapInstance || !isGM || !isMarkerCreating || !onMapClick) {
      return
    }
    
    // Change cursor to crosshair during marker creation
    mapInstance.getContainer().style.cursor = 'crosshair'
    
    const handleClick = (e: any) => {
      // Prevent if clicking on a control or marker
      if (e.originalEvent?.target?.closest('.leaflet-control') ||
          e.originalEvent?.target?.closest('.map-marker-icon')) {
        return
      }
      
      // Convert click to normalized coordinates
      const x = e.latlng.lng / MAP_WIDTH
      const y = 1 - (e.latlng.lat / MAP_HEIGHT)
      
      // Clamp to valid range
      const normalizedX = Math.max(0, Math.min(1, x))
      const normalizedY = Math.max(0, Math.min(1, y))
      
      onMapClick(normalizedX, normalizedY)
    }
    
    mapInstance.on('click', handleClick)
    
    return () => {
      mapInstance.off('click', handleClick)
      if (mapInstance.getContainer()) {
        mapInstance.getContainer().style.cursor = ''
      }
    }
  }, [isGM, isMarkerCreating, onMapClick])
  
  // Handle position placement mode (GM only)
  useEffect(() => {
    if (!mapInstance || !isGM || !isPositionPlacing || !selectedPositionCharacter) {
      return
    }
    
    // Change cursor to crosshair during position placement
    mapInstance.getContainer().style.cursor = 'crosshair'
    
    const handleClick = async (e: any) => {
      // Prevent if clicking on a control
      if (e.originalEvent?.target?.closest('.leaflet-control')) {
        return
      }
      
      // Convert click to normalized coordinates
      const x = e.latlng.lng / MAP_WIDTH
      const y = 1 - (e.latlng.lat / MAP_HEIGHT)
      
      // Clamp to valid range
      const normalizedX = Math.max(0, Math.min(1, x))
      const normalizedY = Math.max(0, Math.min(1, y))
      
      console.log(`Placing ${selectedPositionCharacter} at (${normalizedX.toFixed(3)}, ${normalizedY.toFixed(3)})`)
      
      // Upsert position (insert or update)
      const { error } = await supabase
        .from('player_positions')
        .upsert({
          character_id: selectedPositionCharacter,
          x: normalizedX,
          y: normalizedY,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'character_id'  // Update if character already has a position
        })
      
      if (error) {
        console.error('Error saving position:', error)
      } else {
        console.log('✓ Position saved')
        
        // Trigger onMapClick to exit placement mode
        if (onMapClick) {
          onMapClick(normalizedX, normalizedY)
        }
      }
    }
    
    mapInstance.on('click', handleClick)
    
    return () => {
      mapInstance.off('click', handleClick)
      if (mapInstance.getContainer()) {
        mapInstance.getContainer().style.cursor = ''
      }
    }
  }, [isGM, isPositionPlacing, selectedPositionCharacter, onMapClick])
  
  // Handle distance measurement mode
  useEffect(() => {
    if (!mapInstance || !isDistanceMeasuring) {
      return
    }
    
    // Change cursor to crosshair during measurement
    mapInstance.getContainer().style.cursor = 'crosshair'
    
    const handleClick = (e: any) => {
      // Prevent if clicking on a control
      if (e.originalEvent?.target?.closest('.leaflet-control')) {
        return
      }
      
      // Convert click to normalized coordinates
      const x = e.latlng.lng / MAP_WIDTH
      const y = 1 - (e.latlng.lat / MAP_HEIGHT)
      
      // Clamp to valid range
      const normalizedX = Math.max(0, Math.min(1, x))
      const normalizedY = Math.max(0, Math.min(1, y))
      
      // Trigger onMapClick to add waypoint
      if (onMapClick) {
        onMapClick(normalizedX, normalizedY)
      }
    }
    
    mapInstance.on('click', handleClick)
    
    return () => {
      mapInstance.off('click', handleClick)
      if (mapInstance.getContainer()) {
        mapInstance.getContainer().style.cursor = ''
      }
    }
  }, [isDistanceMeasuring, onMapClick])
  
  // Handle travel planning mode (GM only)
  useEffect(() => {
    if (!mapInstance || !isGM || !isPlanningTravel) {
      return
    }
    
    // Change cursor to crosshair during planning
    mapInstance.getContainer().style.cursor = 'crosshair'
    
    const handleClick = (e: any) => {
      // Prevent if clicking on a control
      if (e.originalEvent?.target?.closest('.leaflet-control')) {
        return
      }
      
      // Convert click to normalized coordinates
      const x = e.latlng.lng / MAP_WIDTH
      const y = 1 - (e.latlng.lat / MAP_HEIGHT)
      
      // Clamp to valid range
      const normalizedX = Math.max(0, Math.min(1, x))
      const normalizedY = Math.max(0, Math.min(1, y))
      
      // Trigger onMapClick to add waypoint
      if (onMapClick) {
        onMapClick(normalizedX, normalizedY)
      }
    }
    
    mapInstance.on('click', handleClick)
    
    return () => {
      mapInstance.off('click', handleClick)
      if (mapInstance.getContainer()) {
        mapInstance.getContainer().style.cursor = ''
      }
    }
  }, [isGM, isPlanningTravel, onMapClick])

  return (
    <>
      {/* Viewport-fixed fog overlay - simple mask with unioned polygon */}
      {!isGM && unionedPolygon && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 2000 }}
        >
          <svg 
            width="100%" 
            height="100%" 
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            <defs>
              <mask id="unioned-fog-mask">
                {/* White = show fog (opaque), Black = hide fog (transparent/reveal map) */}
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {/* Single unioned polygon in black = reveal map */}
                {unionedPolygon.map((multiPoly: any, i: number) => 
                  multiPoly.map((ring: any, j: number) => {
                    const points = ring.map(([x, y]: [number, number]) => `${x},${y}`).join(' ')
                    return (
                      <polygon 
                        key={`mask-${i}-${j}`}
                        points={points}
                        fill="black"
                      />
                    )
                  })
                )}
              </mask>
            </defs>
            {/* Black fog with mask applied */}
            <rect 
              x="0" 
              y="0" 
              width="100%" 
              height="100%" 
              fill="black"
              mask="url(#unioned-fog-mask)"
            />
          </svg>
        </div>
      )}
      
      {/* Show full black fog if no polygons loaded yet (prevents map flash) */}
      {!isGM && screenPolygons.length === 0 && (
        <div 
          className="absolute inset-0 pointer-events-none bg-black"
          style={{ zIndex: 2000 }}
        />
      )}

      {/* Biome Legend */}
      {showBiomes && showLegend && (
        <div className="absolute top-4 right-4 z-[2100] bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 max-h-[80vh] overflow-y-auto">
          <h3 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wide">
            Biomes
          </h3>
          <div className="space-y-1">
            {BIOMES.filter(b => b.id !== 0).map((biome) => (
              <div key={biome.id} className="flex items-center gap-2 text-xs">
                <div
                  className="w-4 h-4 rounded border border-gray-600"
                  style={{ backgroundColor: biome.color }}
                />
                <span className="text-gray-300">{biome.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Map Container */}
      <div 
        id="map" 
        className="w-full h-full" 
        style={{ 
          minHeight: '400px',
          backgroundColor: '#1a1f2e'  // Dark blue-gray to hide transparent tile areas
        }}
      />
    </>
  )
}
