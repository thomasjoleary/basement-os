'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Character = {
    id: string
    name: string
    level: number
    xp_current: number
    mana_max: number
    stats: Record<string, number>
    money: { gold: number; silver: number; copper: number }
    abilities: { power_level?: number | string }[]
    inventory: { power_level?: number | string }[]
    skills: { name: string; level: number }[]
}

type Tame = {
    player_name: string | null
    job: string | null
    abilities: { power_level?: number | string }[]
    inventory: { power_level?: number | string }[]
}

type WC = Record<string, number>

type Category = {
    id: string
    label: string
    group: string
    emoji: string
    getValue: (char: Character, wordCounts: WC, wordManaTotals: WC, tamePowerLevels: WC) => number
    sortKeys?: (char: Character, wordCounts: WC, wordManaTotals: WC, tamePowerLevels: WC) => number[]
    renderValue?: (char: Character, wordCounts: WC, wordManaTotals: WC, tamePowerLevels: WC) => React.ReactNode
    formatValue?: (value: number) => string
}

function sumPL(items: { power_level?: number | string }[]): number {
    return (items ?? []).reduce((s: number, a: any) => s + (Number(a.power_level) || 0), 0)
}

const CATEGORIES: Category[] = [
    { id: 'strength',  label: 'Strength',  group: 'Stats', emoji: '💪', getValue: (c) => c.stats?.strength  ?? 0 },
    { id: 'speed',     label: 'Speed',     group: 'Stats', emoji: '⚡', getValue: (c) => c.stats?.speed     ?? 0 },
    { id: 'fortitude', label: 'Fortitude', group: 'Stats', emoji: '🛡️', getValue: (c) => c.stats?.fortitude ?? 0 },
    { id: 'magic',     label: 'Magic',     group: 'Stats', emoji: '🔮', getValue: (c) => c.stats?.magic     ?? 0 },
    {
        id: 'level_xp',
        label: 'Level',
        group: 'Level & XP',
        emoji: '⭐',
        getValue: (c) => c.level ?? 0,
        sortKeys: (c) => [c.level ?? 0, c.xp_current ?? 0],
        renderValue: (c) => (
            <div className="text-right shrink-0">
                <div className="text-yellow-400 font-mono font-bold text-lg">Lv {c.level ?? 0}</div>
                <div className="text-gray-500 text-xs font-mono">{(c.xp_current ?? 0).toLocaleString()} XP</div>
            </div>
        ),
    },
    {
        id: 'currency',
        label: 'Currency',
        group: 'Currency',
        emoji: '💰',
        getValue: (c) => c.money?.gold ?? 0,
        sortKeys: (c) => [c.money?.gold ?? 0, c.money?.silver ?? 0, c.money?.copper ?? 0],
        renderValue: (c) => (
            <div className="flex items-center gap-1.5 font-mono font-bold text-sm shrink-0">
                <span className="text-yellow-400">{(c.money?.gold   ?? 0).toLocaleString()} G</span>
                <span className="text-gray-600">|</span>
                <span className="text-slate-300">{(c.money?.silver ?? 0).toLocaleString()} S</span>
                <span className="text-gray-600">|</span>
                <span className="text-amber-600">{(c.money?.copper ?? 0).toLocaleString()} C</span>
            </div>
        ),
    },
    { id: 'words', label: 'Words of Power', group: 'Words', emoji: '📖', getValue: (c, wc) => wc[c.id] ?? 0 },
    {
        id: 'power_level',
        label: 'Power Level',
        group: 'Power',
        emoji: '⚡',
        getValue: (c, _wc, manaTotals, tamePowerLevels) => {
            const levelPts = (c.level ?? 0) * 100
            const abPts   = sumPL(c.abilities)
            const itemPts = sumPL(c.inventory)
            const statPts = Object.values(c.stats ?? {}).reduce((s: number, v: any) => s + (Number(v) || 0), 0)
            const manaPts = (c.mana_max ?? 0) * 5
            const skillPts = (c.skills ?? []).reduce((s: number, sk: any) => s + (Number(sk.level) || 0) * 50, 0)
            const wordPts = (manaTotals[c.id] ?? 0) * 25
            const tamePts = tamePowerLevels[c.id] ?? 0
            return levelPts + abPts + itemPts + statPts + manaPts + skillPts + wordPts + tamePts
        },
        formatValue: (v) => v.toLocaleString(),
    },
]

