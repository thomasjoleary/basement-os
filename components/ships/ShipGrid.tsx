'use client'

import { useEffect, useRef, useState } from 'react'
import { type Deck, type ShipPlan, type Point, type Room, newId, roomAt, movePart, newPart } from '@/lib/ships'

export type ShipTool = 'select' | 'pan' | 'room' | 'wall' | 'door' | 'label' | 'fixture'
export type Selection = { kind: 'room' | 'mark' | 'part' | 'connection'; id: string } | null
type Gesture = { start: Point; current: Point; client: Point; pan: Point; part?: string; mode: ShipTool }

export default function ShipGrid({ deck, plan, editable, tool, selection, onSelect, onChange, onDeck, onMessage }: {
  deck: Deck; plan: ShipPlan; editable: boolean; tool: ShipTool; selection: Selection
  onSelect: (s: Selection) => void; onChange: (p: ShipPlan) => void; onDeck: (id: string) => void; onMessage: (message: string) => void
}) {
  const svg = useRef<SVGSVGElement>(null), group = useRef<SVGGElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const [draft, setDraft] = useState<Gesture | null>(null)
  const [zoom, setZoom] = useState(1), [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  useEffect(() => {
    const cancel = (e: KeyboardEvent) => { if (e.key === 'Escape') { gesture.current = null; setDraft(null) } }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [])
  function point(e: React.PointerEvent): Point {
    const matrix = group.current?.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse())
    return { x: Math.max(0, Math.min(deck.width - 1, Math.floor(p.x / 32))), y: Math.max(0, Math.min(deck.height - 1, Math.floor(p.y / 32))) }
  }
  function down(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0 && e.button !== 1) return
    e.preventDefault()
    const p = point(e)
    const mode = e.button === 1 ? 'pan' : editable ? tool : tool === 'pan' ? 'pan' : 'select'
    const hit = (e.target as Element).closest('[data-kind]') as SVGElement | null
    let part: string | undefined
    if (mode === 'select') {
      if (hit) {
        const kind = hit.dataset.kind as NonNullable<Selection>['kind'], id = hit.dataset.id!
        onSelect({ kind, id })
        if (kind === 'part' && editable) part = id
        if (kind === 'connection' && !editable) {
          const c = plan.connections.find(c => c.id === id)!
          onDeck(c.from_deck === deck.id ? c.to_deck : c.from_deck)
        }
      } else onSelect(null)
    }
    gesture.current = { start: p, current: p, client: { x: e.clientX, y: e.clientY }, pan, part, mode }
    setDraft(gesture.current)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function move(e: React.PointerEvent<SVGSVGElement>) {
    const g = gesture.current
    if (!g) return
    if (g.mode === 'pan') {
      const matrix = svg.current?.getScreenCTM()
      if (matrix) setPan({ x: g.pan.x + (e.clientX - g.client.x) / matrix.a, y: g.pan.y + (e.clientY - g.client.y) / matrix.d })
    } else {
      gesture.current = { ...g, current: point(e) }
      setDraft(gesture.current)
    }
  }
  function up(e: React.PointerEvent<SVGSVGElement>) {
    const g = gesture.current
    gesture.current = null; setDraft(null)
    if (!g || !editable || g.mode === 'pan') return
    const p = point(e)
    if (g.part) { onChange(movePart(plan, g.part, deck, p)); return }
    let next = { ...deck }
    if (g.mode === 'room') {
      const r: Room = { id: newId(), name: `Room ${deck.rooms.length + 1}`, x: Math.min(g.start.x, p.x), y: Math.min(g.start.y, p.y), width: Math.abs(p.x - g.start.x) + 1, height: Math.abs(p.y - g.start.y) + 1, notes: '' }
      if (deck.rooms.some(a => r.x < a.x + a.width && r.x + r.width > a.x && r.y < a.y + a.height && r.y + r.height > a.y)) { onMessage('Rooms cannot overlap. Draw in an empty area.'); return }
      next = { ...deck, rooms: [...deck.rooms, r] }; onSelect({ kind: 'room', id: r.id })
      // Newly enclosed fixtures become linked to the room.
      onChange({ ...plan, decks: plan.decks.map(d => d.id === deck.id ? next : d), parts: plan.parts.map(part => part.deck_id === deck.id ? { ...part, room_id: roomAt(next, part)?.id ?? null } : part) })
      return
    }
    if (g.mode === 'wall' || g.mode === 'door' || g.mode === 'label') {
      const vertical = Math.abs(p.y - g.start.y) > Math.abs(p.x - g.start.x)
      const mark = { id: newId(), kind: g.mode, name: g.mode === 'label' ? 'New label' : g.mode === 'door' ? 'Door' : 'Wall', x: vertical ? g.start.x : Math.min(p.x, g.start.x), y: vertical ? Math.min(p.y, g.start.y) : g.start.y, vertical, length: g.mode === 'label' ? 1 : Math.abs(vertical ? p.y - g.start.y : p.x - g.start.x) + 1 }
      next = { ...deck, marks: [...deck.marks, mark] }; onSelect({ kind: 'mark', id: mark.id })
    }
    if (g.mode === 'fixture') {
      const part = newPart(deck, p)
      onChange({ ...plan, parts: [...plan.parts, part] }); onSelect({ kind: 'part', id: part.id }); return
    }
    if (g.mode !== 'select') onChange({ ...plan, decks: plan.decks.map(d => d.id === deck.id ? next : d) })
  }
  const selected = (id: string) => selection?.id === id
  return <div className="relative rounded-xl border border-gray-700 bg-gray-950 overflow-hidden">
    <div className="flex items-center justify-between p-3 border-b border-gray-800 gap-2">
      <span className="text-xs text-gray-400">{deck.width} × {deck.height} grid · {Math.round(zoom * 100)}%</span>
      <div className="flex gap-2">
        <button type="button" className="px-2 py-1 min-w-8" aria-label="Zoom out" onClick={() => setZoom(z => Math.max(.5, z / 1.25))}>−</button>
        <button type="button" className="px-2 py-1" aria-label="Fit deck" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>Fit</button>
        <button type="button" className="px-2 py-1 min-w-8" aria-label="Zoom in" onClick={() => setZoom(z => Math.min(4, z * 1.25))}>+</button>
      </div>
    </div>
    <svg ref={svg} data-testid="ship-grid" aria-label={`${deck.name} ship plan`} role="img"
      viewBox={`-16 -16 ${deck.width * 32 + 32} ${deck.height * 32 + 32}`} className="w-full h-[380px] md:h-[520px] touch-none select-none"
      style={{ cursor: tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up}
      onPointerCancel={() => { gesture.current = null; setDraft(null) }}
      onWheel={e => { setZoom(z => Math.min(4, Math.max(.5, z * (e.deltaY < 0 ? 1.1 : .9)))) }}>
      <defs><pattern id="ship-grid-lines" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#243044" strokeWidth="1" /></pattern></defs>
      <g ref={group} transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
        <rect width={deck.width * 32} height={deck.height * 32} fill="url(#ship-grid-lines)" stroke="#475569" />
        {deck.rooms.map(r => <g key={r.id} data-kind="room" data-id={r.id}>
          <rect x={r.x * 32} y={r.y * 32} width={r.width * 32} height={r.height * 32} fill={selected(r.id) ? '#164e63' : '#172638'} fillOpacity=".9" stroke={selected(r.id) ? '#67e8f9' : '#94a3b8'} strokeWidth="3" />
          <text x={r.x * 32 + 8} y={r.y * 32 + 17} fill="#e2e8f0" fontSize="11">{r.name.length > Math.floor((r.width * 32 - 16) / 6) ? r.name.slice(0, Math.max(1, Math.floor((r.width * 32 - 16) / 6) - 1)) + '…' : r.name}</text><title>{r.name}</title>
        </g>)}
        {deck.marks.map(m => <g key={m.id} data-kind="mark" data-id={m.id}>
          {m.kind === 'label' ? <text x={m.x * 32 + 4} y={m.y * 32 + 20} fill={selected(m.id) ? '#67e8f9' : '#fcd34d'} fontSize="12">{m.name}</text> : <>
            <line x1={m.x * 32} y1={m.y * 32} x2={(m.x + (m.vertical ? 0 : m.length)) * 32} y2={(m.y + (m.vertical ? m.length : 0)) * 32} stroke="#030712" strokeWidth="10" />
            <line x1={m.x * 32} y1={m.y * 32} x2={(m.x + (m.vertical ? 0 : m.length)) * 32} y2={(m.y + (m.vertical ? m.length : 0)) * 32} stroke={selected(m.id) ? '#67e8f9' : m.kind === 'door' ? '#fbbf24' : '#cbd5e1'} strokeWidth={m.kind === 'door' ? 4 : 6} strokeDasharray={m.kind === 'door' ? '7 4' : undefined} />
          </>}
          <title>{m.name}</title>
        </g>)}
        {plan.parts.filter(p => p.deck_id === deck.id).map(p => {
          const at = draft?.part === p.id ? draft.current : p
          return <g key={p.id} data-kind="part" data-id={p.id} transform={`translate(${at.x * 32 + 16} ${at.y * 32 + 16})`}>
            <rect x="-11" y="-10" width="22" height="20" rx="4" fill={selected(p.id) ? '#0891b2' : '#334155'} stroke={p.black_market ? '#f472b6' : '#93c5fd'} strokeWidth="2" />
            <text textAnchor="middle" y="4" fontSize="10" fill="white">{p.name.slice(0, 2).toUpperCase()}</text><title>{p.name} · {p.quality} · {p.condition}</title>
          </g>
        })}
        {plan.connections.filter(c => c.from_deck === deck.id || c.to_deck === deck.id).map(c => {
          const p = c.from_deck === deck.id ? c.from : c.to
          return <g key={c.id} data-kind="connection" data-id={c.id} transform={`translate(${p.x * 32 + 16} ${p.y * 32 + 16})`}>
            <circle r="13" fill="#5b21b6" stroke={selected(c.id) ? '#67e8f9' : '#c4b5fd'} strokeWidth="2" />
            <text textAnchor="middle" y="5" fontSize="14" fill="white">{c.kind === 'lift' ? '↕' : '⇅'}</text><title>{c.name}</title>
          </g>
        })}
        {draft?.mode === 'room' && <rect x={Math.min(draft.start.x, draft.current.x) * 32} y={Math.min(draft.start.y, draft.current.y) * 32} width={(Math.abs(draft.start.x - draft.current.x) + 1) * 32} height={(Math.abs(draft.start.y - draft.current.y) + 1) * 32} fill="#06b6d4" fillOpacity=".2" stroke="#67e8f9" strokeDasharray="6 4" pointerEvents="none" />}
      </g>
    </svg>
    <p className="p-3 text-xs text-gray-400 border-t border-gray-800">{editable ? 'Draw rooms by dragging. Walls and doors follow grid edges. Select and drag fixtures to move them. Esc cancels a gesture.' : 'Select a room or component to inspect. Select a lift or stairs to change decks.'}</p>
  </div>
}
