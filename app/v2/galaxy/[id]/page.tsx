'use client'

// Per-system builder for the v2 Galaxy map. A GM-only authoring tool for one star
// system's contents: an arbitrary-depth hierarchy of bodies (star -> planet -> moon,
// or anything else orbiting anything else) via `parent_id`.
//
// Layout: hierarchy tree (left) + top-down orbit diagram (center) + inspector (right).
// See lib/galaxy.ts for the shared types/constants/helpers this page builds on.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  BodyKind,
  StarSystem,
  SystemBody,
  BODY_KINDS,
  classesForKind,
  bodyClassMeta,
  starClassMeta,
  isLightless,
  defaultChildKind,
  childrenOf,
  descendantsOf,
  wouldCycle,
  orbitalPeriodDays,
  resolvePeriodDays,
  formatPeriod,
  earthMassesToSolar,
  solarToEarthMasses,
  SOLAR_RADIUS_KM,
} from '@/lib/galaxy'

// Rough Earth-mass / radius flavour defaults per planet/moon class, used only to
// prefill the inspector when a GM picks a class on a body with no mass/radius yet.
// Not part of the shared contract -- game flavour, kept local to this page.
const PLANET_CLASS_DEFAULTS: Record<string, { earthMasses: number; radiusKm: number }> = {
  terrestrial: { earthMasses: 1, radiusKm: 6371 },
  ocean: { earthMasses: 1.4, radiusKm: 6800 },
  desert: { earthMasses: 0.85, radiusKm: 6100 },
  ice: { earthMasses: 0.9, radiusKm: 6200 },
  volcanic: { earthMasses: 1.1, radiusKm: 6300 },
  toxic: { earthMasses: 1.2, radiusKm: 6500 },
  barren: { earthMasses: 0.25, radiusKm: 3200 },
  gas_giant: { earthMasses: 318, radiusKm: 69911 },
  ice_giant: { earthMasses: 14.5, radiusKm: 24622 },
  dwarf: { earthMasses: 0.002, radiusKm: 1188 },
}

function classDefaults(kind: BodyKind, classId: string): { mass_solar: number | null; radius_km: number | null } {
  if (kind === 'star') {
    const sc = starClassMeta(classId)
    const mid = (r: [number, number]) => (r[0] + r[1]) / 2
    return { mass_solar: mid(sc.massSolar), radius_km: Math.round(mid(sc.radiusSolar) * SOLAR_RADIUS_KM) }
  }
  if ((kind === 'planet' || kind === 'moon') && PLANET_CLASS_DEFAULTS[classId]) {
    const d = PLANET_CLASS_DEFAULTS[classId]
    const scale = kind === 'moon' ? 0.1 : 1 // moons default a good deal smaller than planets of the same class
    return { mass_solar: earthMassesToSolar(d.earthMasses * scale), radius_km: Math.round(d.radiusKm * (kind === 'moon' ? 0.3 : 1)) }
  }
  return { mass_solar: null, radius_km: null }
}

// Round to `sig` significant figures -- used only to keep the Earth-mass readout
// readable (mass_solar round-trips through a /332946 division and picks up float noise).
function roundSig(v: number, sig = 6): number {
  if (v === 0 || !isFinite(v)) return v
  const mag = Math.ceil(Math.log10(Math.abs(v)))
  const factor = 10 ** (sig - mag)
  return Math.round(v * factor) / factor
}

// Friendlier message for the common failure mode during development: the migration
// for v2_star_systems / v2_system_bodies hasn't been applied yet.
function friendlyError(err: { message?: string; code?: string } | null): string {
  if (!err) return 'Unknown error.'
  const msg = err.message || 'Unknown error.'
  if (err.code === '42P01' || /relation .* does not exist/i.test(msg) || /could not find the table/i.test(msg)) {
    return `The galaxy builder's database tables aren't set up yet -- the migration may not be applied. (${msg})`
  }
  return msg
}

