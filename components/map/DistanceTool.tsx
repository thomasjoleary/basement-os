'use client'

import { useState } from 'react'

interface DistanceToolProps {
  isActive: boolean
  onToggle: (active: boolean) => void
  waypoints: { x: number; y: number }[]
  onClearWaypoints: () => void
  onUndoLastWaypoint: () => void
  onUpdateWaypoint?: (index: number, x: number, y: number) => void
  totalDistance: number
  segmentDistances: number[]
}

export default function DistanceTool({
  isActive,
  onToggle,
  waypoints,
  onClearWaypoints,
  onUndoLastWaypoint,
  totalDistance,
  segmentDistances
}: DistanceToolProps) {
  const [scale, setScale] = useState(75)  // Default: 100 map units = 75 miles
  const [unit, setUnit] = useState('miles')
  
  // Convert map distance to real-world distance
  const convertDistance = (mapDist: number) => {
    // Map distance is in map coordinate units (0-1 normalized * map width)
    // Scale: X map units = scale real units
    return (mapDist * scale / 100)
  }
  
  const realDistance = convertDistance(totalDistance)

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-bold mb-3">📏 Distance Tool</h3>
      
      {/* Toggle button */}
      <button
        onClick={() => onToggle(!isActive)}
        className={`w-full px-4 py-2 rounded font-medium transition-colors mb-3 ${
          isActive
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-white'
        }`}
      >
        {isActive ? '✓ Click Map to Add Points' : 'Start Measuring'}
      </button>
      
      {/* Scale configuration */}
      {!isActive && (
        <div className="mb-3 pb-3 border-b border-gray-700">
          <label className="block text-xs text-gray-400 mb-1">Scale:</label>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-400 whitespace-nowrap">100 units =</span>
            <input
              type="number"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value) || 50)}
              className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
              min="1"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
            >
              <option value="miles">miles</option>
              <option value="km">km</option>
              <option value="feet">feet</option>
              <option value="meters">meters</option>
            </select>
          </div>
          <p className="text-xs text-gray-500 italic">
            Adjust scale to match your campaign map
          </p>
        </div>
      )}
      
      {/* Measurement display */}
      {waypoints.length > 0 && (
        <div className="space-y-2">
          {/* Waypoint count */}
          <div className="text-sm text-gray-300">
            <span className="font-medium">{waypoints.length}</span> waypoint{waypoints.length !== 1 ? 's' : ''}
          </div>
          
          {/* Segments */}
          {segmentDistances.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
              {segmentDistances.map((dist, i) => (
                <div key={i} className="flex justify-between text-gray-400">
                  <span>Segment {i + 1}:</span>
                  <span className="font-mono">
                    {convertDistance(dist).toFixed(1)} {unit}
                  </span>
                </div>
              ))}
            </div>
          )}
          
          {/* Total distance */}
          <div className="pt-2 border-t border-gray-700">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-white">Total Distance:</span>
              <span className="text-lg font-bold text-blue-400 font-mono">
                {realDistance.toFixed(1)} {unit}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              ({totalDistance.toFixed(1)} map units)
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onUndoLastWaypoint}
              disabled={waypoints.length === 0}
              className="flex-1 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded transition"
            >
              ↶ Undo
            </button>
            <button
              onClick={onClearWaypoints}
              className="flex-1 px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded transition"
            >
              ✕ Clear
            </button>
          </div>
        </div>
      )}
      
      {/* Instructions */}
      {isActive && waypoints.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-2">
          Click the map to add waypoints along your path
        </p>
      )}
    </div>
  )
}
