'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Holy', 'Unique', 'Demonic'];

function getRarityColor(rarity: string): string {
    const r = rarity ? rarity.toLowerCase() : 'common';
    switch (r) {
        case 'common': return 'text-gray-300';
        case 'uncommon': return 'text-green-400';
        case 'rare': return 'text-blue-400';
        case 'very rare': return 'text-purple-400';
        case 'legendary': return 'text-orange-400';
        case 'holy': return 'text-yellow-200';
        case 'unique': return 'text-pink-400';
        case 'demonic': return 'text-red-600';
        default: return 'text-gray-300';
    }
}

export default function CharacterDetail() {
  const { id } = useParams()
  const router = useRouter()
  const [char, setChar] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [isGM, setIsGM] = useState(false)
  const [profiles, setProfiles] = useState<any[]>([]) 
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<any>(null)

  useEffect(() => {
    async function init() {
      // 1. Get Session & Role
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      
      let userIsGM = false
      if (session) {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
          if (profile && profile.role === 'gm') {
              userIsGM = true
              setIsGM(true)
          }
      }

      // 2. Get Character
      const { data, error } = await supabase
        .from('characters')
        .select('*, profiles(username)') 
        .eq('id', id)
        .single()
      
      if (error) console.error(error)
      else {
        setChar(data)
        setFormData(data)
      }

      // 3. If GM, fetch all profiles for assignment dropdown
      if (userIsGM) {
          const { data: allProfiles } = await supabase.from('profiles').select('id, username').order('username')
          if (allProfiles) setProfiles(allProfiles)
      }

      setLoading(false)
    }
    if (id) init()
  }, [id])

  async function handleSave() {
    const { error } = await supabase
        .from('characters')
        .update({
            hp_current: parseInt(formData.hp_current),
            hp_max: parseInt(formData.hp_max),
            xp_current: parseInt(formData.xp_current),
            xp_max: parseInt(formData.xp_max),
            level: parseInt(formData.level),
            stats: formData.stats,
            inventory: formData.inventory,
            abilities: formData.abilities,
            skills: formData.skills
        })
        .eq('id', id)

    if (error) {
        alert('Error saving: ' + error.message)
    } else {
        setChar(formData) 
        setIsEditing(false)
    }
  }

  async function handleAssignOwner(newUserId: string) {
      const val = newUserId === 'none' ? null : newUserId;
      
      // 1. Update the Main Character
      const { error } = await supabase
        .from('characters')
        .update({ user_id: val })
        .eq('id', id)

      if (error) {
          alert('Error assigning owner: ' + error.message)
          return;
      }

      // 2. Update Associated Tames (Cascade)
      // Logic: Update ALL characters where is_tame is true AND (player_name == thisChar.name OR job starts with thisChar.name)
      // Note: Supabase JS client doesn't support complex OR filters easily in update, so we fetch IDs first.
      
      const firstName = char.name.split(' ')[0];
      
      const { data: tamesToUpdate } = await supabase
        .from('characters')
        .select('id')
        .eq('is_tame', true)
        .or(`player_name.eq.${char.name},job.ilike.${firstName}%`) // Tame Linking Logic

      if (tamesToUpdate && tamesToUpdate.length > 0) {
          const tameIds = tamesToUpdate.map(t => t.id);
          await supabase
            .from('characters')
            .update({ user_id: val })
            .in('id', tameIds)
          
          console.log(`Updated ${tameIds.length} tames to new owner.`);
      }

      // Update local state
      const newOwnerProfile = profiles.find(p => p.id === val)
      setChar({ ...char, user_id: val, profiles: newOwnerProfile ? { username: newOwnerProfile.username } : null })
      alert(`Assigned ${char.name} (and linked tames) successfully.`)
  }

  // --- HANDLERS ---

  function handleStatChange(key: string, value: string) {
    setFormData({
        ...formData,
        stats: {
            ...formData.stats,
            [key]: parseInt(value) || 0
        }
    })
  }

  function handleInventoryChange(index: number, field: string, value: string) {
    const newInventory = [...formData.inventory]
    newInventory[index] = { ...newInventory[index], [field]: value }
    setFormData({ ...formData, inventory: newInventory })
  }

  function handleAddItem() {
    const newItem = { name: "New Item", rarity: "Common", description: "" }
    setFormData({ ...formData, inventory: [...(formData.inventory || []), newItem] })
  }

  function handleRemoveItem(index: number) {
    const newInventory = [...formData.inventory]
    newInventory.splice(index, 1)
    setFormData({ ...formData, inventory: newInventory })
  }

  function handleAbilityChange(index: number, field: string, value: string) {
    const newAbilities = [...(formData.abilities || [])]
    newAbilities[index] = { ...newAbilities[index], [field]: value }
    setFormData({ ...formData, abilities: newAbilities })
  }

  function handleAddAbility() {
    const newAbility = { name: "New Ability", rarity: "Common", description: "", level: null, type: "" }
    setFormData({ ...formData, abilities: [...(formData.abilities || []), newAbility] })
  }

  function handleRemoveAbility(index: number) {
    const newAbilities = [...(formData.abilities || [])]
    newAbilities.splice(index, 1)
    setFormData({ ...formData, abilities: newAbilities })
  }

  function handleSkillChange(index: number, field: string, value: string) {
    const newSkills = [...(formData.skills || [])]
    newSkills[index] = { ...newSkills[index], [field]: field === 'level' ? parseInt(value) || 0 : value }
    setFormData({ ...formData, skills: newSkills })
  }

  function handleAddSkill() {
    const newSkill = { name: "New Skill", level: 1 }
    setFormData({ ...formData, skills: [...(formData.skills || []), newSkill] })
  }

  function handleRemoveSkill(index: number) {
    const newSkills = [...(formData.skills || [])]
    newSkills.splice(index, 1)
    setFormData({ ...formData, skills: newSkills })
  }

  if (loading) return <div className="min-h-screen bg-gray-900 text-white p-8 text-center">Loading...</div>
  if (!char) return <div className="min-h-screen bg-gray-900 text-white p-8 text-center">Character not found.</div>

  const displayData = isEditing ? formData : char
  
  const canEdit = isGM // ONLY GMs can edit characters

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 font-sans">
      <div className="flex justify-between items-center mb-6">
        <Link href="/" className="text-gray-400 hover:text-white inline-block">← Back to Dashboard</Link>
        <div className="flex gap-2">
            {isEditing ? (
                <>
                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-500 transition font-bold">Save Changes</button>
                </>
            ) : canEdit && (
                <button onClick={() => setIsEditing(true)} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 transition flex items-center gap-2">
                    <span>✏️</span> Edit Sheet
                </button>
            )}
        </div>
      </div>

      {/* HEADER */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-xl border border-gray-700 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-red-500">{char.name}</h1>
            <div className="text-xl text-gray-300 mt-1 flex items-center gap-2">
              <span>Level</span>
              {isEditing ? (
                  <input 
                    type="number" 
                    className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-center"
                    value={formData.level}
                    onChange={(e) => setFormData({...formData, level: e.target.value})}
                  />
              ) : (
                  <span>{char.level}</span>
              )}
              <span className="text-gray-500">•</span> {char.job || 'Jobless'} 
              {char.is_npc && <span className="ml-2 bg-gray-700 text-xs px-2 py-1 rounded">NPC</span>}
            </div>
            
            {/* GM ONLY: OWNER ASSIGNMENT */}
            {isGM && (
                <div className="mt-4 flex items-center gap-2 bg-black/30 p-2 rounded w-fit border border-gray-700">
                    <span className="text-xs uppercase text-gray-500 font-bold">Assigned To:</span>
                    <select 
                        className="bg-transparent text-sm text-blue-300 outline-none cursor-pointer"
                        value={char.user_id || 'none'}
                        onChange={(e) => handleAssignOwner(e.target.value)}
                    >
                        <option value="none">Unclaimed (Public)</option>
                        {profiles.map(p => (
                            <option key={p.id} value={p.id}>{p.username}</option>
                        ))}
                    </select>
                </div>
            )}
          </div>
          
          <div className="flex flex-col items-end gap-2 w-full md:w-auto">
             {/* HP BAR */}
             <div className="w-full md:w-64">
                <div className="flex justify-between text-xs uppercase font-bold text-gray-400 mb-1 items-center">
                    <span>HP</span>
                    {isEditing ? (
                        <div className="flex items-center gap-1">
                            <input 
                                type="number" 
                                className="w-16 bg-gray-900 border border-gray-600 rounded px-1 text-right"
                                value={formData.hp_current}
                                onChange={(e) => setFormData({...formData, hp_current: e.target.value})}
                            />
                            <span>/</span>
                            <input 
                                type="number" 
                                className="w-16 bg-gray-900 border border-gray-600 rounded px-1"
                                value={formData.hp_max}
                                onChange={(e) => setFormData({...formData, hp_max: e.target.value})}
                            />
                        </div>
                    ) : (
                        <span>{char.hp_current} / {char.hp_max}</span>
                    )}
                </div>
                <div className="w-full bg-gray-900 h-4 rounded-full overflow-hidden border border-gray-600">
                    <div 
                        className="bg-red-600 h-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, (displayData.hp_current / displayData.hp_max) * 100 || 0)}%` }}
                    />
                </div>
             </div>
             {/* XP BAR */}
             <div className="w-full md:w-64">
                <div className="flex justify-between text-xs uppercase font-bold text-gray-400 mb-1 items-center">
                    <span>XP</span>
                    {isEditing ? (
                        <div className="flex items-center gap-1">
                            <input 
                                type="number" 
                                className="w-20 bg-gray-900 border border-gray-600 rounded px-1 text-right"
                                value={formData.xp_current}
                                onChange={(e) => setFormData({...formData, xp_current: e.target.value})}
                            />
                            <span>/</span>
                            <input 
                                type="number" 
                                className="w-20 bg-gray-900 border border-gray-600 rounded px-1"
                                value={formData.xp_max}
                                onChange={(e) => setFormData({...formData, xp_max: e.target.value})}
                            />
                        </div>
                    ) : (
                        <span>{char.xp_current} / {char.xp_max}</span>
                    )}
                </div>
                <div className="w-full bg-gray-900 h-2 rounded-full overflow-hidden border border-gray-600">
                    <div 
                        className="bg-blue-500 h-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, (displayData.xp_current / displayData.xp_max) * 100 || 0)}%` }}
                    />
                </div>
             </div>
          </div>
        </div>
        
        {/* TAGS */}
        <div className="flex flex-wrap gap-2 mt-4">
            {char.tags && char.tags.map((tag: string) => (
                <span key={tag} className="text-xs bg-gray-900 border border-gray-600 px-2 py-1 rounded text-gray-400">
                    #{tag}
                </span>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Stats & Abilities */}
        <div className="space-y-6">
            
            {/* STATS */}
            <div className="bg-gray-800 rounded-xl p-6 shadow border border-gray-700">
                <h2 className="text-xl font-bold text-gray-200 mb-4 border-b border-gray-700 pb-2">Stats</h2>
                <div className="grid grid-cols-2 gap-4">
                    {Object.entries(displayData.stats || {}).map(([key, val]: [string, any]) => (
                        <div key={key} className="bg-gray-900 p-3 rounded text-center">
                            <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">{key}</div>
                            {isEditing ? (
                                <input 
                                    type="number" 
                                    className="w-full bg-black border border-gray-600 rounded text-center font-mono font-bold text-white py-1"
                                    value={val}
                                    onChange={(e) => handleStatChange(key, e.target.value)}
                                />
                            ) : (
                                <div className="text-2xl font-mono font-bold text-white">{val}</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* SKILLS */}
            <div className="bg-gray-800 rounded-xl p-6 shadow border border-gray-700">
                <h2 className="text-xl font-bold text-gray-200 mb-4 border-b border-gray-700 pb-2">Skills</h2>
                
                {isEditing ? (
                    // EDIT MODE SKILLS
                    <div className="space-y-2">
                        {formData.skills && formData.skills.map((skill: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 bg-gray-900 p-2 rounded border border-gray-600">
                                <input 
                                    className="flex-1 bg-black text-white px-2 py-1 rounded border border-gray-700 text-sm" 
                                    placeholder="Skill Name"
                                    value={skill.name} 
                                    onChange={(e) => handleSkillChange(i, 'name', e.target.value)}
                                />
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500">Lv</span>
                                    <input 
                                        type="number"
                                        className="w-16 bg-black text-white px-2 py-1 rounded border border-gray-700 text-center text-sm" 
                                        value={skill.level}
                                        onChange={(e) => handleSkillChange(i, 'level', e.target.value)}
                                    />
                                </div>
                                <button 
                                    onClick={() => handleRemoveSkill(i)}
                                    className="bg-red-900/50 text-red-400 hover:bg-red-900 px-2 py-1 rounded border border-red-800 transition text-sm"
                                    title="Remove Skill"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                        <button 
                            onClick={handleAddSkill}
                            className="w-full py-2 border-2 border-dashed border-gray-600 text-gray-400 rounded hover:border-gray-400 hover:text-white transition text-sm font-bold"
                        >
                            + Add Skill
                        </button>
                    </div>
                ) : (
                    // VIEW MODE SKILLS
                    <div className="space-y-2">
                        {char.skills && char.skills.length > 0 ? (
                            char.skills.map((skill: any, i: number) => (
                                <div key={i} className="flex justify-between items-center bg-gray-900 px-3 py-2 rounded border border-gray-800">
                                    <span className="text-sm text-gray-200">{skill.name}</span>
                                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded font-mono">Lv {skill.level}</span>
                                </div>
                            ))
                        ) : <p className="text-gray-500 italic text-sm">No skills learned.</p>}
                    </div>
                )}
            </div>

            {/* ABILITIES */}
            <div className="bg-gray-800 rounded-xl p-6 shadow border border-gray-700">
                <h2 className="text-xl font-bold text-gray-200 mb-4 border-b border-gray-700 pb-2">Abilities</h2>
                
                {isEditing ? (
                    // EDIT MODE ABILITIES
                    <div className="space-y-3">
                        {formData.abilities && formData.abilities.map((ab: any, i: number) => (
                            <div key={i} className="bg-gray-900 p-3 rounded border border-gray-600">
                                <div className="flex flex-col gap-2 mb-2">
                                    <div className="flex gap-2">
                                        <input 
                                            className="flex-1 bg-black text-white px-2 py-1 rounded border border-gray-700" 
                                            placeholder="Ability Name"
                                            value={ab.name} 
                                            onChange={(e) => handleAbilityChange(i, 'name', e.target.value)}
                                        />
                                        <select 
                                            className={`bg-black px-2 py-1 rounded border border-gray-700 text-xs font-bold ${getRarityColor(ab.rarity)}`}
                                            value={ab.rarity || 'Common'}
                                            onChange={(e) => handleAbilityChange(i, 'rarity', e.target.value)}
                                        >
                                            {RARITIES.map(r => <option key={r} value={r} className="text-white">{r}</option>)}
                                        </select>
                                        <input 
                                            type="number"
                                            className="w-16 bg-black text-gray-300 px-2 py-1 rounded border border-gray-700 text-center text-xs" 
                                            placeholder="Lv"
                                            value={ab.level || ''}
                                            onChange={(e) => handleAbilityChange(i, 'level', e.target.value)}
                                        />
                                        <button 
                                            onClick={() => handleRemoveAbility(i)}
                                            className="bg-red-900/50 text-red-400 hover:bg-red-900 px-3 rounded border border-red-800 transition"
                                            title="Remove Ability"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <textarea
                                        className="w-full bg-black text-gray-400 text-sm px-2 py-1 rounded border border-gray-700 min-h-[60px]"
                                        placeholder="Ability description..."
                                        value={ab.description || ''}
                                        onChange={(e) => handleAbilityChange(i, 'description', e.target.value)}
                                    />
                                </div>
                            </div>
                        ))}
                        <button 
                            onClick={handleAddAbility}
                            className="w-full py-3 border-2 border-dashed border-gray-600 text-gray-400 rounded hover:border-gray-400 hover:text-white transition font-bold"
                        >
                            + Add Ability
                        </button>
                    </div>
                ) : (
                    // VIEW MODE ABILITIES
                    <div className="space-y-4">
                        {char.abilities && char.abilities.length > 0 ? (
                            char.abilities.map((ab: any, i: number) => (
                                <div key={i} className="group">
                                    <div className="flex justify-between items-baseline">
                                        <h3 className={`font-bold ${getRarityColor(ab.rarity)}`}>{ab.name}</h3>
                                        {ab.level && <span className="text-xs text-gray-500">Lv {ab.level}</span>}
                                    </div>
                                    <p className="text-sm text-gray-400 mt-1 leading-relaxed">{ab.description}</p>
                                </div>
                            ))
                        ) : <p className="text-gray-500 italic">No abilities listed.</p>}
                    </div>
                )}
            </div>
        </div>

        {/* RIGHT COLUMN: Inventory & Words */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* INVENTORY */}
            <div className="bg-gray-800 rounded-xl p-6 shadow border border-gray-700">
                <h2 className="text-xl font-bold text-gray-200 mb-4 border-b border-gray-700 pb-2">Inventory</h2>
                
                {isEditing ? (
                    // EDIT MODE INVENTORY
                    <div className="space-y-3">
                        {formData.inventory && formData.inventory.map((item: any, i: number) => (
                            <div key={i} className="bg-gray-900 p-3 rounded border border-gray-600">
                                <div className="flex flex-col md:flex-row gap-2 mb-2">
                                    <input 
                                        className="flex-1 bg-black text-white px-2 py-1 rounded border border-gray-700" 
                                        placeholder="Item Name"
                                        value={item.name} 
                                        onChange={(e) => handleInventoryChange(i, 'name', e.target.value)}
                                    />
                                    <select 
                                        className={`bg-black px-2 py-1 rounded border border-gray-700 text-xs font-bold ${getRarityColor(item.rarity)}`}
                                        value={item.rarity || 'Common'}
                                        onChange={(e) => handleInventoryChange(i, 'rarity', e.target.value)}
                                    >
                                        {RARITIES.map(r => <option key={r} value={r} className="text-white">{r}</option>)}
                                    </select>
                                    <button 
                                        onClick={() => handleRemoveItem(i)}
                                        className="bg-red-900/50 text-red-400 hover:bg-red-900 px-3 rounded border border-red-800 transition"
                                        title="Remove Item"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <textarea
                                    className="w-full bg-black text-gray-400 text-xs px-2 py-1 rounded border border-gray-700 min-h-[60px]"
                                    placeholder="Item description..."
                                    value={item.description || ''}
                                    onChange={(e) => handleInventoryChange(i, 'description', e.target.value)}
                                />
                            </div>
                        ))}
                        <button 
                            onClick={handleAddItem}
                            className="w-full py-3 border-2 border-dashed border-gray-600 text-gray-400 rounded hover:border-gray-400 hover:text-white transition font-bold"
                        >
                            + Add Item
                        </button>
                    </div>
                ) : (
                    // VIEW MODE INVENTORY
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {char.inventory && char.inventory.length > 0 ? (
                            char.inventory.map((item: any, i: number) => (
                                <div key={i} className="bg-gray-900 p-3 rounded border border-gray-800 hover:border-gray-600 transition-colors">
                                    <div className={`font-medium ${getRarityColor(item.rarity)}`}>{item.name}</div>
                                    {item.description && (
                                        <div className="mt-2 text-xs text-gray-400 italic bg-black/20 p-2 rounded border-l-2 border-blue-500">
                                            {item.description}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : <p className="text-gray-500 italic">Empty pockets.</p>}
                    </div>
                )}
            </div>

            {/* WORDS (SPELLS) */}
            {char.words && char.words.length > 0 && (
                <div className="bg-gray-800 rounded-xl p-6 shadow border border-gray-700">
                    <h2 className="text-xl font-bold text-gray-200 mb-4 border-b border-gray-700 pb-2">Words of Power</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {char.words.map((word: any, i: number) => (
                            <div key={i} className="flex justify-between bg-gray-900 px-4 py-2 rounded items-center border border-gray-800">
                                <span className="font-mono text-purple-400 font-bold">{word.name}</span>
                                <span className="text-gray-500 text-sm">→ {word.meaning}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  )
}
