'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function WikiIndex() {
  const [notes, setNotes] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCharacter, setFilterCharacter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [isGM, setIsGM] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    async function getData() {
      // 1. Get Session & Role
      const { data: { session } } = await supabase.auth.getSession()
      
      let gmStatus = false
      if (session) {
          setIsAuthenticated(true)
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
          if (profile && profile.role === 'gm') gmStatus = true
      }
      setIsGM(gmStatus)

      // 2. Get All Notes
      const { data: allNotes } = await supabase
        .from('notes')
        .select('id, title, type, tags, is_public, created_by, character_name')
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
              if (n.created_by === session?.user.id) return true; // Notes I created
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
    const matchesCharacter = filterCharacter === 'all' || 
                             (filterCharacter === 'gm-lore' && !note.created_by) ||
                             (filterCharacter === 'player-notes' && note.created_by) ||
                             note.character_name === filterCharacter
    return matchesSearch && matchesType && matchesCharacter
  })

  // Unique Types for Filter Buttons
  const types = ['all', ...Array.from(new Set(notes.map(n => n.type))).filter(Boolean)]
  
  // Unique Character Names for Filter
  const characterNames = Array.from(new Set(notes.map(n => n.character_name).filter(Boolean)))
  const hasGMLore = notes.some(n => !n.created_by)
  const hasPlayerNotes = notes.some(n => n.created_by)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 font-sans">
      <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">← Back to Dashboard</Link>
      
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
            <h1 className="text-4xl font-bold text-red-500 font-mono">BASEMENT WIKI</h1>
            <p className="text-gray-400 mt-2">
              {isGM ? 'The Archive of Lost Knowledge' : 'Lore & Personal Notes'}
            </p>
            {isAuthenticated && (
              <Link 
                href="/wiki/new"
                className="inline-block mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors text-sm uppercase tracking-wider"
              >
                {isGM ? '+ Create New Lore' : '+ Create Note'}
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

      {/* TYPE FILTERS */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Filter by Type</div>
        <div className="flex flex-wrap gap-2">
          {types.map(type => {
            // Display label mapping
            const displayLabel = type === 'post' ? 'Posts' : type
            return (
              <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1 rounded text-sm uppercase tracking-wider transition-colors border ${
                      filterType === type 
                      ? 'bg-red-900 border-red-500 text-white' 
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
              >
                  {displayLabel}
              </button>
            )
          })}
        </div>
      </div>

      {/* CHARACTER FILTERS */}
      {(hasGMLore || hasPlayerNotes || characterNames.length > 0) && (
        <div className="mb-6">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Filter by Source</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterCharacter('all')}
              className={`px-3 py-1 rounded text-sm uppercase tracking-wider transition-colors border ${
                filterCharacter === 'all'
                  ? 'bg-blue-900 border-blue-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              All
            </button>
            {hasGMLore && (
              <button
                onClick={() => setFilterCharacter('gm-lore')}
                className={`px-3 py-1 rounded text-sm uppercase tracking-wider transition-colors border ${
                  filterCharacter === 'gm-lore'
                    ? 'bg-purple-900 border-purple-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                📜 GM Lore
              </button>
            )}
            {hasPlayerNotes && (
              <button
                onClick={() => setFilterCharacter('player-notes')}
                className={`px-3 py-1 rounded text-sm uppercase tracking-wider transition-colors border ${
                  filterCharacter === 'player-notes'
                    ? 'bg-green-900 border-green-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                📝 Player Notes
              </button>
            )}
            {characterNames.map(char => (
              <button
                key={char}
                onClick={() => setFilterCharacter(char)}
                className={`px-3 py-1 rounded text-sm transition-colors border ${
                  filterCharacter === char
                    ? 'bg-cyan-900 border-cyan-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {char}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* GRID */}
      {loading ? (
        <div className="text-center text-gray-500 mt-12 animate-pulse">Loading Archives...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredNotes.map(note => {
                const isPlayerNote = !!note.created_by
                const borderColor = isPlayerNote ? 'border-green-700 hover:border-green-500' : 'border-gray-700 hover:border-red-500'
                
                return (
                  <Link href={`/wiki/${note.id}`} key={note.id} className="group">
                      <div className={`bg-gray-800 border p-4 rounded-lg shadow-lg transition-all h-full flex flex-col ${borderColor}`}>
                          <div className="flex justify-between items-start mb-2">
                              <h2 className="text-lg font-bold text-gray-200 group-hover:text-white flex-1">{note.title}</h2>
                              {note.type && (
                                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded ml-2 ${
                                      note.type === 'post' ? 'bg-green-900/50 text-green-300' :
                                      note.type === 'monster' ? 'bg-red-900/50 text-red-300' :
                                      note.type === 'class' ? 'bg-blue-900/50 text-blue-300' :
                                      note.type === 'system' ? 'bg-purple-900/50 text-purple-300' :
                                      'bg-gray-700 text-gray-300'
                                  }`}>
                                      {note.type === 'post' ? 'Post' : note.type}
                                  </span>
                              )}
                          </div>
                          
                          {/* Character Name Badge */}
                          {note.character_name && (
                            <div className="mb-2">
                              <span className="text-xs bg-cyan-900/50 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800">
                                {note.character_name}
                              </span>
                            </div>
                          )}
                          
                          {/* Source Badge */}
                          {isPlayerNote && (
                            <div className="mb-2">
                              <span className="text-[10px] bg-green-900/30 text-green-400 px-2 py-0.5 rounded border border-green-800">
                                📝 Player Note
                              </span>
                            </div>
                          )}
                          
                          <div className="mt-auto flex flex-wrap gap-1">
                              {note.tags && note.tags.slice(0, 3).map((tag: string) => (
                                  <span key={tag} className="text-xs text-gray-500">#{tag}</span>
                              ))}
                          </div>
                      </div>
                  </Link>
                )
            })}
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
