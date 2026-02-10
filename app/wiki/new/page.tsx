'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function CreateLore() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isGM, setIsGM] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState<'class' | 'monster' | 'lore' | 'system'>('lore')
  const [tags, setTags] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  useEffect(() => {
    async function checkAuth() {
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

      if (profile?.role !== 'gm') {
        router.push('/wiki')
        return
      }

      setIsGM(true)
      setLoading(false)
    }
    checkAuth()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      // Parse tags (comma or space separated)
      const tagArray = tags
        .split(/[\s,]+/)
        .map(t => t.trim())
        .filter(t => t.length > 0)

      const { error } = await supabase
        .from('notes')
        .insert({
          title: title.trim(),
          content: content.trim(),
          type,
          tags: tagArray.length > 0 ? tagArray : null,
          is_public: isPublic,
          data: {}
        })

      if (error) throw error

      router.push('/wiki')
    } catch (error) {
      console.error('Error creating lore:', error)
      alert('Failed to create lore. Please try again.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-gray-500">Authenticating...</div>
        </div>
      </div>
    )
  }

  if (!isGM) return null

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 font-sans">
      <Link href="/wiki" className="text-gray-400 hover:text-white mb-6 inline-block">
        ← Back to Wiki
      </Link>

      <div className="max-w-3xl mx-auto">
        <div className="border-b border-gray-700 pb-4 mb-8">
          <h1 className="text-4xl font-bold text-red-500 font-mono">CREATE NEW LORE</h1>
          <p className="text-gray-400 mt-2">Add new knowledge to the Archive</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 rounded focus:outline-none focus:border-red-500 transition-colors"
              placeholder="Name of the lore entry..."
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">
              Category *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('lore')}
                className={`px-4 py-3 rounded border transition-colors ${
                  type === 'lore'
                    ? 'bg-gray-700 border-gray-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                Lore
              </button>
              <button
                type="button"
                onClick={() => setType('class')}
                className={`px-4 py-3 rounded border transition-colors ${
                  type === 'class'
                    ? 'bg-blue-900 border-blue-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                Class
              </button>
              <button
                type="button"
                onClick={() => setType('monster')}
                className={`px-4 py-3 rounded border transition-colors ${
                  type === 'monster'
                    ? 'bg-red-900 border-red-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                Monster
              </button>
              <button
                type="button"
                onClick={() => setType('system')}
                className={`px-4 py-3 rounded border transition-colors ${
                  type === 'system'
                    ? 'bg-purple-900 border-purple-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                System
              </button>
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">
              Description *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={12}
              className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 rounded focus:outline-none focus:border-red-500 transition-colors font-mono text-sm resize-y"
              placeholder="Enter the lore content..."
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">
              Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 rounded focus:outline-none focus:border-red-500 transition-colors"
              placeholder="combat, magic, ancient (comma or space separated)"
            />
            <p className="text-xs text-gray-500 mt-1">Separate tags with commas or spaces</p>
          </div>

          {/* Public Toggle */}
          <div className="bg-gray-800 border border-gray-700 p-4 rounded">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-5 h-5 bg-gray-700 border-gray-600 rounded focus:ring-2 focus:ring-red-500"
              />
              <div>
                <span className="font-bold text-gray-200">Make Public</span>
                <p className="text-xs text-gray-500">
                  If checked, all players can see this lore immediately
                </p>
              </div>
            </label>
          </div>

          {/* Submit */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded transition-colors uppercase tracking-wider"
            >
              {saving ? 'Creating...' : 'Create Lore'}
            </button>
            <Link
              href="/wiki"
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded transition-colors text-center uppercase tracking-wider"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
