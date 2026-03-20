'use client';

import React, { useEffect, useState } from 'react';

/**
 * DraftTimelineInline 元件 - 可滑動時間軸，from now to 2026-04-20
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

  // 時間範圍：now 到 2026-04-20
  const now = new Date();
  const endDate = new Date('2026-04-20T23:59:59');
  const totalTimeMs = endDate.getTime() - now.getTime();
  
  // 每個時段佔據的 pixel 寬度（1小時 = 80px）
  const pixelsPerHour = 80;
  const timelineWidth = (totalTimeMs / (1000 * 60 * 60)) * pixelsPerHour;

  const getX = (isoString) => {
    const time = new Date(isoString).getTime();
    return ((time - now.getTime()) / totalTimeMs) * timelineWidth;
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

  // 生成時間刻度（每日一個）
  const timeMarks = [];
  let currentDate = new Date(now);
  currentDate.setHours(0, 0, 0, 0);
  while (currentDate <= endDate) {
    timeMarks.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

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

      {/* 可滑動時間軸容器 */}
      <div className="overflow-x-auto rounded-lg border border-slate-700/50 bg-slate-900/40">
        <div className="relative" style={{ width: `${timelineWidth}px`, minWidth: '100%' }}>
          {/* 時間軸背景網格 */}
          <div className="absolute inset-0 flex">
            {timeMarks.map((mark, idx) => {
              const x = getX(mark.toISOString());
              const isToday = 
                mark.getDate() === now.getDate() &&
                mark.getMonth() === now.getMonth() &&
                mark.getFullYear() === now.getFullYear();
              
              return (
                <div
                  key={idx}
                  className={`absolute top-0 bottom-0 w-px ${
                    isToday
                      ? 'bg-green-500/50 shadow-lg shadow-green-500/30'
                      : 'bg-slate-700/30'
                  }`}
                  style={{ left: `${x}px` }}
                />
              );
            })}
          </div>

          {/* 選秀時段線條容器 */}
          <div className="relative h-32 p-3">
            {/* Timeline A - 上半部 */}
            <div className="absolute top-3 left-0 right-0 h-12">
              {lineA.map((draft) => {
                const startTime = new Date(draft.draft_time).getTime();
                const endTime = startTime + 90 * 60 * 1000;
                const x = getX(draft.draft_time);
                const width = ((endTime - startTime) / totalTimeMs) * timelineWidth;

                return (
                  <div
                    key={draft.league_id}
                    className="absolute h-10 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg flex items-center px-2 transition-all hover:shadow-xl hover:scale-105 cursor-pointer group border border-blue-400/50"
                    style={{
                      left: `${x}px`,
                      width: `${Math.max(width, 80)}px`,
                      top: '2px',
                    }}
                    title={`${draft.league_name}\n${formatTimeShort(draft.draft_time)}`}
                  >
                    <div className="text-xs font-bold text-blue-100 whitespace-nowrap overflow-hidden text-ellipsis">
                      {draft.queue_number ? `#${draft.queue_number}` : draft.league_name.slice(0, 6)}
                    </div>

                    {/* Hover 提示 */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white whitespace-nowrap z-20 pointer-events-none">
                      {draft.league_name}
                      <br />
                      {formatTimeShort(draft.draft_time)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Timeline B - 下半部 */}
            <div className="absolute bottom-3 left-0 right-0 h-12">
              {lineB.map((draft) => {
                const startTime = new Date(draft.draft_time).getTime();
                const endTime = startTime + 90 * 60 * 1000;
                const x = getX(draft.draft_time);
                const width = ((endTime - startTime) / totalTimeMs) * timelineWidth;

                return (
                  <div
                    key={draft.league_id}
                    className="absolute h-10 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 shadow-lg flex items-center px-2 transition-all hover:shadow-xl hover:scale-105 cursor-pointer group border border-amber-400/50"
                    style={{
                      left: `${x}px`,
                      width: `${Math.max(width, 80)}px`,
                      bottom: '2px',
                    }}
                    title={`${draft.league_name}\n${formatTimeShort(draft.draft_time)}`}
                  >
                    <div className="text-xs font-bold text-amber-100 whitespace-nowrap overflow-hidden text-ellipsis">
                      {draft.queue_number ? `#${draft.queue_number}` : draft.league_name.slice(0, 6)}
                    </div>

                    {/* Hover 提示 */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white whitespace-nowrap z-20 pointer-events-none">
                      {draft.league_name}
                      <br />
                      {formatTimeShort(draft.draft_time)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 提議時間標記（綠色豎線） */}
            {proposedTime && (
              <div
                className="absolute top-0 bottom-0 w-1 bg-green-400 shadow-lg shadow-green-500/50"
                style={{
                  left: `${getX(proposedTime)}px`,
                  zIndex: 10,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* 時間刻度標籤 */}
      <div className="overflow-x-auto rounded-lg bg-slate-900/30 p-2">
        <div className="flex gap-2 text-xs text-slate-400" style={{ width: `${timelineWidth}px`, minWidth: '100%' }}>
          {timeMarks.map((mark, idx) => {
            if (idx % 2 === 0) {
              // 每兩天顯示一次標籤
              return (
                <div
                  key={idx}
                  style={{
                    marginLeft: `${getX(mark.toISOString())}px`,
                  }}
                  className="whitespace-nowrap text-xs"
                >
                  {mark.toLocaleDateString('zh-TW', {
                    month: 'numeric',
                    day: 'numeric',
                  })}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>

      {/* 圖例 */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-400 p-2 bg-slate-900/20 rounded-lg">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600"></div>
          時間線 A
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600"></div>
          時間線 B
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-3 bg-green-400"></div>
          提議時間
        </div>
        <div className="text-slate-500">
          間隔需 ≥ {minGapMinutes} 分鐘 | 預設 1.5 小時/場
        </div>
      </div>
    </div>
  );
}
