'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function BasementOSv2() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (!profile || profile.role !== 'gm') {
        alert('Access denied. GM only.')
        router.push('/')
        return
      }

      setLoading(false)
    }
    init()
  }, [router])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-900 text-white font-sans">
        <p className="text-gray-500 animate-pulse">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8 bg-gray-900 text-white font-sans relative">
      <div className="flex justify-end mb-4 md:absolute md:top-6 md:right-8 z-10">
        <Link
          href="/"
          className="bg-gray-800 border border-gray-700 px-4 py-2 rounded-full text-gray-400 hover:text-white hover:border-gray-500 transition text-xs font-bold uppercase tracking-wide"
        >
          ← Back to Basement OS
        </Link>
      </div>

      <div className="flex flex-col items-center mb-12 mt-4 md:mt-0">
        <span className="text-xs uppercase tracking-widest text-red-500/70 font-bold mb-2">Private Preview</span>
        <h1 className="text-5xl font-bold mb-2 text-center text-red-500 font-mono tracking-tighter drop-shadow-[0_2px_10px_rgba(220,38,38,0.5)]">
          BASEMENT_OS <span className="text-gray-500">v2</span>
        </h1>
        <div className="h-1 w-32 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50"></div>
      </div>

      <div className="flex justify-center gap-4 mb-10 flex-wrap">
        <Link
          href="/v2/galaxy"
          className="bg-indigo-900 border border-indigo-700 px-6 py-2 rounded hover:bg-indigo-800 transition-colors text-indigo-200 font-bold flex items-center gap-2"
        >
          <span>🌌</span> Galaxy Map
        </Link>
      </div>

      <div className="max-w-xl mx-auto text-center">
        <p className="text-gray-400">
          This is the new version of Basement OS, under construction. Only you can see this page for now —
          it isn&apos;t linked from anywhere else and it isn&apos;t the login home page yet.
        </p>
      </div>
    </main>
  )
}
