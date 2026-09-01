'use client'

// Pannable/zoomable top-down galaxy map. Systems are dots positioned by their
// x/y light-year coordinates; a deterministic spiral-arm starfield renders
// behind them purely for atmosphere. Mirrors the pan/zoom/pointer-gesture
// approach used by components/battlefield/BattlefieldGrid.tsx.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  StarSystem,
  JumpDrive,
  distanceLy,
  jumpTimeHours,
  formatDuration,
  formatLy,
  BASE_PX_PER_LY,
  MIN_SCALE,
  MAX_SCALE,
  SNAP_LY,
} from '@/lib/galaxy'

const CLICK_SLOP = 4 // px of movement below which a press counts as a click
const LABEL_MIN_SCALE = 0.4 // hide system names when zoomed out further than this

export type GalaxyTool = 'select' | 'pan' | 'measure'

export interface GalaxyFocusRequest {
  x: number
  y: number
  // Bump this on every request so re-selecting the same system still re-centers.
  nonce: number
}

interface Props {
  systems: StarSystem[]
  // system id -> dot colour, computed by the page from its stars
  systemColors: Record<string, string>
  selectedId: string | null
  onSelect: (id: string | null) => void
  tool: GalaxyTool
  // "Add system" mode: a click on empty space places a system instead of deselecting.
  addMode?: boolean
  onCreateAt: (x: number, y: number) => void
  onMoveSystem: (id: string, x: number, y: number) => void
  onDeleteSystem: (id: string) => void
  measureFrom: string | null
  measureTo: string | null
  onMeasureChange: (from: string | null, to: string | null) => void
  snapToGrid: boolean
  drive: JumpDrive
  focusRequest?: GalaxyFocusRequest | null
}

function snap(v: number): number {
  return Math.round(v / SNAP_LY) * SNAP_LY
}

// Dot radius in constant SCREEN pixels (grows sub-linearly with zoom, then clamps).
function dotScreenRadius(scale: number): number {
  return Math.max(3.2, Math.min(9.5, 5 + Math.log2(scale) * 1.6))
}

// Grid step (in ly) chosen so lines never render closer than ~55 screen px apart.
const GRID_STEPS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
function pickGridStep(scale: number): number {
  const pxPerLy = BASE_PX_PER_LY * scale
  for (const step of GRID_STEPS) {
    if (step * pxPerLy >= 55) return step
  }
  return GRID_STEPS[GRID_STEPS.length - 1]
}

// ===========================================================================
// Deterministic spiral-arm backdrop
//
// A tiny seeded PRNG (mulberry32) so the starfield is generated once and never
// churns/flickers on re-render -- Math.random() would reroll every paint.
// ===========================================================================

