'use client'
import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { type Ship } from '@/lib/ships'
import { type Profile, shipAccess, shipError } from '@/lib/ship-api'
import ShipEditor from '@/components/ships/ShipEditor'

export default function ShipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params), router = useRouter()
  const [state, setState] = useState<{ ship: Ship; notes: string; isGM: boolean; profiles: Profile[] } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const access = await shipAccess()
        if (!access) { router.replace('/login'); return }
        const { data, error } = await supabase.from('v2_ships').select('*').eq('id', id).maybeSingle()
        if (error) throw new Error(shipError(error))
        if (!data) throw new Error('Ship unavailable. It may not exist or may not be assigned to you.')
        let notes = '', profiles: Profile[] = []
        if (access.isGM) {
          const [n, p] = await Promise.all([supabase.from('v2_ship_gm_notes').select('notes').eq('ship_id', id).maybeSingle(), supabase.from('profiles').select('id,username').order('username')])
          if (n.error) throw new Error(shipError(n.error))
          if (p.error) throw new Error(shipError(p.error))
          notes = n.data?.notes ?? ''; profiles = p.data ?? []
        }
        if (active) setState({ ship: data as Ship, notes, isGM: access.isGM, profiles })
      } catch (e) { if (active) setError((e as Error).message) }
    }
    load(); return () => { active = false }
  }, [id, router])
  if (error) return <main className="min-h-screen bg-gray-900 text-white p-8"><Link href="/v2/ships">← Back to ships</Link><p role="alert" className="mt-6 text-red-300">{error}</p></main>
  if (!state) return <main className="min-h-screen bg-gray-900 text-white p-8">Loading ship…</main>
  return <ShipEditor key={id} initialShip={state.ship} initialNotes={state.notes} isGM={state.isGM} profiles={state.profiles} />
}
