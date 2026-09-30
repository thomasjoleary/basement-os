'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Request = { id: string; username: string; email: string; created_at: string }
export default function RegistrationApprovals() {
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(''), [selected, setSelected] = useState<Request | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const lock = useRef(false)
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_registration_requests')
    setLoading(false)
    if (error) { setAuthorized(false); setRequests([]); setMessage(error.code === '42501' ? 'Only approved GMs can review registrations.' : 'Could not load requests. Try refreshing.'); return }
    setAuthorized(true); setRequests(data ?? [])
  }, [])
  useEffect(() => {
    let active = true
    void supabase.rpc('list_registration_requests').then(({ data, error }) => {
      if (!active) return
      setLoading(false)
      if (error) { setAuthorized(false); setMessage(error.code === '42501' ? 'Only approved GMs can review registrations.' : 'Could not load requests. Try refreshing.'); return }
      setAuthorized(true); setRequests(data ?? [])
    })
    return () => { active = false }
  }, [])
  async function approve() {
    if (!selected || lock.current) return
    lock.current = true; setBusy(true); setMessage('')
    const { data, error } = await supabase.rpc('approve_registration', { profile_id: selected.id })
    if (error) setMessage('Approval failed. No approval was confirmed; try again.')
    else { setSelected(null); await load(); setMessage(data ? 'Account approved.' : 'This request was already approved or is no longer available.') }
    setBusy(false); lock.current = false
  }
  return <main className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
    <div className="max-w-3xl mx-auto space-y-5">
      <Link href="/" className="text-cyan-300">Back to Basement OS</Link>
      <h1 className="text-2xl font-bold">Registration approvals</h1>
      <p className="text-gray-400">Approve only people you recognize. Approval grants normal player access; it does not make someone a GM.</p>
      {message && <p role="status">{message}</p>}
      {loading ? <p>Loading requests…</p> : authorized && <>
        <button disabled={busy} onClick={() => { setMessage(''); void load() }} className="rounded border border-gray-600 px-4 py-2">Refresh requests</button>
        {!requests.length && <p>No registrations are waiting for approval.</p>}
        {requests.map(request => <article key={request.id} className="min-w-0 border border-gray-700 rounded-xl p-4 space-y-2 [overflow-wrap:anywhere]">
          <h2 className="font-semibold">{request.username || 'Unnamed account'}</h2>
          <p>{request.email}</p><p className="text-sm text-gray-400">Registered {new Date(request.created_at).toLocaleString()}</p>
          <button disabled={busy} onClick={() => { setMessage(''); setSelected(request) }} className="rounded bg-cyan-800 px-4 py-2">Review {request.username || request.email}</button>
        </article>)}
      </>}
      {selected && <section role="dialog" aria-modal="false" aria-labelledby="approval-review" className="border border-cyan-700 rounded-xl p-5 bg-gray-800 space-y-4 [overflow-wrap:anywhere]">
        <h2 id="approval-review" className="font-semibold">Approve this registration?</h2>
        <p>{selected.username} — {selected.email}</p>
        <p>This person will be able to access the campaign as a player.</p>
        <div className="flex flex-wrap gap-3">
          <button disabled={busy} onClick={approve} className="rounded bg-cyan-700 px-4 py-2">{busy ? 'Approving…' : 'Approve player'}</button>
          <button disabled={busy} onClick={() => setSelected(null)} className="rounded border border-gray-600 px-4 py-2">Cancel</button>
        </div>
      </section>}
    </div>
  </main>
}
