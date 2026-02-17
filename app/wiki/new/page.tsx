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
  const [userId, setUserId] = useState<string | null>(null)

  // Form fields
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState<'class' | 'monster' | 'lore' | 'system'>('lore')
  const [tags, setTags] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [characterName, setCharacterName] = useState('')

  // For player character dropdown
  const [playerCharacters, setPlayerCharacters] = useState<any[]>([])

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      setUserId(session.user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      const userIsGM = profile?.role === 'gm'
      setIsGM(userIsGM)

      // If player, load their characters for dropdown
      if (!userIsGM) {
        const { data: chars } = await supabase
          .from('characters')
          .select('id, name')
          .eq('user_id', session.user.id)
          .eq('is_tame', false)
          .eq('is_npc', false)
          .order('name')

        if (chars) setPlayerCharacters(chars)
      }

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

      const noteData: any = {
        title: title.trim(),
        content: content.trim(),
        type,
        tags: tagArray.length > 0 ? tagArray : null,
        is_public: isPublic,
        data: {}
      }

      // Add created_by for player notes (GMs can create lore without creator)
      if (!isGM && userId) {
        noteData.created_by = userId
        noteData.character_name = characterName || null
      }

      const { error } = await supabase
        .from('notes')
        .insert(noteData)

      if (error) throw error

      router.push('/wiki')
    } catch (error) {
      console.error('Error creating note:', error)
      alert('Failed to create note. Please try again.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-gray-500">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 font-sans">
      <Link href="/wiki" className="text-gray-400 hover:text-white mb-6 inline-block">
        ← Back to Wiki
      </Link>

      <div className="max-w-3xl mx-auto">
        <div className="border-b border-gray-700 pb-4 mb-8">
          <h1 className="text-4xl font-bold text-red-500 font-mono">
            {isGM ? 'CREATE NEW LORE' : 'CREATE NOTE'}
          </h1>
          <p className="text-gray-400 mt-2">
            {isGM ? 'Add new knowledge to the Archive' : 'Write your character notes and observations'}
          </p>
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
              placeholder={isGM ? "Name of the lore entry..." : "Note title..."}
            />
          </div>

          {/* Character Name (for players only) */}
          {!isGM && (
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">
                Character
              </label>
              <select
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 rounded focus:outline-none focus:border-red-500 transition-colors"
              >
                <option value="">None (General Notes)</option>
                {playerCharacters.map(char => (
                  <option key={char.id} value={char.name}>{char.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Categorizes this note under a specific character
              </p>
            </div>
          )}

          {/* Type (GM only) */}
          {isGM && (
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
          )}

          {/* Content */}
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">
              {isGM ? 'Description *' : 'Content *'}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={12}
              className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 rounded focus:outline-none focus:border-red-500 transition-colors font-mono text-sm resize-y"
              placeholder={isGM ? "Enter the lore content..." : "Write your notes here..."}
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
                  {isGM 
                    ? 'If checked, all players can see this lore immediately'
                    : 'If checked, all players can see this note. Otherwise, only you and the GM can see it.'}
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
              {saving ? 'Creating...' : (isGM ? 'Create Lore' : 'Create Note')}
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
