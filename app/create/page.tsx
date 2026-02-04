'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function CreateCharacter() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    job: '',
    type: 'NPC', // PC, NPC, Tame
    party: '',
    player_name: '', // For Tames (Owner Name) or PCs (Player Name)
    hp: 100,
    stats: { strength: 0, speed: 0, fortitude: 0, magic: 0 }
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    // Tame Logic: If type is Tame, 'job' is typically the Owner's Name (per your rule)
    // But we'll keep it flexible.
    
    const payload = {
        name: form.name,
        job: form.job,
        level: 1,
        hp_current: form.hp,
        hp_max: form.hp,
        xp_current: 0,
        xp_max: 1000,
        stats: form.stats,
        is_npc: form.type !== 'PC', // NPC or Tame are both "NPCs" technically
        is_tame: form.type === 'Tame',
        party: form.party || null,
        player_name: form.player_name || null, // Stores Owner Name for Tames
        tags: [form.type]
    }

    const { data, error } = await supabase
        .from('characters')
        .insert(payload)
        .select()
        .single()

    if (error) {
        alert('Error: ' + error.message)
        setLoading(false)
    } else {
        router.push(`/character/${data.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 font-sans flex justify-center">
      <div className="w-full max-w-2xl">
        <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">← Cancel</Link>
        
        <h1 className="text-3xl font-bold mb-8">Create New Character</h1>

        <form onSubmit={handleSubmit} className="space-y-6 bg-gray-800 p-8 rounded-xl border border-gray-700">
            
            {/* TYPE SELECTOR */}
            <div className="flex gap-4 mb-6">
                {['PC', 'NPC', 'Tame'].map(t => (
                    <button
                        type="button"
                        key={t}
                        onClick={() => setForm({...form, type: t})}
                        className={`flex-1 py-3 rounded font-bold border ${
                            form.type === t 
                            ? 'bg-blue-600 border-blue-400 text-white' 
                            : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                        }`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs uppercase text-gray-500 mb-1">Name</label>
                    <input 
                        required
                        className="w-full bg-gray-900 border border-gray-600 rounded p-2"
                        value={form.name}
                        onChange={e => setForm({...form, name: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-xs uppercase text-gray-500 mb-1">
                        {form.type === 'Tame' ? 'Owner Name (Job Field)' : 'Class / Job'}
                    </label>
                    <input 
                        className="w-full bg-gray-900 border border-gray-600 rounded p-2"
                        value={form.job}
                        onChange={e => setForm({...form, job: e.target.value})}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs uppercase text-gray-500 mb-1">Max HP</label>
                    <input 
                        type="number"
                        className="w-full bg-gray-900 border border-gray-600 rounded p-2"
                        value={form.hp}
                        onChange={e => setForm({...form, hp: parseInt(e.target.value)})}
                    />
                </div>
                <div>
                    <label className="block text-xs uppercase text-gray-500 mb-1">Party Name (Optional)</label>
                    <input 
                        className="w-full bg-gray-900 border border-gray-600 rounded p-2"
                        placeholder="e.g. The Saviors"
                        value={form.party}
                        onChange={e => setForm({...form, party: e.target.value})}
                    />
                </div>
            </div>

            {/* BASE STATS */}
            <div>
                <label className="block text-xs uppercase text-gray-500 mb-2">Base Stats</label>
                <div className="grid grid-cols-4 gap-2">
                    {Object.keys(form.stats).map(stat => (
                        <div key={stat}>
                            <div className="text-[10px] uppercase text-gray-400 text-center mb-1">{stat}</div>
                            <input 
                                type="number"
                                className="w-full bg-gray-900 border border-gray-600 rounded p-1 text-center"
                                value={(form.stats as any)[stat]}
                                onChange={e => setForm({
                                    ...form, 
                                    stats: { ...form.stats, [stat]: parseInt(e.target.value) } 
                                })}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded transition mt-4"
            >
                {loading ? 'Creating...' : 'Create Character'}
            </button>

        </form>
      </div>
    </div>
  )
}
