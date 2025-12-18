'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Timestamp } from 'firebase/firestore';
import { auth } from '../../lib/firebase';
import { createInventorySession } from '../../lib/firestore';
import { getCurrentTerm } from '../../lib/terms';
import Link from 'next/link';
import AuthGuard from '../../components/AuthGuard';

function NewSessionPageContent() {
  const router = useRouter();
  const [user] = useAuthState(auth as any);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    notes: '',
  });

  const currentTermInfo = getCurrentTerm();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    
    if (!formData.name.trim()) {
      setError('Session name is required');
      return;
    }

    setSubmitting(true);

    try {
      const sessionId = await createInventorySession({
        name: formData.name.trim(),
        // Store the term snapshot now; we'll create the academicTerm entry
        // and link it when the session is completed and counts exist.
        term: currentTermInfo.term,
        termYear: currentTermInfo.year,
        date: Timestamp.now(),
        conductedByUid: user?.uid,
        isComplete: false,
        // Firestore does not allow undefined; omit notes when empty
        ...(formData.notes.trim() ? { notes: formData.notes.trim() } : {}),
      });
      
      // Redirect to the counting page
      router.push(`/sessions/${sessionId}/count`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-50 via-emerald-100 to-slate-50 bg-clip-text text-transparent flex items-center gap-2 sm:gap-3">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              New Count Session
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">Create a new inventory counting session for an academic term</p>
          </div>
          <Link
            href="/"
            className="group rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-700/50 hover:shadow-lg hover:shadow-slate-900/50"
          >
            ← Back
          </Link>
        </header>

        <form onSubmit={handleSubmit} className="rounded-xl sm:rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-4 sm:p-5 lg:p-6 shadow-xl shadow-slate-900/50 space-y-4 sm:space-y-6">
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 backdrop-blur-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
              Session Name <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g., Fall 2024 Inventory Count"
              className="w-full rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-2.5 text-sm text-slate-100 placeholder-slate-500 transition-all focus:border-emerald-500/50 focus:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Academic Term
            </label>
            <div className="rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm px-3 sm:px-4 py-2.5 sm:py-3">
              <p className="text-sm font-semibold text-slate-100">
                {currentTermInfo.name}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                This session will be locked to the current CU Boulder term based on today&apos;s
                date. The term will only be added to the database once counts are saved and the
                session is completed.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-slate-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any notes about this counting session..."
              rows={3}
              className="w-full rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-2.5 text-sm text-slate-100 placeholder-slate-500 transition-all focus:border-emerald-500/50 focus:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg sm:rounded-xl bg-emerald-500 px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Session & Start Counting'}
            </button>
            <Link
              href="/"
              className="rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-medium text-slate-200 hover:bg-slate-700/50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewSessionPage() {
  return (
    <AuthGuard>
      <NewSessionPageContent />
    </AuthGuard>
  );
}