function mulberry32(seed: number) {
  let a = seed >>> 0
  return function rand() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface BgStar {
  x: number
  y: number
  r: number
  o: number
  c: string
}

const SPIRAL_SEED = 190604
const ARM_COUNT = 4
const ARM_STARS = 260
const CORE_STARS = 160
const HAZE_STARS = 220
const FIELD_RADIUS_LY = 480
const ARM_TURNS = 2.2
const ARM_TIGHTNESS = 0.3

function buildSpiralField(): BgStar[] {
  const rand = mulberry32(SPIRAL_SEED)
  const stars: BgStar[] = []
  const thetaMax = ARM_TURNS * Math.PI * 2
  // Logarithmic spiral: r = a * e^(b*theta), solved so the outer edge lands at FIELD_RADIUS_LY.
  const a = FIELD_RADIUS_LY / Math.exp(ARM_TIGHTNESS * thetaMax)

  for (let arm = 0; arm < ARM_COUNT; arm++) {
    const armOffset = (arm / ARM_COUNT) * Math.PI * 2
    for (let i = 0; i < ARM_STARS; i++) {
      const t = i / ARM_STARS
      const theta = t * thetaMax
      const radius = a * Math.exp(ARM_TIGHTNESS * theta)
      const spread = 8 + t * 34 // arms get fuzzier further out
      const rr = radius + (rand() - 0.5) * spread
      const th = theta + armOffset + (rand() - 0.5) * 0.22
      stars.push({
        x: Math.cos(th) * rr,
        y: Math.sin(th) * rr,
        r: 0.35 + rand() * 1.15,
        o: 0.12 + rand() * 0.4,
        c: '#bfd4ff',
      })
    }
  }

  // Dense, warmer core.
  for (let i = 0; i < CORE_STARS; i++) {
    const rr = Math.sqrt(rand()) * FIELD_RADIUS_LY * 0.12
    const th = rand() * Math.PI * 2
    stars.push({
      x: Math.cos(th) * rr,
      y: Math.sin(th) * rr,
      r: 0.4 + rand() * 1.4,
      o: 0.25 + rand() * 0.55,
      c: '#ffe6b8',
    })
  }

  // Faint scattered haze between the arms, for depth.
  for (let i = 0; i < HAZE_STARS; i++) {
    const rr = Math.sqrt(rand()) * FIELD_RADIUS_LY
    const th = rand() * Math.PI * 2
    stars.push({
      x: Math.cos(th) * rr,
      y: Math.sin(th) * rr,
      r: 0.3 + rand() * 0.7,
      o: 0.05 + rand() * 0.15,
      c: '#94a3b8',
    })
  }

  return stars
}

interface DragState {
  id: string
  origX: number
  origY: number
  startSx: number
  startSy: number
  moved: boolean
}

export default function GalaxyMap({
  systems,
  systemColors,
  selectedId,
  onSelect,
  tool,
  addMode = false,
  onCreateAt,
  onMoveSystem,
  onDeleteSystem,
  measureFrom,
  measureTo,
  onMeasureChange,
  snapToGrid,
  drive,
  focusRequest,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [viewSize, setViewSize] = useState({ w: 800, h: 600 })
  const [centered, setCentered] = useState(false)

  // Gesture bookkeeping (mirrors BattlefieldGrid's ref pattern).
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const pinchStart = useRef<{ dist: number; scale: number; cx: number; cy: number; panX: number; panY: number } | null>(null)
  const clickRef = useRef<{ x: number; y: number } | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const measureClickRef = useRef<{ id: string; x: number; y: number } | null>(null)

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [dragGhost, setDragGhost] = useState<{ id: string; x: number; y: number } | null>(null)
  const [hoverLy, setHoverLy] = useState<{ x: number; y: number } | null>(null)
  const [cursorLy, setCursorLy] = useState<{ x: number; y: number } | null>(null)

  const spiralField = useMemo(buildSpiralField, [])

  // ---- Container sizing ---------------------------------------------------
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setViewSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Center on the galactic origin once we know the container size.
  useEffect(() => {
    if (centered) return
    if (viewSize.w === 0 && viewSize.h === 0) return
    setPan({ x: viewSize.w / 2, y: viewSize.h / 2 })
    setCentered(true)
  }, [viewSize, centered])

  // ---- Coordinate conversion ----------------------------------------------
  // "Stage px" = light-years * BASE_PX_PER_LY, BEFORE the pan/scale transform.
  const toStage = useCallback(
    (clientX: number, clientY: number) => {
      const rect = wrapRef.current?.getBoundingClientRect()
      if (!rect) return { sx: 0, sy: 0 }
      return { sx: (clientX - rect.left - pan.x) / scale, sy: (clientY - rect.top - pan.y) / scale }
    },
    [pan, scale]
  )

  const worldBounds = useMemo(() => {
    const left = -pan.x / scale / BASE_PX_PER_LY
    const top = -pan.y / scale / BASE_PX_PER_LY
    const right = (viewSize.w - pan.x) / scale / BASE_PX_PER_LY
    const bottom = (viewSize.h - pan.y) / scale / BASE_PX_PER_LY
    return { left, top, right, bottom }
  }, [pan, scale, viewSize])

  // ---- Zoom -----------------------------------------------------------------
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

  // Frame every system with a margin. Going back to the origin at 100% would
  // look like a no-op whenever the systems sit far from 0,0.
  const resetView = () => {
    const { w, h } = viewSize
    if (!systems.length) {
      setScale(1)
      setPan({ x: w / 2, y: h / 2 })
      return
    }

    const xs = systems.map(s => s.x)
    const ys = systems.map(s => s.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)

    // Floor the span so a single system (or a perfectly straight line of them)
    // doesn't divide by zero and slam the zoom to MAX_SCALE.
    const spanX = Math.max(maxX - minX, 2) * BASE_PX_PER_LY
    const spanY = Math.max(maxY - minY, 2) * BASE_PX_PER_LY
    const pad = 90

    const next = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY))
    )
    const cx = ((minX + maxX) / 2) * BASE_PX_PER_LY
    const cy = ((minY + maxY) / 2) * BASE_PX_PER_LY

    setScale(next)
    setPan({ x: w / 2 - cx * next, y: h / 2 - cy * next })
  }

  // ---- Fullscreen ----------------------------------------------------------
  const toggleFullscreen = () => {
    const el = wrapRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else el.requestFullscreen?.().catch(() => {})
  }

  // Track it from the event rather than our own click, so pressing Esc (which
  // exits fullscreen without touching the button) keeps the icon honest.
  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === wrapRef.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const prevent = (e: WheelEvent) => e.preventDefault()
    el.addEventListener('wheel', prevent, { passive: false })
    return () => el.removeEventListener('wheel', prevent)
  }, [])

  // ---- Focus request (search result -> select + center) --------------------
  useEffect(() => {
    if (!focusRequest) return
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const targetScale = Math.max(scale, 1)
    setScale(targetScale)
    setPan({
      x: rect.width / 2 - focusRequest.x * BASE_PX_PER_LY * targetScale,
      y: rect.height / 2 - focusRequest.y * BASE_PX_PER_LY * targetScale,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.nonce])

  // ---- Background: pan / pinch / click-to-create / click-to-deselect ------
  const onBgPointerDown = (e: React.PointerEvent) => {
    // The overlay controls (zoom, fullscreen, the measure readout's dismiss) are
    // children of this container. Capturing the pointer here would retarget their
    // pointerup to the container and swallow the click entirely, so let those
    // events through untouched.
    if ((e.target as HTMLElement).closest?.('button, input, select, textarea, a')) return

    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

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
      clickRef.current = null
      return
    }

    // Middle/right mouse always pans; pan tool pans; touch pans.
    const wantsPan = tool === 'pan' || e.button === 1 || e.button === 2 || e.pointerType === 'touch'
    if (wantsPan) {
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
      return
    }

    clickRef.current = { x: e.clientX, y: e.clientY }
  }

  const onBgPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

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

    const { sx, sy } = toStage(e.clientX, e.clientY)
    const worldX = sx / BASE_PX_PER_LY
    const worldY = sy / BASE_PX_PER_LY
    setCursorLy({ x: worldX, y: worldY })
    if (tool === 'measure' && measureFrom && !measureTo) {
      setHoverLy({ x: worldX, y: worldY })
    }
  }

  const onBgPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null

    if (panStart.current) {
      if (pointers.current.size === 0) panStart.current = null
      return
    }

    if (clickRef.current) {
      const moved = Math.hypot(e.clientX - clickRef.current.x, e.clientY - clickRef.current.y) > CLICK_SLOP
      clickRef.current = null
      if (!moved) {
        if (tool === 'measure') {
          onMeasureChange(null, null)
        } else if (addMode) {
          const { sx, sy } = toStage(e.clientX, e.clientY)
          let x = sx / BASE_PX_PER_LY
          let y = sy / BASE_PX_PER_LY
          if (snapToGrid) {
            x = snap(x)
            y = snap(y)
          }
          onCreateAt(x, y)
        } else {
          onSelect(null)
        }
      }
    }
  }

  // ---- System dots: click to select, drag to reposition, click-click to measure
  const advanceMeasure = (id: string) => {
    if (!measureFrom || measureFrom === id) {
      onMeasureChange(id, null)
    } else if (!measureTo) {
      onMeasureChange(measureFrom, id)
    } else {
      onMeasureChange(id, null)
    }
    setHoverLy(null)
  }

  const onDotPointerDown = (e: React.PointerEvent, sys: StarSystem) => {
    e.stopPropagation()
    ;(e.currentTarget as SVGElement).setPointerCapture(e.pointerId)

    if (tool === 'measure') {
      measureClickRef.current = { id: sys.id, x: e.clientX, y: e.clientY }
      return
    }

    onSelect(sys.id)
    if (tool !== 'select') return // pan tool: select only, no drag

    const { sx, sy } = toStage(e.clientX, e.clientY)
    dragRef.current = { id: sys.id, origX: sys.x, origY: sys.y, startSx: sx, startSy: sy, moved: false }
  }

  const onDotPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    e.stopPropagation()
    const { sx, sy } = toStage(e.clientX, e.clientY)
    let nx = d.origX + (sx - d.startSx) / BASE_PX_PER_LY
    let ny = d.origY + (sy - d.startSy) / BASE_PX_PER_LY
    if (snapToGrid) {
      nx = snap(nx)
      ny = snap(ny)
    }
    if (nx !== d.origX || ny !== d.origY) d.moved = true
    setDragGhost({ id: d.id, x: nx, y: ny })
  }

  const onDotPointerUp = (e: React.PointerEvent, sys: StarSystem) => {
    e.stopPropagation()

    const d = dragRef.current
    if (d && d.id === sys.id) {
      dragRef.current = null
      const ghost = dragGhost
      setDragGhost(null)
      if (d.moved && ghost) onMoveSystem(sys.id, ghost.x, ghost.y)
    }

    const m = measureClickRef.current
    if (m && m.id === sys.id) {
      measureClickRef.current = null
      const moved = Math.hypot(e.clientX - m.x, e.clientY - m.y) > CLICK_SLOP
      if (!moved) advanceMeasure(sys.id)
    }
  }

  // ---- Keyboard: Delete removes, Escape clears, arrows nudge ---------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)
      if (typing) return
      if (!selectedId) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        onDeleteSystem(selectedId)
      } else if (e.key === 'Escape') {
        onSelect(null)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const sys = systems.find(s => s.id === selectedId)
        if (!sys) return
        e.preventDefault()
        let dx = 0
        let dy = 0
        if (e.key === 'ArrowLeft') dx = -SNAP_LY
        else if (e.key === 'ArrowRight') dx = SNAP_LY
        else if (e.key === 'ArrowUp') dy = -SNAP_LY
        else dy = SNAP_LY
        onMoveSystem(sys.id, sys.x + dx, sys.y + dy)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, systems, onDeleteSystem, onSelect, onMoveSystem])

  // ---- Derived render data ---------------------------------------------
  const dotR = dotScreenRadius(scale)
  const showLabels = scale >= LABEL_MIN_SCALE

  const gridStep = pickGridStep(scale)
  const gridLines = useMemo(() => {
    const x0 = Math.floor(worldBounds.left / gridStep) * gridStep
    const x1 = Math.ceil(worldBounds.right / gridStep) * gridStep
    const y0 = Math.floor(worldBounds.top / gridStep) * gridStep
    const y1 = Math.ceil(worldBounds.bottom / gridStep) * gridStep
    const verticals: number[] = []
    for (let gx = x0; gx <= x1 && verticals.length < 300; gx += gridStep) verticals.push(gx)
    const horizontals: number[] = []
    for (let gy = y0; gy <= y1 && horizontals.length < 300; gy += gridStep) horizontals.push(gy)
    return { verticals, horizontals }
  }, [worldBounds, gridStep])

  const measureInfo = useMemo(() => {
    if (!measureFrom) return null
    const from = systems.find(s => s.id === measureFrom)
    if (!from) return null
    if (measureTo) {
      const to = systems.find(s => s.id === measureTo)
      if (!to) return null
      return { from, to, ly: distanceLy(from, to) }
    }
    if (hoverLy) {
      return { from, to: null as StarSystem | null, ly: distanceLy(from, { x: hoverLy.x, y: hoverLy.y, z: from.z }) }
    }
    return { from, to: null as StarSystem | null, ly: null as number | null }
  }, [measureFrom, measureTo, systems, hoverLy])

  const cursorStyle =
    tool === 'pan' ? 'grab' : tool === 'measure' ? 'crosshair' : addMode ? 'crosshair' : 'default'

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full overflow-hidden bg-[#05060d] select-none"
      style={{ touchAction: 'none' }}
      onContextMenu={e => e.preventDefault()}
      onWheel={onWheel}
      onPointerDown={onBgPointerDown}
      onPointerMove={onBgPointerMove}
      onPointerUp={onBgPointerUp}
      onPointerCancel={onBgPointerUp}
    >
      <svg className="absolute inset-0 w-full h-full" style={{ cursor: cursorStyle }}>
        <defs>
          <radialGradient id="galaxy-core-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.32" />
            <stop offset="35%" stopColor="#fcd34d" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#fcd34d" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
          {/* Decorative backdrop -- never intercepts pointer events */}
          <g pointerEvents="none">
            <circle cx={0} cy={0} r={130 * BASE_PX_PER_LY} fill="url(#galaxy-core-glow)" />
            {spiralField.map((s, i) => (
              <circle key={i} cx={s.x * BASE_PX_PER_LY} cy={s.y * BASE_PX_PER_LY} r={s.r} fill={s.c} fillOpacity={s.o} />
            ))}
          </g>

          {/* Coordinate grid -- adaptive step, origin axes tinted red */}
          <g pointerEvents="none">
            {gridLines.verticals.map(gx => (
              <line
                key={`gx${gx}`}
                x1={gx * BASE_PX_PER_LY}
                y1={worldBounds.top * BASE_PX_PER_LY}
                x2={gx * BASE_PX_PER_LY}
                y2={worldBounds.bottom * BASE_PX_PER_LY}
                stroke={gx === 0 ? 'rgba(239,68,68,0.35)' : 'rgba(148,163,184,0.12)'}
                strokeWidth={gx === 0 ? 1.5 : 1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {gridLines.horizontals.map(gy => (
              <line
                key={`gy${gy}`}
                x1={worldBounds.left * BASE_PX_PER_LY}
                y1={gy * BASE_PX_PER_LY}
                x2={worldBounds.right * BASE_PX_PER_LY}
                y2={gy * BASE_PX_PER_LY}
                stroke={gy === 0 ? 'rgba(239,68,68,0.35)' : 'rgba(148,163,184,0.12)'}
                strokeWidth={gy === 0 ? 1.5 : 1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>

          {/* Measure line: solid once both endpoints are set, dashed while live-previewing */}
          {measureInfo && measureInfo.ly !== null && (
            <g pointerEvents="none">
              <line
                x1={measureInfo.from.x * BASE_PX_PER_LY}
                y1={measureInfo.from.y * BASE_PX_PER_LY}
                x2={(measureInfo.to ? measureInfo.to.x : hoverLy?.x ?? measureInfo.from.x) * BASE_PX_PER_LY}
                y2={(measureInfo.to ? measureInfo.to.y : hoverLy?.y ?? measureInfo.from.y) * BASE_PX_PER_LY}
                stroke="#ef4444"
                strokeOpacity={measureInfo.to ? 1 : 0.6}
                strokeWidth={2}
                strokeDasharray={measureInfo.to ? undefined : '7 5'}
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={measureInfo.from.x * BASE_PX_PER_LY}
                cy={measureInfo.from.y * BASE_PX_PER_LY}
                r={5 / scale}
                fill="none"
                stroke="#ef4444"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
              {measureInfo.to && (
                <circle
                  cx={measureInfo.to.x * BASE_PX_PER_LY}
                  cy={measureInfo.to.y * BASE_PX_PER_LY}
                  r={5 / scale}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          )}

          {/* Star systems */}
          {systems.map(sys => {
            const ghost = dragGhost && dragGhost.id === sys.id ? dragGhost : null
            const x = ghost ? ghost.x : sys.x
            const y = ghost ? ghost.y : sys.y
            const color = systemColors[sys.id] ?? '#94a3b8'
            const selected = sys.id === selectedId
            const isMeasureEndpoint = sys.id === measureFrom || sys.id === measureTo
            const px = x * BASE_PX_PER_LY
            const py = y * BASE_PX_PER_LY
            const r = dotR / scale

            return (
              <g
                key={sys.id}
                onPointerDown={e => onDotPointerDown(e, sys)}
                onPointerMove={onDotPointerMove}
                onPointerUp={e => onDotPointerUp(e, sys)}
                onPointerCancel={e => onDotPointerUp(e, sys)}
                style={{ cursor: tool === 'measure' ? 'crosshair' : tool === 'select' ? (ghost ? 'grabbing' : 'grab') : 'pointer' }}
              >
                {/* Soft glow */}
                <circle cx={px} cy={py} r={r * 2.3} fill={color} opacity={0.16} />
                {/* Selection / measure-endpoint ring */}
                {(selected || isMeasureEndpoint) && (
                  <circle
                    cx={px}
                    cy={py}
                    r={r + 5 / scale}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    className={selected ? 'animate-pulse' : undefined}
                  />
                )}
                {/* Body */}
                <circle
                  cx={px}
                  cy={py}
                  r={r}
                  fill={color}
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  opacity={sys.discovered === false ? 0.55 : 1}
                />
                {showLabels && (
                  <text
                    x={px + r + 6 / scale}
                    y={py + 4 / scale}
                    fontSize={11 / scale}
                    fill="#e5e7eb"
                    className="font-mono"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {sys.name}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-30 flex flex-col gap-1">
        <button onClick={() => zoomButton(1.2)} className="w-9 h-9 rounded bg-gray-800/90 border border-gray-600 text-white text-lg hover:bg-gray-700" aria-label="Zoom in">+</button>
        <button onClick={() => zoomButton(0.83)} className="w-9 h-9 rounded bg-gray-800/90 border border-gray-600 text-white text-lg hover:bg-gray-700" aria-label="Zoom out">−</button>
        <button onClick={resetView} className="w-9 h-9 rounded bg-gray-800/90 border border-gray-600 text-white text-base hover:bg-gray-700" aria-label="Fit all systems" title="Fit all systems">◎</button>
        <button
          onClick={toggleFullscreen}
          className="w-9 h-9 rounded bg-gray-800/90 border border-gray-600 text-white text-xs hover:bg-gray-700"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? '⤡' : '⛶'}
        </button>
      </div>

      {/* Add-mode hint */}
      {addMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 text-xs font-mono px-3 py-1.5 rounded-full bg-red-900/80 border border-red-600 text-red-100 pointer-events-none">
          Click the map to place a new system
        </div>
      )}

      {/* Measure readout */}
      {tool === 'measure' && (
        <div className="absolute bottom-3 left-3 z-30 text-sm font-mono px-3 py-1.5 rounded bg-black/80 border border-red-700 text-red-200 flex items-center gap-2 max-w-[calc(100%-1.5rem)]">
          {measureInfo && measureInfo.ly !== null ? (
            <>
              <span className="truncate">
                📏 {measureInfo.from.name}
                {measureInfo.to ? ` → ${measureInfo.to.name}` : ' → …'}
              </span>
              <span className="text-white font-bold shrink-0">{formatLy(measureInfo.ly)}</span>
              <span className="text-gray-500 shrink-0">•</span>
              <span className="text-amber-300 shrink-0">{formatDuration(jumpTimeHours(measureInfo.ly, drive))}</span>
              <button onClick={() => onMeasureChange(null, null)} className="ml-1 text-gray-400 hover:text-white shrink-0" aria-label="Clear measurement">✕</button>
            </>
          ) : (
            <span className="text-gray-400">📏 Click a system, then another, to measure the jump</span>
          )}
        </div>
      )}

      {/* Cursor coordinate readout */}
      {cursorLy && (
        <div className="absolute bottom-3 right-3 z-30 text-xs font-mono px-2 py-1 rounded bg-gray-800/90 border border-gray-700 text-gray-400 pointer-events-none">
          {cursorLy.x.toFixed(1)}, {cursorLy.y.toFixed(1)} ly
        </div>
      )}
    </div>
  )
}
