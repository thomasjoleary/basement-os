'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null)

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })
      if (error) {
        setMessage({ text: error.message, type: 'error' })
      } else {
        setMessage({ text: 'Check your email for the confirmation link!', type: 'success' })
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        setMessage({ text: error.message, type: 'error' })
      } else {
        router.push('/')
        router.refresh()
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <Link href="/" className="mb-8 text-gray-500 hover:text-white transition">← Back to Basement</Link>
      
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl border border-gray-700 shadow-2xl">
        <h1 className="text-3xl font-bold text-center mb-2 text-red-500 font-mono">
          {isSignUp ? 'JOIN THE PARTY' : 'IDENTIFY YOURSELF'}
        </h1>
        <p className="text-center text-gray-400 mb-8 text-sm">
          {isSignUp ? 'Create a new profile to track your journey.' : 'Log in to access your character sheet.'}
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs uppercase text-gray-500 mb-1">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full bg-gray-900 border border-gray-600 rounded p-3 focus:border-red-500 outline-none transition"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-gray-500 mb-1">Password</label>
            <input 
              type="password" 
              required
              className="w-full bg-gray-900 border border-gray-600 rounded p-3 focus:border-red-500 outline-none transition"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
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
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Log In')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          {isSignUp ? 'Already have an account?' : "Don't have a profile yet?"}
          <button 
            onClick={() => { setIsSignUp(!isSignUp); setMessage(null); }}
            className="ml-2 text-blue-400 hover:underline"
          >
            {isSignUp ? 'Log In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  )
}
