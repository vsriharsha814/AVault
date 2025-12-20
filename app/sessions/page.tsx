'use client';

import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { getInventorySessions, deleteInventorySession } from '../lib/firestore';
import type { InventorySession } from '../types';
import Link from 'next/link';
import AuthGuard from '../components/AuthGuard';

function SessionsPageContent() {
  const [user] = useAuthState(auth!);
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  async function loadSessions() {
    try {
      setLoading(true);
      const sessionsData = await getInventorySessions();
      setSessions(sessionsData);
    } catch (error) {
      console.error('Error loading sessions:', error);
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSession(sessionId: string, sessionName: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm(`Are you sure you want to delete "${sessionName}"? This will permanently delete the session and all its counts. This action cannot be undone.`)) {
      return;
    }

    setDeletingSessionId(sessionId);
    setError('');

    try {
      await deleteInventorySession(sessionId);
      // Reload sessions after deletion
      await loadSessions();
    } catch (err) {
      console.error('Error deleting session:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete session');
    } finally {
      setDeletingSessionId(null);
    }
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-50 via-emerald-100 to-slate-50 bg-clip-text text-transparent">
              Inventory Sessions
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              View and manage all inventory count sessions
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Link
              href="/"
              className="group relative rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-700/50 hover:shadow-lg hover:shadow-slate-900/50"
            >
              Back to Dashboard
            </Link>
            <Link
              href="/sessions/new"
              className="group relative rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-105 active:scale-95"
            >
              <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">New Session</span>
                <span className="sm:hidden">New</span>
              </span>
            </Link>
          </div>
        </header>

        {/* Sessions List */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-4 sm:p-5 lg:p-6 shadow-xl shadow-slate-900/50">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-slate-400">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-500"></div>
                <span className="text-sm">Loading sessions...</span>
              </div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-xl border border-slate-800/50 bg-slate-900/30 p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-slate-400 mb-4">No sessions yet.</p>
              <Link
                href="/sessions/new"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create your first session
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 backdrop-blur-sm">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="group flex items-center justify-between rounded-xl border border-slate-800/50 bg-slate-900/30 backdrop-blur-sm p-3 sm:p-4 transition-all hover:border-slate-700/50 hover:bg-slate-800/30 hover:shadow-md"
                  >
                    <Link
                      href={`/sessions/${session.id}/count`}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    >
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                        session.isComplete ? 'bg-emerald-500' : 'bg-yellow-500 animate-pulse'
                      }`}></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm sm:text-base font-semibold text-slate-200 truncate">{session.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-xs text-slate-500">
                            {session.date?.toDate?.().toLocaleDateString() || 'No date'}
                          </p>
                          {session.notes && (
                            <>
                              <span className="text-slate-600">•</span>
                              <p className="text-xs text-slate-500 truncate max-w-xs">{session.notes}</p>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`rounded-full px-2 sm:px-3 py-1 text-xs font-semibold border ${
                          session.isComplete
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        }`}
                      >
                        {session.isComplete ? 'Complete' : 'In Progress'}
                      </span>
                      <button
                        onClick={(e) => handleDeleteSession(session.id, session.name, e)}
                        disabled={deletingSessionId === session.id}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        title="Delete session"
                      >
                        {deletingSessionId === session.id ? (
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-400 border-t-transparent"></div>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SessionsPage() {
  return (
    <AuthGuard>
      <SessionsPageContent />
    </AuthGuard>
  );
}

