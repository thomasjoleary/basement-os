'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function getRarityColor(rarity: string): string {
    const r = rarity ? rarity.toLowerCase() : 'common';
    switch (r) {
        case 'common': return 'text-gray-300';
        case 'uncommon': return 'text-green-400';
        case 'rare': return 'text-blue-400';
        case 'very rare': return 'text-purple-400';
        case 'legendary': return 'text-orange-400';
        case 'holy': return 'text-yellow-200';
        case 'unique': return 'text-pink-400';
        case 'demonic': return 'text-red-600';
        default: return 'text-gray-300';
    }
}

export default function NoteDetail() {
  const { id } = useParams()
  const [note, setNote] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  
  // User State
  const [isGM, setIsGM] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  
  // GM Tools
  const [players, setPlayers] = useState<any[]>([])
  const [unlocks, setUnlocks] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function getNote() {
      // 1. Get Session & Role
      const { data: { session } } = await supabase.auth.getSession()
      
      let userIsGM = false
      let currentUserId: string | null = null
      
      if (session) {
          currentUserId = session.user.id
          setUserId(currentUserId)
          
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
          if (profile && profile.role === 'gm') {
              userIsGM = true
              setIsGM(true)
          }
      }

      // 2. Fetch Note Data
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error || !data) {
          setLoading(false)
          return
      }

      // 3. Check Permissions
      let hasAccess = false
      const isOwner = data.created_by === currentUserId
      
      if (userIsGM) hasAccess = true
      else if (isOwner) hasAccess = true
      else if (data.is_public) hasAccess = true
      else if (session) {
          const { data: unlock } = await supabase
            .from('unlocks')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('note_id', id)
            .single()
          if (unlock) hasAccess = true
      }

      if (hasAccess) {
          setNote(data)
          // Can edit if GM or owner
          setCanEdit(userIsGM || isOwner)
      } else {
          setAccessDenied(true)
      }

      // 4. GM Data Fetching (Players & Unlocks)
      if (userIsGM) {
          // Get all players with their main characters
          // Main character = not a tame, not an NPC, not dead
          const { data: mainCharacters } = await supabase
            .from('characters')
            .select('id, name, user_id, profiles(id, username)')
            .eq('is_tame', false)
            .eq('is_npc', false)
            .eq('is_dead', false)
            .not('user_id', 'is', null)
          
          // Map to player format with character name
          if (mainCharacters) {
            const playerMap = mainCharacters.map(char => {
              // Supabase returns profiles as array from join
              const profile = Array.isArray(char.profiles) ? char.profiles[0] : char.profiles
              return {
                id: char.user_id,
                username: profile?.username,
                characterName: char.name,
                characterId: char.id
              }
            })
            setPlayers(playerMap)
          }

          // Get existing unlocks for this note
          const { data: existingUnlocks } = await supabase.from('unlocks').select('user_id').eq('note_id', id)
          if (existingUnlocks) {
              setUnlocks(new Set(existingUnlocks.map(u => u.user_id)))
          }
      }

      setLoading(false)
    }
    if (id) getNote()
  }, [id])

  async function toggleUnlock(userId: string, currentStatus: boolean) {
      if (currentStatus) {
          // Revoke
          await supabase.from('unlocks').delete().match({ user_id: userId, note_id: id })
          const next = new Set(unlocks); next.delete(userId); setUnlocks(next)
      } else {
          // Grant
          await supabase.from('unlocks').insert({ user_id: userId, note_id: id })
          const next = new Set(unlocks); next.add(userId); setUnlocks(next)
      }
  }

  if (loading) return <div className="min-h-screen bg-gray-900 text-white p-8 text-center">Loading...</div>
  
  if (accessDenied) return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center justify-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-6">You have not discovered this knowledge yet.</p>
          <Link href="/wiki" className="text-blue-400 hover:underline">Return to Archives</Link>
      </div>
  )

  if (!note) return <div className="min-h-screen bg-gray-900 text-white p-8 text-center">Note not found.</div>

  const abilities = note.data?.abilities || []
  const unlockReq = note.data?.unlock || note.data?.unlock_requirements 
  const isClass = abilities.length > 0 || note.type === 'class';

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 font-sans">
      <Link href="/wiki" className="text-gray-400 hover:text-white mb-6 inline-block">← Back to Wiki Index</Link>

      <div className="max-w-4xl mx-auto">
        {/* HEADER */}
        <div className="border-b border-gray-700 pb-4 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                <div className="flex-1">
                  <h1 className="text-4xl font-bold text-red-500 font-mono">{note.title}</h1>
                  {/* Player Note Indicator */}
                  {note.created_by && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm bg-green-900/30 text-green-400 px-2 py-1 rounded border border-green-800">
                        📝 Player Note
                      </span>
                      {note.character_name && (
                        <span className="text-sm bg-cyan-900/50 text-cyan-300 px-2 py-1 rounded border border-cyan-800">
                          {note.character_name}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                    {note.type && (
                      <span className="text-sm bg-gray-800 px-3 py-1 rounded text-gray-300 border border-gray-700 uppercase tracking-widest">
                          {note.type === 'post' ? 'Post' : note.type}
                      </span>
                    )}
                    {note.is_public && <span className="text-sm bg-green-900/50 text-green-300 px-2 py-1 rounded border border-green-800">Public</span>}
                    {!note.is_public && note.created_by && (
                      <span className="text-sm bg-gray-700 text-gray-400 px-2 py-1 rounded border border-gray-600">Private</span>
                    )}
                    {canEdit && (
                      <Link
                        href={`/wiki/${id}/edit`}
                        className="text-sm bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded border border-yellow-500 uppercase tracking-widest transition-colors"
                      >
                        Edit
                      </Link>
                    )}
                </div>
            </div>
            {note.tags && (
                <div className="flex flex-wrap gap-2 mt-3">
                    {note.tags.map((tag: string) => (
                        <span key={tag} className="text-xs text-gray-500">#{tag}</span>
                    ))}
                </div>
            )}
        </div>

        {/* 1. UNLOCK REQUIREMENTS */}
        {unlockReq && (
            <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded-lg mb-8 shadow-lg">
                <h3 className="text-xs uppercase tracking-widest text-yellow-500 font-bold mb-2 flex items-center gap-2">
                    <span className="text-lg">🔓</span> Unlock Requirement
                </h3>
                <p className="text-yellow-100 font-medium whitespace-pre-wrap">{unlockReq}</p>
            </div>
        )}

        {/* 2. ABILITIES GRID */}
        {abilities.length > 0 && (
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-blue-400 mb-4 border-b border-gray-800 pb-2">Class Abilities</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {abilities.map((ab: any, i: number) => (
                        <div key={i} className="bg-gray-800 border border-gray-700 p-4 rounded hover:border-blue-500/50 transition-colors shadow-lg">
                            <div className="flex justify-between items-baseline mb-2">
                                <h3 className={`font-bold ${getRarityColor(ab.rarity)}`}>{ab.name}</h3>
                                {ab.level && <span className="text-xs text-gray-500 uppercase">Level {ab.level}</span>}
                            </div>
                            <p className="text-sm text-gray-400 leading-relaxed">{ab.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* 3. CONTENT BLOCK */}
        {isClass ? (
            <details className="group bg-gray-800/30 p-4 rounded-lg border border-gray-700 shadow-lg">
                <summary className="cursor-pointer font-bold text-gray-400 hover:text-white flex items-center gap-2 select-none">
                    <span className="group-open:rotate-90 transition-transform">▶</span>
                    <span>Raw Notes / Source Text</span>
                </summary>
                <div className="whitespace-pre-wrap font-sans text-gray-300 leading-relaxed text-lg mt-4 pl-4 border-l-2 border-gray-600">
                    {note.content}
                </div>
            </details>
        ) : (
            <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700 shadow-lg min-h-[200px]">
                <div className="whitespace-pre-wrap font-sans text-gray-300 leading-relaxed text-lg">
                    {note.content}
                </div>
            </div>
        )}

        {/* 4. GM CONTROL PANEL */}
        {isGM && !note.is_public && (
            <div className="mt-12 bg-black/40 border border-gray-700 p-6 rounded-lg">
                <h3 className="text-gray-400 font-bold uppercase tracking-widest text-sm mb-4 border-b border-gray-800 pb-2">
                    GM Controls: Knowledge Distribution
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {players.map(player => {
                        const isUnlocked = unlocks.has(player.id)
                        return (
                            <div key={player.id} className="flex items-center justify-between bg-gray-900 p-3 rounded border border-gray-800">
                                <div className="truncate">
                                  <span className="text-sm text-gray-100 font-medium">{player.characterName}</span>
                                  <span className="text-xs text-gray-500 ml-2">({player.username})</span>
                                </div>
                                <button
                                    onClick={() => toggleUnlock(player.id, isUnlocked)}
                                    className={`text-xs font-bold px-3 py-1 rounded transition-colors ml-2 ${
                                        isUnlocked 
                                        ? 'bg-green-900/50 text-green-400 border border-green-800 hover:bg-green-900'
                                        : 'bg-red-900/50 text-red-400 border border-red-800 hover:bg-red-900'
                                    }`}
                                >
                                    {isUnlocked ? 'Known' : 'Unknown'}
                                </button>
                            </div>
                        )
                    })}
                    {players.length === 0 && <p className="text-gray-600 text-sm">No active player characters found.</p>}
                </div>
            </div>
        )}

      </div>
    </div>
  )
}
