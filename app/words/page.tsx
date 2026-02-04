'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function WordsOfPower() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isGM, setIsGM] = useState(false)
  const [words, setWords] = useState<any[]>([])
  const [characters, setCharacters] = useState<any[]>([])
  const [characterWords, setCharacterWords] = useState<any[]>([])
  
  // Edit state
  const [editingWordId, setEditingWordId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({ word: '', meaning: '', mana_cost: 0 })
  const [showAddForm, setShowAddForm] = useState(false)
  const [newWordForm, setNewWordForm] = useState({ word: '', meaning: '', mana_cost: 0 })

  useEffect(() => {
    async function init() {
      // Check if user is GM
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

      setIsGM(true)
      await loadData()
      setLoading(false)
    }
    init()
  }, [router])

  async function loadData() {
    // Fetch all words
    const { data: wordsData } = await supabase
      .from('words_of_power')
      .select('*')
      .order('word')
    
    // Fetch all player characters (not NPCs, not tames)
    const { data: charsData } = await supabase
      .from('characters')
      .select('id, name, user_id, profiles(username)')
      .eq('is_npc', false)
      .is('is_tame', false)
      .order('name')
    
    // Fetch all character-word relationships
    const { data: cwData } = await supabase
      .from('character_words')
      .select('character_id, word_id')

    setWords(wordsData || [])
    setCharacters(charsData || [])
    setCharacterWords(cwData || [])
  }

  async function toggleCharacterWord(characterId: string, wordId: string) {
    const existing = characterWords.find(
      cw => cw.character_id === characterId && cw.word_id === wordId
    )

    if (existing) {
      // Remove knowledge
      await supabase
        .from('character_words')
        .delete()
        .eq('character_id', characterId)
        .eq('word_id', wordId)
      
      setCharacterWords(characterWords.filter(
        cw => !(cw.character_id === characterId && cw.word_id === wordId)
      ))
    } else {
      // Grant knowledge
      const { data, error } = await supabase
        .from('character_words')
        .insert({ character_id: characterId, word_id: wordId })
        .select()
        .single()
      
      if (data) {
        setCharacterWords([...characterWords, data])
      } else if (error) {
        alert('Error: ' + error.message)
      }
    }
  }

  function hasWord(characterId: string, wordId: string): boolean {
    return characterWords.some(
      cw => cw.character_id === characterId && cw.word_id === wordId
    )
  }

  async function handleAddWord() {
    if (!newWordForm.word.trim() || !newWordForm.meaning.trim()) {
      alert('Word and meaning are required.')
      return
    }

    const { data, error } = await supabase
      .from('words_of_power')
      .insert({
        word: newWordForm.word.trim(),
        meaning: newWordForm.meaning.trim(),
        mana_cost: parseInt(newWordForm.mana_cost as any) || 0
      })
      .select()
      .single()

    if (error) {
      alert('Error adding word: ' + error.message)
    } else {
      setWords([...words, data].sort((a, b) => a.word.localeCompare(b.word)))
      setNewWordForm({ word: '', meaning: '', mana_cost: 0 })
      setShowAddForm(false)
    }
  }

  async function handleUpdateWord(wordId: string) {
    const { error } = await supabase
      .from('words_of_power')
      .update({
        word: editForm.word.trim(),
        meaning: editForm.meaning.trim(),
        mana_cost: parseInt(editForm.mana_cost) || 0
      })
      .eq('id', wordId)

    if (error) {
      alert('Error updating word: ' + error.message)
    } else {
      setWords(words.map(w => w.id === wordId ? { ...w, ...editForm } : w))
      setEditingWordId(null)
    }
  }

  async function handleDeleteWord(wordId: string) {
    if (!confirm('Delete this word? This will also remove it from all characters.')) {
      return
    }

    const { error } = await supabase
      .from('words_of_power')
      .delete()
      .eq('id', wordId)

    if (error) {
      alert('Error deleting word: ' + error.message)
    } else {
      setWords(words.filter(w => w.id !== wordId))
      setCharacterWords(characterWords.filter(cw => cw.word_id !== wordId))
    }
  }

  function startEdit(word: any) {
    setEditingWordId(word.id)
    setEditForm({ word: word.word, meaning: word.meaning, mana_cost: word.mana_cost })
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-900 text-white p-8 text-center">Loading...</div>
  }

  if (!isGM) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 font-sans">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/" className="text-gray-400 hover:text-white inline-block mb-2">← Back to Dashboard</Link>
          <h1 className="text-4xl font-bold text-purple-500">Words of Power</h1>
          <p className="text-gray-400 mt-2">Manage the spell library and who knows what.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-500 transition font-bold"
        >
          {showAddForm ? 'Cancel' : '+ Add Word'}
        </button>
      </div>

      {/* ADD WORD FORM */}
      {showAddForm && (
        <div className="bg-gray-800 rounded-xl p-6 shadow border border-purple-700 mb-6">
          <h2 className="text-xl font-bold text-purple-400 mb-4">New Word of Power</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-400 uppercase mb-1">Word (Spell)</label>
              <input
                type="text"
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                placeholder="e.g., IGNIS"
                value={newWordForm.word}
                onChange={(e) => setNewWordForm({ ...newWordForm, word: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 uppercase mb-1">Meaning</label>
              <input
                type="text"
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                placeholder="e.g., Fire"
                value={newWordForm.meaning}
                onChange={(e) => setNewWordForm({ ...newWordForm, meaning: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 uppercase mb-1">Mana Cost</label>
              <input
                type="number"
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                value={newWordForm.mana_cost}
                onChange={(e) => setNewWordForm({ ...newWordForm, mana_cost: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <button
            onClick={handleAddWord}
            className="px-6 py-2 rounded bg-green-600 text-white hover:bg-green-500 transition font-bold"
          >
            Create Word
          </button>
        </div>
      )}

      {/* WORDS TABLE */}
      {words.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
          <p className="text-gray-400 text-lg">No words of power yet. Add one to get started!</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl shadow border border-gray-700 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900 border-b border-gray-700">
              <tr>
                <th className="text-left p-4 text-gray-400 uppercase text-xs font-bold w-32">Word</th>
                <th className="text-left p-4 text-gray-400 uppercase text-xs font-bold w-32">Meaning</th>
                <th className="text-center p-4 text-gray-400 uppercase text-xs font-bold w-24">Mana</th>
                {characters.map(char => (
                  <th key={char.id} className="text-center p-2 text-gray-400 text-xs font-bold min-w-[100px]">
                    <div className="truncate" title={char.name}>
                      {char.name}
                    </div>
                  </th>
                ))}
                <th className="text-center p-4 text-gray-400 uppercase text-xs font-bold w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {words.map(word => (
                <tr key={word.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                  {editingWordId === word.id ? (
                    // EDIT MODE
                    <>
                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-sm text-white"
                          value={editForm.word}
                          onChange={(e) => setEditForm({ ...editForm, word: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-sm text-white"
                          value={editForm.meaning}
                          onChange={(e) => setEditForm({ ...editForm, meaning: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-sm text-white text-center"
                          value={editForm.mana_cost}
                          onChange={(e) => setEditForm({ ...editForm, mana_cost: parseInt(e.target.value) || 0 })}
                        />
                      </td>
                      {characters.map(char => (
                        <td key={char.id} className="p-2 text-center">
                          <input
                            type="checkbox"
                            className="w-5 h-5 cursor-pointer"
                            checked={hasWord(char.id, word.id)}
                            onChange={() => toggleCharacterWord(char.id, word.id)}
                          />
                        </td>
                      ))}
                      <td className="p-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => handleUpdateWord(word.id)}
                            className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-500 text-xs font-bold"
                            title="Save"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setEditingWordId(null)}
                            className="px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-500 text-xs font-bold"
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // VIEW MODE
                    <>
                      <td className="p-4">
                        <span className="font-mono text-purple-400 font-bold">{word.word}</span>
                      </td>
                      <td className="p-4 text-gray-300">{word.meaning}</td>
                      <td className="p-4 text-center text-blue-400 font-mono">{word.mana_cost}</td>
                      {characters.map(char => (
                        <td key={char.id} className="p-2 text-center">
                          <input
                            type="checkbox"
                            className="w-5 h-5 cursor-pointer"
                            checked={hasWord(char.id, word.id)}
                            onChange={() => toggleCharacterWord(char.id, word.id)}
                          />
                        </td>
                      ))}
                      <td className="p-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => startEdit(word)}
                            className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 text-xs font-bold"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteWord(word.id)}
                            className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-500 text-xs font-bold"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* LEGEND */}
      <div className="mt-6 bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">How to Use</h3>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>✓ Check a box to grant a character knowledge of that word</li>
          <li>✏️ Click edit to modify word details</li>
          <li>🗑️ Delete removes the word from all characters</li>
          <li>💡 Only player characters (not NPCs or tames) are shown</li>
        </ul>
      </div>
    </div>
  )
}
