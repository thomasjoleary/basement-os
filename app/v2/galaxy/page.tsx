'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import GalaxyMap, { GalaxyTool, GalaxyFocusRequest } from '@/components/galaxy/GalaxyMap'
import {
  StarSystem,
  SystemBody,
  GalaxySettings,
  DEFAULT_SETTINGS,
  JumpDrive,
  DRIVE_PROFILES,
  DEFAULT_DRIVE,
  STAR_CLASSES,
  systemColor,
  normalizeBody,
  nearestSystems,
  formatLy,
  formatDuration,
  jumpTimeHours,
} from '@/lib/galaxy'

// Turns a raw Supabase/Postgres error into something a GM can act on --
// most importantly, "the table doesn't exist yet" (migration not applied).
function describeError(err: { message: string; code?: string } | null): string {
  if (!err) return 'Unknown error'
  if (err.code === '42P01' || /relation .* does not exist/i.test(err.message)) {
    return `Table not found (${err.message}). Has the v2 galaxy SQL migration been applied yet?`
  }
  return err.message
}

export default function GalaxyMapPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [isGM, setIsGM] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [systems, setSystems] = useState<StarSystem[]>([])
  const [bodies, setBodies] = useState<SystemBody[]>([])
  const [settings, setSettings] = useState<GalaxySettings>(DEFAULT_SETTINGS)
  // Jump performance is a property of the ship, not the galaxy, so this is local
  // UI state for estimating travel -- nothing is persisted. Eventually this
  // picker gets replaced by whatever drive the party's ship actually has.
  const [drive, setDrive] = useState<JumpDrive>(DEFAULT_DRIVE)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tool, setTool] = useState<GalaxyTool>('select')
  const [addMode, setAddMode] = useState(false)
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [measureFrom, setMeasureFrom] = useState<string | null>(null)
  const [measureTo, setMeasureTo] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [focusRequest, setFocusRequest] = useState<GalaxyFocusRequest | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const focusNonce = useRef(0)

  // ---- Auth gate ------------------------------------------------------------
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (!profile || profile.role !== 'gm') {
        alert('Access denied. GM only.')
        router.push('/')
        return
      }

      setIsGM(true)
      setUserId(session.user.id)
      await loadAll()
      setLoading(false)
    }
    init()
  }, [router])

  async function loadAll() {
    const [sysRes, bodyRes, settingsRes] = await Promise.all([
      supabase.from('v2_star_systems').select('*').order('name'),
      supabase.from('v2_system_bodies').select('*'),
      supabase.from('v2_galaxy_settings').select('*').eq('id', 1).maybeSingle(),
    ])

    if (sysRes.error) setError(describeError(sysRes.error))
    else setSystems((sysRes.data ?? []) as StarSystem[])

    if (bodyRes.error) {
      if (!sysRes.error) setError(describeError(bodyRes.error))
    } else {
      setBodies((bodyRes.data ?? []).map(normalizeBody))
    }

    // Missing singleton row (or the table itself missing, or nothing has been
    // saved yet) all fall back to DEFAULT_SETTINGS rather than crashing.
    if (settingsRes.data) setSettings(settingsRes.data as GalaxySettings)
    else setSettings(DEFAULT_SETTINGS)
  }

  // ---- Realtime: keep systems in sync with other sessions -------------------
  useEffect(() => {
    if (!isGM) return
    const channel = supabase
      .channel('v2-galaxy-systems')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'v2_star_systems' }, payload => {
        setSystems(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(s => s.id !== (payload.old as { id: string }).id)
          const row = payload.new as StarSystem
          const idx = prev.findIndex(s => s.id === row.id)
          if (idx === -1) return [...prev, row]
          const next = [...prev]
          next[idx] = row
          return next
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [isGM])

  // ---- Derived: colour per system, from its primary star -------------------
  const bodiesBySystem = useMemo(() => {
    const m: Record<string, SystemBody[]> = {}
    for (const b of bodies) (m[b.system_id] ??= []).push(b)
    return m
  }, [bodies])

  const systemColors = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of systems) m[s.id] = systemColor(bodiesBySystem[s.id] ?? [])
    return m
  }, [systems, bodiesBySystem])

  const selected = systems.find(s => s.id === selectedId) ?? null
  const nearest = useMemo(() => (selected ? nearestSystems(selected, systems, 6) : []), [selected, systems])

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return systems.filter(s => s.name.toLowerCase().includes(q)).slice(0, 8)
  }, [search, systems])

  // ---- Mutations --------------------------------------------------------
  function goToSystem(sys: StarSystem) {
    focusNonce.current += 1
    setSelectedId(sys.id)
    setFocusRequest({ x: sys.x, y: sys.y, nonce: focusNonce.current })
    setSearch('')
  }

  async function createSystemAt(x: number, y: number) {
    const { data, error: err } = await supabase
      .from('v2_star_systems')
      .insert({
        name: 'New System',
        x, y, z: 0,
        description: '',
        gm_notes: '',
        discovered: false,
        tags: [],
        created_by: userId,
      })
      .select()
      .single()

    if (err) { setError(describeError(err)); return }
    if (data) {
      const sys = data as StarSystem
      setSystems(prev => [...prev, sys])
      setSelectedId(sys.id)
      setAddMode(false)
    }
  }

  async function moveSystem(id: string, x: number, y: number) {
    setSystems(prev => prev.map(s => (s.id === id ? { ...s, x, y } : s)))
    const { error: err } = await supabase.from('v2_star_systems').update({ x, y }).eq('id', id)
    if (err) setError(describeError(err))
  }

  async function patchSystem(id: string, patch: Partial<StarSystem>) {
    setSystems(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)))
    const { error: err } = await supabase.from('v2_star_systems').update(patch).eq('id', id)
    if (err) setError(describeError(err))
  }

  async function deleteSystem(id: string) {
    const sys = systems.find(s => s.id === id)
    if (!sys) return
    if (!confirm(`Delete "${sys.name}" and every body in it? This cannot be undone.`)) return

    setSystems(prev => prev.filter(s => s.id !== id))
    setBodies(prev => prev.filter(b => b.system_id !== id))
    if (selectedId === id) setSelectedId(null)
    if (measureFrom === id || measureTo === id) { setMeasureFrom(null); setMeasureTo(null) }

    const { error: err } = await supabase.from('v2_star_systems').delete().eq('id', id)
    if (err) setError(describeError(err))
  }

  async function updateSettings(patch: Partial<GalaxySettings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    const { error: err } = await supabase.from('v2_galaxy_settings').upsert({
      id: 1,
      galaxy_name: next.galaxy_name,
    })
    if (err) setError(describeError(err))
  }

  function selectTool(t: GalaxyTool) {
    setTool(t)
    setAddMode(false)
  }

  function toggleAddMode() {
    setAddMode(a => {
      const next = !a
      if (next) setTool('select')
      return next
    })
  }

  // ---- Render -------------------------------------------------------------
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <p className="text-gray-500 animate-pulse">Loading galaxy…</p>
      </main>
    )
  }

  if (!isGM) return null

  return (
    <main className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/v2" className="text-gray-400 hover:text-white shrink-0">←</Link>
          <h1 className="text-base sm:text-lg font-bold text-red-500 font-mono truncate">
            {settings.galaxy_name || 'GALAXY MAP'}
          </h1>
          <span className="bg-red-900/80 text-red-200 text-xs px-2 py-0.5 rounded border border-red-700 font-bold shrink-0">GM</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Find a system…"
              className="w-40 sm:w-56 bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder:text-gray-500"
            />
            {searchResults.length > 0 && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-gray-800 border border-gray-600 rounded shadow-xl z-40 overflow-hidden">
                {searchResults.map(s => (
                  <button
                    key={s.id}
                    onClick={() => goToSystem(s)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 flex items-center gap-2"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: systemColors[s.id] }} />
                    <span className="truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer select-none">
            <input type="checkbox" checked={snapToGrid} onChange={e => setSnapToGrid(e.target.checked)} />
            Snap
          </label>

          <button
            onClick={() => setShowSettings(true)}
            className="w-9 h-9 rounded bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center"
            title="Galaxy settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-950 border-b border-red-700 text-red-200 text-sm px-4 py-2 flex items-center justify-between gap-3 shrink-0">
          <span className="truncate">⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-white shrink-0">✕</button>
        </div>
      )}

      {/* Body: map + side panel */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <div className="relative flex-1 min-h-[50vh] md:min-h-0">
          <GalaxyMap
            systems={systems}
            systemColors={systemColors}
            selectedId={selectedId}
            onSelect={setSelectedId}
            tool={tool}
            addMode={addMode}
            onCreateAt={createSystemAt}
            onMoveSystem={moveSystem}
            onDeleteSystem={deleteSystem}
            measureFrom={measureFrom}
            measureTo={measureTo}
            onMeasureChange={(from, to) => { setMeasureFrom(from); setMeasureTo(to) }}
            snapToGrid={snapToGrid}
            drive={drive}
            focusRequest={focusRequest}
          />

          {/* Empty state */}
          {systems.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center bg-gray-900/80 border border-gray-700 rounded-xl px-8 py-6 max-w-sm">
                <p className="text-3xl mb-2">🌌</p>
                <p className="text-white font-bold mb-1">No systems yet</p>
                <p className="text-gray-400 text-sm">Turn on Add and click anywhere on the map to place your first star system.</p>
              </div>
            </div>
          )}

          {/* Floating tool dock */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-gray-800/95 border border-gray-600 rounded-full px-2 py-1.5 shadow-lg">
            <ToolBtn active={tool === 'select'} onClick={() => selectTool('select')} title="Select / move">↖️</ToolBtn>
            <ToolBtn active={tool === 'pan'} onClick={() => selectTool('pan')} title="Pan">✋</ToolBtn>
            <ToolBtn active={tool === 'measure'} onClick={() => selectTool('measure')} title="Measure jump distance">📏</ToolBtn>
            <span className="w-px h-6 bg-gray-600 mx-0.5" />
            <ToolBtn active={addMode} onClick={toggleAddMode} title="Add system">➕</ToolBtn>
          </div>
        </div>

        {/* Side panel */}
        <div className="w-full md:w-80 shrink-0 bg-gray-800 border-t md:border-t-0 md:border-l border-gray-700 overflow-y-auto">
          {selected ? (
            <SystemPanel
              key={selected.id}
              system={selected}
              nearest={nearest}
              drive={drive}
              onPatch={patch => patchSystem(selected.id, patch)}
              onDelete={() => deleteSystem(selected.id)}
              onSelectNearest={id => {
                const s = systems.find(x => x.id === id)
                if (s) goToSystem(s)
              }}
            />
          ) : (
            <div className="p-4 text-sm text-gray-400">
              Select a system on the map to view and edit it, or turn on <span className="text-white font-bold">Add</span> and click the map to place a new one.
            </div>
          )}

          <Legend />
        </div>
      </div>

      {showSettings && (
        <SettingsModal
          settings={settings}
          drive={drive}
          onSave={updateSettings}
          onDriveChange={setDrive}
          onClose={() => setShowSettings(false)}
        />
      )}
    </main>
  )
}

// ===========================================================================
// Side panel: selected system editor + nearest-systems planner
// ===========================================================================

function SystemPanel({
  system,
  nearest,
  drive,
  onPatch,
  onDelete,
  onSelectNearest,
}: {
  system: StarSystem
  nearest: { system: StarSystem; ly: number }[]
  drive: JumpDrive
  onPatch: (patch: Partial<StarSystem>) => void
  onDelete: () => void
  onSelectNearest: (id: string) => void
}) {
  return (
    <div className="p-4 space-y-4 text-sm border-b border-gray-700">
      <Field label="Name">
        <input
          defaultValue={system.name}
          onBlur={e => { if (e.target.value.trim() && e.target.value !== system.name) onPatch({ name: e.target.value.trim() }) }}
          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-white font-bold"
        />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label="X (ly)">
          <input type="number" step="0.1" defaultValue={system.x}
            onBlur={e => onPatch({ x: parseFloat(e.target.value) || 0 })}
            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1" />
        </Field>
        <Field label="Y (ly)">
          <input type="number" step="0.1" defaultValue={system.y}
            onBlur={e => onPatch({ y: parseFloat(e.target.value) || 0 })}
            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1" />
        </Field>
        <Field label="Z (ly)">
          <input type="number" step="0.1" defaultValue={system.z}
            onBlur={e => onPatch({ z: parseFloat(e.target.value) || 0 })}
            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1" />
        </Field>
      </div>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-xs text-gray-300">Discovered by players</span>
        <input type="checkbox" checked={system.discovered} onChange={e => onPatch({ discovered: e.target.checked })} />
      </label>

      <Field label="Description">
        <textarea defaultValue={system.description} rows={3}
          onBlur={e => onPatch({ description: e.target.value })}
          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 resize-none" />
      </Field>

      <Field label="GM Notes">
        <textarea defaultValue={system.gm_notes} rows={3}
          onBlur={e => onPatch({ gm_notes: e.target.value })}
          placeholder="Private -- never shown to players"
          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 resize-none placeholder:text-gray-600" />
      </Field>

      <Field label="Tags (comma separated)">
        <input defaultValue={system.tags.join(', ')}
          onBlur={e => onPatch({ tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1" />
      </Field>

      <Link
        href={`/v2/galaxy/${system.id}`}
        className="block text-center bg-red-800 hover:bg-red-700 border border-red-600 rounded px-3 py-2 font-bold"
      >
        Open system →
      </Link>

      {nearest.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 uppercase mb-1.5">Nearest systems</p>
          <div className="space-y-1">
            {nearest.map(({ system: n, ly }) => (
              <button
                key={n.id}
                onClick={() => onSelectNearest(n.id)}
                className="w-full flex items-center justify-between gap-2 bg-gray-900/60 hover:bg-gray-900 rounded px-2 py-1.5 text-left"
              >
                <span className="truncate">{n.name}</span>
                <span className="text-gray-400 text-xs shrink-0 font-mono">
                  {formatLy(ly)} · {formatDuration(jumpTimeHours(ly, drive))}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onDelete}
        className="w-full bg-gray-900 hover:bg-red-950 border border-red-900 text-red-400 rounded px-3 py-2 text-xs font-bold"
      >
        🗑️ Delete system
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-400 uppercase mb-1">{label}</span>
      {children}
    </label>
  )
}

function ToolBtn({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-9 h-9 rounded-full text-base flex items-center justify-center transition ${active ? 'bg-red-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
    >
      {children}
    </button>
  )
}

// ===========================================================================
// Star-class colour legend
// ===========================================================================

function Legend() {
  return (
    <div className="p-4 border-t border-gray-700">
      <p className="text-xs text-gray-400 uppercase mb-2">Star classes</p>
      <div className="grid grid-cols-1 gap-1 text-xs">
        {STAR_CLASSES.map(c => (
          <div key={c.id} className="flex items-center gap-2" title={c.blurb}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color, boxShadow: `0 0 4px ${c.color}` }} />
            <span className="text-gray-300 truncate">{c.label}</span>
            <span className="text-gray-600 ml-auto shrink-0">{c.spectral.split(' ')[0]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ===========================================================================
// Galaxy settings modal
//
// The galaxy name is persisted; the drive is not. Jump performance belongs to
// the ship and its components, so the picker here is only an estimating tool
// for the GM -- swap it for the party's actual drive once ships exist.
// ===========================================================================

function SettingsModal({
  settings,
  drive,
  onSave,
  onDriveChange,
  onClose,
}: {
  settings: GalaxySettings
  drive: JumpDrive
  onSave: (patch: Partial<GalaxySettings>) => void
  onDriveChange: (drive: JumpDrive) => void
  onClose: () => void
}) {
  const [name, setName] = useState(settings.galaxy_name)

  function save() {
    onSave({ galaxy_name: name.trim() || DEFAULT_SETTINGS.galaxy_name })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-gray-800 border border-gray-600 rounded-xl p-5 w-full max-w-sm space-y-4">
        <h2 className="text-lg font-bold text-red-500 font-mono">Galaxy Settings</h2>

        <Field label="Galaxy name">
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5" />
        </Field>

        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">
            Estimate jumps with <span className="text-gray-500 normal-case tracking-normal">(not saved)</span>
          </div>
          <div className="space-y-1.5">
            {DRIVE_PROFILES.map(d => (
              <button
                key={d.id}
                onClick={() => onDriveChange(d)}
                className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                  d.id === drive.id
                    ? 'bg-red-900/40 border-red-600 text-white'
                    : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold text-sm">{d.label}</span>
                  <span className="text-[10px] font-mono text-gray-400 shrink-0">
                    {d.charge_hours}h · {d.speed_ly_per_hour} ly/h · {d.power_draw} pwr
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{d.blurb}</p>
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-500">
          With the {drive.label}, a {formatLy(10)} hop costs {formatDuration(jumpTimeHours(10, drive))}.
        </p>

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-3 py-1.5 rounded text-gray-300 hover:text-white">Cancel</button>
          <button onClick={save} className="px-4 py-1.5 rounded bg-red-700 hover:bg-red-600 font-bold">Save</button>
        </div>
      </div>
    </div>
  )
}
