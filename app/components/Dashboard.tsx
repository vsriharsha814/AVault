'use client';

import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, signOutAndClearCache } from '../lib/firebase';
import {
  getCategories,
  getItems,
  getInventorySessions,
  getInventoryCounts,
  getAcademicTerms,
  getHistoricalCounts,
} from '../lib/firestore';
import { Timestamp } from 'firebase/firestore';
import { getCurrentTerm, getTermDisplayName } from '../lib/terms';
import type { Category, Item, InventorySession, AcademicTerm, HistoricalCount } from '../types';
import Link from 'next/link';

export default function Dashboard() {
  // Auth is guaranteed to be non-null here because AuthGuard handles the null case
  const [user] = useAuthState(auth!);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [historicalCounts, setHistoricalCounts] = useState<HistoricalCount[]>([]);
  const [latestSessionCounts, setLatestSessionCounts] = useState<HistoricalCount[]>([]);
  const [sessionLastUpdates, setSessionLastUpdates] = useState<Record<string, Timestamp>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Load data on initial mount only
  // Manual refresh available via the refresh button

  async function loadData() {
    try {
      setLoading(true);
      const [itemsData, categoriesData, sessionsData, termsData, countsData] = await Promise.all([
        getItems(),
        getCategories(),
        getInventorySessions(),
        getAcademicTerms(),
        getHistoricalCounts(),
      ]);
      setItems(itemsData);
      setCategories(categoriesData);
      setSessions(sessionsData);
      setTerms(termsData);
      setHistoricalCounts(countsData);
      
      // Also load counts from the latest session (even if incomplete) to show most recent counts
      // This ensures counts show immediately even before session is marked complete
      if (sessionsData.length > 0) {
        const latestSession = sessionsData[0];
        try {
          const latestCounts = await getInventoryCounts(latestSession.id);
          setLatestSessionCounts(latestCounts);
        } catch (error) {
          console.error('Error loading latest session counts:', error);
          setLatestSessionCounts([]);
        }
      } else {
        setLatestSessionCounts([]);
      }
      
      // Load last update times for all sessions (most recent count timestamp)
      // This shows when each session was last updated with new counts
      const lastUpdatesMap: Record<string, Timestamp> = {};
      await Promise.all(
        sessionsData.map(async (session) => {
            try {
              const sessionCounts = await getInventoryCounts(session.id);
              if (sessionCounts.length > 0) {
                // Find the most recent importedAt timestamp
                const mostRecent = sessionCounts.reduce((latest, count) => {
                  const countTime = count.importedAt?.toMillis?.() || 0;
                  const latestTime = latest?.importedAt?.toMillis?.() || 0;
                  return countTime > latestTime ? count : latest;
                });
                if (mostRecent?.importedAt) {
                  lastUpdatesMap[session.id] = mostRecent.importedAt;
                }
              }
          } catch (error) {
            // Silently fail for individual sessions - will fall back to session date
            console.error(`Error loading counts for session ${session.id}:`, error);
          }
        })
      );
      setSessionLastUpdates(lastUpdatesMap);
      
      // Debug logging
      if (process.env.NODE_ENV === 'development') {
        // Find the most recent count to see what term it's associated with
        const mostRecent = countsData.length > 0
          ? countsData.reduce((latest, count) => {
              const countTime = count.importedAt?.toMillis?.() || 0;
              const latestTime = latest?.importedAt?.toMillis?.() || 0;
              return countTime > latestTime ? count : latest;
            })
          : null;
        
        const mostRecentTerm = mostRecent
          ? termsData.find(t => t.id === mostRecent.academicTermId)
          : null;
        
        console.log('📊 Data loaded:', {
          items: itemsData.length,
          categories: categoriesData.length,
          terms: termsData.length,
          historicalCounts: countsData.length,
          mostRecentCount: mostRecent ? {
            itemId: mostRecent.itemId,
            academicTermId: mostRecent.academicTermId,
            termName: mostRecentTerm?.name || 'NOT FOUND',
            importedAt: mostRecent.importedAt?.toDate?.()?.toISOString(),
            timestamp: mostRecent.importedAt?.toMillis?.()
          } : null,
          termIds: termsData.map(t => ({ id: t.id, name: t.name })).slice(0, 5),
          sampleCounts: countsData.slice(0, 3).map(c => ({
            itemId: c.itemId,
            academicTermId: c.academicTermId,
            quantity: c.countedQuantity,
            importedAt: c.importedAt?.toDate?.()?.toISOString()
          })),
          unmatchedTerms: countsData
            .map(c => c.academicTermId)
            .filter(id => !termsData.some(t => t.id === id))
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 5)
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Get latest count for an item
  const getLatestCount = (itemId: string): number => {
    // First, check if there's a count in the latest session (most recent, even if incomplete)
    const latestSessionCount = latestSessionCounts.find((hc) => hc.itemId === itemId);
    if (latestSessionCount) {
      return latestSessionCount.countedQuantity || 0;
    }
    
    // Otherwise, check historical counts
    const itemCounts = historicalCounts.filter((hc) => hc.itemId === itemId);
    
    if (itemCounts.length === 0) {
      return 0;
    }
    
    // Try to sort by terms first (most accurate)
    const countsWithTerms = itemCounts
      .map((hc) => {
        const term = terms.find((t) => t.id === hc.academicTermId);
        return { count: hc, term };
      })
      .filter((item) => item.term !== undefined) as Array<{ count: HistoricalCount; term: AcademicTerm }>;
    
    if (countsWithTerms.length > 0) {
      // Sort by year and term
      countsWithTerms.sort((a, b) => {
        if (a.term.year !== b.term.year) {
          return b.term.year - a.term.year;
        }
        const termOrder = { SPRING: 1, SUMMER: 2, FALL: 3, WINTER: 4 };
        return termOrder[b.term.term] - termOrder[a.term.term];
      });
      return countsWithTerms[0].count.countedQuantity || 0;
    }
    
    // Fallback: if no terms match, use the first count (shouldn't happen if data is correct)
    // But also try to use importedAt timestamp if available
    const sortedByDate = itemCounts.sort((a, b) => {
      const dateA = a.importedAt?.toMillis?.() || 0;
      const dateB = b.importedAt?.toMillis?.() || 0;
      return dateB - dateA; // Most recent first
    });
    
    return sortedByDate[0]?.countedQuantity || 0;
  };

  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName);
    } else {
      newExpanded.add(categoryName);
    }
    setExpandedCategories(newExpanded);
  };

  // Determine current term based on date (CU Boulder calendar)
  const currentTermInfo = getCurrentTerm();

  // Find the term with the most recent count updates (not just the latest term by year)
  // We check historicalCounts first since that's where all counts end up and has the most recent importedAt
  const termWithMostRecentCounts = (() => {
    // Find most recent historical count - this is the source of truth since all counts
    // (from sessions or imports) end up in historicalCounts with updated importedAt timestamps
    const mostRecentHistorical = historicalCounts.length > 0
      ? historicalCounts.reduce((latest, count) => {
          const countTime = count.importedAt?.toMillis?.() || 0;
          const latestTime = latest?.importedAt?.toMillis?.() || 0;
          return countTime > latestTime ? count : latest;
        })
      : null;
    
    if (process.env.NODE_ENV === 'development') {
      if (mostRecentHistorical) {
        const term = terms.find(t => t.id === mostRecentHistorical.academicTermId);
        console.log('📊 Most recent historical count:', {
          itemId: mostRecentHistorical.itemId,
          academicTermId: mostRecentHistorical.academicTermId,
          termName: term?.name || 'NOT FOUND',
          importedAt: mostRecentHistorical.importedAt?.toDate?.()?.toISOString(),
          timestamp: mostRecentHistorical.importedAt?.toMillis?.()
        });
      }
    }
    
    // If we have a most recent historical count, use its term
    if (mostRecentHistorical?.academicTermId) {
      const term = terms.find(t => t.id === mostRecentHistorical.academicTermId);
      if (term) {
        return term;
      }
    }
    
    // Fallback: Check latest session counts if no historical counts exist yet
    // (This handles the case where counts were just saved but historicalCounts hasn't refreshed)
    const mostRecentSession = latestSessionCounts.length > 0
      ? latestSessionCounts.reduce((latest, count) => {
          const countTime = count.importedAt?.toMillis?.() || 0;
          const latestTime = latest?.importedAt?.toMillis?.() || 0;
          return countTime > latestTime ? count : latest;
        })
      : null;
    
    if (mostRecentSession) {
      const session = sessions.find(s => s.id === mostRecentSession.sessionId);
      if (session?.academicTermId) {
        const term = terms.find(t => t.id === session.academicTermId);
        if (term) {
          return term;
        }
      }
    }
    
    // Fallback to latest term by year if no counts exist
    return terms.length > 0 ? terms[0] : undefined;
  })();
  
  const latestSession = sessions[0]; // Most recent session

  // Filter items by search and category
  const filteredItems = items.filter((item) => {
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.serialFrequency?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || item.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group filtered items by category
  const itemsByCategory: Record<string, Item[]> = {};
  filteredItems.forEach((item) => {
    const category = categories.find((c) => c.id === item.categoryId);
    const categoryName = category?.name || 'Uncategorized';
    if (!itemsByCategory[categoryName]) {
      itemsByCategory[categoryName] = [];
    }
    itemsByCategory[categoryName].push(item);
  });

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-50 via-emerald-100 to-slate-50 bg-clip-text text-transparent">
              AVault Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="truncate">Welcome back, {user?.email}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="group relative rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-700/50 hover:shadow-lg hover:shadow-slate-900/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              title="Refresh data"
            >
              <svg 
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <button
              onClick={() => signOutAndClearCache(auth)}
              className="group relative rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-700/50 hover:shadow-lg hover:shadow-slate-900/50"
            >
              Sign Out
            </button>
            <Link
              href="/sessions/new"
              className="group relative rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-105 active:scale-95"
            >
              <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">New Count Session</span>
                <span className="sm:hidden">New Session</span>
              </span>
            </Link>
          </div>
        </header>

        {/* Summary cards */}
        <section className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
          <button
            onClick={loadData}
            disabled={loading}
            className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-3 sm:p-4 lg:p-6 shadow-xl shadow-slate-900/50 transition-all hover:scale-105 hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
            <div className="relative">
              <div className="mb-2 sm:mb-3 flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-emerald-500/10 p-1.5 sm:p-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Items
            </p>
              </div>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-50">
                {loading ? <span className="animate-pulse">...</span> : items.length.toLocaleString()}
            </p>
            </div>
          </button>
          <Link
            href="/categories"
            className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-3 sm:p-4 lg:p-6 shadow-xl shadow-slate-900/50 transition-all hover:scale-105 hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/10 cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
            <div className="relative">
              <div className="mb-2 sm:mb-3 flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-blue-500/10 p-1.5 sm:p-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
              Categories
            </p>
              </div>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-50">
                {loading ? <span className="animate-pulse">...</span> : categories.length.toLocaleString()}
            </p>
            </div>
          </Link>
          <Link
            href="/sessions"
            className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-3 sm:p-4 lg:p-6 shadow-xl shadow-slate-900/50 transition-all hover:scale-105 hover:border-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/10 cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
            <div className="relative">
              <div className="mb-2 sm:mb-3 flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-purple-500/10 p-1.5 sm:p-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
              Latest Session
            </p>
              </div>
              <p className="text-sm sm:text-base lg:text-lg font-bold text-slate-50 line-clamp-1">
                {loading ? <span className="animate-pulse">...</span> : latestSession?.name || <span className="text-slate-500">No sessions yet</span>}
            </p>
            </div>
          </Link>
          <Link
            href="/reports"
            className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-6 shadow-xl shadow-slate-900/50 transition-all hover:scale-105 hover:border-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/10 cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
            <div className="relative">
              <div className="mb-2 sm:mb-3 flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-amber-500/10 p-1.5 sm:p-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Current Term
                </p>
              </div>
              <p className="text-sm sm:text-base lg:text-lg font-bold text-slate-50">
                {loading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  <span>{currentTermInfo.name}</span>
                )}
              </p>
              <p className="mt-1 text-[10px] sm:text-xs text-slate-400">
                {loading ? (
                  <span className="animate-pulse">Checking last update…</span>
                ) : termWithMostRecentCounts ? (
                  <>
                    Last updated:{' '}
                    {termWithMostRecentCounts.name ||
                      getTermDisplayName(termWithMostRecentCounts.term, termWithMostRecentCounts.year)}
                  </>
                ) : (
                  'No academic terms found yet'
                )}
              </p>
            </div>
          </Link>
        </section>

        {/* Main content */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Inventory by Category */}
            <div className="rounded-xl sm:rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-4 sm:p-5 lg:p-6 shadow-xl shadow-slate-900/50">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div>
                  <h2 className="text-base sm:text-lg lg:text-xl font-bold text-slate-50 flex items-center gap-1.5 sm:gap-2">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="hidden sm:inline">Inventory by Category</span>
                    <span className="sm:hidden">Inventory</span>
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                  {filteredItems.length}
                </span>
              </div>

              {/* Search and Filter */}
              <div className="mb-4 sm:mb-6 space-y-2 sm:space-y-3">
                <div className="relative">
                  <svg className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 transition-all focus:border-emerald-500/50 focus:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm text-slate-100 transition-all focus:border-emerald-500/50 focus:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-3 text-slate-400">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-500"></div>
                    <span className="text-sm">Loading inventory...</span>
                  </div>
                </div>
              ) : Object.keys(itemsByCategory).length === 0 ? (
                <div className="rounded-xl border border-slate-800/50 bg-slate-900/30 p-8 text-center">
                  <svg className="mx-auto h-12 w-12 text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-sm text-slate-400">
                    {searchQuery || selectedCategory ? 'No items match your filters.' : 'No items yet. Add items manually.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {Object.entries(itemsByCategory).map(([categoryName, categoryItems]) => {
                    const isExpanded = expandedCategories.has(categoryName);
                    const totalQuantity = categoryItems.reduce((sum, item) => sum + getLatestCount(item.id), 0);
                    
                    return (
                      <div key={categoryName} className="group rounded-lg sm:rounded-xl border border-slate-800/50 bg-slate-900/30 backdrop-blur-sm overflow-hidden transition-all hover:border-slate-700/50 hover:shadow-lg hover:shadow-slate-900/50">
                        <button
                          onClick={() => toggleCategory(categoryName)}
                          className="w-full flex items-center justify-between p-2.5 sm:p-3 lg:p-4 hover:bg-slate-800/30 transition-all"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 min-w-0 flex-1">
                            <div className={`flex h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 items-center justify-center rounded-lg transition-all flex-shrink-0 ${
                              isExpanded ? 'bg-emerald-500/20 text-emerald-400 rotate-90' : 'bg-slate-800/50 text-slate-400'
                            }`}>
                              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                            <div className="text-left min-w-0 flex-1">
                              <h3 className="text-sm sm:text-base font-semibold text-slate-200 truncate">{categoryName}</h3>
                              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 sm:gap-2">
                                <span>{categoryItems.length} {categoryItems.length === 1 ? 'item' : 'items'}</span>
                                <span className="hidden sm:inline">•</span>
                                <span className="font-medium text-emerald-400">Total: {totalQuantity}</span>
                              </p>
                            </div>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-slate-800/50 bg-slate-900/20 animate-in slide-in-from-top-2">
                            <div className="overflow-x-auto -mx-2.5 sm:-mx-3 lg:-mx-4">
                              <table className="w-full">
                                <thead className="bg-slate-800/20">
                                  <tr>
                                    <th className="px-3 py-2 sm:px-4 sm:py-2.5 lg:px-5 lg:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Item</th>
                                    <th className="px-3 py-2 sm:px-4 sm:py-2.5 lg:px-5 lg:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Location</th>
                                    <th className="px-3 py-2 sm:px-4 sm:py-2.5 lg:px-5 lg:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Condition</th>
                                    <th className="px-3 py-2 sm:px-4 sm:py-2.5 lg:px-5 lg:py-3 text-right text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Count</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                  {categoryItems.map((item) => {
                                    const latestCount = getLatestCount(item.id);
                                    return (
                                      <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                                        <td className="px-3 py-2 sm:px-4 sm:py-2.5 lg:px-5 lg:py-3 text-xs sm:text-sm font-medium text-slate-200">
                                          <div className="flex flex-col">
                            <span>{item.name}</span>
                                            <span className="text-[10px] sm:hidden text-slate-500 mt-0.5">{item.location || 'No location'}</span>
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 sm:px-4 sm:py-2.5 lg:px-5 lg:py-3 text-xs sm:text-sm text-slate-400 hidden sm:table-cell">{item.location || '-'}</td>
                                        <td className="px-3 py-2 sm:px-4 sm:py-2.5 lg:px-5 lg:py-3 text-xs sm:text-sm hidden md:table-cell">
                                          {item.condition ? (
                                            <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-medium ${
                                              item.condition.toLowerCase().includes('excellent') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                              item.condition.toLowerCase().includes('good') ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                              item.condition.toLowerCase().includes('poor') || item.condition.toLowerCase().includes('bad') || item.condition.toLowerCase().includes('needs') ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                              'bg-slate-700/50 text-slate-300 border border-slate-600/50'
                                            }`}>
                                              {item.condition}
                                            </span>
                                          ) : '-'}
                                        </td>
                                        <td className="px-3 py-2 sm:px-4 sm:py-2.5 lg:px-5 lg:py-3 text-xs sm:text-sm text-right">
                                          {latestCount > 0 ? (
                                            <span className="inline-flex items-center justify-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 min-w-[2.5rem] sm:min-w-[3rem] text-xs sm:text-sm">
                                              {latestCount}
                                            </span>
                                          ) : (
                                            <span className="text-slate-500">0</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            {/* Recent Sessions */}
            <div className="rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-6 shadow-xl shadow-slate-900/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-50 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Recent Sessions
                </h2>
                <Link
                  href="/sessions"
                  className="text-xs sm:text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  View all →
                </Link>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-500"></div>
                </div>
              ) : sessions.length === 0 ? (
                <div className="rounded-xl border border-slate-800/50 bg-slate-900/30 p-4 text-center">
                  <p className="text-xs sm:text-sm text-slate-400">No sessions yet. Create one to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.slice(0, 3).map((session) => (
                    <Link
                      key={session.id}
                      href={`/sessions/${session.id}/count`}
                      className="group flex items-center justify-between rounded-xl border border-slate-800/50 bg-slate-900/30 backdrop-blur-sm p-3 transition-all hover:border-slate-700/50 hover:bg-slate-800/30 hover:shadow-md cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                          session.isComplete ? 'bg-emerald-500' : 'bg-yellow-500 animate-pulse'
                        }`}></div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-semibold text-slate-200 truncate">{session.name}</p>
                          <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
                            {sessionLastUpdates[session.id] 
                              ? `Updated ${sessionLastUpdates[session.id].toDate().toLocaleDateString()}`
                              : session.date?.toDate?.().toLocaleDateString() || 'No date'}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] sm:text-xs font-semibold border flex-shrink-0 ${
                          session.isComplete
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        }`}
                      >
                        {session.isComplete ? 'Complete' : 'In Progress'}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-6 shadow-xl shadow-slate-900/50">
              <h2 className="text-xl font-bold text-slate-50 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Quick Actions
              </h2>
              <div className="space-y-2">
                <a
                  href="/users"
                  className="group flex items-center gap-3 w-full rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-4 py-3 text-left text-sm font-medium text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-700/50 hover:shadow-md hover:translate-x-1"
                >
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Manage Users
                </a>
                <Link
                  href="/items/new"
                  className="group flex items-center gap-3 w-full rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-4 py-3 text-left text-sm font-medium text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-700/50 hover:shadow-md hover:translate-x-1"
                >
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add New Item
                </Link>
                <Link
                  href="/categories"
                  className="group flex items-center gap-3 w-full rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-4 py-3 text-left text-sm font-medium text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-700/50 hover:shadow-md hover:translate-x-1"
                >
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Manage Categories
                </Link>
                <Link
                  href="/reports"
                  className="group flex items-center gap-3 w-full rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-4 py-3 text-left text-sm font-medium text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-700/50 hover:shadow-md hover:translate-x-1"
                >
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  View Reports
                </Link>
                <Link
                  href="/semester-history"
                  className="group flex items-center gap-3 w-full rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-4 py-3 text-left text-sm font-medium text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-700/50 hover:shadow-md hover:translate-x-1"
                >
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Semester History
                </Link>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

