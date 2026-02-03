'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function Home() {
  const [characters, setCharacters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [isGM, setIsGM] = useState(false)

  useEffect(() => {
    async function init() {
        // 1. Get Session & Role
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)

        let userIsGM = false
        if (session) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .single()
            
            if (profile && profile.role === 'gm') {
                userIsGM = true
                setIsGM(true)
            }
        }

        // 2. Fetch Characters
        const { data, error } = await supabase.from('characters').select('*')
        if (data) setCharacters(data)
        else console.error(error)
        
        setLoading(false)
    }
    init()
  }, [])

  async function handleSignOut() {
      await supabase.auth.signOut()
      setSession(null)
      setIsGM(false)
  }

  // --- DATA PROCESSING & VISIBILITY FILTER ---
  const filteredCharacters = characters.filter(char => {
      // 1. GM sees everything
      if (isGM) return true;

      // 2. Dead characters (Graveyard) are visible to everyone
      if (char.is_dead) return true;

      // 3. Players see characters assigned to them
      if (session && char.user_id === session.user.id) return true;

      // 4. Players see TAMES assigned to them (Cascading visibility)
      // Note: We need to know who owns the tame.
      // Logic: If char is tame, and its owner (linked via name/job) is assigned to me, show it.
      // Or simpler: The "Assign Owner" logic ALREADY updates the tame's user_id. 
      // So rule #3 covers Tames too!
      
      // Default: Hidden
      return false;
  })

  // --- GROUPING LOGIC (Runs on Filtered List) ---
  const allTames = filteredCharacters.filter(c => c.is_tame)
  const allNonTames = filteredCharacters.filter(c => !c.is_tame)
  const owners = allNonTames.filter(c => !c.is_dead)
  const graveyard = allNonTames.filter(c => c.is_dead)

  owners.forEach(owner => {
      const myTames = allTames.filter(t => 
          (t.player_name && t.player_name === owner.name) || 
          (t.job && owner.name.startsWith(t.job)) 
      );
      owner.tames = myTames.sort((a, b) => {
          if (a.is_dead === b.is_dead) return 0;
          return a.is_dead ? 1 : -1; 
      });
  });

  const parties: Record<string, any[]> = {}
  const unaffiliated: any[] = []

  owners.forEach(char => {
      if (char.party) {
          if (!parties[char.party]) parties[char.party] = [];
          parties[char.party].push(char);
      } else {
          unaffiliated.push(char);
      }
  });

  return (
    <main className="min-h-screen p-8 bg-gray-900 text-white font-sans">
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-4xl font-bold mb-4 text-center text-red-500 font-mono">
            BASEMENT_OS
        </h1>
        
        {/* AUTH HEADER */}
        {loading ? (
            <div className="h-8"></div>
        ) : session ? (
            <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>Logged in as <span className="text-white">{session.user.email}</span></span>
                {isGM && <span className="bg-red-900 text-red-200 text-xs px-2 py-1 rounded border border-red-700">GM</span>}
                <button onClick={handleSignOut} className="text-red-400 hover:text-red-300 underline">Sign Out</button>
            </div>
        ) : (
            <Link href="/login" className="text-blue-400 hover:text-blue-300 underline text-sm">
                Log In / Sign Up
            </Link>
        )}
      </div>

      <div className="flex justify-center gap-4 mb-8">
        <a href="/wiki" className="bg-gray-800 border border-gray-600 px-6 py-2 rounded hover:bg-gray-700 hover:border-red-500 transition-colors text-gray-300 font-bold flex items-center gap-2">
            <span>📖</span> Open Wiki
        </a>
        
        {isGM && (
            <a href="/create" className="bg-blue-900 border border-blue-700 px-6 py-2 rounded hover:bg-blue-800 transition-colors text-blue-200 font-bold flex items-center gap-2">
                <span>+</span> New Character
            </a>
        )}
      </div>

      {loading && <p className="text-center text-gray-500 animate-pulse">Loading Party Data...</p>}

      {/* --- PARTIES --- */}
      <div className="space-y-12">
        {Object.entries(parties).map(([partyName, members]) => (
            <div key={partyName}>
                <h2 className="text-2xl font-bold text-gray-400 mb-4 border-b border-gray-800 pb-2 flex items-center gap-3">
                    <span className="text-xl">🛡️</span> {partyName}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {members.map(char => <CharacterCard key={char.id} char={char} />)}
                </div>
            </div>
        ))}

        {/* --- UNAFFILIATED --- */}
        {unaffiliated.length > 0 && (
            <div>
                <h2 className="text-2xl font-bold text-gray-500 mb-4 border-b border-gray-800 pb-2">Unaffiliated</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {unaffiliated.map(char => <CharacterCard key={char.id} char={char} />)}
                </div>
            </div>
        )}
      </div>

      {/* --- GRAVEYARD (PCs/NPCs Only) --- */}
      {graveyard.length > 0 && (
          <div className="mt-16 border-t border-gray-800 pt-8">
            <h2 className="text-2xl font-bold text-gray-600 text-center mb-6 uppercase tracking-widest flex items-center justify-center gap-4">
                <span>🪦</span> Graveyard <span>🪦</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 opacity-75 grayscale hover:grayscale-0 transition-all duration-500">
                {graveyard.map(char => (
                    <Link href={`/character/${char.id}`} key={char.id} className="block group">
                        <div className="bg-gray-900 border border-gray-800 p-4 rounded-lg hover:border-gray-600 transition-colors">
                            <h3 className="font-bold text-gray-500 group-hover:text-gray-300">{char.name}</h3>
                            <p className="text-xs text-gray-600">Level {char.level} {char.job}</p>
                        </div>
                    </Link>
                ))}
            </div>
          </div>
      )}
    </main>
  )
}

