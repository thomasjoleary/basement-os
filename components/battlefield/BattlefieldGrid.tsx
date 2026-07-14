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
const CLICK_SLOP = 4 // px of movement below which a press counts as a click

type Tool = 'select' | 'pan' | 'measure' | 'fog'
type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

interface Props {
  battlefield: Battlefield
  entities: BattlefieldEntity[]
  characters: Record<string, CharacterLite>
  isGM: boolean
  selectedIds: string[]
  tool: Tool
  rangeEntityId?: string | null
  onSelectionChange: (ids: string[], opts?: { inspect?: boolean }) => void
  onInspect: (id: string) => void
  onMoveEntities: (moves: { id: string; x: number; y: number }[]) => void
  onResizeEntity: (id: string, box: { x: number; y: number; width: number; height: number }) => void
  // Phase 2 (fog)
  fogVisibleCells?: Set<string> | null
  hiddenEntityIds?: Set<string>
  fogDisplay?: 'none' | 'player' | 'edit' // player = opaque black outside; edit = translucent + tint
  fogReveal?: boolean                     // when painting with the fog tool: true reveals, false hides
  fogShape?: 'rect' | 'brush'
  onPaintCells?: (cells: string[], reveal: boolean) => void
}

const CREATURE_KINDS = new Set(['player', 'tame', 'enemy'])

