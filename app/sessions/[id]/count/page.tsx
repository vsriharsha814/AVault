'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../../lib/firebase';
import {
  getInventorySession,
  getItems,
  getCategories,
  getInventoryCounts,
  createOrUpdateInventoryCount,
  updateInventorySession,
  findOrCreateAcademicTermByCode,
  syncHistoricalCountsFromSession,
} from '../../../lib/firestore';
import type { InventorySession, Item, Category, InventoryCount } from '../../../types';
import Link from 'next/link';
import AuthGuard from '../../../components/AuthGuard';

function CountSessionPageContent() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  // Cast auth because it can be null when Firebase isn't configured; that case
  // is handled in AuthGuard wrapping this page.
  const [user] = useAuthState(auth as any);
  
  const [session, setSession] = useState<InventorySession | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<InventoryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [completingSession, setCompletingSession] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (sessionId) {
      loadData();
    }
  }, [sessionId]);

  // Reload data when page becomes visible (e.g., returning from add item/category)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && sessionId) {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [sessionId]);

  async function loadData() {
    try {
      setLoading(true);
      const [sessionData, itemsData, categoriesData, countsData] = await Promise.all([
        getInventorySession(sessionId),
        getItems(),
        getCategories(),
        getInventoryCounts(sessionId),
      ]);

      if (!sessionData) {
        setError('Session not found');
        return;
      }

      setSession(sessionData);
      setItems(itemsData);
      setCategories(categoriesData);
      setCounts(countsData);

      // Initialize item counts from existing counts
      const countsMap: Record<string, number> = {};
      countsData.forEach((count) => {
        countsMap[count.itemId] = count.countedQuantity;
      });
      setItemCounts(countsMap);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load session data');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCount(itemId: string, quantity: number) {
    if (!session) return;

    // Allow saving 0 or any positive number
    if (quantity < 0) {
      setError('Count cannot be negative');
      return;
    }

    setSavingItemId(itemId);
    setError('');

    try {
      // This function handles both create and update - if count exists, it updates; otherwise creates
      await createOrUpdateInventoryCount(itemId, sessionId, quantity, user?.uid);
      
      // Update local state immediately for better UX
      setItemCounts(prev => ({ ...prev, [itemId]: quantity }));
      
      // Reload counts to get updated data
      const updatedCounts = await getInventoryCounts(sessionId);
      setCounts(updatedCounts);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save count');
      // Revert local state on error
      const existingCount = counts.find(c => c.itemId === itemId);
      if (existingCount) {
        setItemCounts(prev => ({ ...prev, [itemId]: existingCount.countedQuantity }));
      }
    } finally {
      setSavingItemId(null);
    }
  }

  async function handleCompleteSession() {
    if (!session || completingSession) {
      return;
    }

    if (!confirm('Mark this session as complete? You can still edit counts later.')) {
      return;
    }

    setCompletingSession(true);
    setError('');

    try {
      let academicTermId = session.academicTermId;

      // If this session isn't yet linked to an academic term, create/find it now
      // using the term snapshot that was stored when the session was created.
      if (!academicTermId && session.term && session.termYear) {
        const termDoc = await findOrCreateAcademicTermByCode(
          session.term,
          session.termYear,
          `${session.term} ${session.termYear}`
        );
        academicTermId = termDoc.id;
        await updateInventorySession(sessionId, { academicTermId });
      }

      await updateInventorySession(sessionId, { isComplete: true });
      setSession({ ...session, isComplete: true, academicTermId });

      // When a session is completed, push its counts into the historical counts
      // for the associated academic term so the dashboard reflects the latest data.
      if (academicTermId) {
        await syncHistoricalCountsFromSession(sessionId, academicTermId);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to complete session');
    } finally {
      setCompletingSession(false);
    }
  }

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || item.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group items by category
  const itemsByCategory: Record<string, Item[]> = {};
  filteredItems.forEach((item) => {
    const category = categories.find((c) => c.id === item.categoryId);
    const categoryName = category?.name || 'Uncategorized';
    if (!itemsByCategory[categoryName]) {
      itemsByCategory[categoryName] = [];
    }
    itemsByCategory[categoryName].push(item);
  });

  const countedItems = Object.keys(itemCounts).length;
  const totalItems = items.length;
  const progressPercent = totalItems > 0 ? (countedItems / totalItems) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-500"></div>
          <span>Loading session...</span>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <Link href="/" className="text-emerald-400 hover:text-emerald-300">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-50 via-emerald-100 to-slate-50 bg-clip-text text-transparent">
              {session?.name || 'Count Session'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Count items incrementally - save as you go, update counts when you find more items
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Link
              href={`/categories?returnTo=/sessions/${sessionId}/count`}
              className="group rounded-lg sm:rounded-xl border border-blue-500/30 bg-blue-500/10 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-blue-400 transition-all hover:border-blue-500/50 hover:bg-blue-500/20 flex items-center gap-1.5"
              title="Add new category"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Add Category</span>
              <span className="sm:hidden">Category</span>
            </Link>
            <Link
              href="/"
              className="group rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-700/50"
            >
              ← Dashboard
            </Link>
            {session && !session.isComplete && (
              <button
                onClick={handleCompleteSession}
                disabled={completingSession}
                className="rounded-lg sm:rounded-xl bg-emerald-500 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center gap-2"
              >
                {completingSession ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    <span>Completing...</span>
                  </>
                ) : (
                  'Mark Complete'
                )}
              </button>
            )}
            {session?.isComplete && (
              <>
                {!isEditMode ? (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="rounded-lg sm:rounded-xl bg-blue-500/20 border border-blue-500/30 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-blue-400 hover:bg-blue-500/30 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Counts
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditMode(false)}
                    className="rounded-lg sm:rounded-xl bg-slate-700/50 border border-slate-600/50 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-300 hover:bg-slate-700/70 transition-colors"
                  >
                    Done Editing
                  </button>
                )}
                <span className="rounded-lg sm:rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-emerald-400">
                  ✓ Complete
                </span>
              </>
            )}
          </div>
        </header>

        {/* Progress Bar */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-4 sm:p-5 lg:p-6 shadow-xl shadow-slate-900/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-300">Progress</span>
            <span className="text-sm font-semibold text-emerald-400">
              {countedItems} / {totalItems} items counted
            </span>
          </div>
          <div className="w-full h-3 bg-slate-800/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 backdrop-blur-sm">
            {error}
          </div>
        )}

        {/* Search and Filter */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-4 sm:p-5 lg:p-6 shadow-xl shadow-slate-900/50">
          <div className="space-y-3">
            <div className="relative">
              <svg className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 transition-all focus:border-emerald-500/50 focus:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-100 transition-all focus:border-emerald-500/50 focus:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Items by Category */}
        <div className="space-y-4 sm:space-y-6">
          {Object.entries(itemsByCategory).map(([categoryName, categoryItems]) => (
            <div key={categoryName} className="rounded-xl sm:rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl overflow-hidden shadow-xl shadow-slate-900/50">
              <div className="bg-slate-800/30 backdrop-blur-sm px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800/50">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    {categoryName}
                  </h2>
                  <Link
                    href={`/items/new?categoryId=${categories.find(c => c.name === categoryName)?.id || ''}&returnTo=/sessions/${sessionId}/count`}
                    className="group flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400 transition-all hover:border-blue-500/50 hover:bg-blue-500/20"
                    title={`Add item to ${categoryName}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="hidden sm:inline">Add Item</span>
                    <span className="sm:hidden">+</span>
                  </Link>
                </div>
              </div>
              <div className="p-4 sm:p-6 space-y-3">
                {categoryItems.map((item) => {
                  const currentCount = itemCounts[item.id] || 0;
                  const isSaving = savingItemId === item.id;
                  
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-slate-800/50 bg-slate-900/30 backdrop-blur-sm hover:border-slate-700/50 hover:bg-slate-800/30 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm sm:text-base font-semibold text-slate-200 truncate">{item.name}</h3>
                          {currentCount > 0 && (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-emerald-400 border border-emerald-500/30">
                              Saved: {currentCount}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {item.location && <span>📍 {item.location}</span>}
                          {item.condition && (
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              item.condition.toLowerCase().includes('excellent') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                              item.condition.toLowerCase().includes('good') ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                              item.condition.toLowerCase().includes('poor') || item.condition.toLowerCase().includes('bad') || item.condition.toLowerCase().includes('needs') ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                              'bg-slate-700/50 text-slate-300 border border-slate-600/50'
                            }`}>
                              {item.condition}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        {session?.isComplete && !isEditMode ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm text-slate-400 whitespace-nowrap">Count:</span>
                            <span className="w-20 sm:w-24 rounded-lg border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm px-2 sm:px-3 py-1.5 sm:py-2 text-sm text-slate-300 text-center">
                              {currentCount}
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <label htmlFor={`count-${item.id}`} className="text-xs sm:text-sm text-slate-400 whitespace-nowrap">
                                Count:
                              </label>
                              <input
                                id={`count-${item.id}`}
                                type="number"
                                min="0"
                                step="1"
                                value={currentCount || ''}
                                onChange={(e) => {
                                  const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                  setItemCounts(prev => ({ ...prev, [item.id]: value }));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveCount(item.id, itemCounts[item.id] || 0);
                                  }
                                }}
                                disabled={session?.isComplete && !isEditMode}
                                className="w-20 sm:w-24 rounded-lg border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-2 sm:px-3 py-1.5 sm:py-2 text-sm text-slate-100 transition-all focus:border-emerald-500/50 focus:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="0"
                              />
                            </div>
                            <button
                              onClick={() => handleSaveCount(item.id, itemCounts[item.id] || 0)}
                              disabled={isSaving || (session?.isComplete && !isEditMode)}
                              className="rounded-lg sm:rounded-xl bg-emerald-500 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                              {isSaving ? (
                                <span className="flex items-center gap-1.5">
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                  Saving...
                                </span>
                              ) : currentCount > 0 ? (
                                'Update'
                              ) : (
                                'Save'
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="rounded-xl border border-slate-800/50 bg-slate-900/30 p-8 text-center">
            <p className="text-sm text-slate-400">No items match your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CountSessionPage() {
  return (
    <AuthGuard>
      <CountSessionPageContent />
    </AuthGuard>
  );
}

