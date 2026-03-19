'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminAnnouncementsPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    is_active: true
  });

  // Check admin access and load announcements
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const userIdCookie = document.cookie
          .split('; ')
          .find(row => row.startsWith('user_id='));
        const userId = userIdCookie?.split('=')[1];

        if (!userId) {
          router.push('/login');
          return;
        }

        // Check if user is admin
        const adminRes = await fetch(`/api/admin/check?userId=${userId}`);
        const adminData = await adminRes.json();

        if (!adminData.isAdmin) {
          router.push('/home');
          return;
        }

        setIsAdmin(true);
        loadAnnouncements(userId);
      } catch (e) {
        console.error('Error checking access:', e);
        setError('Failed to verify admin access');
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [router]);

  const loadAnnouncements = async (userId) => {
    try {
      const res = await fetch(`/api/admin/announcements?userId=${userId}`);
      const data = await res.json();

      if (data.success) {
        setAnnouncements(data.announcements);
      } else {
        setError(data.error || 'Failed to load announcements');
      }
    } catch (e) {
      console.error('Error loading announcements:', e);
      setError('Error loading announcements');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const userIdCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('user_id='));
      const userId = userIdCookie?.split('=')[1];

      const method = editingId ? 'PUT' : 'POST';
      const url = editingId
        ? `/api/admin/announcements?userId=${userId}&id=${editingId}`
        : `/api/admin/announcements?userId=${userId}`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (data.success) {
        setMessage(data.message);
        setFormData({ title: '', content: '', is_active: true });
        setEditingId(null);
        setShowForm(false);
        loadAnnouncements(userId);
      } else {
        setError(data.error || 'Failed to save announcement');
      }
    } catch (e) {
      console.error('Error saving announcement:', e);
      setError('Error saving announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (announcement) => {
    setEditingId(announcement.id);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      is_active: announcement.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('確定要刪除這個公告嗎？')) return;

    setDeleting(id);
    setMessage('');
    setError('');

    try {
      const userIdCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('user_id='));
      const userId = userIdCookie?.split('=')[1];

      const res = await fetch(`/api/admin/announcements?userId=${userId}&id=${id}`, {
        method: 'DELETE'
      });

      const data = await res.json();

      if (data.success) {
        setMessage(data.message);
        loadAnnouncements(userId);
      } else {
        setError(data.error || 'Failed to delete announcement');
      }
    } catch (e) {
      console.error('Error deleting announcement:', e);
      setError('Error deleting announcement');
    } finally {
      setDeleting(null);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ title: '', content: '', is_active: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full"></div>
          </div>
          <p className="mt-4 text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin')}
            className="text-purple-400 hover:text-purple-300 flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Admin
          </button>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 shadow-2xl mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black text-white mb-2">Announcements</h1>
              <p className="text-slate-300">
                Manage system announcements that all users will see
              </p>
            </div>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold px-6 py-3 rounded-lg border border-green-500/30 shadow-lg shadow-green-500/30 transition-all"
              >
                New Announcement
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
            <p className="text-green-300 font-semibold">{message}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-red-300 font-semibold">{error}</p>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 shadow-2xl mb-8">
            <h2 className="text-2xl font-black text-white mb-6">
              {editingId ? 'Edit Announcement' : 'Create New Announcement'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter announcement title"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:bg-slate-700"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Content
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter announcement content"
                  rows={6}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:bg-slate-700 resize-none"
                  required
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="is_active" className="text-white font-semibold">
                  Publish now (make active)
                </label>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-lg border border-purple-500/30 shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </span>
                  ) : (
                    editingId ? 'Update Announcement' : 'Create Announcement'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-3 bg-slate-700/50 hover:bg-slate-700 text-white font-bold rounded-lg border border-slate-600/50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Announcements List */}
        <div className="space-y-4">
          {announcements.length === 0 ? (
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 text-center">
              <p className="text-slate-400">No announcements yet</p>
            </div>
          ) : (
            announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 shadow-lg hover:border-purple-500/50 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">{announcement.title}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          announcement.is_active
                            ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                            : 'bg-slate-500/20 text-slate-300 border border-slate-500/50'
                        }`}
                      >
                        {announcement.is_active ? 'Active' : 'Draft'}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm mb-3 whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                    <p className="text-slate-500 text-xs">
                      Created: {new Date(announcement.created_at).toLocaleString('en-US')}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleEdit(announcement)}
                    className="flex-1 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-bold rounded-lg border border-blue-500/50 transition-all"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(announcement.id)}
                    disabled={deleting === announcement.id}
                    className="flex-1 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 font-bold rounded-lg border border-red-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting === announcement.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