export default function BattlefieldGrid({
  battlefield,
  entities,
  characters,
  isGM,
  selectedIds,
  tool,
  rangeEntityId,
  onSelectionChange,
  onInspect,
  onMoveEntities,
  onResizeEntity,
  fogVisibleCells = null,
  hiddenEntityIds,
  fogDisplay = 'none',
  fogReveal = true,
  fogShape = 'rect',
  onPaintCells,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 40, y: 40 })

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  // Gesture bookkeeping
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const pinchStart = useRef<{ dist: number; scale: number; cx: number; cy: number; panX: number; panY: number } | null>(null)

  // Marquee selection (stage coords)
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const marqueeRef = useRef<{ additive: boolean; startClient: { x: number; y: number } } | null>(null)

  // Token / group drag
  const [ghosts, setGhosts] = useState<Map<string, { x: number; y: number }> | null>(null)
  const dragRef = useRef<{
    ids: string[]
    orig: Map<string, { x: number; y: number; width: number; height: number }>
    startCellX: number
    startCellY: number
    minDx: number
    maxDx: number
    minDy: number
    maxDy: number
    clickId: string
    moved: boolean
    additive: boolean
  } | null>(null)

  // Resize
  const [resizeBox, setResizeBox] = useState<{ id: string; x: number; y: number; width: number; height: number } | null>(null)
  const resizeRef = useRef<{ id: string; handle: Handle; orig: { x: number; y: number; width: number; height: number } } | null>(null)

  // Measurement
  const [measure, setMeasure] = useState<{ ax: number; ay: number; bx: number; by: number } | null>(null)
  const measuring = useRef(false)

  // Fog painting
  const fogPaintRef = useRef<{ shape: 'rect' | 'brush'; reveal: boolean; start: { x: number; y: number } } | null>(null)
  const [fogPreview, setFogPreview] = useState<Set<string> | null>(null)

  const width = battlefield.cols * CELL
  const height = battlefield.rows * CELL

  const toStage = useCallback(
    (clientX: number, clientY: number) => {
      const rect = wrapRef.current?.getBoundingClientRect()
      if (!rect) return { sx: 0, sy: 0 }
      return { sx: (clientX - rect.left - pan.x) / scale, sy: (clientY - rect.top - pan.y) / scale }
    },
    [pan, scale]
  )

  const cellAt = useCallback(
    (clientX: number, clientY: number) => {
      const { sx, sy } = toStage(clientX, clientY)
      return {
        cx: Math.max(0, Math.min(battlefield.cols - 1, Math.floor(sx / CELL))),
        cy: Math.max(0, Math.min(battlefield.rows - 1, Math.floor(sy / CELL))),
      }
    },
    [toStage, battlefield.cols, battlefield.rows]
  )

  const rectCells = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const set = new Set<string>()
    for (let gx = Math.min(a.x, b.x); gx <= Math.max(a.x, b.x); gx++)
      for (let gy = Math.min(a.y, b.y); gy <= Math.max(a.y, b.y); gy++) set.add(`${gx},${gy}`)
    return set
  }

  // ---- Zoom -------------------------------------------------------------
  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setScale(prevScale => {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prevScale * factor))
      const ratio = next / prevScale
      setPan(prev => ({ x: cx - (cx - prev.x) * ratio, y: cy - (cy - prev.y) * ratio }))
      return next
    })
  }, [])

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

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const prevent = (e: WheelEvent) => e.preventDefault()
    el.addEventListener('wheel', prevent, { passive: false })
    return () => el.removeEventListener('wheel', prevent)
  }, [])

  // ---- Background: pan / marquee / pinch / measure ----------------------
  const onBgPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

    if (tool === 'measure' && isGM) {
      const { sx, sy } = toStage(e.clientX, e.clientY)
      const cx = Math.floor(sx / CELL)
      const cy = Math.floor(sy / CELL)
      setMeasure({ ax: cx, ay: cy, bx: cx, by: cy })
      measuring.current = true
      return
    }

    if (tool === 'fog' && isGM && onPaintCells) {
      const { cx, cy } = cellAt(e.clientX, e.clientY)
      fogPaintRef.current = { shape: fogShape, reveal: fogReveal, start: { x: cx, y: cy } }
      setFogPreview(new Set([`${cx},${cy}`]))
      return
    }

    if (pointers.current.size === 2) {
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
      marqueeRef.current = null
      setMarquee(null)
      return
    }

    // Middle/right mouse always pans; pan tool pans; touch pans (mobile = mostly viewing).
    const wantsPan = tool === 'pan' || e.button === 1 || e.button === 2 || e.pointerType === 'touch'

    if (wantsPan) {
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
      return
    }

    // select tool + mouse on empty space -> marquee
    const { sx, sy } = toStage(e.clientX, e.clientY)
    marqueeRef.current = { additive: e.shiftKey, startClient: { x: e.clientX, y: e.clientY } }
    setMarquee({ x0: sx, y0: sy, x1: sx, y1: sy })
  }

  const onBgPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (measuring.current) {
      const { sx, sy } = toStage(e.clientX, e.clientY)
      setMeasure(m => (m ? { ...m, bx: Math.floor(sx / CELL), by: Math.floor(sy / CELL) } : m))
      return
    }

    if (fogPaintRef.current) {
      const { cx, cy } = cellAt(e.clientX, e.clientY)
      if (fogPaintRef.current.shape === 'brush') {
        setFogPreview(prev => { const s = new Set(prev); s.add(`${cx},${cy}`); return s })
      } else {
        setFogPreview(rectCells(fogPaintRef.current.start, { x: cx, y: cy }))
      }
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
      setPan({ x: panStart.current.panX + (e.clientX - panStart.current.x), y: panStart.current.panY + (e.clientY - panStart.current.y) })
      return
    }

    if (marqueeRef.current) {
      const { sx, sy } = toStage(e.clientX, e.clientY)
      setMarquee(m => (m ? { ...m, x1: sx, y1: sy } : m))
    }
  }

  const onBgPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null

    if (fogPaintRef.current) {
      const reveal = fogPaintRef.current.reveal
      fogPaintRef.current = null
      if (fogPreview && fogPreview.size && onPaintCells) onPaintCells([...fogPreview], reveal)
      setFogPreview(null)
      return
    }

    if (marqueeRef.current && marquee) {
      const moved = Math.hypot(e.clientX - marqueeRef.current.startClient.x, e.clientY - marqueeRef.current.startClient.y) > CLICK_SLOP
      const x0 = Math.min(marquee.x0, marquee.x1)
      const y0 = Math.min(marquee.y0, marquee.y1)
      const x1 = Math.max(marquee.x0, marquee.x1)
      const y1 = Math.max(marquee.y0, marquee.y1)
      const hits = entities
        .filter(en => {
          if (hiddenEntityIds?.has(en.id)) return false
          const l = en.x * CELL
          const t = en.y * CELL
          const r = (en.x + en.width) * CELL
          const b = (en.y + en.height) * CELL
          return l < x1 && r > x0 && t < y1 && b > y0
        })
        .map(en => en.id)
      if (!moved) {
        // plain click on empty space
        onSelectionChange(marqueeRef.current.additive ? selectedIds : [])
      } else if (marqueeRef.current.additive) {
        onSelectionChange([...new Set([...selectedIds, ...hits])], { inspect: true })
      } else {
        onSelectionChange(hits, { inspect: true })
      }
      marqueeRef.current = null
      setMarquee(null)
    }

    if (pointers.current.size === 0) {
      panStart.current = null
      measuring.current = false
    }
  }

  // ---- Token drag (GM, select tool) ------------------------------------
  const onTokenPointerDown = (e: React.PointerEvent, ent: BattlefieldEntity) => {
    e.stopPropagation()
    if (!isGM || tool !== 'select') {
      onSelectionChange([ent.id])
      onInspect(ent.id)
      return
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

    const inSel = selectedSet.has(ent.id)
    let dragIds: string[]
    if (e.shiftKey) {
      const next = inSel ? selectedIds.filter(x => x !== ent.id) : [...selectedIds, ent.id]
      onSelectionChange(next)
      dragIds = next
    } else if (inSel && selectedIds.length > 1) {
      dragIds = selectedIds // keep group for a potential group drag
    } else {
      onSelectionChange([ent.id])
      dragIds = [ent.id]
    }

    const orig = new Map<string, { x: number; y: number; width: number; height: number }>()
    let minDx = -Infinity, maxDx = Infinity, minDy = -Infinity, maxDy = Infinity
    for (const id of dragIds) {
      const en = entities.find(x => x.id === id)
      if (!en) continue
      orig.set(id, { x: en.x, y: en.y, width: en.width, height: en.height })
      minDx = Math.max(minDx, -en.x)
      maxDx = Math.min(maxDx, battlefield.cols - en.width - en.x)
      minDy = Math.max(minDy, -en.y)
      maxDy = Math.min(maxDy, battlefield.rows - en.height - en.y)
    }
    const { sx, sy } = toStage(e.clientX, e.clientY)
    dragRef.current = {
      ids: dragIds,
      orig,
      startCellX: sx / CELL,
      startCellY: sy / CELL,
      minDx, maxDx, minDy, maxDy,
      clickId: ent.id,
      moved: false,
      additive: e.shiftKey,
    }
  }

  const onTokenPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    e.stopPropagation()
    const { sx, sy } = toStage(e.clientX, e.clientY)
    let dcx = Math.round(sx / CELL - d.startCellX)
    let dcy = Math.round(sy / CELL - d.startCellY)
    if (dcx !== 0 || dcy !== 0) d.moved = true
    dcx = Math.max(d.minDx, Math.min(d.maxDx, dcx))
    dcy = Math.max(d.minDy, Math.min(d.maxDy, dcy))
    const g = new Map<string, { x: number; y: number }>()
    for (const [id, o] of d.orig) g.set(id, { x: o.x + dcx, y: o.y + dcy })
    setGhosts(g)
  }

  const onTokenPointerUp = (e: React.PointerEvent, ent: BattlefieldEntity) => {
    const d = dragRef.current
    if (!d) return
    e.stopPropagation()
    dragRef.current = null
    const g = ghosts
    setGhosts(null)
    if (d.moved && g) {
      const moves: { id: string; x: number; y: number }[] = []
      for (const [id, pos] of g) {
        const o = d.orig.get(id)
        if (o && (o.x !== pos.x || o.y !== pos.y)) moves.push({ id, x: pos.x, y: pos.y })
      }
      if (moves.length) onMoveEntities(moves)
    } else if (!d.additive) {
      // click (no drag) -> select just this + open inspector
      onSelectionChange([ent.id])
      onInspect(ent.id)
    } else {
      onInspect(ent.id)
    }
  }

  // ---- Resize handles ---------------------------------------------------
  const onHandlePointerDown = (e: React.PointerEvent, ent: BattlefieldEntity, handle: Handle) => {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    resizeRef.current = { id: ent.id, handle, orig: { x: ent.x, y: ent.y, width: ent.width, height: ent.height } }
    setResizeBox({ id: ent.id, x: ent.x, y: ent.y, width: ent.width, height: ent.height })
  }

  const onHandlePointerMove = (e: React.PointerEvent) => {
    const r = resizeRef.current
    if (!r) return
    e.stopPropagation()
    const { sx, sy } = toStage(e.clientX, e.clientY)
    const col = Math.round(sx / CELL)
    const row = Math.round(sy / CELL)
    let { x, y, width: w, height: h } = r.orig
    const right = r.orig.x + r.orig.width
    const bottom = r.orig.y + r.orig.height
    if (r.handle.includes('e')) w = Math.max(1, Math.min(battlefield.cols - x, col - x))
    if (r.handle.includes('s')) h = Math.max(1, Math.min(battlefield.rows - y, row - y))
    if (r.handle.includes('w')) { const nx = Math.max(0, Math.min(right - 1, col)); w = right - nx; x = nx }
    if (r.handle.includes('n')) { const ny = Math.max(0, Math.min(bottom - 1, row)); h = bottom - ny; y = ny }
    setResizeBox({ id: r.id, x, y, width: w, height: h })
  }

  const onHandlePointerUp = (e: React.PointerEvent) => {
    const r = resizeRef.current
    if (!r) return
    e.stopPropagation()
    const box = resizeBox
    resizeRef.current = null
    setResizeBox(null)
    if (box && (box.x !== r.orig.x || box.y !== r.orig.y || box.width !== r.orig.width || box.height !== r.orig.height)) {
      onResizeEntity(r.id, box)
    }
  }

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
    for (const ids of byCell.values()) ids.forEach((id, i) => out.set(id, { i, n: ids.length }))
    return out
  }, [entities])

  // ---- Movement range ---------------------------------------------------
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

  const measureFeet = measure ? Math.max(Math.abs(measure.ax - measure.bx), Math.abs(measure.ay - measure.by)) * FEET_PER_SQUARE : 0

  const borderStyle =
    battlefield.border_type === 'indoor'
      ? { boxShadow: 'inset 0 0 0 6px #57534e', border: '2px solid #78716c' }
      : { boxShadow: 'inset 0 0 0 4px rgba(34,197,94,0.35)', border: '2px dashed #4ade80' }

  const singleSelected = selectedIds.length === 1 ? entities.find(e => e.id === selectedIds[0]) : null
  const handleGeom = singleSelected
    ? (resizeBox && resizeBox.id === singleSelected.id ? resizeBox : { x: singleSelected.x, y: singleSelected.y, width: singleSelected.width, height: singleSelected.height })
    : null
  const hSize = 11 / scale

  const norm = marquee ? { x: Math.min(marquee.x0, marquee.x1), y: Math.min(marquee.y0, marquee.y1), w: Math.abs(marquee.x1 - marquee.x0), h: Math.abs(marquee.y1 - marquee.y0) } : null

  const handleDefs: { h: Handle; cx: number; cy: number; cursor: string }[] = handleGeom
    ? [
        { h: 'nw', cx: handleGeom.x, cy: handleGeom.y, cursor: 'nwse-resize' },
        { h: 'n', cx: handleGeom.x + handleGeom.width / 2, cy: handleGeom.y, cursor: 'ns-resize' },
        { h: 'ne', cx: handleGeom.x + handleGeom.width, cy: handleGeom.y, cursor: 'nesw-resize' },
        { h: 'e', cx: handleGeom.x + handleGeom.width, cy: handleGeom.y + handleGeom.height / 2, cursor: 'ew-resize' },
        { h: 'se', cx: handleGeom.x + handleGeom.width, cy: handleGeom.y + handleGeom.height, cursor: 'nwse-resize' },
        { h: 's', cx: handleGeom.x + handleGeom.width / 2, cy: handleGeom.y + handleGeom.height, cursor: 'ns-resize' },
        { h: 'sw', cx: handleGeom.x, cy: handleGeom.y + handleGeom.height, cursor: 'nesw-resize' },
        { h: 'w', cx: handleGeom.x, cy: handleGeom.y + handleGeom.height / 2, cursor: 'ew-resize' },
      ]
    : []

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-gray-950 select-none"
      style={{ touchAction: 'none' }}
      onContextMenu={e => e.preventDefault()}
    >
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
              return <div key={`r-${key}`} className="absolute pointer-events-none" style={{ left: gx * CELL, top: gy * CELL, width: CELL, height: CELL, background: 'rgba(59,130,246,0.22)', boxShadow: 'inset 0 0 0 1px rgba(59,130,246,0.4)' }} />
            })}

          {/* Fog: black-out (player) or translucent shroud (GM edit) outside the visible set */}
          {fogDisplay !== 'none' && fogVisibleCells &&
            Array.from({ length: battlefield.cols * battlefield.rows }).map((_, idx) => {
              const gx = idx % battlefield.cols
              const gy = Math.floor(idx / battlefield.cols)
              if (fogVisibleCells.has(`${gx},${gy}`)) return null
              return <div key={`f-${idx}`} className="absolute pointer-events-none" style={{
                left: gx * CELL, top: gy * CELL, width: CELL, height: CELL,
                background: fogDisplay === 'player' ? '#020617' : 'rgba(2,6,23,0.6)',
                zIndex: fogDisplay === 'player' ? 45 : 1,
              }} />
            })}

          {/* Fog paint preview (GM) */}
          {fogPreview &&
            [...fogPreview].map(key => {
              const [gx, gy] = key.split(',').map(Number)
              return <div key={`fp-${key}`} className="absolute pointer-events-none" style={{
                left: gx * CELL, top: gy * CELL, width: CELL, height: CELL, zIndex: 46,
                background: fogReveal ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.45)',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.3)',
              }} />
            })}

          {/* Entities */}
          {entities.map(ent => {
            if (hiddenEntityIds?.has(ent.id)) return null
            const isTerrain = !CREATURE_KINDS.has(ent.kind)
            const g = ghosts?.get(ent.id)
            const box = resizeBox && resizeBox.id === ent.id ? resizeBox : null
            const posX = g ? g.x : box ? box.x : ent.x
            const posY = g ? g.y : box ? box.y : ent.y
            const wCells = box ? box.width : ent.width
            const hCells = box ? box.height : ent.height
            const stack = stackOffsets.get(ent.id)
            const shrink = stack && stack.n > 1 ? 0.62 : 1
            const off = stack && stack.n > 1 ? (stack.i - (stack.n - 1) / 2) * CELL * 0.28 : 0
            const w = wCells * CELL
            const h = hCells * CELL
            const meta = kindMeta(ent.kind)
            const name = entityName(ent, characters)
            const vitals = resolveVitals(ent, characters)
            const selected = selectedSet.has(ent.id)
            const dragging = !!g
            const hpPct = vitals.hpMax ? Math.max(0, Math.min(100, (100 * (vitals.hp ?? 0)) / vitals.hpMax)) : null
            const manaPct = vitals.manaMax ? Math.max(0, Math.min(100, (100 * (vitals.mana ?? 0)) / vitals.manaMax)) : null

            return (
              <div
                key={ent.id}
                onPointerDown={e => onTokenPointerDown(e, ent)}
                onPointerMove={onTokenPointerMove}
                onPointerUp={e => onTokenPointerUp(e, ent)}
                onPointerCancel={e => onTokenPointerUp(e, ent)}
                className="absolute"
                style={{
                  left: posX * CELL + off,
                  top: posY * CELL + off,
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
                    borderRadius: isTerrain ? 4 : wCells === 1 && hCells === 1 ? '50%' : 10,
                    background: isTerrain ? ent.color : `${ent.color}dd`,
                    border: selected ? '2px solid #fbbf24' : `2px solid ${ent.color}`,
                    boxShadow: selected ? '0 0 0 2px rgba(251,191,36,0.5)' : '0 1px 4px rgba(0,0,0,0.5)',
                    opacity: ent.kind === 'wall' ? 0.9 : 1,
                  }}
                >
                  <span style={{ fontSize: Math.min(w, h) * (isTerrain ? 0.5 : 0.42) }}>{ent.icon || meta.icon}</span>
                </div>

                {!isTerrain && (
                  <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none" style={{ top: h + 1, width: Math.max(w, CELL * 1.4) }}>
                    <div className="px-1 rounded bg-black/75 text-white text-center leading-tight whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: 10, maxWidth: '100%' }}>{name}</div>
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
                        {ent.conditions.map(c => <span key={c} title={conditionMeta(c)?.label} style={{ fontSize: 9 }}>{conditionMeta(c)?.icon}</span>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Resize handles (single selection, GM, select tool) */}
          {isGM && tool === 'select' && handleGeom && handleDefs.map(hd => (
            <div
              key={hd.h}
              onPointerDown={e => onHandlePointerDown(e, singleSelected!, hd.h)}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
              onPointerCancel={onHandlePointerUp}
              className="absolute"
              style={{
                left: hd.cx * CELL - hSize / 2,
                top: hd.cy * CELL - hSize / 2,
                width: hSize,
                height: hSize,
                background: '#fbbf24',
                border: `${1 / scale}px solid #78350f`,
                borderRadius: 2 / scale,
                zIndex: 60,
                cursor: hd.cursor,
                touchAction: 'none',
              }}
            />
          ))}

          {/* Marquee */}
          {norm && (
            <div className="absolute pointer-events-none" style={{ left: norm.x, top: norm.y, width: norm.w, height: norm.h, background: 'rgba(251,191,36,0.12)', border: `${1.5 / scale}px solid #fbbf24` }} />
          )}

          {/* Measurement line */}
          {measure && (
            <svg className="absolute inset-0 pointer-events-none" width={width} height={height} style={{ overflow: 'visible' }}>
              <line x1={(measure.ax + 0.5) * CELL} y1={(measure.ay + 0.5) * CELL} x2={(measure.bx + 0.5) * CELL} y2={(measure.by + 0.5) * CELL} stroke="#f87171" strokeWidth={3 / scale} strokeDasharray={`${8 / scale} ${5 / scale}`} />
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}
