'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Battlefield,
  BattlefieldEntity,
  CharacterLite,
  BASE_CELL_PX,
  FEET_PER_SQUARE,
  resolveVitals,
  entityName,
  kindMeta,
  conditionMeta,
} from '@/lib/battlefield'

const CELL = BASE_CELL_PX
const MIN_SCALE = 0.25
const MAX_SCALE = 3

interface Props {
  battlefield: Battlefield
  entities: BattlefieldEntity[]
  characters: Record<string, CharacterLite>
  isGM: boolean
  selectedId: string | null
  onSelectEntity: (id: string | null) => void
  onMoveEntity: (id: string, x: number, y: number) => void
  tool: 'select' | 'measure'
  rangeEntityId?: string | null
  // Phase 2 (fog) — optional. When fogVisibleCells is provided, cells outside it are fogged.
  fogVisibleCells?: Set<string> | null
  hiddenEntityIds?: Set<string>
}

const CREATURE_KINDS = new Set(['player', 'tame', 'enemy'])

export default function BattlefieldGrid({
  battlefield,
  entities,
  characters,
  isGM,
  selectedId,
  onSelectEntity,
  onMoveEntity,
  tool,
  rangeEntityId,
  fogVisibleCells = null,
  hiddenEntityIds,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 40, y: 40 })

  // Gesture bookkeeping
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const pinchStart = useRef<{ dist: number; scale: number; cx: number; cy: number; panX: number; panY: number } | null>(null)

  // Token drag
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null)
  const dragMeta = useRef<{ id: string; grabDX: number; grabDY: number } | null>(null)

  // Measurement
  const [measure, setMeasure] = useState<{ ax: number; ay: number; bx: number; by: number } | null>(null)
  const measuring = useRef(false)

  const width = battlefield.cols * CELL
  const height = battlefield.rows * CELL

  const clampX = (v: number, w: number) => Math.max(0, Math.min(battlefield.cols - w, v))
  const clampY = (v: number, h: number) => Math.max(0, Math.min(battlefield.rows - h, v))

  // Convert a client (screen) point to grid-cell coordinates.
  const screenToCell = useCallback(
    (clientX: number, clientY: number) => {
      const rect = wrapRef.current?.getBoundingClientRect()
      if (!rect) return { cx: 0, cy: 0, sx: 0, sy: 0 }
      const sx = (clientX - rect.left - pan.x) / scale
      const sy = (clientY - rect.top - pan.y) / scale
      return { cx: Math.floor(sx / CELL), cy: Math.floor(sy / CELL), sx, sy }
    },
    [pan, scale]
  )

  // ---- Zoom -------------------------------------------------------------
  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      setScale(prevScale => {
        const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prevScale * factor))
        const ratio = next / prevScale
        setPan(prev => ({ x: cx - (cx - prev.x) * ratio, y: cy - (cy - prev.y) * ratio }))
        return next
      })
    },
    []
  )

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const rect = wrapRef.current?.getBoundingClientRect()
      if (!rect) return
      zoomAt(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - rect.left, e.clientY - rect.top)
    },
    [zoomAt]
  )

  const zoomButton = (factor: number) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    zoomAt(factor, rect.width / 2, rect.height / 2)
  }

  const resetView = () => {
    setScale(1)
    setPan({ x: 40, y: 40 })
  }

  // ---- Background pan / pinch ------------------------------------------
  const onBgPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

    if (tool === 'measure' && isGM) {
      const { cx, cy } = screenToCell(e.clientX, e.clientY)
      setMeasure({ ax: cx, ay: cy, bx: cx, by: cy })
      measuring.current = true
      return
    }

    if (pointers.current.size === 1) {
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
      onSelectEntity(null)
    } else if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const rect = wrapRef.current!.getBoundingClientRect()
      pinchStart.current = {
        dist,
        scale,
        cx: (pts[0].x + pts[1].x) / 2 - rect.left,
        cy: (pts[0].y + pts[1].y) / 2 - rect.top,
        panX: pan.x,
        panY: pan.y,
      }
      panStart.current = null
    }
  }

  const onBgPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (measuring.current && measure) {
      const { cx, cy } = screenToCell(e.clientX, e.clientY)
      setMeasure(m => (m ? { ...m, bx: cx, by: cy } : m))
      return
    }

    if (pinchStart.current && pointers.current.size >= 2) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const ps = pinchStart.current
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, ps.scale * (dist / ps.dist)))
      const ratio = next / ps.scale
      setScale(next)
      setPan({ x: ps.cx - (ps.cx - ps.panX) * ratio, y: ps.cy - (ps.cy - ps.panY) * ratio })
      return
    }

    if (panStart.current) {
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      })
    }
  }

  const onBgPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 0) {
      panStart.current = null
      measuring.current = false
    }
  }

  // ---- Token drag (GM only) --------------------------------------------
  const onTokenPointerDown = (e: React.PointerEvent, ent: BattlefieldEntity) => {
    e.stopPropagation()
    onSelectEntity(ent.id)
    if (!isGM || tool === 'measure') return
    const { sx, sy } = screenToCell(e.clientX, e.clientY)
    dragMeta.current = { id: ent.id, grabDX: sx / CELL - ent.x, grabDY: sy / CELL - ent.y }
    setDrag({ id: ent.id, x: ent.x, y: ent.y })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onTokenPointerMove = (e: React.PointerEvent, ent: BattlefieldEntity) => {
    if (!dragMeta.current || dragMeta.current.id !== ent.id) return
    e.stopPropagation()
    const { sx, sy } = screenToCell(e.clientX, e.clientY)
    const nx = clampX(Math.round(sx / CELL - dragMeta.current.grabDX), ent.width)
    const ny = clampY(Math.round(sy / CELL - dragMeta.current.grabDY), ent.height)
    setDrag({ id: ent.id, x: nx, y: ny })
  }

  const onTokenPointerUp = (e: React.PointerEvent, ent: BattlefieldEntity) => {
    if (!dragMeta.current || dragMeta.current.id !== ent.id) return
    e.stopPropagation()
    const d = drag
    dragMeta.current = null
    setDrag(null)
    if (d && (d.x !== ent.x || d.y !== ent.y)) onMoveEntity(ent.id, d.x, d.y)
  }

  // Prevent the page from scrolling while interacting on touch devices.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const prevent = (e: WheelEvent) => e.preventDefault()
    el.addEventListener('wheel', prevent, { passive: false })
    return () => el.removeEventListener('wheel', prevent)
  }, [])

  // ---- Stacking offsets for creatures sharing a square ------------------
  const stackOffsets = useMemo(() => {
    const byCell = new Map<string, string[]>()
    for (const e of entities) {
      if (!CREATURE_KINDS.has(e.kind)) continue
      const key = `${e.x},${e.y}`
      const arr = byCell.get(key) ?? []
      arr.push(e.id)
      byCell.set(key, arr)
    }
    const out = new Map<string, { i: number; n: number }>()
    for (const ids of byCell.values()) {
      ids.forEach((id, i) => out.set(id, { i, n: ids.length }))
    }
    return out
  }, [entities])

  // ---- Movement range highlight ----------------------------------------
  const rangeCells = useMemo(() => {
    if (!rangeEntityId) return null
    const ent = entities.find(e => e.id === rangeEntityId)
    if (!ent) return null
    const reach = Math.floor(ent.move_ft / FEET_PER_SQUARE)
    const set = new Set<string>()
    for (let gx = ent.x - reach; gx <= ent.x + ent.width - 1 + reach; gx++) {
      for (let gy = ent.y - reach; gy <= ent.y + ent.height - 1 + reach; gy++) {
        if (gx < 0 || gy < 0 || gx >= battlefield.cols || gy >= battlefield.rows) continue
        const dx = Math.max(0, ent.x - gx, gx - (ent.x + ent.width - 1))
        const dy = Math.max(0, ent.y - gy, gy - (ent.y + ent.height - 1))
        if (Math.max(dx, dy) <= reach) set.add(`${gx},${gy}`)
      }
    }
    return set
  }, [rangeEntityId, entities, battlefield.cols, battlefield.rows])

  const measureFeet = measure
    ? Math.max(Math.abs(measure.ax - measure.bx), Math.abs(measure.ay - measure.by)) * FEET_PER_SQUARE
    : 0

  const borderStyle =
    battlefield.border_type === 'indoor'
      ? { boxShadow: 'inset 0 0 0 6px #57534e', border: '2px solid #78716c' }
      : { boxShadow: 'inset 0 0 0 4px rgba(34,197,94,0.35)', border: '2px dashed #4ade80' }

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-950 select-none" style={{ touchAction: 'none' }}>
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-30 flex flex-col gap-1">
        <button onClick={() => zoomButton(1.2)} className="w-9 h-9 rounded bg-gray-800/90 border border-gray-600 text-white text-lg hover:bg-gray-700" aria-label="Zoom in">+</button>
        <button onClick={() => zoomButton(0.83)} className="w-9 h-9 rounded bg-gray-800/90 border border-gray-600 text-white text-lg hover:bg-gray-700" aria-label="Zoom out">−</button>
        <button onClick={resetView} className="w-9 h-9 rounded bg-gray-800/90 border border-gray-600 text-white text-xs hover:bg-gray-700" aria-label="Reset view">⤢</button>
      </div>

      {/* Border-type badge */}
      <div className="absolute top-3 left-3 z-30 text-xs font-bold px-2 py-1 rounded border"
        style={battlefield.border_type === 'indoor'
          ? { background: 'rgba(87,83,74,0.9)', borderColor: '#a8a29e', color: '#f5f5f4' }
          : { background: 'rgba(22,101,52,0.85)', borderColor: '#4ade80', color: '#dcfce7' }}>
        {battlefield.border_type === 'indoor' ? '🏠 Indoor — no fleeing out' : '🌳 Outdoor — open to flee'}
      </div>

      {measure && (
        <div className="absolute bottom-3 left-3 z-30 text-sm font-mono px-3 py-1.5 rounded bg-black/80 border border-red-700 text-red-200">
          📏 {measureFeet} ft ({measureFeet / FEET_PER_SQUARE} sq)
          <button onClick={() => setMeasure(null)} className="ml-3 text-gray-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Interaction surface */}
      <div
        ref={wrapRef}
        className="absolute inset-0"
        onWheel={onWheel}
        onPointerDown={onBgPointerDown}
        onPointerMove={onBgPointerMove}
        onPointerUp={onBgPointerUp}
        onPointerCancel={onBgPointerUp}
      >
        {/* Stage */}
        <div
          className="absolute"
          style={{
            width,
            height,
            transformOrigin: '0 0',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            backgroundColor: battlefield.bg_color,
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px)',
            backgroundSize: `${CELL}px ${CELL}px`,
            ...borderStyle,
          }}
        >
          {/* Movement range */}
          {rangeCells &&
            [...rangeCells].map(key => {
              const [gx, gy] = key.split(',').map(Number)
              return (
                <div
                  key={`r-${key}`}
                  className="absolute pointer-events-none"
                  style={{ left: gx * CELL, top: gy * CELL, width: CELL, height: CELL, background: 'rgba(59,130,246,0.22)', boxShadow: 'inset 0 0 0 1px rgba(59,130,246,0.4)' }}
                />
              )
            })}

          {/* Fog (Phase 2): darken cells outside the visible set */}
          {fogVisibleCells &&
            Array.from({ length: battlefield.cols * battlefield.rows }).map((_, idx) => {
              const gx = idx % battlefield.cols
              const gy = Math.floor(idx / battlefield.cols)
              if (fogVisibleCells.has(`${gx},${gy}`)) return null
              return (
                <div key={`f-${idx}`} className="absolute pointer-events-none" style={{ left: gx * CELL, top: gy * CELL, width: CELL, height: CELL, background: '#020617' }} />
              )
            })}

          {/* Entities */}
          {entities.map(ent => {
            if (hiddenEntityIds?.has(ent.id)) return null
            const isTerrain = !CREATURE_KINDS.has(ent.kind)
            const pos = drag && drag.id === ent.id ? drag : ent
            const stack = stackOffsets.get(ent.id)
            const shrink = stack && stack.n > 1 ? 0.62 : 1
            const offX = stack && stack.n > 1 ? (stack.i - (stack.n - 1) / 2) * CELL * 0.28 : 0
            const offY = stack && stack.n > 1 ? (stack.i - (stack.n - 1) / 2) * CELL * 0.28 : 0
            const w = ent.width * CELL
            const h = ent.height * CELL
            const meta = kindMeta(ent.kind)
            const name = entityName(ent, characters)
            const vitals = resolveVitals(ent, characters)
            const selected = selectedId === ent.id
            const dragging = drag?.id === ent.id
            const hpPct = vitals.hpMax ? Math.max(0, Math.min(100, (100 * (vitals.hp ?? 0)) / vitals.hpMax)) : null
            const manaPct = vitals.manaMax ? Math.max(0, Math.min(100, (100 * (vitals.mana ?? 0)) / vitals.manaMax)) : null

            return (
              <div
                key={ent.id}
                onPointerDown={e => onTokenPointerDown(e, ent)}
                onPointerMove={e => onTokenPointerMove(e, ent)}
                onPointerUp={e => onTokenPointerUp(e, ent)}
                onPointerCancel={e => onTokenPointerUp(e, ent)}
                className="absolute"
                style={{
                  left: pos.x * CELL + offX,
                  top: pos.y * CELL + offY,
                  width: w,
                  height: h,
                  zIndex: dragging ? 50 : selected ? 40 : isTerrain ? 5 : 10 + (stack?.i ?? 0),
                  cursor: isGM && tool === 'select' ? (dragging ? 'grabbing' : 'grab') : 'pointer',
                  touchAction: 'none',
                }}
              >
                <div
                  className="absolute inset-0 flex items-center justify-center overflow-hidden"
                  style={{
                    margin: shrink < 1 ? `${(h * (1 - shrink)) / 2}px ${(w * (1 - shrink)) / 2}px` : 2,
                    borderRadius: isTerrain ? 4 : ent.width === 1 && ent.height === 1 ? '50%' : 10,
                    background: isTerrain ? ent.color : `${ent.color}dd`,
                    border: selected ? '2px solid #fbbf24' : `2px solid ${ent.color}`,
                    boxShadow: selected ? '0 0 0 2px rgba(251,191,36,0.5)' : '0 1px 4px rgba(0,0,0,0.5)',
                    opacity: ent.kind === 'wall' ? 0.9 : 1,
                  }}
                >
                  <span style={{ fontSize: Math.min(w, h) * (isTerrain ? 0.5 : 0.42) }}>{ent.icon || meta.icon}</span>
                </div>

                {/* Name + vitals for creatures */}
                {!isTerrain && (
                  <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none" style={{ top: h + 1, width: Math.max(w, CELL * 1.4) }}>
                    <div className="px-1 rounded bg-black/75 text-white text-center leading-tight whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: 10, maxWidth: '100%' }}>
                      {name}
                    </div>
                    {hpPct !== null && (
                      <div className="mt-0.5 h-1.5 rounded-full bg-gray-800 overflow-hidden" style={{ width: Math.max(w - 4, 28) }}>
                        <div className="h-full" style={{ width: `${hpPct}%`, background: hpPct > 50 ? '#22c55e' : hpPct > 20 ? '#eab308' : '#ef4444' }} />
                      </div>
                    )}
                    {manaPct !== null && (
                      <div className="mt-0.5 h-1 rounded-full bg-gray-800 overflow-hidden" style={{ width: Math.max(w - 4, 28) }}>
                        <div className="h-full" style={{ width: `${manaPct}%`, background: '#3b82f6' }} />
                      </div>
                    )}
                    {ent.conditions.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap justify-center gap-0.5" style={{ maxWidth: Math.max(w, CELL * 1.6) }}>
                        {ent.conditions.map(c => (
                          <span key={c} title={conditionMeta(c)?.label} style={{ fontSize: 9 }}>{conditionMeta(c)?.icon}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Measurement line */}
          {measure && (
            <svg className="absolute inset-0 pointer-events-none" width={width} height={height} style={{ overflow: 'visible' }}>
              <line
                x1={(measure.ax + 0.5) * CELL}
                y1={(measure.ay + 0.5) * CELL}
                x2={(measure.bx + 0.5) * CELL}
                y2={(measure.by + 0.5) * CELL}
                stroke="#f87171"
                strokeWidth={3 / scale}
                strokeDasharray={`${8 / scale} ${5 / scale}`}
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}
