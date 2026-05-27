'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Character = {
    id: string
    name: string
    level: number
    xp_current: number
    stats: Record<string, number>
    money: { gold: number; silver: number; copper: number }
}

type Category = {
    id: string
    label: string
    group: string
    emoji: string
    getValue: (char: Character, wordCounts: Record<string, number>) => number
    formatValue?: (value: number) => string
}

const CATEGORIES: Category[] = [
    { id: 'strength',  label: 'Strength',       group: 'Stats',      emoji: '💪', getValue: (c) => c.stats?.strength  ?? 0 },
    { id: 'speed',     label: 'Speed',           group: 'Stats',      emoji: '⚡', getValue: (c) => c.stats?.speed     ?? 0 },
    { id: 'fortitude', label: 'Fortitude',       group: 'Stats',      emoji: '🛡️', getValue: (c) => c.stats?.fortitude ?? 0 },
    { id: 'magic',     label: 'Magic',           group: 'Stats',      emoji: '🔮', getValue: (c) => c.stats?.magic     ?? 0 },
    { id: 'level',     label: 'Level',           group: 'Level & XP', emoji: '⭐', getValue: (c) => c.level            ?? 0 },
    { id: 'xp',        label: 'XP',              group: 'Level & XP', emoji: '✨', getValue: (c) => c.xp_current       ?? 0, formatValue: (v) => v.toLocaleString() },
    { id: 'gold',      label: 'Gold',            group: 'Currency',   emoji: '🪙', getValue: (c) => c.money?.gold      ?? 0, formatValue: (v) => v.toLocaleString() },
    { id: 'silver',    label: 'Silver',          group: 'Currency',   emoji: '🥈', getValue: (c) => c.money?.silver    ?? 0, formatValue: (v) => v.toLocaleString() },
    { id: 'copper',    label: 'Copper',          group: 'Currency',   emoji: '🟤', getValue: (c) => c.money?.copper    ?? 0, formatValue: (v) => v.toLocaleString() },
    { id: 'words',     label: 'Words of Power',  group: 'Magic',      emoji: '📖', getValue: (c, wc) => wc[c.id]       ?? 0 },
]

const GROUPS = Array.from(new Set(CATEGORIES.map(c => c.group)))

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [authorized, setAuthorized] = useState(false)
    const [characters, setCharacters] = useState<Character[]>([])
    const [wordCounts, setWordCounts] = useState<Record<string, number>>({})
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

            const [{ data: chars }, { data: cw }] = await Promise.all([
                supabase
                    .from('characters')
                    .select('id, name, level, xp_current, stats, money')
                    .neq('is_tame', true)
                    .order('name'),
                supabase
                    .from('character_words')
                    .select('character_id'),
            ])

            setCharacters(chars ?? [])

            const counts: Record<string, number> = {}
            for (const row of cw ?? []) {
                counts[row.character_id] = (counts[row.character_id] ?? 0) + 1
            }
            setWordCounts(counts)
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

    const sorted = [...characters]
        .map(char => ({ char, value: category.getValue(char, wordCounts) }))
        .sort((a, b) => b.value - a.value)

    let rank = 1
    const ranked = sorted.map((entry, i) => {
        if (i > 0 && entry.value < sorted[i - 1].value) rank = i + 1
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

            {/* Category selector within group */}
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
                {ranked.map(({ char, value, rank }) => (
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
                        <div className="text-yellow-400 font-mono font-bold text-lg shrink-0">
                            {category.formatValue ? category.formatValue(value) : value}
                        </div>
                    </a>
                ))}
            </div>
        </div>
    )
}
