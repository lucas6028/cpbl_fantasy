'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

function toLocalInputValue(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';

  const pad = (v) => String(v).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hour = pad(d.getHours());
  const minute = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatDateTime(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function DraftReschedulePage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingLeagueId, setSavingLeagueId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [rows, setRows] = useState([]);
  const [editMap, setEditMap] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  const [openWindow, setOpenWindow] = useState(null);
  const [openWindowAt, setOpenWindowAt] = useState(null);
  const [batchSize, setBatchSize] = useState(5);
  const [minGapMinutes, setMinGapMinutes] = useState(90);

  const fetchData = useCallback(async (manual = false) => {
    if (manual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/draft-reschedule');
      const data = await res.json();

      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to load draft reschedule data');
        return;
      }

      setRows(data.leagues || []);
      setOpenWindow(data.openWindow || null);
      setOpenWindowAt(data.openWindowAt || null);
      setBatchSize(data.batchSize || 5);
      setMinGapMinutes(data.minGapMinutes || 90);

      const nextEditMap = {};
      (data.leagues || []).forEach((league) => {
        nextEditMap[league.league_id] = {
          draftTime: toLocalInputValue(league.rescheduled_draft_time || league.live_draft_time),
        };
      });
      setEditMap(nextEditMap);
    } catch (err) {
      console.error(err);
      setError('Unexpected error while loading draft reschedule data');
    } finally {
      if (manual) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      return (
        String(row.league_name || '').toLowerCase().includes(term) ||
        String(row.commissioner || '').toLowerCase().includes(term) ||
        String(row.queue_number || '').toLowerCase().includes(term)
      );
    });
  }, [rows, searchTerm]);

  const updateDraftTime = (leagueId, value) => {
    setEditMap((prev) => ({
      ...prev,
      [leagueId]: {
        ...(prev[leagueId] || {}),
        draftTime: value,
      },
    }));
  };

  const handleSave = async (league) => {
    const edit = editMap[league.league_id] || {};
    if (!edit.draftTime) {
      setError('請先填入重排時間');
      setSuccess('');
      return;
    }

    const d = new Date(edit.draftTime);
    if (Number.isNaN(d.getTime())) {
      setError('重排時間格式不正確');
      setSuccess('');
      return;
    }

    setSavingLeagueId(league.league_id);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/draft-reschedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId: league.league_id,
          draftTime: d.toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (Array.isArray(data.conflicts) && data.conflicts.length > 0) {
          const c = data.conflicts[0];
          setError(`時間衝突：與 ${c.league_name || c.league_id} 僅差 ${c.minutes_apart} 分鐘`);
        } else {
          setError(data.error || 'Save failed');
        }
        return;
      }

      setSuccess(`已儲存：${league.league_name} 重排為 ${formatDateTime(data.draft_time)}`);
      await fetchData(true);
    } catch (err) {
      console.error(err);
      setError('儲存失敗，請稍後再試');
    } finally {
      setSavingLeagueId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-slate-300">Loading draft reschedule...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-white">Draft Reschedule</h1>
            <p className="text-sm text-slate-300 mt-1">
              所有人可查看聯盟、號碼牌與重排時間；只有輪到號碼且為 Commissioner 可寫入。
            </p>
            <p className="text-xs text-slate-400 mt-1">
              規則：每次放行 {batchSize} 個號碼（{openWindow ? `${openWindow.start}-${openWindow.end}` : '目前無開放批次'}），且同時最多 2 盟；第 3 盟需至少間隔 {minGapMinutes} 分鐘。逾期可排（例如目前 6-10 開放時，1-5 也可排）。
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {openWindowAt
                ? `目前批次開放時間：${formatDateTime(openWindowAt)}`
                : '目前尚未到第一批開放時間'}
            </p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:opacity-60"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋聯盟 / Commissioner / 號碼牌"
            className="w-full sm:w-[420px] border border-slate-600 bg-slate-900/70 text-slate-100 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {success}
          </div>
        )}

        <div className="bg-slate-900/60 border border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800/90 border-b border-slate-700">
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-300 uppercase">League</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-slate-300 uppercase">Commissioner</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-slate-300 uppercase">號碼牌</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-slate-300 uppercase">目前時間</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-slate-300 uppercase">重排時間</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-slate-300 uppercase">權限</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400">沒有符合條件的聯盟</td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const edit = editMap[row.league_id] || {};
                    const isSaving = savingLeagueId === row.league_id;
                    return (
                      <tr key={row.league_id} className={row.can_edit ? 'bg-emerald-500/5' : ''}>
                        <td className="px-3 py-3">
                          <div className="font-semibold text-slate-100">{row.league_name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{row.league_id}</div>
                        </td>
                        <td className="px-3 py-3 text-center text-slate-200">{row.commissioner}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex px-2 py-1 rounded-md border border-slate-600 text-slate-200 text-xs">
                            {row.queue_number ?? '-'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center text-slate-300">{formatDateTime(row.effective_draft_time)}</td>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="datetime-local"
                            value={edit.draftTime || ''}
                            onChange={(e) => updateDraftTime(row.league_id, e.target.value)}
                            disabled={!row.can_edit || isSaving}
                            className="w-[210px] border border-slate-600 rounded-md px-2 py-1.5 text-xs bg-slate-800 text-slate-100 disabled:opacity-45"
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          {row.can_edit ? (
                            <button
                              onClick={() => handleSave(row)}
                              disabled={isSaving}
                              className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-60"
                            >
                              {isSaving ? 'Saving...' : '儲存'}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">
                              {row.is_my_league_commissioner ? '尚未輪到' : '非本盟 Commissioner'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