export default function SystemBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [isGM, setIsGM] = useState(false)
  const [loading, setLoading] = useState(true)
  const [system, setSystem] = useState<StarSystem | null>(null)
  const [bodies, setBodies] = useState<SystemBody[]>([])
  const [error, setError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null) // orbit diagram focus; null = system barycentre
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const bodiesById = useMemo(() => new Map(bodies.map(b => [b.id, b])), [bodies])
  const selected = selectedId ? bodiesById.get(selectedId) ?? null : null

  // ---- Load ---------------------------------------------------------------
  async function loadData() {
    setError(null)
    const [{ data: sys, error: sysErr }, { data: bods, error: bodErr }] = await Promise.all([
      supabase.from('v2_star_systems').select('*').eq('id', id).single(),
      supabase.from('v2_system_bodies').select('*').eq('system_id', id),
    ])
    if (sysErr) { setError(friendlyError(sysErr)); return }
    if (bodErr) { setError(friendlyError(bodErr)); return }
    setSystem(sys as StarSystem)
    setBodies((bods ?? []) as SystemBody[])
  }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      if (!profile || profile.role !== 'gm') {
        alert('Access denied. GM only.')
        router.push('/')
        return
      }

      setIsGM(true)
      await loadData()
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router])

  // Open on the primary star rather than the barycentre. The barycentre's only
  // child in a single-star system is the star itself, which sits at orbital
  // radius 0 -- so that view shows one dot at the centre and hides every planet
  // a level deeper. Focusing the star gives the expected system-at-a-glance.
  // Runs once per system so hitting "System" in the breadcrumb actually sticks.
  const didAutoFocus = useRef(false)
  useEffect(() => { didAutoFocus.current = false }, [id])
  useEffect(() => {
    if (didAutoFocus.current || focusId || bodies.length === 0) return
    const topLevelStars = bodies.filter(b => b.parent_id === null && b.kind === 'star')
    if (topLevelStars.length !== 1) return
    // Only jump in if there is actually something orbiting it.
    if (childrenOf(bodies, topLevelStars[0].id).length === 0) return
    didAutoFocus.current = true
    setFocusId(topLevelStars[0].id)
  }, [bodies, focusId])

  // ---- Realtime -------------------------------------------------------------
  useEffect(() => {
    if (!isGM) return
    const channel = supabase
      .channel(`v2-galaxy-system-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'v2_system_bodies', filter: `system_id=eq.${id}` }, payload => {
        setBodies(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(b => b.id !== (payload.old as { id: string }).id)
          const row = payload.new as SystemBody
          const idx = prev.findIndex(b => b.id === row.id)
          if (idx === -1) return [...prev, row]
          const next = [...prev]
          next[idx] = row
          return next
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'v2_star_systems', filter: `id=eq.${id}` }, payload => {
        setSystem(payload.new as StarSystem)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, isGM])

  // ---- Mutations ------------------------------------------------------------
  async function patchSystem(patch: Partial<StarSystem>) {
    setSystem(prev => (prev ? { ...prev, ...patch } : prev))
    const { error: err } = await supabase.from('v2_star_systems').update(patch).eq('id', id)
    if (err) setError(friendlyError(err))
  }

  async function patchBody(bodyId: string, patch: Partial<SystemBody>) {
    setBodies(prev => prev.map(b => (b.id === bodyId ? { ...b, ...patch } : b)))
    const { error: err } = await supabase.from('v2_system_bodies').update(patch).eq('id', bodyId)
    if (err) setError(friendlyError(err))
  }

  async function addBody(opts: { parent_id: string | null; kind?: BodyKind; name?: string }) {
    const parent = opts.parent_id ? bodiesById.get(opts.parent_id) ?? null : null
    const kind = opts.kind ?? defaultChildKind(parent)
    const body_class = classesForKind(kind)[0]?.id ?? ''
    const kindLabel = BODY_KINDS.find(k => k.kind === kind)?.label ?? 'Body'
    const siblingCount = childrenOf(bodies, opts.parent_id ?? null).length
    const row = {
      system_id: id,
      parent_id: opts.parent_id,
      kind,
      name: opts.name ?? `New ${kindLabel}`,
      body_class,
      orbital_radius_au: kind === 'star' ? siblingCount * 0.05 : (siblingCount + 1) * (kind === 'moon' ? 0.01 : 1),
      orbital_period_days: null,
      angle_deg: Math.floor(Math.random() * 360),
      mass_solar: null,
      radius_km: null,
      color: null,
      description: '',
      gm_notes: '',
    }
    const { data, error: err } = await supabase.from('v2_system_bodies').insert(row).select().single()
    if (err) { setError(friendlyError(err)); return }
    if (data) {
      const created = data as SystemBody
      setBodies(prev => (prev.some(b => b.id === created.id) ? prev : [...prev, created]))
      setSelectedId(created.id)
      if (opts.parent_id) setFocusId(opts.parent_id) // jump the diagram to where we just added
    }
  }

  async function duplicateBody(body: SystemBody) {
    const row = {
      system_id: body.system_id,
      parent_id: body.parent_id,
      kind: body.kind,
      name: `${body.name} (copy)`,
      body_class: body.body_class,
      orbital_radius_au: body.orbital_radius_au,
      orbital_period_days: body.orbital_period_days,
      angle_deg: body.angle_deg,
      mass_solar: body.mass_solar,
      radius_km: body.radius_km,
      color: body.color,
      description: body.description,
      gm_notes: body.gm_notes,
    }
    const { data, error: err } = await supabase.from('v2_system_bodies').insert(row).select().single()
    if (err) { setError(friendlyError(err)); return }
    if (data) {
      const created = data as SystemBody
      setBodies(prev => [...prev, created])
      setSelectedId(created.id)
    }
  }

  async function deleteBody(body: SystemBody) {
    const descendants = descendantsOf(bodies, body.id)
    const msg = descendants.length > 0
      ? `Delete "${body.name}"? This will also delete ${descendants.length} bod${descendants.length === 1 ? 'y' : 'ies'} orbiting it -- everything nested beneath it in the hierarchy. This can't be undone.`
      : `Delete "${body.name}"? This can't be undone.`
    if (!confirm(msg)) return
    const removeIds = new Set([body.id, ...descendants.map(d => d.id)])
    setBodies(prev => prev.filter(b => !removeIds.has(b.id)))
    if (selectedId && removeIds.has(selectedId)) setSelectedId(null)
    if (focusId && removeIds.has(focusId)) setFocusId(null)
    // The DB cascades the rest; we only need to delete the body itself.
    const { error: err } = await supabase.from('v2_system_bodies').delete().eq('id', body.id)
    if (err) { setError(friendlyError(err)); loadData() }
  }

  function handleKindChange(newKind: BodyKind) {
    if (!selected) return
    const body_class = classesForKind(newKind)[0]?.id ?? ''
    patchBody(selected.id, { kind: newKind, body_class })
  }

  function handleClassChange(newClass: string) {
    if (!selected) return
    const patch: Partial<SystemBody> = { body_class: newClass }
    // Only prefill mass/radius if the GM hasn't set either yet -- never clobber real data.
    if (selected.mass_solar == null && selected.radius_km == null) {
      const d = classDefaults(selected.kind, newClass)
      if (d.mass_solar != null) patch.mass_solar = d.mass_solar
      if (d.radius_km != null) patch.radius_km = d.radius_km
    }
    patchBody(selected.id, patch)
  }

  function toggleCollapse(bodyId: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(bodyId)) next.delete(bodyId)
      else next.add(bodyId)
      return next
    })
  }

  // ---- Keyboard: Escape clears selection -------------------------------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)
      if (typing) return
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---- Render -----------------------------------------------------------
  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><p className="text-white text-xl animate-pulse">Loading system…</p></div>
  }

  if (!isGM) return null

  if (!system) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-center px-6">
        <p className="text-4xl mb-4">🌌</p>
        <p className="text-white text-lg mb-2">This system isn&apos;t available.</p>
        {error && <p className="text-red-400 text-sm max-w-md mb-4">{error}</p>}
        <Link href="/v2/galaxy" className="text-red-400 hover:text-red-300">← Back to the galaxy</Link>
      </div>
    )
  }

  return (
    <main className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/v2/galaxy" className="text-gray-400 hover:text-white shrink-0 text-lg" title="Back to the galaxy map">←</Link>
          <div className="min-w-0">
            <input
              defaultValue={system.name}
              key={`sysname-${system.id}`}
              onBlur={e => { const v = e.target.value.trim(); if (v && v !== system.name) patchSystem({ name: v }) }}
              className="bg-transparent border-b border-transparent hover:border-gray-600 focus:border-red-500 outline-none text-xl sm:text-2xl font-bold text-red-500 font-mono w-full max-w-md"
            />
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 font-mono">
              <CoordField label="X" value={system.x} onCommit={v => patchSystem({ x: v ?? 0 })} />
              <CoordField label="Y" value={system.y} onCommit={v => patchSystem({ y: v ?? 0 })} />
              <CoordField label="Z" value={system.z} onCommit={v => patchSystem({ z: v ?? 0 })} />
              <span className="text-gray-600">ly</span>
            </div>
          </div>
        </div>
        <span className="text-xs text-gray-500 shrink-0 hidden sm:inline">{bodies.length} bod{bodies.length === 1 ? 'y' : 'ies'}</span>
      </div>

      {/* Error banner -- a clear message beats a blank screen if the migration isn't applied yet */}
      {error && (
        <div className="bg-red-950 border-b border-red-800 text-red-200 text-sm px-4 py-2 flex items-center justify-between gap-4 shrink-0">
          <span className="truncate">⚠ {error}</span>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-white shrink-0">✕</button>
        </div>
      )}

      {bodies.length === 0 ? (
        // ---- Empty state --------------------------------------------------
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <p className="text-5xl mb-4">☀️</p>
          <p className="text-lg mb-2">No bodies in this system yet.</p>
          <p className="text-gray-500 mb-6 max-w-sm">Every system starts with at least one star. Add one to begin building out planets, moons, stations and belts around it.</p>
          <button onClick={() => addBody({ parent_id: null })} className="px-5 py-2.5 rounded bg-red-700 hover:bg-red-600 font-bold">★ Add Star</button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Hierarchy tree */}
          <div className="lg:w-80 border-b lg:border-b-0 lg:border-r border-gray-700 bg-gray-800/30 flex flex-col min-h-0 max-h-[38vh] lg:max-h-none shrink-0">
            <div className="p-2 border-b border-gray-800 flex items-center justify-between shrink-0">
              <h2 className="text-xs uppercase tracking-wide text-gray-500 font-bold">Hierarchy</h2>
              <button onClick={() => addBody({ parent_id: null })} className="text-xs px-2 py-1 rounded bg-red-800 hover:bg-red-700 font-bold whitespace-nowrap">★ Add Star</button>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5">
              <TreeBranch
                bodies={bodies}
                bodiesById={bodiesById}
                parentId={null}
                depth={0}
                selectedId={selectedId}
                collapsed={collapsed}
                onToggleCollapse={toggleCollapse}
                onSelect={setSelectedId}
                onAddChild={b => addBody({ parent_id: b.id })}
                onDelete={deleteBody}
                onDuplicate={duplicateBody}
                onFocus={setFocusId}
                focusId={focusId}
              />
            </div>
          </div>

          {/* Orbit diagram */}
          <div className="flex-1 min-h-[38vh] lg:min-h-0 border-b lg:border-b-0 lg:border-r border-gray-700 flex flex-col">
            <OrbitDiagram
              bodies={bodies}
              focusId={focusId}
              onFocusChange={setFocusId}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>

          {/* Inspector */}
          <div className="lg:w-96 flex flex-col min-h-0 shrink-0">
            <div className="p-2 border-b border-gray-800 shrink-0">
              <h2 className="text-xs uppercase tracking-wide text-gray-500 font-bold">Inspector</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {selected ? (
                <InspectorPanel
                  body={selected}
                  bodies={bodies}
                  bodiesById={bodiesById}
                  onPatch={p => patchBody(selected.id, p)}
                  onKindChange={handleKindChange}
                  onClassChange={handleClassChange}
                  onDelete={() => deleteBody(selected)}
                  onDuplicate={() => duplicateBody(selected)}
                />
              ) : (
                <p className="text-gray-500 text-sm">Select a body from the hierarchy or the diagram to edit it. Press Esc to clear the selection.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// ==========================================================================
// Hierarchy tree
// ==========================================================================
interface TreeBranchProps {
  bodies: SystemBody[]
  bodiesById: Map<string, SystemBody>
  parentId: string | null
  depth: number
  selectedId: string | null
  collapsed: Set<string>
  onToggleCollapse: (id: string) => void
  onSelect: (id: string) => void
  onAddChild: (parent: SystemBody) => void
  onDelete: (body: SystemBody) => void
  onDuplicate: (body: SystemBody) => void
  onFocus: (id: string) => void
  focusId: string | null
}

function TreeBranch(p: TreeBranchProps) {
  const kids = childrenOf(p.bodies, p.parentId)
  if (kids.length === 0) return null
  return (
    <>
      {kids.map(b => {
        const childCount = childrenOf(p.bodies, b.id).length
        const isCollapsed = p.collapsed.has(b.id)
        const cls = bodyClassMeta(b.kind, b.body_class)
        const kindMeta = BODY_KINDS.find(k => k.kind === b.kind)
        const parent = b.parent_id ? p.bodiesById.get(b.parent_id) ?? null : null
        const periodDays = resolvePeriodDays(b, parent?.mass_solar ?? null)
        return (
          <div key={b.id}>
            <div
              className={`group flex items-center gap-1.5 py-1.5 pr-1.5 rounded cursor-pointer text-sm ${p.selectedId === b.id ? 'bg-red-900/40 border border-red-700' : 'hover:bg-gray-800 border border-transparent'}`}
              style={{ paddingLeft: `${p.depth * 18 + 6}px` }}
              onClick={() => p.onSelect(b.id)}
            >
              {childCount > 0 ? (
                <button onClick={e => { e.stopPropagation(); p.onToggleCollapse(b.id) }} className="w-4 text-gray-500 hover:text-white shrink-0">
                  {isCollapsed ? '▸' : '▾'}
                </button>
              ) : <span className="w-4 shrink-0" />}
              <span className="shrink-0" style={{ color: b.color || cls.color }}>{kindMeta?.icon ?? cls.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {b.name}
                  {childCount > 0 && <span className="text-gray-500 font-normal"> ({childCount})</span>}
                  {p.focusId === b.id && (
                    <span className="ml-1.5 text-[10px] text-red-400 font-normal" title="Currently shown in the diagram">◎</span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 truncate">
                  {cls.label} · {b.orbital_radius_au.toFixed(b.orbital_radius_au < 1 ? 3 : 2)} AU · {formatPeriod(periodDays)}
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0">
                {childCount > 0 && (
                  <IconBtn
                    title="Show what orbits this in the diagram"
                    onClick={e => { e.stopPropagation(); p.onFocus(b.id) }}
                  >
                    ◎
                  </IconBtn>
                )}
                <IconBtn title="Add orbiting body" onClick={e => { e.stopPropagation(); p.onAddChild(b) }}>＋</IconBtn>
                <IconBtn title="Duplicate" onClick={e => { e.stopPropagation(); p.onDuplicate(b) }}>⧉</IconBtn>
                <IconBtn title="Delete" danger onClick={e => { e.stopPropagation(); p.onDelete(b) }}>🗑</IconBtn>
              </div>
            </div>
            {!isCollapsed && (
              <TreeBranch {...p} parentId={b.id} depth={p.depth + 1} />
            )}
          </div>
        )
      })}
    </>
  )
}

function IconBtn({ title, onClick, danger, children }: { title: string; onClick: (e: React.MouseEvent) => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`w-6 h-6 rounded flex items-center justify-center text-xs hover:text-white ${danger ? 'hover:bg-red-900/60 text-red-400' : 'hover:bg-gray-700 text-gray-400'}`}
    >
      {children}
    </button>
  )
}

// ==========================================================================
// Orbit diagram (SVG schematic, non-linear radius scale)
// ==========================================================================
function OrbitDiagram({
  bodies, focusId, onFocusChange, selectedId, onSelect,
}: {
  bodies: SystemBody[]
  focusId: string | null
  onFocusChange: (id: string | null) => void
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const bodiesById = useMemo(() => new Map(bodies.map(b => [b.id, b])), [bodies])
  const focusBody = focusId ? bodiesById.get(focusId) ?? null : null
  const children = childrenOf(bodies, focusId)

  // Breadcrumb: barycentre -> ... -> focused body
  const crumbs: SystemBody[] = []
  let cur = focusBody
  while (cur) {
    crumbs.unshift(cur)
    cur = cur.parent_id ? bodiesById.get(cur.parent_id) ?? null : null
  }

  const size = 560
  const center = size / 2
  const maxRadiusPx = center - 40
  const innerPad = 26
  // Bodies sitting at radius 0 (typically stars on the barycentre) are drawn at
  // the centre rather than on a ring, so they need excluding from the scale --
  // otherwise a lone star would make maxAu 0 and collapse everything inward.
  const orbiting = children.filter(c => c.orbital_radius_au > 0)
  const atCentre = children.filter(c => c.orbital_radius_au <= 0)
  const maxAu = Math.max(0.001, ...orbiting.map(c => c.orbital_radius_au))

  // Real orbital radii span orders of magnitude -- a sqrt scale keeps the inner
  // system usable instead of collapsing it into a single dot.
  function radiusPx(au: number): number {
    if (au <= 0) return 0
    return innerPad + (maxRadiusPx - innerPad) * Math.sqrt(au / maxAu)
  }

  function markerSize(kind: BodyKind): number {
    if (kind === 'star') return 14
    if (kind === 'planet') return 9
    return 6 // moon, station, belt
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 text-xs px-2 py-1.5 border-b border-gray-800 overflow-x-auto shrink-0">
        <button onClick={() => onFocusChange(null)} className={`px-2 py-0.5 rounded whitespace-nowrap ${focusId === null ? 'bg-red-900/50 text-red-200' : 'text-gray-400 hover:text-white'}`}>🌌 System</button>
        {crumbs.map(c => (
          <span key={c.id} className="flex items-center gap-1 shrink-0">
            <span className="text-gray-600">/</span>
            <button onClick={() => onFocusChange(c.id)} className={`px-2 py-0.5 rounded truncate max-w-[10rem] ${focusId === c.id ? 'bg-red-900/50 text-red-200' : 'text-gray-400 hover:text-white'}`}>{c.name}</button>
          </span>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
          {focusBody ? (
            <g>
              <circle
                cx={center} cy={center} r={16}
                fill={focusBody.color || bodyClassMeta(focusBody.kind, focusBody.body_class).color}
                stroke={selectedId === focusBody.id ? '#fff' : 'none'}
                strokeWidth={2}
                className="cursor-pointer"
                onClick={() => onSelect(focusBody.id)}
              />
              <text x={center} y={center + 32} textAnchor="middle" fontSize="11" fill="#9ca3af" className="pointer-events-none select-none">{focusBody.name}</text>
            </g>
          ) : atCentre.length === 0 ? (
            <g>
              <circle cx={center} cy={center} r={3} fill="#4b5563" />
              <text x={center} y={center + 18} textAnchor="middle" fontSize="10" fill="#6b7280" className="pointer-events-none select-none">barycentre</text>
            </g>
          ) : null}

          {/* Bodies at radius 0 sit ON the barycentre. Fan them apart so a binary
              pair stays readable instead of stacking into one dot. */}
          {!focusBody && atCentre.map((b, i) => {
            const cls = bodyClassMeta(b.kind, b.body_class)
            const spread = atCentre.length > 1 ? 18 : 0
            const a = (i / Math.max(1, atCentre.length)) * Math.PI * 2 - Math.PI / 2
            const x = center + spread * Math.cos(a)
            const y = center + spread * Math.sin(a)
            const hasKids = childrenOf(bodies, b.id).length > 0
            const isSel = selectedId === b.id
            return (
              <g key={b.id}>
                <circle
                  cx={x} cy={y} r={16}
                  fill={b.color || cls.color}
                  stroke={isSel ? '#fff' : hasKids ? '#f87171' : 'none'}
                  strokeWidth={isSel ? 2.5 : hasKids ? 1.5 : 0}
                  className="cursor-pointer"
                  onClick={() => onSelect(b.id)}
                  onDoubleClick={() => { if (hasKids) onFocusChange(b.id) }}
                >
                  <title>{b.name} -- {cls.label}{hasKids ? ' (double-click to see what orbits it)' : ''}</title>
                </circle>
                <text x={x} y={y + 30} textAnchor="middle" fontSize="11" fill="#d1d5db" className="pointer-events-none select-none">{b.name}</text>
              </g>
            )
          })}

          {children.length === 0 && (
            <text x={center} y={center - 60} textAnchor="middle" fontSize="12" fill="#6b7280" className="pointer-events-none select-none">
              {focusBody ? 'Nothing orbits this yet -- add one from the hierarchy panel.' : 'Add a star to begin.'}
            </text>
          )}

          {orbiting.map(b => {
            const r = radiusPx(b.orbital_radius_au)
            const angleRad = (b.angle_deg * Math.PI) / 180
            const x = center + r * Math.cos(angleRad)
            const y = center + r * Math.sin(angleRad)
            const cls = bodyClassMeta(b.kind, b.body_class)
            const color = b.color || cls.color
            const kids = childrenOf(bodies, b.id)
            const hasKids = kids.length > 0
            const isSel = selectedId === b.id
            const msz = markerSize(b.kind)
            const satRing = msz + 8
            return (
              <g key={b.id}>
                <circle
                  cx={center} cy={center} r={r} fill="none" stroke="#374151" strokeWidth={1}
                  strokeDasharray={b.kind === 'belt' ? '3 3' : undefined}
                />

                {/* Whatever orbits this body, shown in miniature so the system's
                    structure reads at a glance without drilling in. */}
                {hasKids && (
                  <>
                    <circle cx={x} cy={y} r={satRing} fill="none" stroke="#4b5563" strokeWidth={0.75} strokeDasharray="2 2" />
                    {kids.map((k, ki) => {
                      const ka = (ki / kids.length) * Math.PI * 2 - Math.PI / 2
                      const kcls = bodyClassMeta(k.kind, k.body_class)
                      return (
                        <circle
                          key={k.id}
                          cx={x + satRing * Math.cos(ka)}
                          cy={y + satRing * Math.sin(ka)}
                          r={3}
                          fill={k.color || kcls.color}
                          stroke={selectedId === k.id ? '#fff' : 'none'}
                          strokeWidth={1.5}
                          className="cursor-pointer"
                          onClick={() => onSelect(k.id)}
                          // Drop into the parent so this one becomes a full-size
                          // body with its own orbiters visible.
                          onDoubleClick={() => onFocusChange(b.id)}
                        >
                          <title>{k.name} -- {kcls.label} (double-click to open {b.name})</title>
                        </circle>
                      )
                    })}
                  </>
                )}

                <circle
                  cx={x} cy={y} r={msz}
                  fill={color}
                  stroke={isSel ? '#fff' : hasKids ? '#f87171' : 'none'}
                  strokeWidth={isSel ? 2.5 : hasKids ? 1.5 : 0}
                  className="cursor-pointer"
                  onClick={() => onSelect(b.id)}
                  onDoubleClick={() => { if (hasKids) onFocusChange(b.id) }}
                >
                  <title>{b.name} -- {cls.label}{hasKids ? ' (double-click to focus)' : ''}</title>
                </circle>
                <text
                  x={x}
                  y={y + (hasKids ? satRing : msz) + 12}
                  textAnchor="middle" fontSize="10" fill="#d1d5db"
                  className="pointer-events-none select-none"
                >
                  {b.name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <p className="text-[11px] text-gray-500 px-2 py-1 border-t border-gray-800 shrink-0">
        Click to select · <span className="text-gray-300">double-click a body with a red halo</span> to open it, or hit <span className="text-gray-300">◎</span> on any row in the hierarchy · use the breadcrumb above to come back out
      </p>
    </div>
  )
}

// ==========================================================================
// Inspector
// ==========================================================================
function InspectorPanel({
  body, bodies, bodiesById, onPatch, onKindChange, onClassChange, onDelete, onDuplicate,
}: {
  body: SystemBody
  bodies: SystemBody[]
  bodiesById: Map<string, SystemBody>
  onPatch: (patch: Partial<SystemBody>) => void
  onKindChange: (k: BodyKind) => void
  onClassChange: (c: string) => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const parent = body.parent_id ? bodiesById.get(body.parent_id) ?? null : null
  const parentMass = parent?.mass_solar ?? null
  const effectivePeriod = resolvePeriodDays(body, parentMass)
  const hasOverride = body.orbital_period_days != null
  const classList = classesForKind(body.kind)
  const cls = bodyClassMeta(body.kind, body.body_class)
  const isStar = body.kind === 'star'
  const starMeta = isStar ? starClassMeta(body.body_class) : null
  const lightless = isStar && isLightless(body.body_class)

  // Cycle guard: a body can't be re-parented onto itself or any of its own descendants.
  const parentOptions = bodies
    .filter(b => b.id !== body.id && !wouldCycle(bodies, body.id, b.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  const displayMass = isStar
    ? body.mass_solar
    : (body.mass_solar != null ? roundSig(solarToEarthMasses(body.mass_solar)) : null)

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-2xl shrink-0" style={{ color: body.color || cls.color }}>{BODY_KINDS.find(k => k.kind === body.kind)?.icon ?? cls.icon}</span>
        <div className="min-w-0 flex-1">
          <input
            defaultValue={body.name}
            key={`name-${body.id}`}
            onBlur={e => { const v = e.target.value.trim(); if (v && v !== body.name) onPatch({ name: v }) }}
            className="w-full bg-transparent border-b border-transparent hover:border-gray-700 focus:border-red-500 outline-none font-bold text-base py-0.5"
          />
          <div className="text-xs text-gray-500">{cls.label}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Kind">
          <select value={body.kind} onChange={e => onKindChange(e.target.value as BodyKind)} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1">
            {BODY_KINDS.map(k => <option key={k.kind} value={k.kind}>{k.icon} {k.label}</option>)}
          </select>
        </Field>
        <Field label="Class">
          <select value={body.body_class} onChange={e => onClassChange(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1">
            {classList.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Orbits (parent)">
        <select
          value={body.parent_id ?? ''}
          onChange={e => onPatch({ parent_id: e.target.value || null })}
          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1"
        >
          <option value="">— System barycentre —</option>
          {parentOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Orbital radius (AU)">
          <FloatField value={body.orbital_radius_au} min={0} onCommit={v => onPatch({ orbital_radius_au: v ?? 0 })} />
        </Field>
        <Field label="Angle (deg)">
          <FloatField value={body.angle_deg} min={0} max={360} onCommit={v => onPatch({ angle_deg: v ?? 0 })} />
        </Field>
      </div>

      {/* Orbital period: derived from Kepler unless overridden */}
      <div className="rounded border border-gray-700 bg-gray-900/40 p-2 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Orbital period</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${hasOverride ? 'bg-yellow-900/60 text-yellow-300 border border-yellow-700' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
            {hasOverride ? 'MANUAL' : 'DERIVED (KEPLER)'}
          </span>
        </div>
        <div className="font-mono">{formatPeriod(effectivePeriod)}</div>
        {!parent && <p className="text-[11px] text-gray-600">Orbits the barycentre, so there&apos;s no parent mass to derive a period from -- set one manually if it matters.</p>}
        {parent && parentMass == null && !hasOverride && <p className="text-[11px] text-gray-600">Set {parent.name}&apos;s mass to derive a period, or enter one manually below.</p>}
        <div className="flex items-center gap-2">
          <FloatField
            value={body.orbital_period_days}
            min={0}
            placeholder={parent && parentMass != null ? formatPeriod(orbitalPeriodDays(body.orbital_radius_au, parentMass)) + ' (derived)' : 'days (manual)'}
            onCommit={v => onPatch({ orbital_period_days: v })}
            className="flex-1"
          />
          {hasOverride && (
            <button onClick={() => onPatch({ orbital_period_days: null })} className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs shrink-0">Clear override</button>
          )}
        </div>
      </div>

      <Field label={isStar ? 'Mass (solar masses)' : 'Mass (Earth masses)'}>
        <FloatField
          value={displayMass}
          min={0}
          onCommit={v => onPatch({ mass_solar: v == null ? null : (isStar ? v : earthMassesToSolar(v)) })}
        />
      </Field>

      <Field label="Radius (km)">
        <FloatField value={body.radius_km} min={0} onCommit={v => onPatch({ radius_km: v })} />
      </Field>

      <Field label="Color override">
        <div className="flex items-center gap-2">
          <input type="color" value={body.color || cls.color} onChange={e => onPatch({ color: e.target.value })} className="w-8 h-8 rounded bg-transparent border-0 p-0 shrink-0" />
          <span className="text-xs text-gray-500 truncate">{body.color ? body.color : `default (${cls.color})`}</span>
          {body.color && <button onClick={() => onPatch({ color: null })} className="ml-auto px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-xs shrink-0">Reset</button>}
        </div>
      </Field>

      {isStar && starMeta && (
        <div className="rounded border border-gray-700 bg-gray-900/40 p-2.5 space-y-1 text-xs">
          <div className="font-bold text-gray-300">{starMeta.label} <span className="text-gray-500 font-normal">· {starMeta.spectral}</span></div>
          <p className="text-gray-500">{starMeta.blurb}</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1 text-gray-400">
            <span>Temp: {lightless ? 'n/a -- no photosphere' : `${starMeta.tempK[0].toLocaleString()}–${starMeta.tempK[1].toLocaleString()} K`}</span>
            <span>Mass: {starMeta.massSolar[0]}–{starMeta.massSolar[1]} M☉</span>
            <span>Radius: {starMeta.radiusSolar[0]}–{starMeta.radiusSolar[1]} R☉</span>
            <span>Luminosity: {lightless ? 'n/a -- emits no light' : `${starMeta.luminosity[0]}–${starMeta.luminosity[1]} L☉`}</span>
          </div>
          <div className="text-gray-600">{starMeta.abundance}</div>
        </div>
      )}

      <Field label="Description">
        <textarea
          defaultValue={body.description}
          key={`desc-${body.id}`}
          rows={3}
          onBlur={e => onPatch({ description: e.target.value })}
          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 resize-none"
        />
      </Field>

      <Field label="GM notes (private)">
        <textarea
          defaultValue={body.gm_notes}
          key={`gmn-${body.id}`}
          rows={3}
          onBlur={e => onPatch({ gm_notes: e.target.value })}
          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 resize-none"
        />
      </Field>

      <div className="flex gap-2 pt-2 border-t border-gray-700">
        <button onClick={onDuplicate} className="flex-1 py-2 rounded bg-gray-700/60 border border-gray-600 hover:bg-gray-700 text-sm font-bold">⧉ Duplicate</button>
        <button onClick={onDelete} className="flex-1 py-2 rounded bg-red-900/60 border border-red-700 text-red-200 hover:bg-red-900 text-sm font-bold">🗑 Delete</button>
      </div>
    </div>
  )
}

// ==========================================================================
// Shared small inputs
// ==========================================================================
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-400 mb-1">{label}</span>
      {children}
    </label>
  )
}

// A number input that supports decimals and a nullable value (blank = null, e.g.
// "no manual period override" / "mass unknown"). Commits on blur or Enter.
function FloatField({
  value, min, max, placeholder, onCommit, className = '',
}: {
  value: number | null
  min?: number
  max?: number
  placeholder?: string
  onCommit: (v: number | null) => void
  className?: string
}) {
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  const [prevVal, setPrevVal] = useState(value)
  // Re-sync the draft when the committed value changes externally (realtime update, etc).
  if (prevVal !== value) {
    setPrevVal(value)
    setDraft(value == null ? '' : String(value))
  }
  function commit() {
    const trimmed = draft.trim()
    if (trimmed === '') {
      if (value !== null) onCommit(null)
      return
    }
    let v = Number(trimmed)
    if (Number.isNaN(v)) { setDraft(value == null ? '' : String(value)); return }
    if (min != null) v = Math.max(min, v)
    if (max != null) v = Math.min(max, v)
    setDraft(String(v))
    if (v !== value) onCommit(v)
  }
  return (
    <input
      type="number"
      step="any"
      value={draft}
      placeholder={placeholder}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className={`bg-gray-900 border border-gray-600 rounded px-2 py-1 w-full ${className}`}
    />
  )
}

function CoordField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number | null) => void }) {
  return (
    <label className="flex items-center gap-1">
      <span className="text-gray-600">{label}</span>
      <FloatField value={value} onCommit={onCommit} className="w-14 py-0.5 px-1 text-xs" />
    </label>
  )
}
