'use client';

import React, { useEffect, useState } from 'react';

/**
 * DraftTimelineInline 元件 - 時間軸視覺化，用線條表示選秀時長
 * @param {string} proposedTime - 提議的選秀時間 (ISO string)
 * @param {string} excludeLeagueId - 要排除的聯盟 ID
 * @param {callback} onConflictDetected - 偵測到衝突時的回調
 */
export default function DraftTimelineInline({
  proposedTime = null,
  excludeLeagueId = null,
  onConflictDetected = null,
}) {
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTimeline = async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (proposedTime) params.append('proposedTime', proposedTime);
      if (excludeLeagueId) params.append('excludeLeagueId', excludeLeagueId);

      const res = await fetch(`/api/draft-timeline?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || '無法載入時間線');
        return;
      }

      setTimelineData(data);

      if (onConflictDetected && data.conflicts && data.conflicts.length > 0) {
        onConflictDetected(data.conflicts);
      }
    } catch (err) {
      console.error('Error fetching timeline:', err);
      setError('載入時間線失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [proposedTime, excludeLeagueId]);

  if (!timelineData) {
    return null;
  }

  const { timeline, conflicts, minGapMinutes } = timelineData;
  const lineA = timeline?.lineA || [];
  const lineB = timeline?.lineB || [];
  const allDrafts = [...lineA, ...lineB];

  if (allDrafts.length === 0) {
    return null;
  }

  // 計算時間軸範圍
  const draftTimes = allDrafts
    .map(d => new Date(d.draft_time).getTime())
    .sort((a, b) => a - b);
  
  if (draftTimes.length === 0) return null;

  const minTime = draftTimes[0];
  const maxTime = draftTimes[draftTimes.length - 1] + 90 * 60 * 1000; // +1.5hr for last draft
  const timeRange = maxTime - minTime;
  const pixelsPerMinute = timeRange > 0 ? 300 / (timeRange / 60 / 1000) : 1;

  const getX = (timeMs) => {
    return ((timeMs - minTime) / timeRange) * 300;
  };

  const formatTimeShort = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="space-y-3 mt-3">
      {/* 衝突警告 */}
      {conflicts && conflicts.length > 0 && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <h4 className="font-bold text-red-300 text-sm mb-1">⚠️ 時間衝突</h4>
          <div className="space-y-0.5 text-xs text-red-200">
            {conflicts.map((conflict, idx) => (
              <div key={idx}>
                {conflict.league_name} - 相差 {conflict.minutes_apart} 分鐘
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 時間軸視覺化 */}
      <div className="relative">
        {/* 時間軸刻度背景 */}
        <div className="relative h-20 bg-slate-900/30 rounded-lg border border-slate-700/30 p-2">
          {/* 時間刻度線 */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <div
              key={ratio}
              className="absolute top-0 bottom-0 w-px bg-slate-700/20"
              style={{ left: `calc(${ratio * 100}% + ${-0.5}px)` }}
            />
          ))}

          {/* 選秀時段線條 */}
          {allDrafts.map((draft, idx) => {
            const startTime = new Date(draft.draft_time).getTime();
            const endTime = startTime + 90 * 60 * 1000; // 1.5小時
            const x = getX(startTime);
            const width = (90 * 60 * 1000 / timeRange) * 300;
            const isLineA = lineA.some(d => d.league_id === draft.league_id);
            const bgColor = isLineA
              ? 'bg-gradient-to-r from-blue-500 to-blue-600'
              : 'bg-gradient-to-r from-amber-500 to-amber-600';
            const textColor = isLineA ? 'text-blue-100' : 'text-amber-100';

            return (
              <div
                key={draft.league_id}
                className={`absolute h-7 rounded-full ${bgColor} shadow-lg flex items-center px-2 transition-all hover:shadow-xl hover:scale-105 cursor-pointer group`}
                style={{
                  left: `${x}px`,
                  width: `${Math.max(width, 60)}px`,
                  top: `${isLineA ? 2 : 10}px`,
                }}
                title={`${draft.league_name}\n${formatTimeShort(draft.draft_time)}`}
              >
                <div className={`text-xs font-bold ${textColor} whitespace-nowrap overflow-hidden text-ellipsis`}>
                  {draft.queue_number ? `#${draft.queue_number}` : ''}
                </div>

                {/* Hover 提示 */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white whitespace-nowrap z-10">
                  {draft.league_name} - {formatTimeShort(draft.draft_time)}
                </div>
              </div>
            );
          })}

          {/* 提議的時間標記（如果有） */}
          {proposedTime && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-green-400 shadow-lg shadow-green-500/50"
              style={{
                left: `${getX(new Date(proposedTime).getTime())}px`,
              }}
            />
          )}
        </div>

        {/* 時間刻度標籤 */}
        <div className="flex justify-between text-xs text-slate-400 mt-1 px-2">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const time = new Date(minTime + ratio * timeRange);
            return (
              <div key={ratio} className="text-xs">
                {time.toLocaleString('zh-TW', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* 圖例 */}
      <div className="flex gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600"></div>
          時間線 A
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-amber-500 to-amber-600"></div>
          時間線 B
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-3 bg-green-400"></div>
          提議時間
        </div>
        <div className="text-slate-500">
          間隔需 ≥ {minGapMinutes} 分鐘
        </div>
      </div>
    </div>
  );
}
