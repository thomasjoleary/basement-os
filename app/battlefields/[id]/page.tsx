'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import BattlefieldGrid from '@/components/battlefield/BattlefieldGrid'
import {
  Battlefield,
  BattlefieldEntity,
  BattlefieldPreset,
  BattlefieldVisibility,
  CharacterLite,
  EntityKind,
  TOKEN_COLORS,
  BG_COLORS,
  CONDITIONS,
  kindMeta,
  conditionMeta,
  entityName,
  resolveVitals,
  footprintVisible,
} from '@/lib/battlefield'

type Tab = 'add' | 'inspect' | 'initiative' | 'fog' | 'settings' | 'notes'
type Tool = 'select' | 'pan' | 'measure' | 'fog' | 'ping'
const CREATURE_KINDS = new Set<EntityKind>(['player', 'tame', 'enemy'])

interface FullChar extends CharacterLite {
  is_npc?: boolean
  is_dead?: boolean
  user_id?: string | null
  party?: string | null
  player_name?: string | null
  job?: string | null
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
  const [gmNotes, setGmNotes] = useState('')
  const [visibility, setVisibility] = useState<BattlefieldVisibility[]>([])
  const [reveals, setReveals] = useState<{ id: string; character_id: string; entity_id: string }[]>([])

  // Player (non-GM) fogged view, loaded via the RPC
  const [playerView, setPlayerView] = useState<{ battlefield: Battlefield; entities: BattlefieldEntity[]; visibleCells: Set<string> } | null>(null)
  const [playerSelectedId, setPlayerSelectedId] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [tool, setTool] = useState<Tool>('select')
  const [rangeEntityId, setRangeEntityId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('add')
  const [sheetOpen, setSheetOpen] = useState(false)

  // Fog editing (GM): whose fog we're painting, and how
  const [fogCharId, setFogCharId] = useState<string | null>(null)
  const [fogReveal, setFogReveal] = useState(true)
  const [fogShape, setFogShape] = useState<'rect' | 'brush'>('rect')
  const [previewAs, setPreviewAs] = useState<string | null>(null)

  // Live pings (broadcast to everyone viewing this battlefield)
  const [pings, setPings] = useState<{ id: number; x: number; y: number; color: string }[]>([])
  const pingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const charMap = useMemo(() => {
    const m: Record<string, CharacterLite> = {}
    for (const c of allChars) m[c.id] = c
    return m
  }, [allChars])

  const selected = selectedIds.length === 1 ? entities.find(e => e.id === selectedIds[0]) ?? null : null

  // ---- Player load via RPC ----------------------------------------------
  async function loadPlayer() {
    const { data } = await supabase.rpc('get_player_battlefield', { bf: id })
    if (!data) { setPlayerView(null); return }
    const bf = data.battlefield as Battlefield
    const ents = (data.entities as Partial<BattlefieldEntity>[]).map(e => ({
      battlefield_id: id, notes: '', created_at: '', updated_at: '',
      hp_current: null, hp_max: null, mana_current: null, mana_max: null,
      hidden_until_revealed: false, ...e,
    })) as BattlefieldEntity[]
    setPlayerView({ battlefield: bf, entities: ents, visibleCells: new Set((data.visible_cells as string[]) ?? []) })
  }

  // ---- Load -------------------------------------------------------------
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      let gm = false
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
        gm = profile?.role === 'gm'
        setIsGM(gm)
      }

      if (!gm) {
        await loadPlayer()
        setLoading(false)
        return
      }

