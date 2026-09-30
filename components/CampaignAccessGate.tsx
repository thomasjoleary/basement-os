'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Access = { status: 'loading' | 'login' | 'pending' | 'approved' | 'error'; isGM?: boolean; message?: string }
export default function CampaignAccessGate({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const isPublic = path === '/login' || path === '/reset-password'
  return isPublic ? children : <ProtectedCampaign>{children}</ProtectedCampaign>
}
function ProtectedCampaign({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<Access>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true, request = 0
    let currentAccount: string | null | undefined
    async function refresh() {
      const current = ++request
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (!active || current !== request) return
      currentAccount = session?.user.id ?? null
      if (sessionError) { setAccess({ status: 'error', message: 'Could not verify your session. Try again.' }); return }
      if (!session) { setAccess({ status: 'login' }); return }
      const { data, error } = await supabase.rpc('campaign_access_status')
      if (!active || current !== request) return
      if (error || !data || !['approved', 'pending'].includes(data.status)) {
        setAccess({ status: 'error', message: error?.code === 'PGRST202'
          ? 'Registration approval setup is not available yet. Ask the GM to finish setup, then try again.'
          : 'Could not verify campaign approval. Try again.' })
        return
      }
      setAccess({ status: data.status, isGM: data.is_gm === true })
    }
    void refresh()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      request++
      const nextAccount = session?.user.id ?? null
      if (currentAccount !== nextAccount) setAccess({ status: 'loading' })
      currentAccount = nextAccount
      // Do not await Supabase requests inside the auth-state callback.
      queueMicrotask(() => { if (active) void refresh() })
    })
    const recheck = () => { if (document.visibilityState === 'visible') void refresh() }
    const interval = window.setInterval(recheck, 15000)
    window.addEventListener('focus', recheck)
    return () => { active = false; request++; subscription.unsubscribe(); window.clearInterval(interval); window.removeEventListener('focus', recheck) }
  }, [attempt])
  if (access.status === 'approved') return <>
    {access.isGM && <nav aria-label="GM administration" className="bg-gray-950 text-cyan-300 text-sm px-4 py-2 text-right"><Link href="/approvals">Registration approvals</Link></nav>}
    {children}
  </>
  return <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
    <section className="max-w-lg rounded-xl border border-gray-700 bg-gray-800 p-6 space-y-4">
      <h1 className="text-xl font-bold">{access.status === 'pending' ? 'Waiting for GM approval' : access.status === 'login' ? 'Sign in to Basement OS' : access.status === 'error' ? 'Campaign access unavailable' : 'Checking campaign access…'}</h1>
      {access.status === 'pending' && <p>Your account is registered. A GM must approve it before you can access the campaign. This page checks automatically; you can also check again.</p>}
      {access.status === 'error' && <p role="alert">{access.message}</p>}
      {access.status === 'login' ? <Link href="/login" className="inline-block rounded bg-cyan-800 px-4 py-2">Sign in or request access</Link> : access.status !== 'loading' && <div className="flex flex-wrap gap-3">
        <button onClick={() => setAttempt(n => n + 1)} className="rounded bg-cyan-800 px-4 py-2">Check again</button>
        <button onClick={async () => { await supabase.auth.signOut(); setAccess({ status: 'login' }) }} className="rounded border border-gray-600 px-4 py-2">Sign out</button>
      </div>}
    </section>
  </main>
}
