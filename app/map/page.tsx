'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import MapViewer from '@/components/map/MapViewer'
import Link from 'next/link'

export default function MapPage() {
  const [session, setSession] = useState<any>(null)
  const [isGM, setIsGM] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)

      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        
        if (profile && profile.role === 'gm') {
          setIsGM(true)
        }
      }
      
      setLoading(false)
    }
    init()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-xl animate-pulse">Loading map...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link 
            href="/" 
            className="text-gray-400 hover:text-white transition flex items-center gap-2"
          >
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-red-500 font-mono">CAMPAIGN MAP</h1>
        </div>
        
        <div className="flex items-center gap-3">
          {session && (
            <div className="text-sm text-gray-400">
              {session.user.email}
              {isGM && (
                <span className="ml-2 bg-red-900/80 text-red-200 text-xs px-2 py-1 rounded border border-red-700 font-bold">
                  GM
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Map Viewer */}
      <MapViewer isGM={isGM} />
    </main>
  )
}
