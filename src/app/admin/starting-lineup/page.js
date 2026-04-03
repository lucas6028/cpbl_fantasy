'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const TEAMS = ['統一7-ELEVEn獅', '富邦悍將', '樂天桃猿', '中信兄弟', '味全龍', '台鋼雄鷹']

const TEAM_COLORS = {
    '統一7-ELEVEn獅': 'border-orange-500/40 bg-orange-500/10',
    '富邦悍將': 'border-blue-500/40 bg-blue-500/10',
    '樂天桃猿': 'border-rose-500/40 bg-rose-500/10',
    '中信兄弟': 'border-yellow-500/40 bg-yellow-500/10',
    '味全龍': 'border-red-500/40 bg-red-500/10',
    '台鋼雄鷹': 'border-green-500/40 bg-green-500/10',
}

const TEAM_TEXT = {
    '統一7-ELEVEn獅': 'text-orange-300',
    '富邦悍將': 'text-blue-300',
    '樂天桃猿': 'text-rose-300',
    '中信兄弟': 'text-yellow-300',
    '味全龍': 'text-red-300',
    '台鋼雄鷹': 'text-green-300',
}

function getTomorrowTW() {
    const now = new Date()
    const twOffset = 8 * 60 * 60 * 1000
    const twTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + twOffset)
    twTime.setDate(twTime.getDate() + 1)
    return twTime.toISOString().split('T')[0]
}

function getTodayTW() {
    const now = new Date()
    const twOffset = 8 * 60 * 60 * 1000
    const twTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + twOffset)
    return twTime.toISOString().split('T')[0]
}

