'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function WikiIndex() {
  const [notes, setNotes] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [isGM, setIsGM] = useState(false)

  useEffect(() => {
    async function getData() {
      // 1. Get Session & Role
      const { data: { session } } = await supabase.auth.getSession()
      
      let gmStatus = false
      if (session) {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
          if (profile && profile.role === 'gm') gmStatus = true
      }
      setIsGM(gmStatus)

      // 2. Get All Notes
      const { data: allNotes } = await supabase
        .from('notes')
        .select('id, title, type, tags, is_public')
        .order('title')
      
      // 3. Get User Unlocks (if logged in and not GM)
      let unlockedIds = new Set<string>()
      if (session && !isGM) {
          const { data: unlocks } = await supabase
            .from('unlocks')
            .select('note_id')
            .eq('user_id', session.user.id)
          
          if (unlocks) unlocks.forEach(u => unlockedIds.add(u.note_id))
      }

      // 4. Filter
      if (allNotes) {
          const visible = allNotes.filter(n => {
              if (gmStatus) return true; // GM sees all
              if (n.is_public) return true; // Public notes
              if (unlockedIds.has(n.id)) return true; // Unlocked notes
              return false; // Hidden
          })
          setNotes(visible)
      }
      
      setLoading(false)
    }
    getData()
  }, [])

  // Search Logic
  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(search.toLowerCase()) || 
                          (note.tags && note.tags.some((t: string) => t.toLowerCase().includes(search.toLowerCase())))
    const matchesType = filterType === 'all' || note.type === filterType
    return matchesSearch && matchesType
  })

  // Unique Types for Filter Buttons
  const types = ['all', ...Array.from(new Set(notes.map(n => n.type))).filter(Boolean)]

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 font-sans">
      <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">← Back to Dashboard</Link>
      
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
            <h1 className="text-4xl font-bold text-red-500 font-mono">BASEMENT WIKI</h1>
            <p className="text-gray-400 mt-2">The Archive of Lost Knowledge</p>
            {isGM && (
              <Link 
                href="/wiki/new"
                className="inline-block mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors text-sm uppercase tracking-wider"
              >
                + Create New Lore
              </Link>
            )}
        </div>
        
        <div className="w-full md:w-auto">
            <input 
                type="text" 
                placeholder="Search archives..." 
                className="w-full md:w-64 bg-gray-800 border border-gray-600 text-white px-4 py-2 rounded focus:outline-none focus:border-red-500 transition-colors"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
        </div>
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap gap-2 mb-6">
        {types.map(type => (
            <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1 rounded text-sm uppercase tracking-wider transition-colors border ${
                    filterType === type 
                    ? 'bg-red-900 border-red-500 text-white' 
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
            >
                {type}
            </button>
        ))}
      </div>

      {/* GRID */}
      {loading ? (
        <div className="text-center text-gray-500 mt-12 animate-pulse">Loading Archives...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredNotes.map(note => (
                <Link href={`/wiki/${note.id}`} key={note.id} className="group">
                    <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg shadow-lg hover:border-red-500 transition-all h-full flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                            <h2 className="text-lg font-bold text-gray-200 group-hover:text-white">{note.title}</h2>
                            {note.type && (
                                <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${
                                    note.type === 'monster' ? 'bg-red-900/50 text-red-300' :
                                    note.type === 'class' ? 'bg-blue-900/50 text-blue-300' :
                                    note.type === 'system' ? 'bg-purple-900/50 text-purple-300' :
                                    'bg-gray-700 text-gray-300'
                                }`}>
                                    {note.type}
                                </span>
                            )}
                        </div>
                        <div className="mt-auto flex flex-wrap gap-1">
                            {note.tags && note.tags.slice(0, 3).map((tag: string) => (
                                <span key={tag} className="text-xs text-gray-500">#{tag}</span>
                            ))}
                        </div>
                    </div>
                </Link>
            ))}
        </div>
      )}
      
      {!loading && filteredNotes.length === 0 && (
        <div className="text-center text-gray-500 mt-12 italic">
            No records found.
        </div>
      )}
    </div>
  )
}
