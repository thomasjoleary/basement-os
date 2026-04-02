'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null)

  // Supabase fires a PASSWORD_RECOVERY event when the user arrives via the
  // reset link — this means the session is live and we can call updateUser.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    // Also check if a session is already active (e.g. page was refreshed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setMessage({ text: 'Passwords do not match.', type: 'error' })
      return
    }
    if (password.length < 6) {
      setMessage({ text: 'Password must be at least 6 characters.', type: 'error' })
      return
    }
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setMessage({ text: error.message, type: 'error' })
    } else {
      setMessage({ text: 'Password updated! Redirecting to login…', type: 'success' })
      setTimeout(() => router.push('/login'), 2000)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <Link href="/login" className="mb-8 text-gray-500 hover:text-white transition">← Back to Login</Link>

      <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl border border-gray-700 shadow-2xl">
        <h1 className="text-3xl font-bold text-center mb-2 text-red-500 font-mono">
          REFORGE YOUR KEY
        </h1>
        <p className="text-center text-gray-400 mb-8 text-sm">
          Choose a new password for your account.
        </p>

        {!ready ? (
          <p className="text-center text-gray-500 text-sm">
            Verifying your reset link… if this takes a while, try clicking the link in your email again.
          </p>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-xs uppercase text-gray-500 mb-1">New Password</label>
              <input
                type="password"
                required
                minLength={6}
                className="w-full bg-gray-900 border border-gray-600 rounded p-3 focus:border-red-500 outline-none transition"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs uppercase text-gray-500 mb-1">Confirm Password</label>
              <input
                type="password"
                required
                minLength={6}
                className="w-full bg-gray-900 border border-gray-600 rounded p-3 focus:border-red-500 outline-none transition"
                placeholder="••••••••"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
              />
            </div>

            {message && (
              <div className={`p-3 rounded text-sm text-center ${message.type === 'error' ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'}`}>
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded transition mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating…' : 'Set New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
