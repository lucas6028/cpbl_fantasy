'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ScheduleDelayPage() {
  const router = useRouter();
  const [affectedWeek, setAffectedWeek] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    const weekNum = Number(affectedWeek);
    if (!Number.isInteger(weekNum) || weekNum < 1) {
      setError('Fantasy week must be an integer >= 1');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/schedule-delay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affectedWeek: weekNum }),
      });

      const data = await res.json();

      if (res.status === 401 || res.status === 403) {
        alert('You do not have admin privileges');
        router.push('/home');
        return;
      }

      if (!data.success) {
        setError(data.error || 'Failed to delay schedule');
        return;
      }

      setResult(data);
    } catch (err) {
      console.error('Delay action failed:', err);
      setError('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/admin')}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fantasy Week Delay System</h1>
            <p className="text-sm text-gray-500">Delay subsequent fantasy weeks by one week for all leagues</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6">
          <div className="text-sm font-bold text-amber-900 mb-1">Week Extension Rule</div>
          <p className="text-sm text-amber-800 leading-relaxed">
            假如任一球隊在 fantasy week 區間無法完成 3 場比賽，則往後週次將全數順延一週。
          </p>
          <p className="text-xs text-amber-700 mt-2">
            This action updates date fields only in schedule_date, league_schedule, and league_matchups.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Affected Fantasy Week (N)</label>
            <input
              type="number"
              min="1"
              value={affectedWeek}
              onChange={(e) => setAffectedWeek(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-2">All weeks with week number greater than N will be shifted by +7 days.</p>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Applying Delay...' : 'Apply 1-Week Delay'}
            </button>
          </div>
        </form>

        {result && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="text-sm font-bold text-green-900 mb-1">Delay Applied</div>
            <div className="text-sm text-green-800">{result.message}</div>
            <ul className="mt-3 text-sm text-green-900 space-y-1">
              <li>schedule_date updated: {result.updated?.schedule_date ?? 0}</li>
              <li>league_schedule updated: {result.updated?.league_schedule ?? 0}</li>
              <li>league_matchups updated: {result.updated?.league_matchups ?? 0}</li>
              <li>league_matchups date mode: {result.updated?.league_matchups_date_mode ?? '-'}</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