      const [{ data: bf }, { data: ents }, { data: chars }, { data: pres }, { data: notes }, { data: vis }, { data: rev }] = await Promise.all([
        supabase.from('battlefields').select('*').eq('id', id).single(),
        supabase.from('battlefield_entities').select('*').eq('battlefield_id', id),
        supabase.from('characters').select('id,name,hp_current,hp_max,mana_current,mana_max,is_tame,is_npc,is_dead,user_id,party,player_name,job'),
        supabase.from('battlefield_presets').select('*'),
        supabase.from('battlefield_gm_notes').select('notes').eq('battlefield_id', id).maybeSingle(),
        supabase.from('battlefield_visibility').select('*').eq('battlefield_id', id),
        supabase.from('battlefield_entity_reveals').select('id,character_id,entity_id').eq('battlefield_id', id),
      ])
      if (bf) setBattlefield(bf as Battlefield)
      if (ents) setEntities(ents as BattlefieldEntity[])
      if (chars) setAllChars(chars as FullChar[])
      if (pres) setPresets(pres as BattlefieldPreset[])
      if (notes) setGmNotes(notes.notes ?? '')
      if (vis) setVisibility(vis as BattlefieldVisibility[])
      if (rev) setReveals(rev)
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // ---- Realtime: player path (ping -> refetch RPC) ----------------------
  useEffect(() => {
    if (isGM) return
    const channel = supabase
      .channel(`bf-player-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battlefields', filter: `id=eq.${id}` }, () => { loadPlayer() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battlefield_visibility', filter: `battlefield_id=eq.${id}` }, () => { loadPlayer() })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'characters' }, () => { loadPlayer() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isGM])

  // ---- Realtime: GM path (direct table sync) ----------------------------
  useEffect(() => {
    if (!isGM) return
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battlefield_visibility', filter: `battlefield_id=eq.${id}` }, payload => {
        setVisibility(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(v => v.id !== (payload.old as { id: string }).id)
          const row = payload.new as BattlefieldVisibility
          const idx = prev.findIndex(v => v.id === row.id)
          if (idx === -1) return [...prev, row]
          const next = [...prev]; next[idx] = row; return next
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, isGM])

  // ---- Ping channel (broadcast, both roles) -----------------------------
  useEffect(() => {
    const ch = supabase.channel(`bf-ping-${id}`, { config: { broadcast: { self: true } } })
    ch.on('broadcast', { event: 'ping' }, ({ payload }) => {
      const pid = Date.now() + Math.random()
      setPings(prev => [...prev, { id: pid, x: payload.x, y: payload.y, color: payload.color || '#fbbf24' }])
      setTimeout(() => setPings(prev => prev.filter(p => p.id !== pid)), 1800)
    }).subscribe()
    pingChannelRef.current = ch
    return () => { supabase.removeChannel(ch); pingChannelRef.current = null }
  }, [id])

  function sendPing(x: number, y: number) {
    pingChannelRef.current?.send({ type: 'broadcast', event: 'ping', payload: { x, y, color: isGM ? '#f87171' : '#fbbf24' } })
  }

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

  // ---- GM notes (separate table) ----------------------------------------
  async function patchGmNotes(text: string) {
    setGmNotes(text)
    await supabase.from('battlefield_gm_notes').upsert({ battlefield_id: id, notes: text, updated_at: new Date().toISOString() })
  }

  // ---- Visibility / fog -------------------------------------------------
  function visRow(charId: string) {
    return visibility.find(v => v.character_id === charId)
  }

  async function upsertVisibility(charId: string, patch: { granted?: boolean; visible_cells?: string[] }) {
    const existing = visRow(charId)
    const merged = {
      battlefield_id: id,
      character_id: charId,
      granted: patch.granted ?? existing?.granted ?? false,
      visible_cells: patch.visible_cells ?? existing?.visible_cells ?? [],
    }
    // optimistic
    setVisibility(prev => {
      const i = prev.findIndex(v => v.character_id === charId)
      if (i === -1) return [...prev, { id: `tmp-${charId}`, updated_at: '', ...merged } as BattlefieldVisibility]
      const next = [...prev]; next[i] = { ...next[i], ...merged }; return next
    })
    const { data } = await supabase.from('battlefield_visibility').upsert(merged, { onConflict: 'battlefield_id,character_id' }).select().single()
    if (data) setVisibility(prev => prev.map(v => (v.character_id === charId ? (data as BattlefieldVisibility) : v)))
  }

  function paintCells(charId: string, cells: string[], reveal: boolean) {
    const current = new Set(visRow(charId)?.visible_cells ?? [])
    if (reveal) cells.forEach(c => current.add(c))
    else cells.forEach(c => current.delete(c))
    upsertVisibility(charId, { visible_cells: [...current] })
  }

  function revealWholeGrid(charId: string, reveal: boolean) {
    if (!battlefield) return
    if (!reveal) { upsertVisibility(charId, { visible_cells: [] }); return }
    const all: string[] = []
    for (let x = 0; x < battlefield.cols; x++) for (let y = 0; y < battlefield.rows; y++) all.push(`${x},${y}`)
    upsertVisibility(charId, { visible_cells: all })
  }

  async function setEntityRevealed(entityId: string, charId: string, revealed: boolean) {
    if (revealed) {
      const tmp = { id: `tmp-${entityId}-${charId}`, character_id: charId, entity_id: entityId }
      setReveals(prev => (prev.some(r => r.entity_id === entityId && r.character_id === charId) ? prev : [...prev, tmp]))
      const { data } = await supabase.from('battlefield_entity_reveals').insert({ battlefield_id: id, entity_id: entityId, character_id: charId }).select('id,character_id,entity_id').single()
      if (data) setReveals(prev => prev.map(r => (r.id === tmp.id ? data : r)))
    } else {
      setReveals(prev => prev.filter(r => !(r.entity_id === entityId && r.character_id === charId)))
      await supabase.from('battlefield_entity_reveals').delete().eq('entity_id', entityId).eq('character_id', charId)
    }
  }

  // ---- Damage / heal ----------------------------------------------------
  // Linked tokens write to the character sheet (HP is live from there); enemies/manual write to the token.
  async function applyHp(entity: BattlefieldEntity, delta: number) {
    if (entity.character_id) {
      const c = allChars.find(x => x.id === entity.character_id)
      const cur = c?.hp_current ?? 0
      const max = c?.hp_max ?? null
      const next = Math.max(0, max != null ? Math.min(max, cur + delta) : cur + delta)
      setAllChars(prev => prev.map(x => (x.id === entity.character_id ? { ...x, hp_current: next } : x)))
      await supabase.from('characters').update({ hp_current: next }).eq('id', entity.character_id)
    } else {
      const cur = entity.hp_current ?? 0
      const max = entity.hp_max ?? null
      const next = Math.max(0, max != null ? Math.min(max, cur + delta) : cur + delta)
      patchEntity(entity.id, { hp_current: next })
    }
  }

  // ---- Duplicate (save as template) -------------------------------------
  async function duplicateBattlefield() {
    if (!battlefield) return
    const { data: nb, error } = await supabase.from('battlefields').insert({
      name: `${battlefield.name} (copy)`,
      cols: battlefield.cols, rows: battlefield.rows,
      bg_color: battlefield.bg_color, border_type: battlefield.border_type,
    }).select().single()
    if (error || !nb) { alert('Could not duplicate: ' + (error?.message ?? 'unknown error')); return }
    const newId = (nb as Battlefield).id
    const copies = entities.map(e => ({
      battlefield_id: newId, kind: e.kind, character_id: e.character_id, label: e.label,
      x: e.x, y: e.y, width: e.width, height: e.height, color: e.color, icon: e.icon,
      hp_current: e.hp_current, hp_max: e.hp_max, mana_current: e.mana_current, mana_max: e.mana_max,
      move_ft: e.move_ft, conditions: e.conditions, initiative: e.initiative,
      hidden_until_revealed: e.hidden_until_revealed, notes: e.notes,
    }))
    if (copies.length) await supabase.from('battlefield_entities').insert(copies)
    if (gmNotes) await supabase.from('battlefield_gm_notes').upsert({ battlefield_id: newId, notes: gmNotes })
    router.push(`/battlefields/${newId}`)
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

  // Player (non-GM) fogged, read-only view
  if (!isGM) {
    if (!playerView) {
      return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-center px-6">
          <p className="text-4xl mb-4">⚔️</p>
          <p className="text-white text-lg mb-2">This battlefield isn&apos;t shared with you.</p>
          <p className="text-gray-500 mb-6">Your GM will open it up when your character is in the fight.</p>
          <Link href="/battlefields" className="text-red-400 hover:text-red-300">← Back to battlefields</Link>
        </div>
      )
    }
    const pTool: Tool = tool === 'pan' || tool === 'ping' ? tool : 'select'
    const pSel = playerView.entities.find(e => e.id === playerSelectedId) ?? null
    return (
      <main className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
        <div className="bg-gray-800 border-b border-gray-700 px-3 sm:px-5 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/battlefields" className="text-gray-400 hover:text-white shrink-0">←</Link>
            <h1 className="text-base sm:text-lg font-bold text-red-500 font-mono truncate">{playerView.battlefield.name}</h1>
          </div>
          <span className="text-xs text-gray-400 shrink-0">Round {playerView.battlefield.round}</span>
        </div>
        <div className="flex-1 relative min-w-0">
          <BattlefieldGrid
            battlefield={playerView.battlefield}
            entities={playerView.entities}
            characters={{}}
            isGM={false}
            selectedIds={playerSelectedId ? [playerSelectedId] : []}
            tool={pTool}
            onSelectionChange={ids => setPlayerSelectedId(ids[0] ?? null)}
            onInspect={eid => setPlayerSelectedId(eid)}
            onMoveEntities={() => {}}
            onResizeEntity={() => {}}
            fogDisplay="player"
            fogVisibleCells={playerView.visibleCells}
            pings={pings}
            onPing={sendPing}
          />

          {pSel && <PlayerTokenCard entity={pSel} onClose={() => setPlayerSelectedId(null)} />}

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-gray-800/95 border border-gray-600 rounded-full px-2 py-1.5 shadow-lg">
            <ToolBtn active={pTool === 'select'} onClick={() => setTool('select')} title="Look">↖️</ToolBtn>
            <ToolBtn active={pTool === 'pan'} onClick={() => setTool('pan')} title="Pan">✋</ToolBtn>
            <ToolBtn active={pTool === 'ping'} onClick={() => setTool('ping')} title="Ping a square">📍</ToolBtn>
          </div>
        </div>
      </main>
    )
  }

  if (!battlefield) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-center px-6">
        <p className="text-4xl mb-4">⚔️</p>
        <p className="text-white text-lg mb-2">This battlefield isn&apos;t available.</p>
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
      applyHp={applyHp}
      onDuplicate={duplicateBattlefield}
      visibility={visibility}
      reveals={reveals}
      gmNotes={gmNotes}
      patchGmNotes={patchGmNotes}
      upsertVisibility={upsertVisibility}
      revealWholeGrid={revealWholeGrid}
      setEntityRevealed={setEntityRevealed}
      fogCharId={fogCharId}
      setFogCharId={cid => { setFogCharId(cid); setPreviewAs(null); if (cid) setTool('fog') }}
      previewAs={previewAs}
      setPreviewAs={cid => { setPreviewAs(cid); if (cid) setTool('select') }}
      onDeleteBattlefield={async () => {
        if (!confirm('Delete this battlefield and everything on it?')) return
        await supabase.from('battlefields').delete().eq('id', id)
        router.push('/battlefields')
      }}
    />
  )

  // Fog overlay config for the GM grid
  let fogDisplay: 'none' | 'edit' | 'player' = 'none'
  let fogCells: Set<string> | null = null
  let hiddenIds: Set<string> | undefined
  if (previewAs) {
    const v = visibility.find(x => x.character_id === previewAs)
    fogCells = new Set(v?.visible_cells ?? [])
    const revealed = new Set(reveals.filter(r => r.character_id === previewAs).map(r => r.entity_id))
    hiddenIds = new Set(entities.filter(e => !footprintVisible(e, fogCells!) || (e.hidden_until_revealed && !revealed.has(e.id))).map(e => e.id))
    fogDisplay = 'player'
  } else if (tool === 'fog' && fogCharId) {
    const v = visibility.find(x => x.character_id === fogCharId)
    fogCells = new Set(v?.visible_cells ?? [])
    fogDisplay = 'edit'
  }

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
            fogDisplay={fogDisplay}
            fogVisibleCells={fogCells}
            hiddenEntityIds={hiddenIds}
            fogReveal={fogReveal}
            fogShape={fogShape}
            onPaintCells={(cells, reveal) => { if (fogCharId) paintCells(fogCharId, cells, reveal) }}
            pings={pings}
            onPing={sendPing}
          />

          {/* Fog paint sub-toolbar */}
          {tool === 'fog' && !previewAs && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 bg-gray-800/95 border border-gray-600 rounded-full px-3 py-1.5 shadow-lg text-sm">
              {fogCharId ? (
                <>
                  <span className="text-gray-400">Painting:</span>
                  <span className="font-bold">{charMap[fogCharId]?.name ?? 'player'}</span>
                  <div className="w-px h-5 bg-gray-600 mx-1" />
                  <button onClick={() => setFogReveal(true)} className={`px-2 py-0.5 rounded ${fogReveal ? 'bg-green-700' : 'bg-gray-700'}`}>Reveal</button>
                  <button onClick={() => setFogReveal(false)} className={`px-2 py-0.5 rounded ${!fogReveal ? 'bg-red-700' : 'bg-gray-700'}`}>Hide</button>
                  <div className="w-px h-5 bg-gray-600 mx-1" />
                  <button onClick={() => setFogShape('rect')} className={`px-2 py-0.5 rounded ${fogShape === 'rect' ? 'bg-red-700' : 'bg-gray-700'}`} title="Rectangle">▭</button>
                  <button onClick={() => setFogShape('brush')} className={`px-2 py-0.5 rounded ${fogShape === 'brush' ? 'bg-red-700' : 'bg-gray-700'}`} title="Brush">🖌️</button>
                </>
              ) : (
                <button onClick={() => openTab('fog')} className="text-gray-300">Pick a player in the Fog panel →</button>
              )}
            </div>
          )}

          {previewAs && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-purple-900/90 border border-purple-500 rounded-full px-3 py-1.5 shadow-lg text-sm">
              <span>👁️ Seeing as <b>{charMap[previewAs]?.name ?? 'player'}</b></span>
              <button onClick={() => setPreviewAs(null)} className="px-2 py-0.5 rounded bg-purple-700 hover:bg-purple-600">Exit</button>
            </div>
          )}

          {/* Floating toolbar */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-gray-800/95 border border-gray-600 rounded-full px-2 py-1.5 shadow-lg">
            <ToolBtn active={tool === 'select'} onClick={() => setTool('select')} title="Select (marquee, move, resize)">↖️</ToolBtn>
            <ToolBtn active={tool === 'pan'} onClick={() => setTool('pan')} title="Pan / move view">✋</ToolBtn>
            {isGM && <ToolBtn active={tool === 'measure'} onClick={() => setTool('measure')} title="Measure distance">📏</ToolBtn>}
            <ToolBtn active={tool === 'ping'} onClick={() => setTool('ping')} title="Ping a square">📍</ToolBtn>
            {isGM && <ToolBtn active={tool === 'fog'} onClick={() => { setTool('fog'); openTab('fog') }} title="Fog of war">🌫️</ToolBtn>}
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
    { id: 'fog', label: 'Fog', gmOnly: true },
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
  applyHp: (entity: BattlefieldEntity, delta: number) => void
  onDuplicate: () => void
  onDeleteBattlefield: () => void
  // Phase 2
  visibility: BattlefieldVisibility[]
  reveals: { id: string; character_id: string; entity_id: string }[]
  gmNotes: string
  patchGmNotes: (text: string) => void
  upsertVisibility: (charId: string, patch: { granted?: boolean; visible_cells?: string[] }) => void
  revealWholeGrid: (charId: string, reveal: boolean) => void
  setEntityRevealed: (entityId: string, charId: string, revealed: boolean) => void
  fogCharId: string | null
  setFogCharId: (id: string | null) => void
  previewAs: string | null
  setPreviewAs: (id: string | null) => void
}

function PanelContent(p: PanelProps) {
  if (p.tab === 'add' && p.isGM) return <AddPanel {...p} />
  if (p.tab === 'inspect') return <InspectPanel {...p} />
  if (p.tab === 'initiative') return <InitiativePanel {...p} />
  if (p.tab === 'fog' && p.isGM) return <FogPanel {...p} />
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
  const { selected: e, selectedIds, entities, isGM, charMap, patchEntity, deleteEntities, battlefield, rangeEntityId, setRangeEntityId, saveCharacterDefault, saveEnemyPreset, visibility, reveals, setEntityRevealed, applyHp } = p

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

              <div>
                <span className="block text-xs text-gray-400 mb-1">Damage / Heal</span>
                <HpAdjuster onApply={d => applyHp(e, d)} />
              </div>

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

          {/* Fog: hide this token even in a revealed square, reveal per player */}
          <div className="rounded border border-gray-700 bg-gray-900/40 p-2 space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs text-gray-300">🌫️ Hidden until revealed</span>
              <input type="checkbox" checked={e.hidden_until_revealed} onChange={ev => patchEntity(e.id, { hidden_until_revealed: ev.target.checked })} />
            </label>
            {e.hidden_until_revealed && (() => {
              const sharedChars = visibility.filter(v => v.granted).map(v => v.character_id)
              if (sharedChars.length === 0) return <p className="text-[11px] text-gray-600">No players share this battlefield yet (see the Fog tab).</p>
              return (
                <div className="space-y-1">
                  {sharedChars.map(cid => {
                    const revealed = reveals.some(r => r.entity_id === e.id && r.character_id === cid)
                    return (
                      <div key={cid} className="flex items-center justify-between text-xs">
                        <span className="truncate">{charMap[cid]?.name ?? 'player'}</span>
                        <button onClick={() => setEntityRevealed(e.id, cid, !revealed)}
                          className={`px-2 py-0.5 rounded border ${revealed ? 'bg-green-800 border-green-600' : 'bg-gray-700 border-gray-600'}`}>
                          {revealed ? 'Seen ✓' : 'Reveal'}
                        </button>
                      </div>
                    )
                  })}
                  <button onClick={() => sharedChars.forEach(cid => setEntityRevealed(e.id, cid, true))}
                    className="w-full mt-1 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs">Reveal to all</button>
                </div>
              )
            })()}
          </div>

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

// Read-only token inspector for the player view.
function PlayerTokenCard({ entity, onClose }: { entity: BattlefieldEntity; onClose: () => void }) {
  const vitals = resolveVitals(entity, {})
  const showVitals = vitals.hpMax != null || vitals.manaMax != null
  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 w-64 max-w-[90vw] bg-gray-800/95 border border-gray-600 rounded-lg shadow-xl p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">{entity.icon || kindMeta(entity.kind).icon}</span>
          <div className="min-w-0">
            <div className="font-bold truncate">{entityName(entity, {})}</div>
            <div className="text-xs text-gray-500 capitalize">{entity.kind}</div>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white shrink-0">✕</button>
      </div>
      {entity.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {entity.conditions.map(c => (
            <span key={c} className="text-xs bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5">{conditionMeta(c)?.icon} {conditionMeta(c)?.label}</span>
          ))}
        </div>
      )}
      {showVitals && <div className="mt-2"><VitalsReadout vitals={vitals} /></div>}
      {showVitals && entity.character_id && (
        <Link href={`/character/${entity.character_id}`} className="block mt-2 text-center text-red-400 hover:text-red-300 text-xs font-bold">
          View character sheet →
        </Link>
      )}
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
function SettingsPanel({ battlefield, patchBattlefield, onDeleteBattlefield, onDuplicate }: PanelProps) {
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

      <div className="pt-4 border-t border-gray-700 space-y-2">
        <button onClick={onDuplicate} className="w-full py-2 rounded bg-gray-700/60 border border-gray-600 hover:bg-gray-700 text-sm font-bold">
          ⧉ Duplicate battlefield
        </button>
        <p className="text-[11px] text-gray-600">Copies the grid, terrain, tokens and notes into a new battlefield (fog &amp; player sharing start fresh) — handy as a reusable template.</p>
        <button onClick={onDeleteBattlefield} className="w-full py-2 rounded bg-red-900/60 border border-red-700 text-red-200 hover:bg-red-900 text-sm font-bold">
          Delete battlefield
        </button>
      </div>
    </div>
  )
}

// -------- Fog ------------------------------------------------------------
function FogPanel({ entities, charMap, visibility, upsertVisibility, revealWholeGrid, fogCharId, setFogCharId, previewAs, setPreviewAs, battlefield }: PanelProps) {
  const seen = new Set<string>()
  const list = entities.filter(e => e.kind === 'player' && e.character_id && !seen.has(e.character_id) && seen.add(e.character_id))
  if (list.length === 0) return <p className="text-gray-500 text-sm">Place player-character tokens on the battlefield first — then share and reveal their view here.</p>
  const total = battlefield.cols * battlefield.rows
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-gray-500">Each player only sees squares you reveal for them. Visibility is per-player — never shared.</p>
      {list.map(e => {
        const cid = e.character_id as string
        const v = visibility.find(x => x.character_id === cid)
        const granted = v?.granted ?? false
        const cells = v?.visible_cells?.length ?? 0
        const editing = fogCharId === cid
        return (
          <div key={cid} className={`rounded border p-2 ${editing ? 'border-red-500 bg-red-900/10' : 'border-gray-700 bg-gray-800/40'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold truncate">{charMap[cid]?.name ?? e.label}</span>
              <button onClick={() => upsertVisibility(cid, { granted: !granted })}
                className={`px-2 py-0.5 rounded text-xs font-bold border shrink-0 ${granted ? 'bg-green-800 border-green-600' : 'bg-gray-700 border-gray-600'}`}>
                {granted ? 'Shared ✓' : 'Share'}
              </button>
            </div>
            <div className="text-[11px] text-gray-500 mt-1">{cells} / {total} squares revealed</div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button onClick={() => setFogCharId(editing ? null : cid)} className={`px-2 py-1 rounded text-xs font-bold ${editing ? 'bg-red-700' : 'bg-gray-700 hover:bg-gray-600'}`}>{editing ? 'Painting…' : '🖌️ Paint fog'}</button>
              <button onClick={() => revealWholeGrid(cid, true)} className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600">Reveal all</button>
              <button onClick={() => revealWholeGrid(cid, false)} className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600">Hide all</button>
              <button onClick={() => setPreviewAs(previewAs === cid ? null : cid)} className={`px-2 py-1 rounded text-xs ${previewAs === cid ? 'bg-purple-700' : 'bg-gray-700 hover:bg-gray-600'}`}>👁️ {previewAs === cid ? 'Previewing' : 'Preview'}</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// -------- Notes ----------------------------------------------------------
function NotesPanel({ battlefield, gmNotes, patchGmNotes }: PanelProps) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2 text-xs text-gray-500"><span>🔒</span> Private to you (GM only)</div>
      <textarea
        defaultValue={gmNotes}
        key={`gmn-${battlefield.id}`}
        rows={16}
        placeholder="Ambush on round 3… trap under the rug… enemy weaknesses…"
        onBlur={e => patchGmNotes(e.target.value)}
        className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 resize-none leading-relaxed"
      />
    </div>
  )
}

// ==========================================================================
// Inputs
// ==========================================================================
function HpAdjuster({ onApply }: { onApply: (delta: number) => void }) {
  const [amt, setAmt] = useState(5)
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => onApply(-amt)} className="flex-1 py-1.5 rounded bg-red-900/60 border border-red-700 text-red-200 hover:bg-red-900 text-sm font-bold">− Damage</button>
      <input type="number" value={amt} min={0}
        onChange={ev => setAmt(Math.max(0, Math.round(Number(ev.target.value) || 0)))}
        className="w-14 text-center bg-gray-900 border border-gray-600 rounded px-1 py-1" />
      <button onClick={() => onApply(amt)} className="flex-1 py-1.5 rounded bg-green-900/60 border border-green-700 text-green-200 hover:bg-green-900 text-sm font-bold">＋ Heal</button>
    </div>
  )
}

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
