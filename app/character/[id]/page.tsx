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
  const [refreshKey, setRefreshKey] = useState(0)
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<any>(null)
  
  // Tame Buffs
  const [activeTames, setActiveTames] = useState<any[]>([])
  const [totalStats, setTotalStats] = useState<any>({})
  
  // Words of Power
  const [words, setWords] = useState<any[]>([])
  const [wordSearch, setWordSearch] = useState('')
  const [minMana, setMinMana] = useState('')
  const [maxMana, setMaxMana] = useState('')
  const [spellBuilderInput, setSpellBuilderInput] = useState('')

  // Level Up Modal
  const [showLevelUpModal, setShowLevelUpModal] = useState(false)
  const [levelUpStep, setLevelUpStep] = useState<1 | 2 | 3>(1)
  const [levelUpModalMode, setLevelUpModalMode] = useState<'gm-initiate' | 'player-allocate' | 'gm-review' | null>(null)
  const [diceRollInput, setDiceRollInput] = useState('')
  const [luStatDeltas, setLuStatDeltas] = useState<{ [key: string]: number }>({})
  const [luManaGain, setLuManaGain] = useState(0)
  const [luNewSkills, setLuNewSkills] = useState<{ name: string; level: number }[]>([])
  const [luSkillLevelUps, setLuSkillLevelUps] = useState<number[]>([])
  const [luNewSkillInput, setLuNewSkillInput] = useState('')

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
        // Ensure default stats exist (strength, speed, fortitude, magic)
        const defaultStats = {
          strength: 0,
          speed: 0,
          fortitude: 0,
          magic: 0,
          ...(data.stats || {})
        }
        
        // Ensure skills is always an array and mana values default to 0
        const normalized = {
          ...data,
          stats: defaultStats,
          skills: data.skills || [],
          mana_current: data.mana_current ?? 0,
          mana_max: data.mana_max ?? 0,
          is_active: data.is_active ?? false,
          stat_buffs: data.stat_buffs || {},
          tame_class: data.tame_class || '',
          species: data.species || '',
          money: data.money || { copper: 0, silver: 0, gold: 0 },
          pending_levelup: data.pending_levelup || null,
        }
        setChar(normalized)
        setFormData(normalized)
        
        // Fetch active tames that belong to THIS character (master linkage)
        // Tames are linked via player_name matching this character's name OR job starting with first name
        const firstName = data.name?.split(' ')?.[0] ?? ''
        const { data: tames } = await supabase
          .from('characters')
          .select('name, stat_buffs, is_active')
          .eq('is_tame', true)
          .eq('is_active', true)
          .or(`player_name.eq.${data.name},job.ilike.${firstName}%`)
        
        if (tames && tames.length > 0) {
          setActiveTames(tames)
          // Calculate total stats (base + buffs)
          const baseStats = normalized.stats || {}
          const buffedStats = { ...baseStats }
          
          tames.forEach(tame => {
            const buffs = tame.stat_buffs || {}
            Object.keys(buffs).forEach(stat => {
              buffedStats[stat] = (buffedStats[stat] || 0) + (buffs[stat] || 0)
            })
          })
          
          setTotalStats(buffedStats)
        } else {
          // No linked tames = no buffs, just use base stats
          setTotalStats(normalized.stats || {})
        }
      }

      // 3. If GM, fetch all profiles for assignment dropdown
      if (userIsGM) {
          const { data: allProfiles } = await supabase.from('profiles').select('id, username').order('username')
          if (allProfiles) setProfiles(allProfiles)
      }

      // 4. Fetch Words of Power for this character
      const { data: characterWords } = await supabase
        .from('character_words')
        .select('word_id, words_of_power(word, meaning, mana_cost)')
        .eq('character_id', id)
      
      if (characterWords) {
        const wordsData = characterWords.map(cw => cw.words_of_power).filter(Boolean)
        setWords(wordsData)
      }

      setLoading(false)
    }
    if (id) init()
  }, [id, refreshKey])

  async function handleSave() {
    const { error } = await supabase
        .from('characters')
        .update({
            hp_current: parseInt(formData.hp_current),
            hp_max: parseInt(formData.hp_max),
            mana_current: parseInt(formData.mana_current),
            mana_max: parseInt(formData.mana_max),
            xp_current: parseInt(formData.xp_current),
            xp_max: parseInt(formData.xp_max),
            level: parseInt(formData.level),
            stats: formData.stats,
            inventory: formData.inventory,
            abilities: formData.abilities,
            skills: formData.skills,
            is_active: formData.is_active,
            stat_buffs: formData.stat_buffs,
            tame_class: formData.tame_class || null,
            species: formData.species || null,
            money: formData.money || { copper: 0, silver: 0, gold: 0 }
        })
        .eq('id', id)

    if (error) {
        alert('Error saving: ' + error.message)
    } else {
        setChar(formData) 
        setIsEditing(false)
        // Reload page to recalculate buffs
        setRefreshKey(k => k + 1)
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
      
      const firstName = char.name?.split(' ')?.[0] ?? '';
      
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

  function handleStatBuffChange(statName: string, value: string) {
    const newBuffs = { ...formData.stat_buffs }
    const numValue = parseInt(value) || 0
    if (numValue === 0) {
      delete newBuffs[statName]
    } else {
      newBuffs[statName] = numValue
    }
    setFormData({ ...formData, stat_buffs: newBuffs })
  }

  async function toggleTameActive() {
    const newActiveState = !char.is_active
    const { error } = await supabase
      .from('characters')
      .update({ is_active: newActiveState })
      .eq('id', id)

    if (error) {
      alert('Error toggling active state: ' + error.message)
      return
    }

    // Recalculate the owner's HP max proportionally (handles no-change case internally)
    await recalcOwnerHp(String(id), newActiveState)

    setChar({ ...char, is_active: newActiveState })
    setFormData({ ...formData, is_active: newActiveState })
    setRefreshKey(k => k + 1)
  }

  async function recalcOwnerHp(tameId: string, tameNewActiveState: boolean) {
    // Find the owner — try player_name (exact) first, then job prefix (ilike)
    let owner: any = null

    if (char.player_name) {
      const { data } = await supabase
        .from('characters')
        .select('id, name, level, stats, hp_current, hp_max')
        .eq('name', char.player_name)
        .maybeSingle()
      owner = data
    }

    if (!owner && char.job) {
      const firstName = char.job.split(' ')[0]
      const { data } = await supabase
        .from('characters')
        .select('id, name, level, stats, hp_current, hp_max')
        .eq('is_tame', false)
        .ilike('name', `${firstName}%`)
        .limit(1)
        .maybeSingle()
      owner = data
    }

    if (!owner) return

    // Fetch all tames linked to this owner (two queries to avoid .or() space-parsing issues)
    const firstName = owner.name.split(' ')[0]
    const [{ data: tamesByName }, { data: tamesByJob }] = await Promise.all([
      supabase.from('characters').select('id, is_active, stat_buffs').eq('is_tame', true).eq('player_name', owner.name),
      supabase.from('characters').select('id, is_active, stat_buffs').eq('is_tame', true).ilike('job', `${firstName}%`),
    ])

    const allTames = [...(tamesByName || []), ...(tamesByJob || [])]
      .filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)

    // Sum fortitude buffs, applying the new active state for the tame being toggled
    let fortitudeBuff = 0
    allTames.forEach(tame => {
      const active = tame.id === tameId ? tameNewActiveState : tame.is_active
      if (active) fortitudeBuff += tame.stat_buffs?.fortitude || 0
    })

    const baseFortitude = owner.stats?.fortitude || 0
    const newHpMax = owner.level * (25 + Math.floor((baseFortitude + fortitudeBuff) / 10))
    const oldHpMax = owner.hp_max || 0

    if (newHpMax === oldHpMax) return

    const newHpCurrent = oldHpMax > 0
      ? Math.max(0, Math.min(newHpMax, Math.round(owner.hp_current * (newHpMax / oldHpMax))))
      : newHpMax

    const { error: updateErr } = await supabase
      .from('characters')
      .update({ hp_max: newHpMax, hp_current: newHpCurrent })
      .eq('id', owner.id)

  }

  // --- LEVEL UP HELPERS ---

  const XP_MAX_TABLE: { [key: number]: number } = {
    1: 50, 2: 250, 3: 1250, 4: 6250, 5: 30000,
    6: 100000, 7: 500000, 8: 2000000, 9: 10000000, 10: 50000000,
  }

  function getXpMaxForLevel(level: number): number {
    return XP_MAX_TABLE[level] ?? 50000000
  }

  function getSkillLevelUpCost(baseLevel: number, levelsAdded: number): number {
    let cost = 0
    for (let l = 0; l < levelsAdded; l++) {
      cost += Math.pow(2, baseLevel + l)
    }
    return cost
  }

  function getLuPointsSpent(): number {
    const statCost = Object.values(luStatDeltas).reduce((a, b) => a + b, 0)
    const manaCost = luManaGain * 2
    // Each new skill costs 10 to create (Lv 1), plus exponential cost for any levels above 1
    const newSkillCost = luNewSkills.reduce((total, skill) => {
      return total + 10 + getSkillLevelUpCost(1, (skill.level || 1) - 1)
    }, 0)
    const skillLevelCost = (char?.skills || []).reduce((total: number, skill: any, i: number) => {
      return total + getSkillLevelUpCost(skill.level, luSkillLevelUps[i] || 0)
    }, 0)
    return statCost + manaCost + newSkillCost + skillLevelCost
  }

  // GM: Start the level-up flow (step 1 — dice roll entry)
  function openGMInitiateModal() {
    setLevelUpStep(1)
    setDiceRollInput('')
    setLuStatDeltas({})
    setLuManaGain(0)
    setLuNewSkills([])
    setLuSkillLevelUps((char?.skills || []).map(() => 0))
    setLuNewSkillInput('')
    setLevelUpModalMode('gm-initiate')
    setShowLevelUpModal(true)
  }

  // Player: Open their allocation modal (step 2 — spend points)
  function openPlayerAllocateModal() {
    const pending = char?.pending_levelup
    setLevelUpStep(2)
    setDiceRollInput(String(pending?.points_total || 0))
    setLuStatDeltas(pending?.stat_deltas || {})
    setLuManaGain(pending?.mana_gain || 0)
    setLuNewSkills(pending?.new_skills || [])
    setLuSkillLevelUps(pending?.skill_level_ups || (char?.skills || []).map(() => 0))
    setLuNewSkillInput('')
    setLevelUpModalMode('player-allocate')
    setShowLevelUpModal(true)
  }

  // GM: Open review modal (step 3 — review player's submission)
  function openGMReviewModal() {
    const pending = char?.pending_levelup
    setLevelUpStep(3)
    setDiceRollInput(String(pending?.points_total || 0))
    setLuStatDeltas(pending?.stat_deltas || {})
    setLuManaGain(pending?.mana_gain || 0)
    setLuNewSkills(pending?.new_skills || [])
    setLuSkillLevelUps(pending?.skill_level_ups || (char?.skills || []).map(() => 0))
    setLuNewSkillInput('')
    setLevelUpModalMode('gm-review')
    setShowLevelUpModal(true)
  }

  // GM: Save dice roll total to DB and hand off to player
  async function handleGMInitiateLevelUp() {
    const newLevel = char.level + 1
    const { error } = await supabase.from('characters').update({
      pending_levelup: {
        status: 'player_allocating',
        new_level: newLevel,
        points_total: parseInt(diceRollInput) || 0,
      },
    }).eq('id', id)
    if (error) { alert('Error initiating level up: ' + error.message) }
    else { setShowLevelUpModal(false); setRefreshKey(k => k + 1) }
  }

  // Player: Submit their allocation for GM review
  async function handlePlayerSubmitAllocation() {
    const { error } = await supabase.from('characters').update({
      pending_levelup: {
        ...char.pending_levelup,
        status: 'player_submitted',
        stat_deltas: luStatDeltas,
        mana_gain: luManaGain,
        new_skills: luNewSkills,
        skill_level_ups: luSkillLevelUps,
      },
    }).eq('id', id)
    if (error) { alert('Error submitting allocation: ' + error.message) }
    else { setShowLevelUpModal(false); setRefreshKey(k => k + 1) }
  }

  // GM: Confirm and apply the level up
  async function handleGMConfirmLevelUp() {
    const pending = char.pending_levelup
    const newLevel = pending.new_level

    const newStats = { ...char.stats }
    Object.entries(luStatDeltas).forEach(([key, delta]) => {
      newStats[key] = (newStats[key] || 0) + (delta as number)
    })

    const newManaMax = (char.mana_max || 0) + luManaGain

    // HP max = level * (25 + floor(fortitude / 10))
    const newFortitude = newStats['fortitude'] || 0
    const newHpMax = newLevel * (25 + Math.floor(newFortitude / 10))

    const updatedSkills = [...(char.skills || [])]
    luSkillLevelUps.forEach((levelsAdded, i) => {
      if (levelsAdded > 0 && updatedSkills[i]) {
        updatedSkills[i] = { ...updatedSkills[i], level: updatedSkills[i].level + levelsAdded }
      }
    })
    luNewSkills.forEach(skill => {
      updatedSkills.push({ name: skill.name, level: skill.level || 1 })
    })

    const { error } = await supabase.from('characters').update({
      level: newLevel,
      xp_current: 0,
      xp_max: getXpMaxForLevel(newLevel),
      stats: newStats,
      hp_max: newHpMax,
      hp_current: newHpMax,
      mana_max: newManaMax,
      mana_current: newManaMax,
      skills: updatedSkills,
      pending_levelup: null,
    }).eq('id', id)

    if (error) { alert('Error confirming level up: ' + error.message) }
    else { setShowLevelUpModal(false); setRefreshKey(k => k + 1) }
  }

  // GM: Void the pending level up entirely
  async function handleGMCancelLevelUp() {
    const { error } = await supabase.from('characters').update({
      pending_levelup: null,
    }).eq('id', id)
    if (error) { alert('Error cancelling: ' + error.message) }
    else { setShowLevelUpModal(false); setRefreshKey(k => k + 1) }
  }

  if (loading) return <div className="min-h-screen bg-gray-900 text-white p-8 text-center">Loading...</div>
  if (!char) return <div className="min-h-screen bg-gray-900 text-white p-8 text-center">Character not found.</div>

  const displayData = isEditing ? formData : char

  const canEdit = isGM // ONLY GMs can edit characters
  const isMyCharacter = !isGM && session?.user?.id === char.user_id
  const pendingLevelup = char.pending_levelup
  const isPendingAllocating = pendingLevelup?.status === 'player_allocating'
  const isPendingSubmitted = pendingLevelup?.status === 'player_submitted'
  const xpMaxed = !char.is_tame && char.xp_max > 0 && char.xp_current >= char.xp_max

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
            ) : (
                <>
                    <Link href="/wiki" className="px-4 py-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition flex items-center gap-2">
                        📖 Wiki
                    </Link>
                    {/* GM: XP maxed, no pending level-up yet */}
                    {isGM && xpMaxed && !pendingLevelup && (
                        <button onClick={openGMInitiateModal} className="px-4 py-2 rounded bg-fuchsia-700 text-white hover:bg-fuchsia-600 transition font-bold flex items-center gap-2">
                            ⬆️ Level Up
                        </button>
                    )}
                    {/* GM: Waiting for player to allocate */}
                    {isGM && isPendingAllocating && (
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-2 rounded bg-yellow-900/40 border border-yellow-700 text-yellow-400 text-sm font-semibold flex items-center gap-1.5">
                                ⏳ Awaiting Player
                            </span>
                            <button onClick={handleGMCancelLevelUp} className="px-3 py-2 rounded bg-gray-700 text-gray-400 hover:bg-gray-600 transition text-sm">
                                Cancel
                            </button>
                        </div>
                    )}
                    {/* GM: Player has submitted, ready to review */}
                    {isGM && isPendingSubmitted && (
                        <button onClick={openGMReviewModal} className="px-4 py-2 rounded bg-green-700 text-white hover:bg-green-600 transition font-bold flex items-center gap-2 animate-pulse">
                            ⚔️ Review Submission
                        </button>
                    )}
                    {/* Player: Their turn to allocate points */}
                    {isMyCharacter && isPendingAllocating && (
                        <button onClick={openPlayerAllocateModal} className="px-4 py-2 rounded bg-fuchsia-700 text-white hover:bg-fuchsia-600 transition font-bold flex items-center gap-2 animate-pulse">
                            ⬆️ Allocate Level Up!
                        </button>
                    )}
                    {/* Player: Waiting for GM to confirm */}
                    {isMyCharacter && isPendingSubmitted && (
                        <span className="px-3 py-2 rounded bg-green-900/40 border border-green-700 text-green-400 text-sm font-semibold flex items-center gap-1.5">
                            ✓ Submitted — Awaiting GM
                        </span>
                    )}
                    {canEdit && (
                        <button onClick={() => setIsEditing(true)} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 transition flex items-center gap-2">
                            <span>✏️</span> Edit Sheet
                        </button>
                    )}
                </>
            )}
        </div>
      </div>

      {/* HEADER */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-xl border border-gray-700 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-red-500">{char.name}</h1>
            <div className="text-xl text-gray-300 mt-1 flex items-center gap-2">
              {!char.is_tame && (
                <>
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
                  <span className="text-gray-500">•</span>
                  {char.job || 'Jobless'} 
                </>
              )}
              {char.is_tame && (
                <>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="text"
                        placeholder="Class"
                        className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-center uppercase"
                        value={formData.tame_class || ''}
                        onChange={(e) => setFormData({...formData, tame_class: e.target.value})}
                      />
                      <span>Class</span>
                      <span className="text-gray-500">-</span>
                      <input 
                        type="text"
                        placeholder="Species"
                        className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1"
                        value={formData.species || ''}
                        onChange={(e) => setFormData({...formData, species: e.target.value})}
                      />
                    </div>
                  ) : (
                    <>
                      {char.tame_class && <span className="uppercase font-bold text-purple-300">{char.tame_class} Class</span>}
                      {char.tame_class && char.species && <span className="text-gray-500">-</span>}
                      {char.species && <span>{char.species}</span>}
                      {!char.tame_class && !char.species && <span className="text-gray-500 italic">Tame</span>}
                    </>
                  )}
                  <span className="ml-2 bg-purple-900 text-purple-300 text-xs px-2 py-1 rounded border border-purple-700">TAME</span>
                </>
              )}
              {!char.is_tame && char.is_npc && <span className="ml-2 bg-gray-700 text-xs px-2 py-1 rounded">NPC</span>}
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
             {/* MANA BAR */}
             <div className="w-full md:w-64">
                <div className="flex justify-between text-xs uppercase font-bold text-gray-400 mb-1 items-center">
                    <span>Mana</span>
                    {isEditing ? (
                        <div className="flex items-center gap-1">
                            <input 
                                type="number" 
                                className="w-16 bg-gray-900 border border-gray-600 rounded px-1 text-right"
                                value={formData.mana_current}
                                onChange={(e) => setFormData({...formData, mana_current: e.target.value})}
                            />
                            <span>/</span>
                            <input 
                                type="number" 
                                className="w-16 bg-gray-900 border border-gray-600 rounded px-1"
                                value={formData.mana_max}
                                onChange={(e) => setFormData({...formData, mana_max: e.target.value})}
                            />
                        </div>
                    ) : (
                        <span>{char.mana_current} / {char.mana_max}</span>
                    )}
                </div>
                <div className="w-full bg-gray-900 h-4 rounded-full overflow-hidden border border-gray-600">
                    <div 
                        className="bg-blue-600 h-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, (displayData.mana_current / displayData.mana_max) * 100 || 0)}%` }}
                    />
                </div>
             </div>
             {/* XP BAR */}
             <div className="w-full md:w-64">
                <div className="flex justify-between text-xs uppercase font-bold text-gray-400 mb-1 items-center">
                    <span className="flex items-center gap-1.5">
                        XP
                        {!isEditing && xpMaxed && !pendingLevelup && (
                            <span className="text-fuchsia-400 animate-pulse tracking-wide">✦ READY</span>
                        )}
                        {!isEditing && xpMaxed && isPendingAllocating && (
                            <span className="text-yellow-400 tracking-wide">⏳ PENDING</span>
                        )}
                        {!isEditing && xpMaxed && isPendingSubmitted && (
                            <span className="text-green-400 tracking-wide">✓ SUBMITTED</span>
                        )}
                    </span>
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
                        className={`h-full transition-all duration-500 ${xpMaxed && !pendingLevelup ? 'bg-fuchsia-400 animate-pulse' : xpMaxed ? 'bg-fuchsia-300' : 'bg-fuchsia-500'}`}
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
                    {Object.entries(displayData.stats || {}).map(([key, val]: [string, any]) => {
                        const baseStat = val
                        const totalStat = totalStats[key] || baseStat
                        const buffAmount = totalStat - baseStat
                        
                        return (
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
                                    <div className="flex flex-col items-center">
                                        <div className={`text-2xl font-mono font-bold ${buffAmount > 0 ? 'text-green-400' : 'text-white'}`}>
                                            {totalStat}
                                        </div>
                                        {buffAmount > 0 && (
                                            <div className="text-xs text-green-500">
                                                +{buffAmount} from tames
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
            
            {/* ACTIVE TAMES (Show buffs being received) */}
            {!char.is_tame && activeTames.length > 0 && (
                <div className="bg-gray-800 rounded-xl p-6 shadow border border-gray-700">
                    <h2 className="text-xl font-bold text-gray-200 mb-4 border-b border-gray-700 pb-2">Active Tames</h2>
                    <div className="space-y-2">
                        {activeTames.map((tame, i) => (
                            <div key={i} className="bg-green-900/20 border border-green-800 rounded p-3">
                                <div className="font-bold text-green-300 mb-1 flex items-center gap-2">
                                    <span>✓</span> {tame.name}
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs">
                                    {Object.entries(tame.stat_buffs || {}).map(([stat, buff]: [string, any]) => (
                                        <span key={stat} className="bg-green-900/50 text-green-300 px-2 py-1 rounded border border-green-700">
                                            +{buff} {stat}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* TAME BUFFS (Only show for tames) */}
            {char.is_tame && isGM && (
                <div className="bg-gray-800 rounded-xl p-6 shadow border border-gray-700">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                        <h2 className="text-xl font-bold text-gray-200">Tame Buffs</h2>
                        <button
                            onClick={toggleTameActive}
                            className={`px-3 py-1 rounded font-bold text-sm transition ${
                                char.is_active 
                                ? 'bg-green-900 text-green-300 border border-green-600 hover:bg-green-800' 
                                : 'bg-gray-700 text-gray-400 border border-gray-600 hover:bg-gray-600'
                            }`}
                        >
                            {char.is_active ? '✓ Active' : 'Inactive'}
                        </button>
                    </div>
                    
                    {isEditing ? (
                        <div className="space-y-3">
                            <p className="text-xs text-gray-400 mb-2">Set buffs this tame provides when active:</p>
                            {Object.keys(formData.stats || {}).length > 0 ? (
                                Object.keys(formData.stats || {}).map(statName => {
                                    const currentBuff = formData.stat_buffs?.[statName] || 0
                                    return (
                                        <div key={statName} className="flex items-center gap-2 bg-gray-900 p-2 rounded">
                                            <span className="text-sm text-gray-300 flex-1 uppercase">{statName}</span>
                                            <span className="text-xs text-gray-500">+</span>
                                            <input 
                                                type="number"
                                                className="w-20 bg-black text-white px-2 py-1 rounded border border-gray-700 text-center text-sm"
                                                value={currentBuff}
                                                onChange={(e) => handleStatBuffChange(statName, e.target.value)}
                                                placeholder="0"
                                            />
                                        </div>
                                    )
                                })
                            ) : (
                                <div className="bg-yellow-900/20 border border-yellow-800 rounded p-3">
                                    <p className="text-yellow-500 text-sm font-bold mb-2">⚠️ No Stats Defined</p>
                                    <p className="text-xs text-gray-400">This tame has no stats yet. Scroll up to the "Stats" section and add some stats first (like strength, speed, etc.), then come back here to configure buffs.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {Object.keys(char.stat_buffs || {}).length > 0 ? (
                                Object.entries(char.stat_buffs).map(([stat, buff]: [string, any]) => (
                                    <div key={stat} className="flex justify-between items-center bg-gray-900 px-3 py-2 rounded">
                                        <span className="text-sm text-gray-300 uppercase">{stat}</span>
                                        <span className="text-green-400 font-bold">+{buff}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 italic text-sm">No buffs configured.</p>
                            )}
                        </div>
                    )}
                </div>
            )}

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

                {/* MONEY */}
                <div className="mb-5 bg-gray-900 rounded-lg border border-gray-700 p-3">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">💰 Currency</div>
                    {isEditing ? (
                        <div className="flex gap-3">
                            {/* Gold */}
                            <div className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-xs font-bold text-yellow-400">Gold</span>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full bg-black text-yellow-400 font-bold text-center px-2 py-1 rounded border border-yellow-700 focus:border-yellow-400 focus:outline-none"
                                    value={formData.money?.gold ?? 0}
                                    onChange={(e) => setFormData({ ...formData, money: { ...formData.money, gold: parseInt(e.target.value) || 0 } })}
                                />
                            </div>
                            {/* Silver */}
                            <div className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-xs font-bold text-gray-300">Silver</span>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full bg-black text-gray-300 font-bold text-center px-2 py-1 rounded border border-gray-500 focus:border-gray-300 focus:outline-none"
                                    value={formData.money?.silver ?? 0}
                                    onChange={(e) => setFormData({ ...formData, money: { ...formData.money, silver: parseInt(e.target.value) || 0 } })}
                                />
                            </div>
                            {/* Copper */}
                            <div className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-xs font-bold text-orange-400">Copper</span>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full bg-black text-orange-400 font-bold text-center px-2 py-1 rounded border border-orange-700 focus:border-orange-400 focus:outline-none"
                                    value={formData.money?.copper ?? 0}
                                    onChange={(e) => setFormData({ ...formData, money: { ...formData.money, copper: parseInt(e.target.value) || 0 } })}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex gap-3">
                            <div className="flex-1 flex flex-col items-center bg-black/30 rounded p-2 border border-yellow-900/40">
                                <span className="text-lg font-extrabold text-yellow-400">{char.money?.gold ?? 0}</span>
                                <span className="text-xs text-yellow-600 font-semibold">Gold</span>
                            </div>
                            <div className="flex-1 flex flex-col items-center bg-black/30 rounded p-2 border border-gray-600/40">
                                <span className="text-lg font-extrabold text-gray-300">{char.money?.silver ?? 0}</span>
                                <span className="text-xs text-gray-500 font-semibold">Silver</span>
                            </div>
                            <div className="flex-1 flex flex-col items-center bg-black/30 rounded p-2 border border-orange-900/40">
                                <span className="text-lg font-extrabold text-orange-400">{char.money?.copper ?? 0}</span>
                                <span className="text-xs text-orange-600 font-semibold">Copper</span>
                            </div>
                        </div>
                    )}
                </div>

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
            {words.length > 0 && (() => {
                // Sort words: by mana cost (low to high), then alphabetically by word
                const sortedWords = [...words].sort((a, b) => {
                    if (a.mana_cost !== b.mana_cost) {
                        return a.mana_cost - b.mana_cost;
                    }
                    return a.word.localeCompare(b.word);
                });
                
                // Apply filters
                const filteredWords = sortedWords.filter(word => {
                    // Text search filter
                    if (wordSearch) {
                        const search = wordSearch.toLowerCase();
                        const matchesText = word.word.toLowerCase().includes(search) ||
                                          word.meaning.toLowerCase().includes(search);
                        if (!matchesText) return false;
                    }
                    
                    // Mana cost range filter
                    const min = minMana ? parseInt(minMana) : -Infinity;
                    const max = maxMana ? parseInt(maxMana) : Infinity;
                    if (word.mana_cost < min || word.mana_cost > max) {
                        return false;
                    }
                    
                    return true;
                });
                
                const hasFilters = wordSearch || minMana || maxMana;
                
                return (
                    <div className="bg-gray-800 rounded-xl p-6 shadow border border-gray-700">
                        <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                            <h2 className="text-xl font-bold text-gray-200">Words of Power</h2>
                            {isGM && (
                                <a 
                                    href="/words" 
                                    className="text-xs text-purple-400 hover:text-purple-300 transition flex items-center gap-1"
                                >
                                    <span>✏️</span> Manage Words
                                </a>
                            )}
                        </div>
                        
                        {/* Spell Builder */}
                        {(() => {
                            const typedWords = spellBuilderInput.trim().split(/\s+/).filter(Boolean)
                            const resolvedWords = typedWords.map(tw => {
                                const match = words.find(w => w.word.toLowerCase() === tw.toLowerCase())
                                return match
                                    ? { input: tw, meaning: match.meaning, mana_cost: match.mana_cost, found: true }
                                    : { input: tw, meaning: '???', mana_cost: 0, found: false }
                            })
                            const totalMana = resolvedWords.reduce((sum, w) => sum + w.mana_cost, 0)
                            return (
                                <div className="mb-5 bg-purple-950/30 border border-purple-800/50 rounded-xl p-4">
                                    <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider mb-3">✨ Spell Builder</h3>
                                    <input
                                        type="text"
                                        placeholder="Type words of power separated by spaces..."
                                        className="w-full bg-gray-900 border border-purple-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:border-purple-400 focus:outline-none transition font-mono"
                                        value={spellBuilderInput}
                                        onChange={(e) => setSpellBuilderInput(e.target.value)}
                                    />
                                    {typedWords.length > 0 && (
                                        <div className="mt-3 space-y-3">
                                            <div className="flex flex-wrap gap-2">
                                                {resolvedWords.map((rw, i) => (
                                                    <div key={i} className={`bg-gray-900 rounded px-3 py-1.5 border ${rw.found ? 'border-purple-700' : 'border-gray-700'}`}>
                                                        <div className={`font-mono font-bold text-sm ${rw.found ? 'text-purple-400' : 'text-gray-500'}`}>{rw.input}</div>
                                                        <div className={`text-xs ${rw.found ? 'text-gray-400 italic' : 'text-red-500 italic'}`}>{rw.meaning}</div>
                                                        {rw.found && <div className="text-xs text-blue-400 font-mono">{rw.mana_cost} MP</div>}
                                                    </div>
                                                ))}
                                            </div>
                                            {(() => {
                                                const canAfford = totalMana <= (char.mana_current ?? 0)
                                                const unknownCount = resolvedWords.filter(w => !w.found).length
                                                return (
                                                    <div className="space-y-1.5">
                                                        {unknownCount > 0 && (
                                                            <div className="text-xs text-yellow-500 flex items-center gap-1">
                                                                ⚠ {unknownCount} word{unknownCount > 1 ? 's' : ''} not recognized — cost may be higher
                                                            </div>
                                                        )}
                                                        <div className={`flex items-center justify-between bg-gray-900 rounded px-3 py-2 border ${canAfford ? 'border-blue-900/50' : 'border-red-800/70'}`}>
                                                            <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Total Mana Cost</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`font-bold font-mono text-lg ${canAfford ? 'text-blue-400' : 'text-red-400'}`}>{totalMana} MP</span>
                                                                <span className="text-xs text-gray-500">/ {char.mana_current ?? 0} available</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )
                        })()}

                        {/* Search & Filter Bar */}
                        <div className="mb-4 space-y-3">
                            {/* Text Search */}
                            <input
                                type="text"
                                placeholder="Search by word or meaning..."
                                className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition"
                                value={wordSearch}
                                onChange={(e) => setWordSearch(e.target.value)}
                            />
                            
                            {/* Mana Cost Range */}
                            <div className="flex gap-3 items-center">
                                <span className="text-sm text-gray-400 whitespace-nowrap">Mana Cost:</span>
                                <input
                                    type="number"
                                    placeholder="Min"
                                    className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition text-sm"
                                    value={minMana}
                                    onChange={(e) => setMinMana(e.target.value)}
                                    min="0"
                                />
                                <span className="text-gray-600">—</span>
                                <input
                                    type="number"
                                    placeholder="Max"
                                    className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition text-sm"
                                    value={maxMana}
                                    onChange={(e) => setMaxMana(e.target.value)}
                                    min="0"
                                />
                                {(minMana || maxMana) && (
                                    <button
                                        onClick={() => { setMinMana(''); setMaxMana(''); }}
                                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs transition"
                                        title="Clear mana filters"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                            
                            {/* Results Counter */}
                            {hasFilters && (
                                <p className="text-xs text-gray-500">
                                    Showing {filteredWords.length} of {words.length} words
                                </p>
                            )}
                        </div>
                        
                        {/* Words Grid */}
                        {filteredWords.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {filteredWords.map((word: any, i: number) => (
                                    <div key={i} className="bg-gray-900 p-3 rounded border border-gray-800 hover:border-purple-700 transition">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-mono text-purple-400 font-bold text-lg">{word.word}</span>
                                            <span className="text-blue-400 text-xs font-mono bg-blue-900/30 px-2 py-0.5 rounded">{word.mana_cost} MP</span>
                                        </div>
                                        <div className="text-gray-500 text-sm italic">{word.meaning}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                {hasFilters ? (
                                    <>No words found matching your filters</>
                                ) : (
                                    <>No words of power yet</>
                                )}
                            </div>
                        )}
                    </div>
                );
            })()}

        </div>
      </div>

      {/* ===================== LEVEL UP MODAL ===================== */}
      {showLevelUpModal && char && levelUpModalMode && (() => {
        const newLevel = levelUpModalMode === 'gm-initiate'
          ? char.level + 1
          : (char.pending_levelup?.new_level || char.level + 1)
        const diceCount = newLevel * 5
        const pointsTotal = parseInt(diceRollInput) || 0
        const pointsSpent = getLuPointsSpent()
        const pointsRemaining = pointsTotal - pointsSpent

        const modalTitles = {
          'gm-initiate': '⬆️ Initiate Level Up',
          'player-allocate': '⬆️ Allocate Your Points',
          'gm-review': '⚔️ Review Submission',
        }

        // Shared allocation UI used in both player-allocate and gm-review (step 2)
        const AllocationUI = () => (
          <div className="space-y-4">
            {levelUpModalMode === 'player-allocate' && (
              <div className="bg-fuchsia-900/20 border border-fuchsia-800 rounded-xl px-4 py-3 text-sm text-fuchsia-300">
                You have <span className="font-bold text-fuchsia-200">{pointsTotal} points</span> to spend. Allocate them below, then submit for GM review.
              </div>
            )}
            {levelUpModalMode === 'gm-review' && levelUpStep === 2 && (
              <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl px-4 py-3 text-sm text-yellow-300">
                <span className="font-bold">GM: Modify Allocation</span> — Adjust points below, then return to review.
              </div>
            )}

            {/* Points Counter */}
            <div className={`flex justify-between items-center bg-gray-800 rounded-xl px-5 py-3 border ${pointsRemaining < 0 ? 'border-red-600 bg-red-900/10' : pointsRemaining === 0 ? 'border-green-600' : 'border-fuchsia-700'}`}>
              <span className="text-gray-400 text-sm font-semibold uppercase tracking-wide">Points Remaining</span>
              <span className={`text-3xl font-bold font-mono ${pointsRemaining < 0 ? 'text-red-400' : pointsRemaining === 0 ? 'text-green-400' : 'text-fuchsia-300'}`}>
                {pointsRemaining}
                <span className="text-gray-500 text-sm font-normal"> / {pointsTotal}</span>
              </span>
            </div>

            {/* Stats */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Stats <span className="text-gray-600 font-normal normal-case">(1 point = +1)</span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(char.stats || {}).map(statKey => {
                  const base = char.stats[statKey] || 0
                  const delta = luStatDeltas[statKey] || 0
                  return (
                    <div key={statKey} className="bg-gray-900 rounded-lg p-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">{statKey}</div>
                        <div className="font-bold text-white text-lg">
                          {base}{delta > 0 && <span className="text-fuchsia-400 text-sm"> +{delta}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button disabled={delta <= 0}
                          onClick={() => setLuStatDeltas(prev => ({ ...prev, [statKey]: Math.max(0, (prev[statKey] || 0) - 1) }))}
                          className="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white font-bold transition text-sm">−</button>
                        <button disabled={pointsRemaining <= 0}
                          onClick={() => setLuStatDeltas(prev => ({ ...prev, [statKey]: (prev[statKey] || 0) + 1 }))}
                          className="w-7 h-7 rounded bg-fuchsia-800 hover:bg-fuchsia-700 disabled:opacity-30 text-white font-bold transition text-sm">+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Mana */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Mana Max <span className="text-gray-600 font-normal normal-case">(2 points = +1 mana)</span>
              </h3>
              <div className="bg-gray-900 rounded-lg p-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Mana Max</div>
                  <div className="font-bold text-white text-lg">
                    {char.mana_max || 0}{luManaGain > 0 && <span className="text-blue-400 text-sm"> +{luManaGain}</span>}
                  </div>
                  <div className="text-xs text-gray-600">Cost: {luManaGain * 2} pts</div>
                </div>
                <div className="flex items-center gap-1">
                  <button disabled={luManaGain <= 0} onClick={() => setLuManaGain(g => Math.max(0, g - 1))}
                    className="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white font-bold transition text-sm">−</button>
                  <button disabled={pointsRemaining < 2} onClick={() => setLuManaGain(g => g + 1)}
                    className="w-7 h-7 rounded bg-blue-800 hover:bg-blue-700 disabled:opacity-30 text-white font-bold transition text-sm">+</button>
                </div>
              </div>
            </div>

            {/* Level Up Existing Skills */}
            {char.skills && char.skills.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Level Up Skills <span className="text-gray-600 font-normal normal-case">(cost doubles per level, max Lv 10)</span>
                </h3>
                <div className="space-y-2">
                  {char.skills.map((skill: any, i: number) => {
                    const levelsAdded = luSkillLevelUps[i] || 0
                    const currentLevel = skill.level + levelsAdded
                    const nextCost = Math.pow(2, currentLevel)
                    const canUp = pointsRemaining >= nextCost && currentLevel < 10
                    const canDown = levelsAdded > 0
                    return (
                      <div key={i} className="bg-gray-900 rounded-lg p-3 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white font-medium truncate">{skill.name}</div>
                          <div className="text-xs text-gray-500">
                            Lv {skill.level}
                            {levelsAdded > 0 && <span className="text-fuchsia-400"> → {currentLevel}</span>}
                            {currentLevel < 10 ? <span className="text-gray-600"> • next: {nextCost} pts</span> : <span className="text-yellow-600"> • MAX</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button disabled={!canDown}
                            onClick={() => setLuSkillLevelUps(prev => { const n = [...prev]; n[i] = Math.max(0, (n[i] || 0) - 1); return n })}
                            className="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white font-bold transition text-sm">−</button>
                          <button disabled={!canUp}
                            onClick={() => setLuSkillLevelUps(prev => { const n = [...prev]; n[i] = (n[i] || 0) + 1; return n })}
                            className="w-7 h-7 rounded bg-fuchsia-800 hover:bg-fuchsia-700 disabled:opacity-30 text-white font-bold transition text-sm">+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* New Skills */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                New Skills <span className="text-gray-600 font-normal normal-case">(10 pts each, starts at Lv 1)</span>
              </h3>
              {luNewSkills.length > 0 && (
                <div className="space-y-2 mb-3">
                  {luNewSkills.map((skill, i) => {
                    const nextLevelCost = Math.pow(2, skill.level)
                    const canLevelUp = pointsRemaining >= nextLevelCost && skill.level < 10
                    const canLevelDown = skill.level > 1
                    return (
                      <div key={i} className="bg-gray-900 rounded-lg p-3 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white font-medium truncate">{skill.name}</div>
                          <div className="text-xs text-gray-500">
                            <span className="text-fuchsia-400">Lv {skill.level}</span>
                            {skill.level < 10
                              ? <span className="text-gray-600"> • next level: {nextLevelCost} pts</span>
                              : <span className="text-yellow-600"> • MAX</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button disabled={!canLevelDown}
                            onClick={() => setLuNewSkills(prev => prev.map((s, j) => j === i ? { ...s, level: s.level - 1 } : s))}
                            className="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white font-bold transition text-sm">−</button>
                          <button disabled={!canLevelUp}
                            onClick={() => setLuNewSkills(prev => prev.map((s, j) => j === i ? { ...s, level: s.level + 1 } : s))}
                            className="w-7 h-7 rounded bg-fuchsia-800 hover:bg-fuchsia-700 disabled:opacity-30 text-white font-bold transition text-sm">+</button>
                          <button onClick={() => setLuNewSkills(prev => prev.filter((_, j) => j !== i))}
                            className="w-7 h-7 rounded bg-red-900/40 hover:bg-red-900 text-red-400 hover:text-red-300 text-sm transition ml-1">✕</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="flex gap-2">
                <input type="text" placeholder="Skill name..."
                  className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-fuchsia-500 focus:outline-none"
                  value={luNewSkillInput} onChange={(e) => setLuNewSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && luNewSkillInput.trim() && pointsRemaining >= 10) {
                      setLuNewSkills(prev => [...prev, { name: luNewSkillInput.trim(), level: 1 }])
                      setLuNewSkillInput('')
                    }
                  }}
                />
                <button
                  disabled={!luNewSkillInput.trim() || pointsRemaining < 10}
                  onClick={() => { if (luNewSkillInput.trim()) { setLuNewSkills(prev => [...prev, { name: luNewSkillInput.trim(), level: 1 }]); setLuNewSkillInput('') } }}
                  className="px-3 py-2 bg-fuchsia-800 hover:bg-fuchsia-700 disabled:opacity-30 text-white text-sm rounded font-bold transition shrink-0"
                >+ Add (10 pts)</button>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-3 pt-1">
              {levelUpModalMode === 'gm-review' && (
                <button onClick={() => setLevelUpStep(3)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-bold transition">
                  ← Back to Review
                </button>
              )}
              {levelUpModalMode === 'player-allocate' && (
                <button disabled={pointsRemaining < 0} onClick={handlePlayerSubmitAllocation}
                  className="flex-1 py-3 bg-fuchsia-700 hover:bg-fuchsia-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-lg transition">
                  Submit for GM Review →
                </button>
              )}
              {levelUpModalMode === 'gm-review' && (
                <button disabled={pointsRemaining < 0} onClick={() => setLevelUpStep(3)}
                  className="flex-1 py-3 bg-fuchsia-700 hover:bg-fuchsia-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-lg transition">
                  Update Review →
                </button>
              )}
            </div>
          </div>
        )

        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-fuchsia-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">

              {/* Modal Header */}
              <div className="bg-fuchsia-900/30 border-b border-fuchsia-800 px-6 py-4 flex justify-between items-center rounded-t-2xl">
                <div>
                  <h2 className="text-xl font-bold text-fuchsia-300">{modalTitles[levelUpModalMode]}</h2>
                  <p className="text-sm text-gray-400">
                    Level <span className="text-white font-bold">{char.level}</span> → <span className="text-fuchsia-400 font-bold">{newLevel}</span>
                  </p>
                </div>
                <button onClick={() => setShowLevelUpModal(false)} className="text-gray-500 hover:text-white text-xl transition">✕</button>
              </div>

              <div className="px-6 py-5">

                {/* ── STEP 1: GM enters dice roll ── */}
                {levelUpStep === 1 && levelUpModalMode === 'gm-initiate' && (
                  <div className="space-y-5">
                    <div className="bg-gray-800 rounded-xl p-6 text-center border border-gray-700">
                      <div className="text-5xl mb-3">🎲</div>
                      <p className="text-gray-300 text-lg mb-1">
                        Roll <span className="text-fuchsia-400 font-bold text-3xl">{diceCount}d10</span>
                      </p>
                      <p className="text-gray-500 text-sm">
                        Reaching level {newLevel} — {newLevel} × 5 = {diceCount} ten-sided dice.
                      </p>
                      <p className="text-xs text-gray-600 mt-1">Range: {diceCount} – {diceCount * 10}</p>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-2 font-semibold uppercase tracking-wide">Enter Total Roll</label>
                      <input
                        type="number" min={diceCount} max={diceCount * 10}
                        placeholder={`${diceCount} – ${diceCount * 10}`}
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white text-2xl text-center font-bold focus:border-fuchsia-500 focus:outline-none transition"
                        value={diceRollInput} onChange={(e) => setDiceRollInput(e.target.value)}
                      />
                    </div>

                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm text-gray-400">
                      <p className="font-semibold text-gray-300 mb-1">What happens next</p>
                      <p>The player will see a button to allocate their points to stats, mana, and skills. You&apos;ll review their choices before anything is confirmed.</p>
                    </div>

                    <button
                      disabled={!diceRollInput || parseInt(diceRollInput) < 1}
                      onClick={handleGMInitiateLevelUp}
                      className="w-full py-3 bg-fuchsia-700 hover:bg-fuchsia-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-lg transition"
                    >
                      Send to Player →
                    </button>
                  </div>
                )}

                {/* ── STEP 2: Allocate points (player or GM modifying) ── */}
                {levelUpStep === 2 && (levelUpModalMode === 'player-allocate' || levelUpModalMode === 'gm-review') && (
                  AllocationUI()
                )}

                {/* ── STEP 3: GM reviews and confirms ── */}
                {levelUpStep === 3 && levelUpModalMode === 'gm-review' && (() => {
                  const changedStats = Object.entries(luStatDeltas).filter(([, v]) => (v as number) > 0)
                  const newXpMax = getXpMaxForLevel(newLevel)
                  const reviewStats = { ...char.stats }
                  Object.entries(luStatDeltas).forEach(([key, delta]) => {
                    reviewStats[key] = (reviewStats[key] || 0) + (delta as number)
                  })
                  const reviewFortitude = reviewStats['fortitude'] || 0
                  const reviewHpMax = newLevel * (25 + Math.floor(reviewFortitude / 10))
                  const reviewManaMax = (char.mana_max || 0) + luManaGain
                  return (
                    <div className="space-y-4">
                      <p className="text-gray-400 text-sm">Review the player&apos;s allocation. Modify or confirm below.</p>

                      <div className="bg-fuchsia-950/40 border border-fuchsia-800 rounded-xl p-4 space-y-3">

                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 font-semibold text-sm">Level</span>
                          <span className="font-bold text-white">{char.level} <span className="text-gray-500">→</span> <span className="text-fuchsia-400">{newLevel}</span></span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 font-semibold text-sm">XP</span>
                          <span className="font-bold text-white">{char.xp_current} <span className="text-gray-500">→</span> <span className="text-fuchsia-400">0</span> / {newXpMax.toLocaleString()}</span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 font-semibold text-sm">HP Max</span>
                          <span className="font-bold text-white">{char.hp_max} <span className="text-gray-500">→</span> <span className="text-fuchsia-400">{reviewHpMax}</span> <span className="text-green-400 text-xs">(full heal)</span></span>
                        </div>

                        {reviewManaMax !== (char.mana_max || 0) && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 font-semibold text-sm">Mana Max</span>
                            <span className="font-bold text-white">{char.mana_max || 0} <span className="text-gray-500">→</span> <span className="text-fuchsia-400">{reviewManaMax}</span> <span className="text-blue-400 text-xs">(full restore)</span></span>
                          </div>
                        )}
                        {reviewManaMax === (char.mana_max || 0) && reviewManaMax > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 font-semibold text-sm">Mana</span>
                            <span className="text-blue-400 text-xs font-semibold">Restored to full ({reviewManaMax})</span>
                          </div>
                        )}

                        {changedStats.length > 0 && (
                          <div>
                            <div className="text-gray-400 font-semibold text-sm mb-1">Stats</div>
                            {changedStats.map(([key, delta]) => (
                              <div key={key} className="flex justify-between text-sm ml-3 py-0.5">
                                <span className="text-gray-400 capitalize">{key}</span>
                                <span className="text-white">{char.stats[key] || 0} <span className="text-gray-500">→</span> <span className="text-fuchsia-400">{(char.stats[key] || 0) + (delta as number)}</span></span>
                              </div>
                            ))}
                          </div>
                        )}

                        {luSkillLevelUps.some(n => n > 0) && (
                          <div>
                            <div className="text-gray-400 font-semibold text-sm mb-1">Skills Leveled Up</div>
                            {char.skills?.map((skill: any, i: number) => {
                              const levelsAdded = luSkillLevelUps[i] || 0
                              if (!levelsAdded) return null
                              return (
                                <div key={i} className="flex justify-between text-sm ml-3 py-0.5">
                                  <span className="text-gray-400">{skill.name}</span>
                                  <span className="text-white">Lv {skill.level} <span className="text-gray-500">→</span> <span className="text-fuchsia-400">Lv {skill.level + levelsAdded}</span></span>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {luNewSkills.length > 0 && (
                          <div>
                            <div className="text-gray-400 font-semibold text-sm mb-1">New Skills</div>
                            {luNewSkills.map((skill, i) => (
                              <div key={i} className="flex justify-between text-sm ml-3 py-0.5">
                                <span className="text-gray-400">{skill.name}</span>
                                <span className="text-fuchsia-400">New — Lv {skill.level || 1}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {changedStats.length === 0 && luManaGain === 0 && !luSkillLevelUps.some(n => n > 0) && luNewSkills.length === 0 && (
                          <p className="text-gray-500 italic text-sm">No points allocated yet.</p>
                        )}

                        <div className="border-t border-fuchsia-900/60 pt-2 flex justify-between text-xs text-gray-500">
                          <span>Points used</span>
                          <span>{getLuPointsSpent()} / {pointsTotal} ({Math.max(0, pointsRemaining)} unspent)</span>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-1">
                        <button onClick={() => setLevelUpStep(2)}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-bold transition">
                          ✏️ Modify
                        </button>
                        <button onClick={handleGMConfirmLevelUp}
                          className="flex-1 py-3 bg-green-700 hover:bg-green-600 text-white font-bold rounded-lg transition">
                          ✓ Confirm Level Up
                        </button>
                      </div>
                      <button onClick={handleGMCancelLevelUp}
                        className="w-full py-2 text-red-400 hover:text-red-300 text-sm transition border border-red-900/50 rounded-lg hover:border-red-700">
                        ✕ Cancel Entire Level Up
                      </button>
                    </div>
                  )
                })()}

              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
