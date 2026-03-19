'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AnnouncementsPage() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadAnnouncements();
    checkAdminStatus();
  }, []);

  const loadAnnouncements = async () => {
    try {
      const res = await fetch('/api/announcements');
      const data = await res.json();

      if (data.success) {
        setAnnouncements(data.announcements);
      } else {
        setError(data.error || 'Failed to load announcements');
      }
    } catch (e) {
      console.error('Error loading announcements:', e);
      setError('Error loading announcements');
    } finally {
      setLoading(false);
    }
  };

  const checkAdminStatus = async () => {
    try {
      const userIdCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('user_id='));
      const userId = userIdCookie?.split('=')[1];

      if (userId) {
        const res = await fetch(`/api/admin/check?userId=${userId}`);
        const data = await res.json();
        setIsAdmin(data.isAdmin || false);
      }
    } catch (e) {
      console.error('Error checking admin status:', e);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => router.push('/home')}
              className="text-purple-400 hover:text-purple-300 flex items-center gap-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </button>
            {isAdmin && (
              <button
                onClick={() => router.push('/admin/announcements')}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-lg border border-purple-500/30 shadow-lg shadow-purple-500/30 transition-all"
              >
                Manage Announcements
              </button>
            )}
          </div>

          <h1 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent mb-2">
            Announcements
          </h1>
          <p className="text-slate-400">Latest system announcements and updates</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-red-300 font-semibold">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin">
              <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full"></div>
            </div>
            <p className="mt-4 text-slate-400">Loading announcements...</p>
          </div>
        )}

        {/* Announcements List */}
        {!loading && (
          <div className="space-y-6">
            {announcements.length === 0 ? (
              <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-12 text-center">
                <svg
                  className="w-16 h-16 mx-auto text-slate-500 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-slate-400 text-lg">No announcements at the moment</p>
              </div>
            ) : (
              announcements.map((announcement, index) => (
                <div
                  key={announcement.id}
                  className="group bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 shadow-lg hover:border-purple-500/60 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                  style={{
                    animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`
                  }}
                >
                  <div className="mb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-400 to-blue-400"></div>
                      <h2 className="text-2xl sm:text-3xl font-black text-white group-hover:text-purple-300 transition-colors">
                        {announcement.title}
                      </h2>
                    </div>

                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
                      {announcement.content}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-purple-500/20">
                    <span className="text-xs text-slate-500 font-medium">
                      {new Date(announcement.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Animation */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
