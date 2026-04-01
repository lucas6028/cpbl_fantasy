'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const TEAM_VARIANTS = {
    '統一7-ELEVEn獅': ['統一7-ELEVEn獅', '統一7-eleven獅', '統一7-11獅'],
}

function normalizeTeam(rawTeam) {
    if (!rawTeam) return rawTeam
    for (const [canonical, variants] of Object.entries(TEAM_VARIANTS)) {
        for (const variant of variants) {
            if (rawTeam.includes(variant)) return canonical
        }
    }
    return rawTeam
}

function parseDate(raw) {
    if (!raw) return null
    const cleaned = raw.replace(/\//g, '-')
    const parts = cleaned.split('-')
    if (parts.length === 3) {
        const [y, m, d] = parts
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    return cleaned
}

const ACTION_COLORS = {
    '升一軍': 'bg-green-900/50 text-green-300',
    '升': 'bg-green-900/50 text-green-300',
    '降二軍': 'bg-orange-900/50 text-orange-300',
    '降': 'bg-orange-900/50 text-orange-300',
    '新登錄': 'bg-blue-900/50 text-blue-300',
    '登錄': 'bg-blue-900/50 text-blue-300',
    '註銷': 'bg-red-900/50 text-red-300',
    '除役': 'bg-red-900/50 text-red-300',
}

export default function CpblTransactionsPage() {
    const router = useRouter()

    const getTaiwanToday = () => {
        const now = new Date()
        const taiwanOffset = 8 * 60 * 60 * 1000
        const taiwanTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + taiwanOffset)
        return taiwanTime.toISOString().split('T')[0]
    }

    const [isAdmin, setIsAdmin] = useState(false)
    const [checkingAdmin, setCheckingAdmin] = useState(true)
    const [text, setText] = useState('')
    const [fallbackDate, setFallbackDate] = useState(getTaiwanToday())
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })
    const [dailyTransactions, setDailyTransactions] = useState([])
    const [loadingDailyTransactions, setLoadingDailyTransactions] = useState(false)
    const [dailyTransactionsError, setDailyTransactionsError] = useState('')

    useEffect(() => {
        const checkAdminStatus = async () => {
            try {
                const res = await fetch('/api/username', { method: 'POST' })
                const data = await res.json()
                if (!(data?.is_admin ?? data?.isAdmin)) {
                    alert('You do not have admin privileges')
                    router.push('/home')
                    return
                }
                setIsAdmin(true)
            } catch (err) {
                console.error('Failed to check admin status:', err)
                alert('Failed to check permissions')
                router.push('/home')
            } finally {
                setCheckingAdmin(false)
            }
        }
        checkAdminStatus()
    }, [router])

    useEffect(() => {
        const fetchDailyTransactions = async () => {
            if (!fallbackDate) return
            setLoadingDailyTransactions(true)
            setDailyTransactionsError('')
            try {
                const res = await fetch(`/api/admin/cpbl-transactions?date=${fallbackDate}`)
                const data = await res.json()
                if (!res.ok || !data.success) {
                    setDailyTransactions([])
                    setDailyTransactionsError(data.error || '讀取當日異動失敗')
                    return
                }
                setDailyTransactions(data.records || [])
            } catch (err) {
                setDailyTransactions([])
                setDailyTransactionsError(err.message || '讀取當日異動失敗')
            } finally {
                setLoadingDailyTransactions(false)
            }
        }

        fetchDailyTransactions()
    }, [fallbackDate])

    // 解析預覽（與後端邏輯一致）
    const parsePreview = (rawText) => {
        if (!rawText.trim()) return []
        const lines = rawText.split('\n').filter(l => l.trim())
        let lastDate = fallbackDate
        const results = []

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i]
            const rawParts = rawLine.split('\t')
            let dateStr, name, team, action

            if (rawParts.length >= 4) {
                const possibleDate = rawParts[0].trim()
                if (possibleDate && /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(possibleDate)) {
                    lastDate = parseDate(possibleDate)
                }
                dateStr = lastDate
                name = rawParts[1].trim()
                team = rawParts[2].trim()
                action = rawParts[3].trim()
            } else if (rawParts.length === 3) {
                dateStr = lastDate
                name = rawParts[0].trim()
                team = rawParts[1].trim()
                action = rawParts[2].trim()
            } else {
                const spaceParts = rawLine.trim().split(/\s+/)
                if (spaceParts.length >= 3) {
                    if (/\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(spaceParts[0])) {
                        lastDate = parseDate(spaceParts[0])
                        name = spaceParts[1]
                        team = spaceParts[2]
                        action = spaceParts[3] || ''
                    } else {
                        name = spaceParts[0]
                        team = spaceParts[1]
                        action = spaceParts[2]
                    }
                    dateStr = lastDate
                } else {
                    results.push({ line: i + 1, raw: rawLine.trim(), valid: false, reason: '格式不正確' })
                    continue
                }
            }

            name = (name || '').replace(/[#◎*]/g, '')
            team = normalizeTeam(team)

            if (!name) {
                results.push({ line: i + 1, raw: rawLine.trim(), valid: false, reason: '缺少球員名稱' })
                continue
            }

            results.push({
                line: i + 1,
                date: dateStr,
                name,
                team,
                action,
                valid: !!action,
                reason: !action ? '缺少異動事件' : '',
                raw: rawLine.trim(),
            })
        }
        return results
    }

    const preview = parsePreview(text)
    const validCount = preview.filter(r => r.valid).length

    const handleSubmit = async () => {
        if (!text.trim()) {
            setMessage({ type: 'error', text: '⚠️ 請填寫異動內容' })
            return
        }

        setLoading(true)
        setMessage({ type: '', text: '' })

        try {
            const res = await fetch('/api/admin/cpbl-transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, date: fallbackDate }),
            })

            const result = await res.json()

            if (res.ok) {
                const warningText = result.warnings?.length > 0
                    ? `\n⚠️ 警告：\n${result.warnings.join('\n')}`
                    : ''
                const dateInfo = result.dates?.length > 0 ? ` (${result.dates.join(', ')})` : ''
                setMessage({
                    type: 'success',
                    text: `✅ 成功寫入 ${result.inserted} 筆升降異動${dateInfo}${warningText}`,
                })
                setText('')
            } else {
                const warningText = result.warnings?.length > 0
                    ? `\n⚠️ 警告：\n${result.warnings.join('\n')}`
                    : ''
                setMessage({
                    type: 'error',
                    text: `❌ ${result.error || '發生錯誤'}${warningText}`,
                })
            }
        } catch (err) {
            setMessage({ type: 'error', text: `❌ 例外錯誤：${err.message}` })
        } finally {
            setLoading(false)
        }
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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8 bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 shadow-2xl">
                    <div className="flex items-center justify-between">
                        <h1 className="text-4xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent">
                            CPBL 升降登錄
                        </h1>
                        <button
                            onClick={() => router.push('/admin')}
                            className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-white rounded-lg border border-slate-500/30 transition-colors"
                        >
                            ← Back to Admin
                        </button>
                    </div>
                    <p className="text-slate-400 mt-2 text-sm">
                        貼上 CPBL 官網異動資料，系統自動解析並寫入 real_life_transactions。
                        <span className="text-yellow-400 ml-2">當日重送會覆蓋該日所有異動。</span>
                    </p>
                </div>

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
                                <div className={`text-lg font-bold mb-6 whitespace-pre-line text-left ${message.type === 'success' ? 'text-green-200' : 'text-red-200'}`}>
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

                {/* Input Section */}
                <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 mb-6 shadow-2xl">
                    {/* Fallback Date Picker */}
                    <div className="mb-6">
                        <label className="block text-purple-300 text-sm font-semibold mb-2">
                            備用日期 <span className="text-slate-500 font-normal">（當貼上內容不含日期時使用）</span>
                        </label>
                        <input
                            type="date"
                            value={fallbackDate}
                            onChange={(e) => setFallbackDate(e.target.value)}
                            className="w-full md:w-64 bg-slate-800/60 border border-purple-500/30 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>

                    {/* Format hint */}
                    <div className="mb-4 p-3 bg-slate-800/40 border border-slate-600/40 rounded-lg">
                        <p className="text-slate-300 text-sm font-semibold mb-1">📋 格式說明</p>
                        <p className="text-slate-400 text-xs">
                            直接從 CPBL 官網複製異動表格貼上（Tab 分隔），日期合併儲存格會自動繼承
                        </p>
                        <p className="text-slate-500 text-xs mt-1">
                            格式：<span className="text-purple-300">日期 [Tab] 球員名 [Tab] 球隊 [Tab] 異動事件</span>
                        </p>
                        <p className="text-slate-500 text-xs">
                            支援：升一軍→PROMOTION、降二軍→DEMOTION、新登錄→NEW_REGISTRATION、註銷→DEREGISTERED
                        </p>
                    </div>

                    {/* Text Area */}
                    <div className="mb-4">
                        <label className="block text-purple-300 text-sm font-semibold mb-2">異動內容（貼上純文字）</label>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder={"2026/3/31\t張翔\t統一7-ELEVEn獅\t升一軍\n\t陳重羽\t統一7-ELEVEn獅\t降二軍"}
                            className="w-full h-64 bg-slate-800/60 border border-purple-500/30 text-white p-4 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-500 resize-none"
                        />
                    </div>

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={loading || validCount === 0}
                        className={`px-8 py-3 rounded-lg font-bold text-white transition-all ${loading || validCount === 0
                            ? 'bg-slate-600 cursor-not-allowed opacity-50'
                            : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg hover:shadow-purple-500/25'
                            }`}
                    >
                        {loading ? '處理中...' : `送出升降異動 (${validCount} 筆)`}
                    </button>
                </div>

                {/* Preview */}
                {preview.length > 0 && (
                    <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
                        <h2 className="text-lg font-bold text-purple-300 mb-4">
                            預覽 ({validCount}/{preview.length} 筆有效)
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-slate-400 border-b border-slate-600">
                                        <th className="pb-2 pr-3">#</th>
                                        <th className="pb-2 pr-3">日期</th>
                                        <th className="pb-2 pr-3">球員</th>
                                        <th className="pb-2 pr-3">球隊</th>
                                        <th className="pb-2 pr-3">異動</th>
                                        <th className="pb-2">狀態</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.map((row, idx) => (
                                        <tr key={idx} className={`border-b border-slate-700/50 ${!row.valid ? 'opacity-50' : ''}`}>
                                            <td className="py-2 pr-3 text-slate-500">{row.line}</td>
                                            <td className="py-2 pr-3 text-slate-300 text-xs">{row.date || '-'}</td>
                                            <td className="py-2 pr-3 text-white font-medium">{row.name || '-'}</td>
                                            <td className="py-2 pr-3 text-slate-300">{row.team || '-'}</td>
                                            <td className="py-2 pr-3">
                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ACTION_COLORS[row.action] || 'bg-slate-700 text-slate-300'
                                                    }`}>
                                                    {row.action || '-'}
                                                </span>
                                            </td>
                                            <td className="py-2">
                                                {row.valid
                                                    ? <span className="text-green-400 text-xs">✓</span>
                                                    : <span className="text-red-400 text-xs">✗ {row.reason}</span>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Daily existing transactions */}
                <div className="mt-6 bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
                    <h2 className="text-lg font-bold text-cyan-300 mb-3">
                        {fallbackDate} 已登錄完整資訊
                    </h2>

                    {loadingDailyTransactions ? (
                        <div className="text-slate-300 text-sm">載入中...</div>
                    ) : dailyTransactionsError ? (
                        <div className="text-red-300 text-sm">{dailyTransactionsError}</div>
                    ) : dailyTransactions.length === 0 ? (
                        <div className="text-slate-400 text-sm">當日尚無異動資料</div>
                    ) : (
                        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                            <table className="text-sm min-w-[1700px]">
                                <thead>
                                    <tr className="text-left text-slate-400 border-b border-slate-600">
                                        <th className="pb-2 pr-3">id</th>
                                        <th className="pb-2 pr-3">transaction_date</th>
                                        <th className="pb-2 pr-3">player_name</th>
                                        <th className="pb-2 pr-3">player_team</th>
                                        <th className="pb-2 pr-3">player_id</th>
                                        <th className="pb-2 pr-3">transaction_type</th>
                                        <th className="pb-2 pr-3">current_status</th>
                                        <th className="pb-2 pr-3">notes</th>
                                        <th className="pb-2 pr-3">created_at</th>
                                        <th className="pb-2 pr-3">status_updated_at</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dailyTransactions.map((row) => (
                                        <tr key={row.id} className="border-b border-slate-700/50 align-top">
                                            <td className="py-2 pr-3 text-slate-300 text-xs break-all">{row.id}</td>
                                            <td className="py-2 pr-3 text-slate-300">{row.transaction_date || '-'}</td>
                                            <td className="py-2 pr-3 text-white font-medium">{row.player_name || '-'}</td>
                                            <td className="py-2 pr-3 text-slate-300">{row.player_team || '-'}</td>
                                            <td className="py-2 pr-3 text-slate-400 text-xs break-all">{row.player_id || '-'}</td>
                                            <td className="py-2 pr-3">
                                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-700 text-slate-200">
                                                    {row.transaction_type || '-'}
                                                </span>
                                            </td>
                                            <td className="py-2 pr-3 text-slate-300">{row.current_status || '-'}</td>
                                            <td className="py-2 pr-3 text-slate-400 text-xs whitespace-pre-wrap">{row.notes || '-'}</td>
                                            <td className="py-2 pr-3 text-slate-400 text-xs">{row.created_at ? new Date(row.created_at).toLocaleString('zh-TW') : '-'}</td>
                                            <td className="py-2 pr-3 text-slate-400 text-xs">{row.status_updated_at ? new Date(row.status_updated_at).toLocaleString('zh-TW') : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