function CharacterCard({ char }: { char: any }) {
    return (
        <div className="flex flex-col gap-2">
            {/* MAIN CARD */}
            <Link href={`/character/${char.id}`} className="block group">
                <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg shadow-lg group-hover:border-red-500 transition-all transform group-hover:-translate-y-1 relative overflow-hidden">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-bold text-white group-hover:text-red-400 transition-colors">{char.name}</h2>
                    <span className={`text-xs px-2 py-1 rounded ${char.type === 'PC' || char.tags?.includes('Player') ? 'bg-blue-900 text-blue-200' : 'bg-green-900 text-green-200'}`}>
                    {char.type || (char.is_npc ? 'NPC' : 'PC')}
                    </span>
                </div>
                <p className="text-gray-400 text-sm mb-4">{char.job || 'Unknown'} - Level {char.level}</p>
                
                <div className="space-y-2">
                    <div className="flex justify-between text-xs uppercase text-gray-500">
                        <span>HP</span>
                        <span>{char.hp_current}/{char.hp_max}</span>
                    </div>
                    <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                        <div 
                            className="bg-red-600 h-full" 
                            style={{ width: `${Math.min(100, (char.hp_current / char.hp_max) * 100 || 0)}%` }}
                        />
                    </div>
                </div>
                </div>
            </Link>

            {/* ATTACHED TAMES */}
            {char.tames && char.tames.length > 0 && (
                <div className="pl-6 border-l-2 border-gray-700 space-y-2">
                    {char.tames.map((tame: any) => (
                        <Link href={`/character/${tame.id}`} key={tame.id} className="block group">
                            <div className={`
                                bg-gray-800/60 border border-gray-700 p-3 rounded-r-lg hover:border-green-500 transition-colors flex justify-between items-center
                                ${tame.is_dead ? 'opacity-50 grayscale hover:opacity-100 hover:grayscale-0' : ''}
                            `}>
                                <div>
                                    <div className={`text-sm font-bold flex items-center gap-2 ${tame.is_dead ? 'text-gray-500' : 'text-gray-300 group-hover:text-green-400'}`}>
                                        <span>{tame.is_dead ? '🪦' : '🐾'}</span> {tame.name}
                                    </div>
                                    <div className="text-xs text-gray-500 capitalize">{tame.species || 'Tame'}</div>
                                </div>
                                <div className="w-16">
                                    <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden">
                                        <div 
                                            className={tame.is_dead ? "bg-gray-600 h-full" : "bg-green-600 h-full"}
                                            style={{ width: `${Math.min(100, (tame.hp_current / tame.hp_max) * 100 || 0)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
