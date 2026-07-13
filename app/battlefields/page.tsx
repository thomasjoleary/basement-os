'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Battlefield } from '@/lib/battlefield'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function BattlefieldsPage() {
  const router = useRouter()
  const [session, setSession] = useState<{ user: { id: string } } | null>(null)
  const [isGM, setIsGM] = useState(false)
  const [loading, setLoading] = useState(true)
  const [battlefields, setBattlefields] = useState<Battlefield[]>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      let gm = false
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
        gm = profile?.role === 'gm'
        setIsGM(gm)
      }
      const { data } = await supabase
        .from('battlefields')
        .select('*')
        .eq('is_archived', false)
        .order('updated_at', { ascending: false })
      if (data) setBattlefields(data as Battlefield[])
      setLoading(false)
    }
    init()
  }, [])

  async function createBattlefield() {
    setCreating(true)
    const { data, error } = await supabase
      .from('battlefields')
      .insert({ name: 'New Battlefield', created_by: session?.user?.id })
      .select()
      .single()
    setCreating(false)
    if (data) router.push(`/battlefields/${data.id}`)
    else alert('Could not create battlefield: ' + (error?.message ?? 'unknown error'))
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 border-b border-gray-700 px-4 sm:px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white transition">← Back</Link>
          <h1 className="text-xl sm:text-2xl font-bold text-red-500 font-mono">BATTLEFIELDS</h1>
        </div>
        {isGM && (
          <button
            onClick={createBattlefield}
            disabled={creating}
            className="bg-red-800 hover:bg-red-700 disabled:opacity-50 border border-red-600 px-3 sm:px-4 py-2 rounded font-bold text-sm"
          >
            {creating ? 'Creating…' : '+ New Battlefield'}
          </button>
        )}
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        {loading && <p className="text-center text-gray-500 animate-pulse">Loading…</p>}

        {!loading && battlefields.length === 0 && (
          <div className="text-center text-gray-500 py-20">
            <p className="text-2xl mb-2">⚔️</p>
            <p>{isGM ? 'No battlefields yet. Create one to start a combat.' : 'No battlefields are visible to you right now.'}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {battlefields.map(bf => (
            <Link key={bf.id} href={`/battlefields/${bf.id}`} className="block group">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-red-500 transition-colors h-full">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-lg group-hover:text-red-400">{bf.name}</h2>
                  <span className="text-xs px-2 py-0.5 rounded border" style={bf.border_type === 'indoor'
                    ? { background: 'rgba(87,83,74,0.5)', borderColor: '#a8a29e', color: '#e7e5e4' }
                    : { background: 'rgba(22,101,52,0.4)', borderColor: '#4ade80', color: '#dcfce7' }}>
                    {bf.border_type === 'indoor' ? '🏠 Indoor' : '🌳 Outdoor'}
                  </span>
                </div>
                <p className="text-sm text-gray-400">
                  {bf.cols} × {bf.rows} squares · {bf.cols * 5} × {bf.rows * 5} ft
                </p>
                <p className="text-xs text-gray-600 mt-2">Round {bf.round}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
