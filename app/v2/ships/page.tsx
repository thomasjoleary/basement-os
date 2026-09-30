'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { emptyPlan, newId, type Ship } from '@/lib/ships'
import { instantiateTemplate, SHIP_TEMPLATES } from '@/lib/ship-templates'
import { saveShip, shipAccess, shipError } from '@/lib/ship-api'

export default function ShipsPage() {
  const router = useRouter()
  const [ships, setShips] = useState<Ship[]>([]), [isGM, setGM] = useState(false), [loading, setLoading] = useState(true)
  const [error, setError] = useState(''), [creating, setCreating] = useState(false), [template, setTemplate] = useState('blank'), [name, setName] = useState(''), [busy, setBusy] = useState(false)
  const lock = useRef(false)
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const access = await shipAccess()
        if (!access) { router.replace('/login'); return }
        const { data, error } = await supabase.from('v2_ships').select('id,name,description,owner_id,crew_ids,version').order('name')
        if (error) throw new Error(shipError(error))
        if (active) { setGM(access.isGM); setShips(data as Ship[]) }
      } catch (e) { if (active) setError((e as Error).message) }
      finally { if (active) setLoading(false) }
    }
    load(); return () => { active = false }
  }, [router])
  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const ship = await saveShip({ id: newId(), name, description: '', owner_id: null, crew_ids: [], version: 0, plan: template === 'blank' ? emptyPlan() : instantiateTemplate(template) }, '')
      router.push(`/v2/ships/${ship.id}`)
    } catch (e) { setError((e as Error).message); lock.current = false; setBusy(false) }
  }
  return <main className="min-h-screen bg-gray-900 text-white p-5 md:p-8">
    <div className="max-w-6xl mx-auto">
      <Link href={isGM ? '/v2' : '/'} className="text-sm text-gray-400">← Back to {isGM ? 'v2' : 'Basement OS'}</Link>
      <div className="flex items-center justify-between gap-4 mt-6 mb-8"><div><p className="text-xs tracking-widest uppercase text-cyan-400">Basement OS v2</p><h1 className="text-3xl font-bold mt-2">Ships</h1><p className="text-gray-400 mt-2">{isGM ? 'Build deck plans and keep equipment in its place.' : 'Deck plans and equipment for ships assigned to you.'}</p></div>
        {isGM && !creating && <button onClick={() => { setCreating(true); setName(''); setTemplate('blank') }} className="rounded bg-cyan-700 px-4 py-2">New ship</button>}
      </div>
      {error && <p role="alert" className="p-4 mb-4 rounded border border-red-800 bg-red-950 text-red-200">{error}</p>}
      {loading ? <p>Loading ships…</p> : <>
        {creating && <form onSubmit={create} className="rounded-xl border border-cyan-800 bg-gray-800 p-5 mb-6 space-y-4">
          <h2 className="text-xl font-semibold">Create a ship</h2>
          <label className="block">Ship name<input autoFocus required maxLength={120} value={name} onChange={e => setName(e.target.value)} className="block w-full bg-gray-950 border border-gray-600 rounded p-2 mt-1" /></label>
          <label className="block">Starting plan<select value={template} onChange={e => setTemplate(e.target.value)} className="block w-full bg-gray-950 border border-gray-600 rounded p-2 mt-1"><option value="blank">Blank ship</option>{SHIP_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <p className="text-sm text-gray-400">{SHIP_TEMPLATES.find(t => t.id === template)?.description ?? 'An empty main deck, ready to draw.'} Templates create independent copies; nothing existing is replaced.</p>
          <div className="flex gap-3"><button disabled={busy || !name.trim()} className="rounded bg-cyan-700 px-4 py-2 disabled:opacity-40">{busy ? 'Creating…' : 'Create ship'}</button><button type="button" disabled={busy} onClick={() => setCreating(false)} className="px-4 py-2">Cancel</button></div>
        </form>}
        {!ships.length && <p className="text-gray-400 py-10">{isGM ? 'No ships yet. Start with a blank plan or a starter template.' : 'No ships are assigned to you yet.'}</p>}
        <div className="grid md:grid-cols-2 gap-4">{ships.map(s => <Link key={s.id} href={`/v2/ships/${s.id}`} className="block rounded-xl border border-gray-700 bg-gray-800 p-5 hover:border-cyan-600"><h2 className="text-xl font-semibold">{s.name}</h2><p className="text-gray-400 mt-2">{s.description || 'Open deck plans and inventory'}</p></Link>)}</div>
      </>}
    </div>
  </main>
}
