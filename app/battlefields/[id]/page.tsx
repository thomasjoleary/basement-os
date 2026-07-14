'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import BattlefieldGrid from '@/components/battlefield/BattlefieldGrid'
import {
  Battlefield,
  BattlefieldEntity,
  BattlefieldPreset,
  CharacterLite,
  EntityKind,
  TOKEN_COLORS,
  BG_COLORS,
  CONDITIONS,
  kindMeta,
  entityName,
  resolveVitals,
} from '@/lib/battlefield'

type Tab = 'add' | 'inspect' | 'initiative' | 'settings' | 'notes'
type Tool = 'select' | 'pan' | 'measure'
const CREATURE_KINDS = new Set<EntityKind>(['player', 'tame', 'enemy'])

interface FullChar extends CharacterLite {
  is_npc?: boolean
  is_dead?: boolean
}

export default function BattlefieldEditorPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [isGM, setIsGM] = useState(false)
  const [loading, setLoading] = useState(true)
  const [battlefield, setBattlefield] = useState<Battlefield | null>(null)
  const [entities, setEntities] = useState<BattlefieldEntity[]>([])
  const [allChars, setAllChars] = useState<FullChar[]>([])
  const [presets, setPresets] = useState<BattlefieldPreset[]>([])

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [tool, setTool] = useState<Tool>('select')
  const [rangeEntityId, setRangeEntityId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('add')
  const [sheetOpen, setSheetOpen] = useState(false)

  const charMap = useMemo(() => {
    const m: Record<string, CharacterLite> = {}
    for (const c of allChars) m[c.id] = c
    return m
  }, [allChars])

  const selected = selectedIds.length === 1 ? entities.find(e => e.id === selectedIds[0]) ?? null : null

  // ---- Load -------------------------------------------------------------
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
        setIsGM(profile?.role === 'gm')
      }
      const [{ data: bf }, { data: ents }, { data: chars }, { data: pres }] = await Promise.all([
        supabase.from('battlefields').select('*').eq('id', id).single(),
        supabase.from('battlefield_entities').select('*').eq('battlefield_id', id),
        supabase.from('characters').select('id,name,hp_current,hp_max,mana_current,mana_max,is_tame,is_npc,is_dead'),
        supabase.from('battlefield_presets').select('*'),
      ])
      if (bf) setBattlefield(bf as Battlefield)
      if (ents) setEntities(ents as BattlefieldEntity[])
      if (chars) setAllChars(chars as FullChar[])
      if (pres) setPresets(pres as BattlefieldPreset[])
      setLoading(false)
    }
    init()
  }, [id])

  // ---- Realtime ---------------------------------------------------------
  useEffect(() => {
    const channel = supabase
      .channel(`battlefield-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battlefield_entities', filter: `battlefield_id=eq.${id}` }, payload => {
        setEntities(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(e => e.id !== (payload.old as { id: string }).id)
          const row = payload.new as BattlefieldEntity
          const idx = prev.findIndex(e => e.id === row.id)
          if (idx === -1) return [...prev, row]
          const next = [...prev]
          next[idx] = row
          return next
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battlefields', filter: `id=eq.${id}` }, payload => {
        setBattlefield(payload.new as Battlefield)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'characters' }, payload => {
        const row = payload.new as FullChar
        setAllChars(prev => prev.map(c => (c.id === row.id ? { ...c, ...row } : c)))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battlefield_presets' }, payload => {
        setPresets(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(p => p.id !== (payload.old as { id: string }).id)
          const row = payload.new as BattlefieldPreset
          const idx = prev.findIndex(p => p.id === row.id)
          if (idx === -1) return [...prev, row]
          const next = [...prev]
          next[idx] = row
          return next
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  // ---- Mutations --------------------------------------------------------
  async function patchBattlefield(patch: Partial<Battlefield>) {
    setBattlefield(prev => (prev ? { ...prev, ...patch } : prev))
    await supabase.from('battlefields').update(patch).eq('id', id)
  }

  async function patchEntity(entId: string, patch: Partial<BattlefieldEntity>) {
    setEntities(prev => prev.map(e => (e.id === entId ? { ...e, ...patch } : e)))
    await supabase.from('battlefield_entities').update(patch).eq('id', entId)
  }

  async function moveEntities(moves: { id: string; x: number; y: number }[]) {
    setEntities(prev => prev.map(e => {
      const m = moves.find(mm => mm.id === e.id)
      return m ? { ...e, x: m.x, y: m.y } : e
    }))
    await Promise.all(moves.map(m => supabase.from('battlefield_entities').update({ x: m.x, y: m.y }).eq('id', m.id)))
  }

  async function deleteEntities(ids: string[]) {
    if (ids.length === 0) return
    setEntities(prev => prev.filter(e => !ids.includes(e.id)))
    setSelectedIds(prev => prev.filter(x => !ids.includes(x)))
    if (rangeEntityId && ids.includes(rangeEntityId)) setRangeEntityId(null)
    await supabase.from('battlefield_entities').delete().in('id', ids)
  }

  async function addEntity(partial: Partial<BattlefieldEntity>) {
    if (!battlefield) return
    // Apply this character's saved default token look, if one exists.
    let defaults: Partial<BattlefieldEntity> = {}
    if (partial.character_id) {
      const d = presets.find(p => p.preset_kind === 'character_default' && p.character_id === partial.character_id)
      if (d) defaults = { width: d.width, height: d.height, color: d.color, icon: d.icon, move_ft: d.move_ft }
    }
    const spread = entities.length % 6
    const base = {
      battlefield_id: id,
      x: Math.max(0, Math.min(battlefield.cols - 1, Math.floor(battlefield.cols / 2) + (spread % 3))),
      y: Math.max(0, Math.min(battlefield.rows - 1, Math.floor(battlefield.rows / 2) + Math.floor(spread / 3))),
      width: 1,
      height: 1,
      move_ft: 30,
      conditions: [],
    }
    const { data } = await supabase.from('battlefield_entities').insert({ ...base, ...defaults, ...partial }).select().single()
    if (data) {
      setEntities(prev => (prev.some(e => e.id === (data as BattlefieldEntity).id) ? prev : [...prev, data as BattlefieldEntity]))
      setSelectedIds([(data as BattlefieldEntity).id])
      setTab('inspect')
    }
  }

  // ---- Presets ----------------------------------------------------------
  async function saveCharacterDefault(ent: BattlefieldEntity) {
    if (!ent.character_id) return
    const existing = presets.find(p => p.preset_kind === 'character_default' && p.character_id === ent.character_id)
    const fields = { width: ent.width, height: ent.height, color: ent.color, icon: ent.icon, move_ft: ent.move_ft }
    if (existing) {
      setPresets(prev => prev.map(p => (p.id === existing.id ? { ...p, ...fields } : p)))
      await supabase.from('battlefield_presets').update(fields).eq('id', existing.id)
    } else {
      const { data } = await supabase.from('battlefield_presets').insert({ preset_kind: 'character_default', character_id: ent.character_id, ...fields }).select().single()
      if (data) setPresets(prev => [...prev, data as BattlefieldPreset])
    }
  }

  async function saveEnemyPreset(ent: BattlefieldEntity, name: string, folder: string) {
    const fields = { name: name.trim(), folder: folder.trim(), width: ent.width, height: ent.height, color: ent.color, icon: ent.icon, move_ft: ent.move_ft, hp_max: ent.hp_max, mana_max: ent.mana_max }
    // Overwrite an existing preset with the same name+folder, else create a new one.
    const existing = presets.find(p => p.preset_kind === 'enemy' && p.name === fields.name && p.folder === fields.folder)
    if (existing) {
      setPresets(prev => prev.map(p => (p.id === existing.id ? { ...p, ...fields } : p)))
      await supabase.from('battlefield_presets').update(fields).eq('id', existing.id)
    } else {
      const { data } = await supabase.from('battlefield_presets').insert({ preset_kind: 'enemy', ...fields }).select().single()
      if (data) setPresets(prev => [...prev, data as BattlefieldPreset])
    }
  }

  async function deletePreset(presetId: string) {
    setPresets(prev => prev.filter(p => p.id !== presetId))
    await supabase.from('battlefield_presets').delete().eq('id', presetId)
  }

  function placeEnemyPreset(p: BattlefieldPreset) {
    addEntity({
      kind: 'enemy',
      label: p.name || 'Enemy',
      width: p.width,
      height: p.height,
      color: p.color,
      icon: p.icon,
      move_ft: p.move_ft,
      hp_max: p.hp_max,
      hp_current: p.hp_max,
      mana_max: p.mana_max,
      mana_current: p.mana_max,
    })
  }

  function openTab(t: Tab) {
    setTab(t)
    setSheetOpen(true)
  }

  // ---- Keyboard: Delete/Backspace removes the selection -----------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)
      if (typing) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && isGM && selectedIds.length > 0) {
        e.preventDefault()
        deleteEntities(selectedIds)
      } else if (e.key === 'Escape') {
        setSelectedIds([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGM, selectedIds])

  // ---- Render -----------------------------------------------------------
  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><p className="text-white text-xl animate-pulse">Loading battlefield…</p></div>
  }
  if (!battlefield) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-center px-6">
        <p className="text-4xl mb-4">⚔️</p>
        <p className="text-white text-lg mb-2">This battlefield isn&apos;t available to you.</p>
        <p className="text-gray-500 mb-6">Player visibility is coming soon — your GM will share battlefields you&apos;re part of.</p>
        <Link href="/battlefields" className="text-red-400 hover:text-red-300">← Back to battlefields</Link>
      </div>
    )
  }

  const panel = (
    <PanelContent
      tab={tab}
      isGM={isGM}
      battlefield={battlefield}
      entities={entities}
      allChars={allChars}
      charMap={charMap}
      presets={presets}
      selected={selected}
      selectedIds={selectedIds}
      rangeEntityId={rangeEntityId}
      setRangeEntityId={setRangeEntityId}
      onSelect={id2 => setSelectedIds(id2 ? [id2] : [])}
      addEntity={addEntity}
      patchEntity={patchEntity}
      deleteEntities={deleteEntities}
      patchBattlefield={patchBattlefield}
      saveCharacterDefault={saveCharacterDefault}
      saveEnemyPreset={saveEnemyPreset}
      deletePreset={deletePreset}
      placeEnemyPreset={placeEnemyPreset}
      onDeleteBattlefield={async () => {
        if (!confirm('Delete this battlefield and everything on it?')) return
        await supabase.from('battlefields').delete().eq('id', id)
        router.push('/battlefields')
      }}
    />
  )

  return (
    <main className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-3 sm:px-5 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/battlefields" className="text-gray-400 hover:text-white shrink-0">←</Link>
          <h1 className="text-base sm:text-lg font-bold text-red-500 font-mono truncate">{battlefield.name}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500 hidden sm:inline">Round {battlefield.round}</span>
          {isGM && <span className="bg-red-900/80 text-red-200 text-xs px-2 py-0.5 rounded border border-red-700 font-bold">GM</span>}
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Grid */}
        <div className="flex-1 relative min-w-0">
          <BattlefieldGrid
            battlefield={battlefield}
            entities={entities}
            characters={charMap}
            isGM={isGM}
            selectedIds={selectedIds}
            tool={tool}
            rangeEntityId={rangeEntityId}
            onSelectionChange={(ids, opts) => { setSelectedIds(ids); if (opts?.inspect && ids.length > 0) { setTab('inspect'); setSheetOpen(true) } }}
            onInspect={entId => { setSelectedIds([entId]); setTab('inspect'); setSheetOpen(true) }}
            onMoveEntities={moveEntities}
            onResizeEntity={(entId, box) => patchEntity(entId, box)}
          />

          {/* Floating toolbar */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-gray-800/95 border border-gray-600 rounded-full px-2 py-1.5 shadow-lg">
            <ToolBtn active={tool === 'select'} onClick={() => setTool('select')} title="Select (marquee, move, resize)">↖️</ToolBtn>
            <ToolBtn active={tool === 'pan'} onClick={() => setTool('pan')} title="Pan / move view">✋</ToolBtn>
            {isGM && <ToolBtn active={tool === 'measure'} onClick={() => setTool('measure')} title="Measure distance">📏</ToolBtn>}
            <div className="w-px h-6 bg-gray-600 mx-1" />
            {isGM && <ToolBtn active={tab === 'add' && sheetOpen} onClick={() => openTab('add')} title="Add">➕</ToolBtn>}
            <ToolBtn active={tab === 'inspect' && sheetOpen} onClick={() => openTab('inspect')} title="Inspect">🔍</ToolBtn>
            <ToolBtn active={tab === 'initiative' && sheetOpen} onClick={() => openTab('initiative')} title="Initiative">🎲</ToolBtn>
            {isGM && <ToolBtn active={tab === 'settings' && sheetOpen} onClick={() => openTab('settings')} title="Settings">⚙️</ToolBtn>}
            {isGM && <ToolBtn active={tab === 'notes' && sheetOpen} onClick={() => openTab('notes')} title="GM notes">📝</ToolBtn>}
          </div>
        </div>

        {/* Desktop side panel */}
        <aside className="hidden lg:flex lg:flex-col w-80 border-l border-gray-700 bg-gray-850 bg-gray-800/40 shrink-0">
          <TabRow tab={tab} setTab={setTab} isGM={isGM} />
          <div className="flex-1 overflow-y-auto p-4">{panel}</div>
        </aside>
      </div>

      {/* Mobile bottom sheet */}
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end" onClick={() => setSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-gray-800 border-t border-gray-600 rounded-t-2xl max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 pt-3">
              <TabRow tab={tab} setTab={setTab} isGM={isGM} />
              <button onClick={() => setSheetOpen(false)} className="text-gray-400 hover:text-white text-xl px-2">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{panel}</div>
          </div>
        </div>
      )}
    </main>
  )
}

// ==========================================================================
// Small shared bits
// ==========================================================================
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

function TabRow({ tab, setTab, isGM }: { tab: Tab; setTab: (t: Tab) => void; isGM: boolean }) {
  const tabs: { id: Tab; label: string; gmOnly?: boolean }[] = [
    { id: 'add', label: 'Add', gmOnly: true },
    { id: 'inspect', label: 'Inspect' },
    { id: 'initiative', label: 'Turns' },
    { id: 'settings', label: 'Setup', gmOnly: true },
    { id: 'notes', label: 'Notes', gmOnly: true },
  ]
  return (
    <div className="flex gap-1 border-b border-gray-700 px-2 pt-2 overflow-x-auto">
      {tabs.filter(t => isGM || !t.gmOnly).map(t => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`px-3 py-2 text-sm font-bold rounded-t whitespace-nowrap ${tab === t.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ==========================================================================
// Panel content
// ==========================================================================
interface PanelProps {
  tab: Tab
  isGM: boolean
  battlefield: Battlefield
  entities: BattlefieldEntity[]
  allChars: FullChar[]
  charMap: Record<string, CharacterLite>
  presets: BattlefieldPreset[]
  selected: BattlefieldEntity | null
  selectedIds: string[]
  rangeEntityId: string | null
  setRangeEntityId: (id: string | null) => void
  onSelect: (id: string | null) => void
  addEntity: (p: Partial<BattlefieldEntity>) => void
  patchEntity: (id: string, p: Partial<BattlefieldEntity>) => void
  deleteEntities: (ids: string[]) => void
  patchBattlefield: (p: Partial<Battlefield>) => void
  saveCharacterDefault: (ent: BattlefieldEntity) => void
  saveEnemyPreset: (ent: BattlefieldEntity, name: string, folder: string) => void
  deletePreset: (id: string) => void
  placeEnemyPreset: (p: BattlefieldPreset) => void
  onDeleteBattlefield: () => void
}

function PanelContent(p: PanelProps) {
  if (p.tab === 'add' && p.isGM) return <AddPanel {...p} />
  if (p.tab === 'inspect') return <InspectPanel {...p} />
  if (p.tab === 'initiative') return <InitiativePanel {...p} />
  if (p.tab === 'settings' && p.isGM) return <SettingsPanel {...p} />
  if (p.tab === 'notes' && p.isGM) return <NotesPanel {...p} />
  return <p className="text-gray-500 text-sm">Nothing here.</p>
}

// -------- Add ------------------------------------------------------------
function AddPanel({ battlefield, entities, allChars, addEntity, presets, deletePreset, placeEnemyPreset }: PanelProps) {
  const onField = new Set(entities.map(e => e.character_id).filter(Boolean) as string[])
  const players = allChars.filter(c => !c.is_tame && !c.is_dead && !c.is_npc)
  const npcs = allChars.filter(c => !c.is_tame && c.is_npc && !c.is_dead)
  const tames = allChars.filter(c => c.is_tame && !c.is_dead)
  const hasDefault = new Set(presets.filter(p => p.preset_kind === 'character_default' && p.character_id).map(p => p.character_id as string))

  const enemyPresets = presets.filter(p => p.preset_kind === 'enemy')
  const folders = [...new Set(enemyPresets.map(p => p.folder))].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))

  const addLinked = (c: FullChar, kind: EntityKind) =>
    addEntity({ kind, character_id: c.id, label: c.name, color: kindMeta(kind).color })

  const CharRow = ({ c, kind }: { c: FullChar; kind: EntityKind }) => (
    <button
      key={c.id}
      onClick={() => addLinked(c, kind)}
      className="w-full flex items-center justify-between px-3 py-2 rounded bg-gray-700/50 hover:bg-gray-700 text-left text-sm"
    >
      <span className="truncate">{c.name}{hasDefault.has(c.id) && <span className="text-gray-500 ml-1" title="Has a saved default token">★</span>}</span>
      <span className="text-xs text-gray-400 shrink-0 ml-2">{onField.has(c.id) ? '＋ again' : '＋'}</span>
    </button>
  )

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Terrain & Enemies</h3>
        <div className="grid grid-cols-2 gap-2">
          {(['enemy', 'object', 'wall', 'door'] as EntityKind[]).map(k => {
            const m = kindMeta(k)
            return (
              <button
                key={k}
                onClick={() => addEntity({
                  kind: k,
                  label: m.label,
                  color: m.color,
                  ...(k === 'enemy' ? { hp_current: 10, hp_max: 10 } : {}),
                })}
                className="flex items-center gap-2 px-3 py-2 rounded bg-gray-700/50 hover:bg-gray-700 text-sm"
              >
                <span>{m.icon}</span> {m.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Player Characters</h3>
        <div className="space-y-1">
          {players.length === 0 && <p className="text-xs text-gray-600">No player characters.</p>}
          {players.map(c => <CharRow key={c.id} c={c} kind="player" />)}
        </div>
      </div>

      {tames.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Tames</h3>
          <div className="space-y-1">{tames.map(c => <CharRow key={c.id} c={c} kind="tame" />)}</div>
        </div>
      )}

      {npcs.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">NPCs</h3>
          <div className="space-y-1">{npcs.map(c => <CharRow key={c.id} c={c} kind="player" />)}</div>
        </div>
      )}
      <p className="text-xs text-gray-600">Grid is {battlefield.cols}×{battlefield.rows}. New tokens land near the center — drag them into place.</p>

      {enemyPresets.length > 0 && (
        <div className="pt-2 border-t border-gray-700">
          <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Enemy Library</h3>
          <div className="space-y-2">
            {folders.map(folder => (
              <div key={folder || '_'}>
                <div className="text-[11px] text-gray-500 mb-1">{folder || 'Ungrouped'}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {enemyPresets.filter(p => p.folder === folder).map(p => (
                    <div key={p.id} className="group relative flex items-center gap-1.5 px-2 py-1.5 rounded bg-gray-700/50 hover:bg-gray-700 text-sm">
                      <button onClick={() => placeEnemyPreset(p)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
                        <span style={{ color: p.color }}>{p.icon || '👹'}</span>
                        <span className="truncate">{p.name || 'Enemy'}</span>
                        {(p.width > 1 || p.height > 1) && <span className="text-[10px] text-gray-500">{p.width}×{p.height}</span>}
                      </button>
                      <button onClick={() => { if (confirm(`Delete preset "${p.name || 'Enemy'}"?`)) deletePreset(p.id) }}
                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs shrink-0" title="Delete preset">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-600 mt-1">Create presets from any enemy token&apos;s Inspect panel.</p>
        </div>
      )}
    </div>
  )
}

// -------- Inspect --------------------------------------------------------
function InspectPanel(p: PanelProps) {
  const { selected: e, selectedIds, entities, isGM, charMap, patchEntity, deleteEntities, battlefield, rangeEntityId, setRangeEntityId, saveCharacterDefault, saveEnemyPreset } = p

  // Multiple selected -> bulk actions
  if (selectedIds.length > 1) {
    const sel = entities.filter(en => selectedIds.includes(en.id))
    return (
      <div className="space-y-4 text-sm">
        <div className="font-bold">{selectedIds.length} tokens selected</div>
        <div className="text-xs text-gray-500 space-y-0.5 max-h-32 overflow-y-auto">
          {sel.map(en => <div key={en.id} className="truncate">{en.icon || kindMeta(en.kind).icon} {entityName(en, charMap)}</div>)}
        </div>
        {isGM && (
          <>
            <Field label="Set color for all">
              <div className="flex flex-wrap gap-1.5">
                {TOKEN_COLORS.map(col => (
                  <button key={col} onClick={() => sel.forEach(en => patchEntity(en.id, { color: col }))}
                    className="w-6 h-6 rounded-full border-2" style={{ background: col, borderColor: 'transparent' }} />
                ))}
              </div>
            </Field>
            <button onClick={() => deleteEntities(selectedIds)} className="w-full py-2 rounded bg-red-900/60 border border-red-700 text-red-200 hover:bg-red-900 text-sm font-bold">
              Remove {selectedIds.length} tokens
            </button>
            <p className="text-[11px] text-gray-600">Tip: drag any selected token to move the whole group, or press Delete.</p>
          </>
        )}
      </div>
    )
  }

  if (!e) return <p className="text-gray-500 text-sm">Select a token on the grid to inspect it. Drag a box on empty space to select several.</p>

  const linked = !!e.character_id
  const vitals = resolveVitals(e, charMap)
  const isCreature = CREATURE_KINDS.has(e.kind)

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{e.icon || kindMeta(e.kind).icon}</span>
        <div className="min-w-0">
          <div className="font-bold truncate">{entityName(e, charMap)}</div>
          <div className="text-xs text-gray-500 capitalize">{e.kind}{linked ? ' · linked to sheet' : ''}</div>
        </div>
      </div>

      {!isGM ? (
        <VitalsReadout vitals={vitals} />
      ) : (
        <>
          {!linked && (
            <Field label="Name">
              <input defaultValue={e.label} key={`lbl-${e.id}`} onBlur={ev => patchEntity(e.id, { label: ev.target.value })}
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1" />
            </Field>
          )}

          {/* Position & size */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="X (sq)"><NumInput value={e.x} min={0} max={battlefield.cols - e.width} onCommit={v => patchEntity(e.id, { x: v })} /></Field>
            <Field label="Y (sq)"><NumInput value={e.y} min={0} max={battlefield.rows - e.height} onCommit={v => patchEntity(e.id, { y: v })} /></Field>
            <Field label={`Width (${e.width * 5}ft)`}><NumInput value={e.width} min={1} max={20} onCommit={v => patchEntity(e.id, { width: v })} /></Field>
            <Field label={`Height (${e.height * 5}ft)`}><NumInput value={e.height} min={1} max={20} onCommit={v => patchEntity(e.id, { height: v })} /></Field>
          </div>

          <Field label="Icon (emoji)">
            <input defaultValue={e.icon ?? ''} key={`ico-${e.id}`} placeholder={kindMeta(e.kind).icon} onBlur={ev => patchEntity(e.id, { icon: ev.target.value || null })}
              className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1" />
          </Field>

          <Field label="Color">
            <div className="flex flex-wrap gap-1.5">
              {TOKEN_COLORS.map(col => (
                <button key={col} onClick={() => patchEntity(e.id, { color: col })}
                  className="w-6 h-6 rounded-full border-2" style={{ background: col, borderColor: e.color === col ? '#fff' : 'transparent' }} />
              ))}
              <input type="color" value={e.color} onChange={ev => patchEntity(e.id, { color: ev.target.value })} className="w-6 h-6 rounded bg-transparent border-0 p-0" />
            </div>
          </Field>

          {isCreature && (
            <>
              {linked ? (
                <div className="rounded bg-gray-900/60 border border-gray-700 p-2">
                  <VitalsReadout vitals={vitals} />
                  <p className="text-[11px] text-gray-500 mt-1">HP/mana are live from the character sheet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="HP"><NumInput value={e.hp_current ?? 0} min={-999} onCommit={v => patchEntity(e.id, { hp_current: v })} /></Field>
                  <Field label="HP max"><NumInput value={e.hp_max ?? 0} min={0} onCommit={v => patchEntity(e.id, { hp_max: v })} /></Field>
                  <Field label="Mana"><NumInput value={e.mana_current ?? 0} min={-999} onCommit={v => patchEntity(e.id, { mana_current: v })} /></Field>
                  <Field label="Mana max"><NumInput value={e.mana_max ?? 0} min={0} onCommit={v => patchEntity(e.id, { mana_max: v })} /></Field>
                </div>
              )}

              <Field label={`Speed (${e.move_ft} ft)`}>
                <NumInput value={e.move_ft} min={0} max={300} step={5} onCommit={v => patchEntity(e.id, { move_ft: v })} />
              </Field>

              <button
                onClick={() => setRangeEntityId(rangeEntityId === e.id ? null : e.id)}
                className={`w-full py-1.5 rounded text-sm font-bold border ${rangeEntityId === e.id ? 'bg-blue-700 border-blue-500' : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'}`}
              >
                {rangeEntityId === e.id ? '✓ Showing movement range' : 'Show movement range'}
              </button>

              <Field label="Conditions">
                <div className="flex flex-wrap gap-1">
                  {CONDITIONS.map(c => {
                    const on = e.conditions.includes(c.id)
                    return (
                      <button key={c.id} title={c.label}
                        onClick={() => patchEntity(e.id, { conditions: on ? e.conditions.filter(x => x !== c.id) : [...e.conditions, c.id] })}
                        className={`px-1.5 py-1 rounded text-sm border ${on ? 'bg-red-800 border-red-500' : 'bg-gray-900 border-gray-700 opacity-60 hover:opacity-100'}`}>
                        {c.icon}
                      </button>
                    )
                  })}
                </div>
              </Field>
            </>
          )}

          <Field label="Notes">
            <textarea defaultValue={e.notes} key={`n-${e.id}`} rows={2} onBlur={ev => patchEntity(e.id, { notes: ev.target.value })}
              className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 resize-none" />
          </Field>

          {/* Presets */}
          {linked && (
            <button onClick={() => saveCharacterDefault(e)}
              className="w-full py-1.5 rounded bg-gray-700/50 border border-gray-600 hover:bg-gray-700 text-sm">
              ★ Save size/color/icon/speed as {entityName(e, charMap)}&apos;s default
            </button>
          )}
          {e.kind === 'enemy' && !linked && <SavePresetForm key={`sp-${e.id}`} onSave={(name, folder) => saveEnemyPreset(e, name, folder)} defaultName={e.label} />}

          <button onClick={() => deleteEntities([e.id])} className="w-full py-2 rounded bg-red-900/60 border border-red-700 text-red-200 hover:bg-red-900 text-sm font-bold">
            Remove from battlefield
          </button>
        </>
      )}
    </div>
  )
}

function SavePresetForm({ onSave, defaultName }: { onSave: (name: string, folder: string) => void; defaultName: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(defaultName || 'Enemy')
  const [folder, setFolder] = useState('')
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full py-1.5 rounded bg-gray-700/50 border border-gray-600 hover:bg-gray-700 text-sm">
        ＋ Save as enemy preset
      </button>
    )
  }
  return (
    <div className="rounded border border-gray-600 bg-gray-900/60 p-2 space-y-2">
      <Field label="Preset name"><input value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1" /></Field>
      <Field label="Folder (optional)"><input value={folder} onChange={e => setFolder(e.target.value)} placeholder="e.g. Goblins" className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1" /></Field>
      <div className="flex gap-2">
        <button onClick={() => { onSave(name, folder); setOpen(false) }} className="flex-1 py-1.5 rounded bg-red-800 hover:bg-red-700 border border-red-600 text-sm font-bold">Save preset</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm">Cancel</button>
      </div>
      <p className="text-[11px] text-gray-600">Saving with an existing name+folder overwrites that preset.</p>
    </div>
  )
}

function VitalsReadout({ vitals }: { vitals: ReturnType<typeof resolveVitals> }) {
  return (
    <div className="space-y-1.5">
      {vitals.hpMax != null && (
        <div>
          <div className="flex justify-between text-xs"><span className="text-red-300">HP</span><span>{vitals.hp ?? 0}/{vitals.hpMax}</span></div>
          <div className="h-2 rounded bg-gray-800 overflow-hidden"><div className="h-full bg-red-600" style={{ width: `${Math.max(0, Math.min(100, (100 * (vitals.hp ?? 0)) / (vitals.hpMax || 1)))}%` }} /></div>
        </div>
      )}
      {vitals.manaMax != null && (
        <div>
          <div className="flex justify-between text-xs"><span className="text-blue-300">Mana</span><span>{vitals.mana ?? 0}/{vitals.manaMax}</span></div>
          <div className="h-2 rounded bg-gray-800 overflow-hidden"><div className="h-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, (100 * (vitals.mana ?? 0)) / (vitals.manaMax || 1)))}%` }} /></div>
        </div>
      )}
      {vitals.hpMax == null && vitals.manaMax == null && <p className="text-xs text-gray-500">No HP/mana set.</p>}
    </div>
  )
}

// -------- Initiative -----------------------------------------------------
function InitiativePanel(p: PanelProps) {
  const { entities, charMap, battlefield, isGM, patchEntity, patchBattlefield, onSelect } = p
  const creatures = entities.filter(e => CREATURE_KINDS.has(e.kind))
  const order = [...creatures].sort((a, b) => {
    const ai = a.initiative ?? -Infinity
    const bi = b.initiative ?? -Infinity
    return bi - ai
  })
  const rolled = order.filter(e => e.initiative != null)

  function nextTurn() {
    if (rolled.length === 0) return
    const curIdx = rolled.findIndex(e => e.id === battlefield.turn_entity_id)
    const nextIdx = (curIdx + 1) % rolled.length
    const wrapped = curIdx >= 0 && nextIdx === 0
    patchBattlefield({ turn_entity_id: rolled[nextIdx].id, round: wrapped ? battlefield.round + 1 : battlefield.round })
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-bold">Round {battlefield.round}</span>
        {isGM && (
          <div className="flex gap-2">
            <button onClick={nextTurn} className="px-3 py-1 rounded bg-red-800 hover:bg-red-700 border border-red-600 text-xs font-bold">Next turn →</button>
          </div>
        )}
      </div>

      {order.length === 0 && <p className="text-gray-500 text-xs">No creatures on the field yet.</p>}

      <div className="space-y-1">
        {order.map(e => {
          const active = battlefield.turn_entity_id === e.id
          return (
            <div key={e.id} className={`flex items-center gap-2 px-2 py-1.5 rounded ${active ? 'bg-red-900/50 border border-red-600' : 'bg-gray-700/40'}`}>
              <button onClick={() => onSelect(e.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                <span>{e.icon || kindMeta(e.kind).icon}</span>
                <span className="truncate">{entityName(e, charMap)}</span>
                {active && <span className="text-xs text-red-300">◀ turn</span>}
              </button>
              {isGM ? (
                <>
                  <NumInput value={e.initiative ?? 0} min={-20} max={99} onCommit={v => patchEntity(e.id, { initiative: v })} className="w-12 text-center" />
                  <button onClick={() => patchBattlefield({ turn_entity_id: e.id })} title="Set current turn" className="text-xs px-1.5 py-1 rounded bg-gray-700 hover:bg-gray-600">▶</button>
                </>
              ) : (
                <span className="text-gray-400 font-mono w-6 text-right">{e.initiative ?? '—'}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// -------- Settings -------------------------------------------------------
function SettingsPanel({ battlefield, patchBattlefield, onDeleteBattlefield }: PanelProps) {
  return (
    <div className="space-y-4 text-sm">
      <Field label="Name">
        <input defaultValue={battlefield.name} key={`bfn-${battlefield.id}`} onBlur={e => patchBattlefield({ name: e.target.value })}
          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1" />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label={`Width (${battlefield.cols * 5} ft)`}>
          <NumInput value={battlefield.cols} min={1} max={100} onCommit={v => patchBattlefield({ cols: v })} />
        </Field>
        <Field label={`Height (${battlefield.rows * 5} ft)`}>
          <NumInput value={battlefield.rows} min={1} max={100} onCommit={v => patchBattlefield({ rows: v })} />
        </Field>
      </div>

      <Field label="Border (where players can flee)">
        <div className="flex gap-2">
          {(['outdoor', 'indoor'] as const).map(b => (
            <button key={b} onClick={() => patchBattlefield({ border_type: b })}
              className={`flex-1 py-1.5 rounded border text-sm font-bold ${battlefield.border_type === b ? 'bg-red-800 border-red-500' : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'}`}>
              {b === 'outdoor' ? '🌳 Outdoor' : '🏠 Indoor'}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Background color">
        <div className="flex flex-wrap gap-1.5">
          {BG_COLORS.map(col => (
            <button key={col} onClick={() => patchBattlefield({ bg_color: col })}
              className="w-6 h-6 rounded border-2" style={{ background: col, borderColor: battlefield.bg_color === col ? '#fff' : 'transparent' }} />
          ))}
          <input type="color" value={battlefield.bg_color} onChange={e => patchBattlefield({ bg_color: e.target.value })} className="w-6 h-6 rounded bg-transparent border-0 p-0" />
        </div>
      </Field>

      <div className="pt-4 border-t border-gray-700">
        <button onClick={onDeleteBattlefield} className="w-full py-2 rounded bg-red-900/60 border border-red-700 text-red-200 hover:bg-red-900 text-sm font-bold">
          Delete battlefield
        </button>
      </div>
    </div>
  )
}

// -------- Notes ----------------------------------------------------------
function NotesPanel({ battlefield, patchBattlefield }: PanelProps) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2 text-xs text-gray-500"><span>🔒</span> Private to you (GM only)</div>
      <textarea
        defaultValue={battlefield.gm_notes}
        key={`gmn-${battlefield.id}`}
        rows={16}
        placeholder="Ambush on round 3… trap under the rug… enemy weaknesses…"
        onBlur={e => patchBattlefield({ gm_notes: e.target.value })}
        className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 resize-none leading-relaxed"
      />
    </div>
  )
}

// ==========================================================================
// Inputs
// ==========================================================================
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-400 mb-1">{label}</span>
      {children}
    </label>
  )
}

function NumInput({ value, min, max, step = 1, onCommit, className = '' }: { value: number; min?: number; max?: number; step?: number; onCommit: (v: number) => void; className?: string }) {
  const [draft, setDraft] = useState(String(value))
  // Re-sync the draft when the committed value changes externally (adjust-state-on-prop-change pattern).
  const [prev, setPrev] = useState(value)
  if (prev !== value) {
    setPrev(value)
    setDraft(String(value))
  }
  const commit = () => {
    let v = Math.round(Number(draft))
    if (Number.isNaN(v)) v = value
    if (min != null) v = Math.max(min, v)
    if (max != null) v = Math.min(max, v)
    setDraft(String(v))
    if (v !== value) onCommit(v)
  }
  return (
    <input
      type="number"
      value={draft}
      step={step}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className={`bg-gray-900 border border-gray-600 rounded px-2 py-1 w-full ${className}`}
    />
  )
}