const GROUPS = Array.from(new Set(CATEGORIES.map(c => c.group)))
const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [authorized, setAuthorized] = useState(false)
    const [characters, setCharacters] = useState<Character[]>([])
    const [wordCounts, setWordCounts] = useState<WC>({})
    const [wordManaTotals, setWordManaTotals] = useState<WC>({})
    const [tamePowerLevels, setTamePowerLevels] = useState<WC>({})
    const [activeGroup, setActiveGroup] = useState(GROUPS[0])
    const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id)

    useEffect(() => {
        async function load() {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single()

            if (profile?.role !== 'gm') { router.push('/'); return }
            setAuthorized(true)

            const [{ data: chars }, { data: cw }, { data: tames }] = await Promise.all([
                supabase
                    .from('characters')
                    .select('id, name, level, xp_current, mana_max, stats, money, abilities, inventory, skills')
                    .neq('is_tame', true)
                    .neq('is_npc', true)
                    .order('name'),
                supabase
                    .from('character_words')
                    .select('character_id, words_of_power(mana_cost)'),
                supabase
                    .from('characters')
                    .select('player_name, job, abilities, inventory')
                    .eq('is_tame', true),
            ])

            setCharacters(chars ?? [])

            const counts: WC = {}
            const manaTotals: WC = {}
            for (const row of cw ?? []) {
                const cid = row.character_id
                counts[cid] = (counts[cid] ?? 0) + 1
                manaTotals[cid] = (manaTotals[cid] ?? 0) + ((row.words_of_power as any)?.mana_cost ?? 0)
            }
            setWordCounts(counts)
            setWordManaTotals(manaTotals)

            // Map each player character id → sum of their tames' power levels
            const tamePLMap: WC = {}
            for (const char of chars ?? []) {
                const firstName = char.name.split(' ')[0].toLowerCase()
                const charTames = (tames ?? []).filter((t: Tame) =>
                    t.player_name === char.name ||
                    (t.job && t.job.toLowerCase().startsWith(firstName))
                )
                tamePLMap[char.id] = charTames.reduce((s: number, t: Tame) =>
                    s + sumPL(t.abilities) + sumPL(t.inventory), 0)
            }
            setTamePowerLevels(tamePLMap)

            setLoading(false)
        }
        load()
    }, [router])

    if (loading || !authorized) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <p className="text-gray-500 animate-pulse">Loading...</p>
            </div>
        )
    }

    const categoriesInGroup = CATEGORIES.filter(c => c.group === activeGroup)
    const category = CATEGORIES.find(c => c.id === activeCategory) ?? CATEGORIES[0]

    const getKeys = (char: Character) =>
        category.sortKeys
            ? category.sortKeys(char, wordCounts, wordManaTotals, tamePowerLevels)
            : [category.getValue(char, wordCounts, wordManaTotals, tamePowerLevels)]

    const sorted = [...characters]
        .map(char => ({ char, keys: getKeys(char) }))
        .sort((a, b) => {
            for (let i = 0; i < Math.max(a.keys.length, b.keys.length); i++) {
                const diff = (b.keys[i] ?? 0) - (a.keys[i] ?? 0)
                if (diff !== 0) return diff
            }
            return 0
        })

    let rank = 1
    const ranked = sorted.map((entry, i) => {
        if (i > 0) {
            const prev = sorted[i - 1]
            const tied = entry.keys.every((v, j) => v === (prev.keys[j] ?? 0))
            if (!tied) rank = i + 1
        }
        return { ...entry, rank }
    })

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <a href="/" className="text-gray-500 hover:text-white transition-colors text-sm">← Back</a>
                <h1 className="text-3xl font-bold">🏆 Leaderboard</h1>
            </div>

            {/* Group selector */}
            <div className="flex gap-2 flex-wrap mb-3">
                {GROUPS.map(group => (
                    <button
                        key={group}
                        onClick={() => {
                            setActiveGroup(group)
                            setActiveCategory(CATEGORIES.find(c => c.group === group)!.id)
                        }}
                        className={`px-4 py-2 rounded font-semibold text-sm transition-colors ${
                            activeGroup === group
                                ? 'bg-yellow-600 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                    >
                        {group}
                    </button>
                ))}
            </div>

            {/* Category selector within group (only shown when group has multiple) */}
            {categoriesInGroup.length > 1 && (
                <div className="flex gap-2 flex-wrap mb-6">
                    {categoriesInGroup.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`px-3 py-1.5 rounded text-sm transition-colors ${
                                activeCategory === cat.id
                                    ? 'bg-gray-600 text-white'
                                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700'
                            }`}
                        >
                            {cat.emoji} {cat.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Category header */}
            <div className="text-sm text-gray-500 uppercase tracking-widest font-semibold mb-3 mt-4">
                {category.emoji} {category.label}
            </div>

            {/* Ranked list */}
            <div className="space-y-2">
                {ranked.length === 0 && (
                    <p className="text-gray-500 italic text-center py-8">No characters found.</p>
                )}
                {ranked.map(({ char, keys, rank }) => {
                    const value = keys[0]
                    return (
                        <a
                            key={char.id}
                            href={`/character/${char.id}`}
                            className="flex items-center gap-4 bg-gray-900 border border-gray-800 hover:border-yellow-700 rounded-lg px-4 py-3 transition-colors group"
                        >
                            <div className="w-8 text-center shrink-0">
                                {rank <= 3
                                    ? <span className="text-xl">{MEDALS[rank - 1]}</span>
                                    : <span className="text-gray-500 text-sm font-bold">#{rank}</span>
                                }
                            </div>
                            <div className="flex-1 font-semibold text-white group-hover:text-yellow-300 transition-colors truncate">
                                {char.name}
                            </div>
                            {category.renderValue
                                ? category.renderValue(char, wordCounts, wordManaTotals, tamePowerLevels)
                                : <div className="text-yellow-400 font-mono font-bold text-lg shrink-0">
                                    {category.formatValue ? category.formatValue(value) : value}
                                  </div>
                            }
                        </a>
                    )
                })}
            </div>
        </div>
    )
}
