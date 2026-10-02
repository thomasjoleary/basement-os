'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
const ShipViewer3D = dynamic(() => import('./ShipViewer3D'), { ssr: false, loading: () => <div className="h-[520px] flex items-center justify-center">Loading 3D view…</div> })
import ShipAppearanceEditor from './ShipAppearanceEditor'
import ShipGrid, { type Selection, type ShipTool } from './ShipGrid'
import { type Ship, type ShipPlan, type Part, type Connection, QUALITIES, CONDITIONS, newDeck, newId, removeDeck, removeRoom, movePart, validatePlan, deckHeight } from '@/lib/ships'
import { type Profile, saveShip } from '@/lib/ship-api'

const inputClass = 'block min-w-0 max-w-full w-full mt-1 bg-gray-950 border border-gray-600 rounded px-2 py-2 text-sm disabled:border-transparent disabled:bg-gray-900 disabled:text-gray-200'
function Field({ label, value, onChange, type = 'text', min, max }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; min?: number; max?: number }) {
  return <label className="block text-xs text-gray-400">{label}<input aria-label={label} type={type} value={value} min={min} max={max} maxLength={type === 'text' ? 120 : undefined} onChange={e => onChange(e.target.value)} className={inputClass} /></label>
}
function Notes({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="block text-xs text-gray-400">{label}<textarea aria-label={label} value={value} onChange={e => onChange(e.target.value)} maxLength={label === 'GM-only notes' ? 50000 : 10000} rows={3} className={inputClass} /></label>
}

export default function ShipEditor({ initialShip, initialNotes, isGM, profiles }: { initialShip: Ship; initialNotes: string; isGM: boolean; profiles: Profile[] }) {
  const [ship, setShip] = useState(initialShip), [notes, setNotes] = useState(initialNotes)
  const [saved, setSaved] = useState({ ship: initialShip, notes: initialNotes })
  const [deckId, setDeckId] = useState(initialShip.plan.decks[0].id)
  const [tool, setTool] = useState<ShipTool>('select'), [selection, setSelection] = useState<Selection>(null)
  const [view, setView] = useState<'2d' | 'cutaway' | 'exterior'>('2d')
  const [tab, setTab] = useState<'inspect' | 'inventory' | 'ship'>('inspect')
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const dirty = ship !== saved.ship || notes !== saved.notes
  const deck = ship.plan.decks.find(d => d.id === deckId) ?? ship.plan.decks[0]
  const room = selection?.kind === 'room' ? deck.rooms.find(r => r.id === selection.id) : undefined
  const mark = selection?.kind === 'mark' ? deck.marks.find(m => m.id === selection.id) : undefined
  const part = selection?.kind === 'part' ? ship.plan.parts.find(p => p.id === selection.id) : undefined
  const connection = selection?.kind === 'connection' ? ship.plan.connections.find(c => c.id === selection.id) : undefined
  useEffect(() => {
    if (!dirty) return
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])
  function change(plan: ShipPlan) { if (isGM && !busy) { setShip(s => ({ ...s, plan })); setMessage('') } }
  function switchDeck(id: string) { setDeckId(id); setSelection(null); setTool('select') }
  function inspect(s: Selection) { setSelection(s); setTab('inspect') }
  function patchPart(patch: Partial<Part>) {
    if (!part) return
    change({ ...ship.plan, parts: ship.plan.parts.map(p => p.id === part.id ? { ...p, ...patch } : p) })
  }
  function patchConnection(patch: Partial<Connection>) {
    if (!connection) return
    change({ ...ship.plan, connections: ship.plan.connections.map(c => c.id === connection.id ? { ...c, ...patch } : c) })
  }
  async function save() {
    if (lock.current) return
    const invalid = validatePlan(ship.plan)
    if (invalid || !ship.name.trim()) { setMessage(invalid ?? 'Give the ship a name.'); return }
    lock.current = true; setBusy(true); setMessage('')
    try {
      const result = await saveShip(ship, notes)
      setShip(result); setSaved({ ship: result, notes }); setMessage('Ship saved.')
    } catch (e) { setMessage((e as Error).message) }
    finally { lock.current = false; setBusy(false) }
  }
  function cancel() {
    if (dirty && !window.confirm('Discard all unsaved changes to this ship?')) return
    setShip(saved.ship); setNotes(saved.notes); setDeckId(saved.ship.plan.decks[0].id); setSelection(null); setTool('select'); setMessage('Changes discarded.')
  }
  function addConnection() {
    const other = ship.plan.decks.find(d => d.id !== deck.id)
    if (!other) { setMessage('Add a second deck before connecting decks.'); return }
    const c: Connection = { id: newId(), name: 'Deck connection', kind: 'stairs', from_deck: deck.id, from: { x: 0, y: 0 }, to_deck: other.id, to: { x: 0, y: 0 } }
    change({ ...ship.plan, connections: [...ship.plan.connections, c] }); inspect({ kind: 'connection', id: c.id }); setTool('select')
  }
  function deleteSelected() {
    if (!selection) return
    if (room) change(removeRoom(ship.plan, room.id))
    if (part) change({ ...ship.plan, parts: ship.plan.parts.filter(p => p.id !== part.id) })
    if (mark) change({ ...ship.plan, decks: ship.plan.decks.map(d => d.id === deck.id ? { ...d, marks: d.marks.filter(m => m.id !== mark.id) } : d) })
    if (connection) change({ ...ship.plan, connections: ship.plan.connections.filter(c => c.id !== connection.id) })
    setSelection(null)
  }
  return <main data-ship-editor className="min-h-screen bg-gray-900 text-white p-4 md:p-6">
    <div className="max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="min-w-0 max-w-full [overflow-wrap:anywhere]"><Link href="/v2/ships" onClick={e => { if (busy || (dirty && !window.confirm('Leave without saving your changes?'))) e.preventDefault() }} className="text-sm text-gray-400">← Back to ships</Link><h1 className="text-2xl font-bold mt-2">{ship.name}</h1><p className="text-xs text-gray-400 mt-1">{isGM ? dirty ? 'Unsaved changes' : 'All changes saved' : 'Assigned crew · read-only'} · Revision {ship.version}</p></div>
        {isGM && <div className="flex gap-2"><button disabled={busy || !dirty} onClick={cancel} className="rounded border border-gray-600 px-4 py-2 disabled:opacity-40">Discard changes</button><button disabled={busy || !dirty} onClick={save} className="rounded bg-cyan-700 px-4 py-2 font-semibold disabled:opacity-40">{busy ? 'Saving…' : 'Save ship'}</button></div>}
      </div>
      {message && <p role="status" className="rounded border border-cyan-800 bg-gray-800 p-3 mb-4 text-sm">{message}</p>}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div role="group" aria-label="Ship view" className="flex gap-1">{(['2d', 'cutaway', 'exterior'] as const).map(v => <button key={v} aria-pressed={view===v} onClick={()=>setView(v)} className={`rounded px-3 py-2 text-sm ${view===v?'bg-cyan-800':'bg-gray-800 border border-gray-700'}`}>{v==='2d'?'2D':v==='cutaway'?'Cutaway':'Exterior'}</button>)}</div>
        <label className="text-sm flex items-center gap-2 min-w-0 max-w-full">Deck<select aria-label="Current deck" value={deck.id} onChange={e => switchDeck(e.target.value)} className="w-52 min-w-0 max-w-full bg-gray-800 border border-gray-600 rounded p-2">{ship.plan.decks.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}</select></label>
        {isGM && <button disabled={busy || ship.plan.decks.length >= 20} onClick={() => { const d = newDeck(`Deck ${ship.plan.decks.length + 1}`); change({ ...ship.plan, decks: [...ship.plan.decks, d] }); switchDeck(d.id) }} className="text-sm border border-gray-600 rounded p-2">Add deck</button>}
        {view === '2d' && (isGM ? ['select', 'pan', 'room', 'wall', 'door', 'label', 'fixture'] : ['select', 'pan']).map(t => <button key={t} aria-pressed={tool === t} disabled={busy} onClick={() => { setTool(t as ShipTool); setSelection(null) }} className={`capitalize rounded px-3 py-2 text-sm ${tool === t ? 'bg-cyan-800 border border-cyan-500' : 'bg-gray-800 border border-gray-700'}`}>{t}</button>)}
        {isGM && view === '2d' && <button disabled={busy} onClick={addConnection} className="text-sm rounded p-2 border border-gray-600">Connect decks</button>}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        {view === '2d' ? <ShipGrid key={`${deck.id}:${tool}`} deck={deck} plan={ship.plan} editable={isGM && !busy} tool={tool} selection={selection} onSelect={inspect} onChange={change} onDeck={switchDeck} onMessage={setMessage} /> : <ShipViewer3D key={view} plan={ship.plan} deckId={deck.id} mode={view} selection={selection} onSelect={(s, targetDeck)=>{if(targetDeck)setDeckId(targetDeck);inspect(s)}} onFallback={()=>setView('2d')} />}
        <aside className="min-w-0 h-[min(640px,75dvh)] flex flex-col [overflow-wrap:anywhere] [overflow-anchor:none] border border-gray-700 bg-gray-800 rounded-xl overflow-hidden">
          <div className="flex shrink-0 border-b border-gray-700">{(['inspect', 'inventory', 'ship'] as const).map(t => <button key={t} onClick={() => setTab(t)} className={`flex-1 text-sm py-3 ${tab === t ? 'text-cyan-300 bg-gray-900' : 'text-gray-400'}`}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
          <div className="p-4 space-y-4 min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
            {tab === 'ship' && <fieldset disabled={!isGM || busy} className="min-w-0 space-y-4">
              <Field label="Ship name" value={ship.name} onChange={name => setShip({ ...ship, name })} />
              <Notes label="Public description" value={ship.description} onChange={description => setShip({ ...ship, description })} />
              <ShipAppearanceEditor plan={ship.plan} deckId={deck.id} disabled={!isGM || busy} onChange={change} />
              {isGM ? <>
                <label className="block text-xs text-gray-400">Owner<select aria-label="Owner" value={ship.owner_id ?? ''} onChange={e => setShip({ ...ship, owner_id: e.target.value || null })} className={inputClass}><option value="">Unassigned</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.username}</option>)}</select></label>
                <div className="text-xs text-gray-400">Crew access<p className="mb-2">Owner and selected crew can read the complete plan and public notes.</p>{profiles.map(p => <label className="flex gap-2 items-center py-1 text-sm text-gray-200" key={p.id}><input type="checkbox" checked={ship.crew_ids.includes(p.id)} onChange={e => setShip({ ...ship, crew_ids: e.target.checked ? [...ship.crew_ids, p.id] : ship.crew_ids.filter(id => id !== p.id) })} />{p.username}</label>)}</div>
                <Notes label="GM-only notes" value={notes} onChange={setNotes} />
              </> : <p className="text-sm text-gray-400">The GM manages ownership and crew assignments.</p>}
            </fieldset>}
            {tab === 'inventory' && <>
              <p className="text-xs text-gray-400">All decks · select a component to locate and inspect it.</p>
              {ship.plan.parts.length === 0 && <p className="text-sm text-gray-400">No components. Use the Fixture tool to place one.</p>}
              {ship.plan.parts.map(p => <button key={p.id} onClick={() => { setDeckId(p.deck_id); setTool('select'); inspect({ kind: 'part', id: p.id }) }} className="block w-full text-left p-3 bg-gray-900 border border-gray-700 rounded"><span className="text-sm">{p.name} × {p.quantity}</span><span className="block text-xs text-gray-400 mt-1">{ship.plan.decks.find(d => d.id === p.deck_id)?.name} · {p.quality} · {p.condition}{p.black_market ? ' · Black Market' : ''}</span></button>)}
            </>}
            {tab === 'inspect' && <>
              {!selection && <>
                <fieldset disabled={!isGM || busy} className="min-w-0 space-y-3">
                  <h2 className="font-semibold">Deck setup</h2><Field label="Deck name" value={deck.name} onChange={name => change({ ...ship.plan, decks: ship.plan.decks.map(d => d.id === deck.id ? { ...d, name } : d) })} />
                  <Field label="Deck height (feet)" type="number" min={1} max={100} value={deckHeight(deck)} onChange={v => { const height = Number(v); if (Number.isFinite(height) && height >= 1 && height <= 100) change({ ...ship.plan, decks: ship.plan.decks.map(d => d.id === deck.id ? { ...d, height_ft: height } : d) }) }} />
                  <div className="grid grid-cols-2 gap-2">{(['width', 'height'] as const).map(axis => <Field key={axis} label={`Deck ${axis}`} type="number" min={4} max={100} value={deck[axis]} onChange={v => { const size = Number(v); if (size >= 4 && size <= 100) { const plan = { ...ship.plan, decks: ship.plan.decks.map(d => d.id === deck.id ? { ...d, [axis]: size } : d) }; const invalid = validatePlan(plan); if (invalid) setMessage('Move or remove items before shrinking the deck.'); else change(plan) } }} />)}</div>
                  {isGM && <button disabled={ship.plan.decks.length === 1} className="text-sm text-red-300 disabled:opacity-30" onClick={() => { if (!confirm('Delete this deck and all its rooms, fixtures and connections?')) return; const plan = removeDeck(ship.plan, deck.id); change(plan); switchDeck(plan.decks[0].id) }}>Delete deck</button>}
                </fieldset>
                <p className="text-xs text-gray-400">Select a room, fixture, wall or connection on the plan. Room outlines act as walls; doors mark openings.</p>
                <h3 className="text-sm font-semibold">Rooms</h3>
                {deck.rooms.map(r => <button key={r.id} className="block text-sm text-cyan-300" onClick={() => inspect({ kind: 'room', id: r.id })}>{r.name}</button>)}
                <h3 className="text-sm font-semibold">Connections</h3>
                {ship.plan.connections.filter(c => c.from_deck === deck.id || c.to_deck === deck.id).map(c => <button key={c.id} className="block text-sm text-violet-300" onClick={() => inspect({ kind: 'connection', id: c.id })}>{c.name}</button>)}
              </>}
              {selection && <button className="text-xs text-cyan-300" onClick={() => setSelection(null)}>← Deck setup</button>}
              <fieldset disabled={!isGM || busy} className="min-w-0 space-y-3">
                {room && <><h2 className="font-semibold">Room</h2><Field label="Room name" value={room.name} onChange={name => change({ ...ship.plan, decks: ship.plan.decks.map(d => d.id === deck.id ? { ...d, rooms: d.rooms.map(r => r.id === room.id ? { ...r, name } : r) } : d) })} /><p className="text-xs text-gray-400">{room.width} × {room.height} cells · ({room.x}, {room.y})</p><Notes label="Public room notes" value={room.notes} onChange={notes => change({ ...ship.plan, decks: ship.plan.decks.map(d => d.id === deck.id ? { ...d, rooms: d.rooms.map(r => r.id === room.id ? { ...r, notes } : r) } : d) })} /></>}
                {mark && <><h2 className="font-semibold capitalize">{mark.kind}</h2><Field label="Label / name" value={mark.name} onChange={name => change({ ...ship.plan, decks: ship.plan.decks.map(d => d.id === deck.id ? { ...d, marks: d.marks.map(m => m.id === mark.id ? { ...m, name } : m) } : d) })} /><p className="text-xs text-gray-400">({mark.x}, {mark.y}) · {mark.length} cells · {mark.vertical ? 'vertical' : 'horizontal'}</p></>}
                {part && <>
                  <h2 className="font-semibold">Component</h2>
                  <Field label="Component name" value={part.name} onChange={name => patchPart({ name })} /><Field label="Type" value={part.type} onChange={type => patchPart({ type })} />
                  <Field label="Quantity" type="number" min={1} max={100000} value={part.quantity} onChange={v => patchPart({ quantity: Number(v) })} />
                  <label className="block text-xs text-gray-400">Quality<select aria-label="Quality" value={part.quality} onChange={e => patchPart({ quality: e.target.value as Part['quality'] })} className={inputClass}>{QUALITIES.map(q => <option key={q}>{q}</option>)}</select></label>
                  <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={part.black_market} onChange={e => patchPart({ black_market: e.target.checked })} />Black Market</label><p className="text-xs text-gray-400">Potentially criminal provenance, independent of quality.</p>
                  <label className="block text-xs text-gray-400">Physical condition<select aria-label="Physical condition" value={part.condition} onChange={e => patchPart({ condition: e.target.value as Part['condition'] })} className={inputClass}>{CONDITIONS.map(c => <option key={c}>{c}</option>)}</select></label>
                  <label className="block text-xs text-gray-400">Component deck<select aria-label="Component deck" value={part.deck_id} onChange={e => { const d = ship.plan.decks.find(d => d.id === e.target.value)!; change(movePart(ship.plan, part.id, d, part)); setDeckId(d.id) }} className={inputClass}>{ship.plan.decks.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}</select></label>
                  <div className="grid grid-cols-2 gap-2">{(['x', 'y'] as const).map(axis => <Field key={axis} label={`Position ${axis}`} type="number" min={0} max={(axis === 'x' ? deck.width : deck.height) - 1} value={part[axis]} onChange={v => change(movePart(ship.plan, part.id, deck, { ...part, [axis]: Number(v) }))} />)}</div>
                  <p className="text-xs text-gray-400">Room: {deck.rooms.find(r => r.id === part.room_id)?.name ?? 'Unassigned (outside rooms)'}</p>
                  <Notes label="Public component notes" value={part.notes} onChange={notes => patchPart({ notes })} />
                </>}
                {connection && <>
                  <h2 className="font-semibold">Deck connection</h2><Field label="Connection name" value={connection.name} onChange={name => patchConnection({ name })} />
                  <label className="block text-xs text-gray-400">Connection type<select aria-label="Connection type" value={connection.kind} onChange={e => patchConnection({ kind: e.target.value as Connection['kind'] })} className={inputClass}><option value="stairs">Stairs</option><option value="lift">Lift</option></select></label>
                  {(['from', 'to'] as const).map(end => <div key={end} className="space-y-2"><label className="block text-xs text-gray-400">{end === 'from' ? 'From deck' : 'To deck'}<select aria-label={`${end} deck`} value={connection[`${end}_deck`]} onChange={e => patchConnection({ [`${end}_deck`]: e.target.value, [end]: { x: 0, y: 0 } })} className={inputClass}>{ship.plan.decks.filter(d => d.id !== connection[end === 'from' ? 'to_deck' : 'from_deck']).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><div className="grid grid-cols-2 gap-2">{(['x', 'y'] as const).map(axis => <Field key={axis} label={`${end} ${axis}`} type="number" min={0} value={connection[end][axis]} onChange={v => patchConnection({ [end]: { ...connection[end], [axis]: Number(v) } })} />)}</div></div>)}
                </>}
                {selection && isGM && <button onClick={deleteSelected} className="text-sm text-red-300">Delete selected {selection.kind === 'part' ? 'component' : selection.kind}</button>}
              </fieldset>
              {room && <div className="space-y-2"><h3 className="text-sm text-gray-400">Components in this room</h3>{ship.plan.parts.filter(p => p.room_id === room.id).map(p => <button key={p.id} className="block text-sm text-cyan-300" onClick={() => inspect({ kind: 'part', id: p.id })}>{p.name} × {p.quantity}</button>)}</div>}
              {connection && <button onClick={() => switchDeck(connection.from_deck === deck.id ? connection.to_deck : connection.from_deck)} className="text-sm text-violet-300">Go to connected deck →</button>}
            </>}
          </div>
        </aside>
      </div>
    </div>
  </main>
}