export default function StartingLineupPage() {
    const router = useRouter()

    // Admin check
    const [isAdmin, setIsAdmin] = useState(false)
    const [checkingAdmin, setCheckingAdmin] = useState(true)

    // Date
    const [selectedPitcherDate, setSelectedPitcherDate] = useState(getTomorrowTW())
    const [selectedLineupDate, setSelectedLineupDate] = useState(getTodayTW())

    // Pitcher State: { team: { name: '', is_confirmed: false } }
    const [pitchers, setPitchers] = useState(() => {
        const init = {}
        TEAMS.forEach(t => { init[t] = { name: '' } })
        return init
    })

    // Lineup State: { team: [ { batting_no: 1, name: '' }, ... ] }
    const [selectedTeam, setSelectedTeam] = useState(TEAMS[0])
    const [lineups, setLineups] = useState(() => {
        const init = {}
        TEAMS.forEach(t => {
            init[t] = Array.from({ length: 9 }, (_, i) => ({ batting_no: i + 1, name: '' }))
        })
        return init
    })

    // UI State
    const [loading, setLoading] = useState(false)
    const [loadingPitchers, setLoadingPitchers] = useState(false)
    const [loadingLineups, setLoadingLineups] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })
    const [checkingPending, setCheckingPending] = useState(false)
    const [pendingLineupTeams, setPendingLineupTeams] = useState([])
    const [pendingPitcherTeams, setPendingPitcherTeams] = useState([])
    const [todayMajorTeamCount, setTodayMajorTeamCount] = useState(0)
    const [tomorrowMajorTeamCount, setTomorrowMajorTeamCount] = useState(0)
    const [playerMap, setPlayerMap] = useState({})

    const todayTW = getTodayTW()
    const tomorrowTW = getTomorrowTW()

    // Admin check
    useEffect(() => {
        const check = async () => {
            try {
                const res = await fetch('/api/username', { method: 'POST' })
                const data = await res.json()
                if (!(data?.is_admin ?? data?.isAdmin)) {
                    alert('You do not have admin privileges')
                    router.push('/home')
                    return
                }
                setIsAdmin(true)
            } catch {
                alert('Failed to check permissions')
                router.push('/home')
            } finally {
                setCheckingAdmin(false)
            }
        }
        check()
    }, [router])

    // Fetch pitcher data when pitcher date changes
    useEffect(() => {
        if (!isAdmin || !selectedPitcherDate) return
        fetchPitchers()
    }, [isAdmin, selectedPitcherDate])

    // Fetch lineup data when lineup date changes
    useEffect(() => {
        if (!isAdmin || !selectedLineupDate) return
        fetchLineups()
    }, [isAdmin, selectedLineupDate])

    useEffect(() => {
        if (!isAdmin) return
        fetchPendingTeams()
    }, [isAdmin])

    useEffect(() => {
        if (!isAdmin) return
        fetchPlayers()
    }, [isAdmin])

    const normalize = (v) => String(v || '').trim().toLowerCase()

    const makePlayerKey = (team, name) => `${normalize(team)}__${normalize(name)}`

    const fetchPlayers = async () => {
        try {
            const res = await fetch('/api/playerslist?available=false')
            const data = await res.json()
            if (!data.success || !Array.isArray(data.players)) return

            const map = {}
            data.players.forEach((p) => {
                const key = makePlayerKey(p.team || p.Team, p.name || p.Name)
                if (!map[key]) map[key] = []
                map[key].push({
                    player_id: p.player_id,
                    name: p.name || p.Name,
                    team: p.team || p.Team
                })
            })
            setPlayerMap(map)
        } catch (err) {
            console.error('Players fetch error:', err)
        }
    }

    const resolvePlayerByTeamAndName = (team, name) => {
        const key = makePlayerKey(team, name)
        const matches = playerMap[key] || []
        if (matches.length === 0) return { status: 'not_found', player: null, matches: [] }
        if (matches.length > 1) return { status: 'ambiguous', player: null, matches }
        return { status: 'ok', player: matches[0], matches }
    }

    const fetchPitchers = async () => {
        setLoadingPitchers(true)
        try {
            const pitcherRes = await fetch(`/api/admin/starting-pitcher?date=${selectedPitcherDate}`)
            const pitcherData = await pitcherRes.json()

            // Reset pitchers
            const newPitchers = {}
            TEAMS.forEach(t => { newPitchers[t] = { name: '' } })
            if (pitcherData.success && pitcherData.data) {
                pitcherData.data.forEach(p => {
                    if (newPitchers[p.team]) {
                        const pitcherName = p.name || p.player?.name || ''
                        newPitchers[p.team] = { name: pitcherName }
                    }
                })
            }
            setPitchers(newPitchers)
        } catch (err) {
            console.error('Pitcher fetch error:', err)
        } finally {
            setLoadingPitchers(false)
        }
    }

    const fetchLineups = async () => {
        setLoadingLineups(true)
        try {
            const lineupRes = await fetch(`/api/admin/starting-lineup?date=${selectedLineupDate}`)
            const lineupData = await lineupRes.json()

            // Reset lineups
            const newLineups = {}
            TEAMS.forEach(t => {
                newLineups[t] = Array.from({ length: 9 }, (_, i) => ({ batting_no: i + 1, name: '' }))
            })
            if (lineupData.success && lineupData.data) {
                lineupData.data.forEach(l => {
                    if (newLineups[l.team] && l.batting_no >= 1 && l.batting_no <= 9) {
                        newLineups[l.team][l.batting_no - 1].name = l.name || l.player?.name || ''
                    }
                })
            }
            setLineups(newLineups)
        } catch (err) {
            console.error('Lineup fetch error:', err)
        } finally {
            setLoadingLineups(false)
        }
    }

    const fetchPendingTeams = async () => {
        setCheckingPending(true)
        try {
            const [todayScheduleRes, tomorrowScheduleRes, todayLineupRes, tomorrowPitcherRes] = await Promise.all([
                fetch(`/api/admin/cpbl-schedule?date=${todayTW}`),
                fetch(`/api/admin/cpbl-schedule?date=${tomorrowTW}`),
                fetch(`/api/admin/starting-lineup?date=${todayTW}`),
                fetch(`/api/admin/starting-pitcher?date=${tomorrowTW}`)
            ])

            const [todayScheduleData, tomorrowScheduleData, todayLineupData, tomorrowPitcherData] = await Promise.all([
                todayScheduleRes.json(),
                tomorrowScheduleRes.json(),
                todayLineupRes.json(),
                tomorrowPitcherRes.json()
            ])

            const todayMajorGames = (todayScheduleData.data || []).filter(g => g.major_game !== false)
            const tomorrowMajorGames = (tomorrowScheduleData.data || []).filter(g => g.major_game !== false)

            const todayMajorTeams = [...new Set(todayMajorGames.flatMap(g => [g.away, g.home]))]
            const tomorrowMajorTeams = [...new Set(tomorrowMajorGames.flatMap(g => [g.away, g.home]))]

            setTodayMajorTeamCount(todayMajorTeams.length)
            setTomorrowMajorTeamCount(tomorrowMajorTeams.length)

            const lineupTeams = new Set((todayLineupData.data || []).map(r => r.team))
            const pitcherTeams = new Set((tomorrowPitcherData.data || []).map(r => r.team))

            setPendingLineupTeams(todayMajorTeams.filter(team => !lineupTeams.has(team)))
            setPendingPitcherTeams(tomorrowMajorTeams.filter(team => !pitcherTeams.has(team)))
        } catch (err) {
            console.error('Pending teams check error:', err)
        } finally {
            setCheckingPending(false)
        }
    }

    // Save Pitchers
    const savePitchers = async () => {
        setLoading(true)
        try {
            const pitcherList = TEAMS
                .map(t => {
                    const rawName = pitchers[t].name?.trim()
                    if (!rawName) return null
                    const resolved = resolvePlayerByTeamAndName(t, rawName)
                    if (resolved.status !== 'ok') return { team: t, name: rawName, invalid: true }
                    return { team: t, name: rawName, player_id: resolved.player.player_id }
                })
                .filter(Boolean)

            const invalidPitchers = pitcherList.filter(p => p.invalid)
            if (invalidPitchers.length > 0) {
                setMessage({ type: 'error', text: `❌ 找不到或重複球員：${invalidPitchers.map(p => `${p.team} ${p.name}`).join('、')}` })
                return
            }

            const res = await fetch('/api/admin/starting-pitcher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: selectedPitcherDate, pitchers: pitcherList })
            })
            const data = await res.json()
            if (data.success) {
                setMessage({ type: 'success', text: `✅ 先發投手已儲存 (${data.inserted} 筆)` })
                fetchPendingTeams()
            } else {
                setMessage({ type: 'error', text: `❌ ${data.error}` })
            }
        } catch (err) {
            setMessage({ type: 'error', text: `❌ ${err.message}` })
        } finally {
            setLoading(false)
        }
    }

    // Save Lineup for selected team
    const saveLineup = async (team) => {
        setLoading(true)
        try {
            const resolvedLineup = lineups[team].map(slot => {
                const rawName = slot.name?.trim()
                if (!rawName) return { batting_no: slot.batting_no, player_id: null }
                const resolved = resolvePlayerByTeamAndName(team, rawName)
                if (resolved.status !== 'ok') {
                    return { batting_no: slot.batting_no, player_id: null, invalidName: rawName }
                }
                return { batting_no: slot.batting_no, player_id: resolved.player.player_id }
            })

            const invalid = resolvedLineup.filter(x => x.invalidName)
            if (invalid.length > 0) {
                setMessage({ type: 'error', text: `❌ ${team} 名單有無法匹配球員：${invalid.map(x => `第${x.batting_no}棒 ${x.invalidName}`).join('、')}` })
                return
            }

            const res = await fetch('/api/admin/starting-lineup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedLineupDate,
                    team,
                    lineup: resolvedLineup
                })
            })
            const data = await res.json()
            if (data.success) {
                setMessage({ type: 'success', text: `✅ ${team} 先發打序已儲存 (${data.inserted} 人)` })
                fetchPendingTeams()
            } else {
                setMessage({ type: 'error', text: `❌ ${data.error}` })
            }
        } catch (err) {
            setMessage({ type: 'error', text: `❌ ${err.message}` })
        } finally {
            setLoading(false)
        }
    }

    // Save all lineups at once
    const saveAllLineups = async () => {
        setLoading(true)
        let totalInserted = 0
        try {
            for (const team of TEAMS) {
                const hasData = lineups[team].some(l => l.name.trim())
                if (!hasData) continue

                const resolvedLineup = lineups[team].map(slot => {
                    const rawName = slot.name?.trim()
                    if (!rawName) return { batting_no: slot.batting_no, player_id: null }
                    const resolved = resolvePlayerByTeamAndName(team, rawName)
                    if (resolved.status !== 'ok') {
                        return { batting_no: slot.batting_no, player_id: null, invalidName: rawName }
                    }
                    return { batting_no: slot.batting_no, player_id: resolved.player.player_id }
                })

                const invalid = resolvedLineup.filter(x => x.invalidName)
                if (invalid.length > 0) {
                    setMessage({ type: 'error', text: `❌ ${team} 有無法匹配球員：${invalid.map(x => `第${x.batting_no}棒 ${x.invalidName}`).join('、')}` })
                    return
                }

                const res = await fetch('/api/admin/starting-lineup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        date: selectedLineupDate,
                        team,
                        lineup: resolvedLineup
                    })
                })
                const data = await res.json()
                if (data.success) totalInserted += data.inserted
            }
            setMessage({ type: 'success', text: `✅ 全部先發打序已儲存 (${totalInserted} 人)` })
            fetchPendingTeams()
        } catch (err) {
            setMessage({ type: 'error', text: `❌ ${err.message}` })
        } finally {
            setLoading(false)
        }
    }

    // Handlers
    const updatePitcher = (team, field, value) => {
        setPitchers(prev => ({
            ...prev,
            [team]: { ...prev[team], [field]: value }
        }))
    }

    const updateLineup = (team, index, name) => {
        setLineups(prev => {
            const newLineup = [...prev[team]]
            newLineup[index] = { ...newLineup[index], name }
            return { ...prev, [team]: newLineup }
        })
    }

    if (checkingAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                <div className="text-xl text-white">Loading...</div>
            </div>
        )
    }
    if (!isAdmin) return null

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">

                {/* Message Modal */}
                {message.text && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className={`relative max-w-lg w-full mx-4 p-8 rounded-2xl shadow-2xl ${message.type === 'success'
                            ? 'bg-gradient-to-br from-green-900 to-green-800 border-2 border-green-400'
                            : 'bg-gradient-to-br from-red-900 to-red-800 border-2 border-red-400'
                            }`}>
                            <div className="text-center">
                                <div className={`text-6xl mb-4 ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                    {message.type === 'success' ? '✓' : '✗'}
                                </div>
                                <div className={`text-lg font-bold mb-6 ${message.type === 'success' ? 'text-green-200' : 'text-red-200'}`}>
                                    {message.text}
                                </div>
                                <button
                                    onClick={() => setMessage({ type: '', text: '' })}
                                    className={`px-6 py-2 rounded-lg font-semibold transition-colors ${message.type === 'success'
                                        ? 'bg-green-500 hover:bg-green-600 text-white'
                                        : 'bg-red-500 hover:bg-red-600 text-white'
                                        }`}
                                >
                                    確認
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="mb-8 bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 md:p-8 shadow-2xl">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent">
                                ⚾ 先發名單管理
                            </h1>
                            <p className="text-slate-400 mt-1 text-sm">登錄每日先發投手與先發打序</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.push('/admin')}
                                className="px-4 py-3 bg-slate-700/50 hover:bg-slate-600/50 text-white rounded-lg border border-slate-500/30 transition-colors whitespace-nowrap"
                            >
                                ← 返回
                            </button>
                        </div>
                    </div>
                </div>

                {(loading || loadingPitchers || loadingLineups) && (
                    <div className="text-center py-4">
                        <div className="inline-block w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}

                {/* Pending Registration Check (Major League) */}
                <div className="mb-8 bg-gradient-to-br from-yellow-600/15 to-amber-600/15 backdrop-blur-lg border border-yellow-500/30 rounded-2xl p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-yellow-300">⚠️ 一軍未登錄檢查</h2>
                        {checkingPending && <span className="text-xs text-yellow-200/80">檢查中...</span>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border border-yellow-500/30 bg-slate-900/40">
                            <div className="text-sm font-semibold text-yellow-200 mb-2">今日 ({todayTW}) 未登錄打序</div>
                            {todayMajorTeamCount === 0 ? (
                                <div className="text-xs text-slate-300">無一軍賽程</div>
                            ) : pendingLineupTeams.length === 0 ? (
                                <div className="text-xs text-emerald-300">全部已登錄</div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {pendingLineupTeams.map(team => (
                                        <span key={team} className="px-2 py-1 rounded bg-yellow-800/30 border border-yellow-500/30 text-xs text-yellow-100">
                                            {team}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 rounded-xl border border-yellow-500/30 bg-slate-900/40">
                            <div className="text-sm font-semibold text-yellow-200 mb-2">明日 ({tomorrowTW}) 未登錄先發投手</div>
                            {tomorrowMajorTeamCount === 0 ? (
                                <div className="text-xs text-slate-300">無一軍賽程</div>
                            ) : pendingPitcherTeams.length === 0 ? (
                                <div className="text-xs text-emerald-300">全部已登錄</div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {pendingPitcherTeams.map(team => (
                                        <span key={team} className="px-2 py-1 rounded bg-yellow-800/30 border border-yellow-500/30 text-xs text-yellow-100">
                                            {team}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ===== Section 1: Starting Pitchers ===== */}
                <div className="mb-8 bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-purple-300 flex items-center gap-2">
                                🔥 先發投手
                            </h2>
                            <input
                                type="date"
                                value={selectedPitcherDate}
                                onChange={e => setSelectedPitcherDate(e.target.value)}
                                className="bg-slate-800/60 border border-purple-500/30 text-white p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <button
                            onClick={savePitchers}
                            disabled={loading}
                            className="px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-lg shadow-lg transition-all disabled:opacity-50"
                        >
                            儲存投手
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {TEAMS.map(team => {
                            const resolved = resolvePlayerByTeamAndName(team, pitchers[team].name)
                            return (
                            <div key={team} className={`p-4 rounded-xl border ${TEAM_COLORS[team]} transition-all`}>
                                <div className={`text-sm font-bold mb-3 ${TEAM_TEXT[team]}`}>{team}</div>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="text"
                                        value={pitchers[team].name}
                                        onChange={e => updatePitcher(team, 'name', e.target.value)}
                                        placeholder="投手姓名"
                                        className="flex-1 bg-slate-800/60 border border-slate-600/40 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-500"
                                    />
                                </div>
                                <div className="mt-2 text-[11px]">
                                    {!pitchers[team].name?.trim() && <span className="text-slate-400">尚未輸入</span>}
                                    {pitchers[team].name?.trim() && resolved.status === 'ok' && (
                                        <span className="text-emerald-300">player_id: {resolved.player.player_id}</span>
                                    )}
                                    {pitchers[team].name?.trim() && resolved.status === 'not_found' && (
                                        <span className="text-amber-300">找不到此隊伍的同名球員</span>
                                    )}
                                    {pitchers[team].name?.trim() && resolved.status === 'ambiguous' && (
                                        <span className="text-amber-300">同隊有重複姓名，請改用更精確名稱</span>
                                    )}
                                </div>
                            </div>
                        )})}
                    </div>
                </div>

                {/* ===== Section 2: Starting Lineup ===== */}
                <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-purple-300 flex items-center gap-2">
                                📋 先發打序
                            </h2>
                            <input
                                type="date"
                                value={selectedLineupDate}
                                onChange={e => setSelectedLineupDate(e.target.value)}
                                className="bg-slate-800/60 border border-purple-500/30 text-white p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <button
                            onClick={saveAllLineups}
                            disabled={loading}
                            className="px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-lg shadow-lg transition-all disabled:opacity-50"
                        >
                            全部儲存
                        </button>
                    </div>

                    {/* Team Tabs */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        {TEAMS.map(team => {
                            const hasData = lineups[team]?.some(l => l.name.trim())
                            return (
                                <button
                                    key={team}
                                    onClick={() => setSelectedTeam(team)}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${selectedTeam === team
                                        ? `${TEAM_COLORS[team]} ${TEAM_TEXT[team]} ring-2 ring-purple-400/40`
                                        : 'border-slate-600/40 text-slate-400 hover:text-white hover:border-slate-500'
                                        }`}
                                >
                                    {team}
                                    {hasData && <span className="ml-1.5 w-2 h-2 inline-block rounded-full bg-green-400"></span>}
                                </button>
                            )
                        })}
                    </div>

                    {/* Lineup Input */}
                    <div className={`p-5 rounded-xl border ${TEAM_COLORS[selectedTeam]} mb-4`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={`text-lg font-bold ${TEAM_TEXT[selectedTeam]}`}>{selectedTeam}</h3>
                            <button
                                onClick={() => saveLineup(selectedTeam)}
                                disabled={loading}
                                className="px-4 py-1.5 bg-slate-700/60 hover:bg-slate-600/60 text-white text-sm rounded-lg border border-slate-500/30 transition-colors disabled:opacity-50"
                            >
                                儲存此隊
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {lineups[selectedTeam]?.map((slot, idx) => (
                                <div key={idx} className="flex flex-col gap-1">
                                    <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700/60 text-slate-300 text-sm font-bold shrink-0">
                                        {slot.batting_no}
                                    </span>
                                    <input
                                        type="text"
                                        value={slot.name}
                                        onChange={e => updateLineup(selectedTeam, idx, e.target.value)}
                                        placeholder={`第 ${slot.batting_no} 棒`}
                                        className="flex-1 bg-slate-800/60 border border-slate-600/40 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-500"
                                    />
                                </div>
                                    {(() => {
                                        const resolved = resolvePlayerByTeamAndName(selectedTeam, slot.name)
                                        if (!slot.name?.trim()) return <div className="pl-11 text-[11px] text-slate-400">尚未輸入</div>
                                        if (resolved.status === 'ok') return <div className="pl-11 text-[11px] text-emerald-300">player_id: {resolved.player.player_id}</div>
                                        if (resolved.status === 'not_found') return <div className="pl-11 text-[11px] text-amber-300">找不到此隊伍的同名球員</div>
                                        return <div className="pl-11 text-[11px] text-amber-300">同隊有重複姓名，請改用更精確名稱</div>
                                    })()}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Overview: All Teams Summary */}
                    <div className="mt-6">
                        <h3 className="text-sm font-semibold text-slate-400 mb-3">全隊概覽</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {TEAMS.map(team => {
                                const filled = lineups[team]?.filter(l => l.name.trim()) || []
                                const pitcher = pitchers[team]
                                if (filled.length === 0 && !pitcher?.name?.trim()) return null
                                return (
                                    <div
                                        key={team}
                                        onClick={() => setSelectedTeam(team)}
                                        className={`p-3 rounded-lg border cursor-pointer transition-all hover:ring-1 hover:ring-purple-400/40 ${TEAM_COLORS[team]}`}
                                    >
                                        <div className={`text-xs font-bold mb-2 ${TEAM_TEXT[team]}`}>{team}</div>
                                        {pitcher?.name?.trim() && (
                                            <div className="text-xs text-slate-300 mb-1">
                                                <span className="text-purple-400">SP:</span> {pitcher.name}
                                            </div>
                                        )}
                                        {filled.length > 0 && (
                                            <div className="text-xs text-slate-400">
                                                {filled.map(l => `${l.batting_no}.${l.name}`).join(' → ')}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
