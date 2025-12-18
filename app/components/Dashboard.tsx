'use client';

import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  getCategories,
  getItems,
  getInventorySessions,
  getAcademicTerms,
  getHistoricalCounts,
} from '../lib/firestore';
import type { Category, Item, InventorySession, AcademicTerm, HistoricalCount } from '../types';
import Link from 'next/link';

export default function Dashboard() {
  const [user] = useAuthState(auth || undefined);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [historicalCounts, setHistoricalCounts] = useState<HistoricalCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

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
      
      // Debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Data loaded:', {
          items: itemsData.length,
          categories: categoriesData.length,
          terms: termsData.length,
          historicalCounts: countsData.length,
          termIds: termsData.map(t => ({ id: t.id, name: t.name })).slice(0, 5),
          sampleCounts: countsData.slice(0, 3).map(c => ({
            itemId: c.itemId,
            academicTermId: c.academicTermId,
            quantity: c.countedQuantity
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

  const currentTerm = terms[0]; // Most recent term
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
    <main className="min-h-screen px-6 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
              AVault Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Welcome back, {user?.email}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => auth && signOut(auth)}
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
            >
              Sign Out
            </button>
            <Link
              href="/sessions/new"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-50 shadow-sm hover:bg-emerald-400"
            >
              New Count Session
            </Link>
          </div>
        </header>

        {/* Summary cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Total Items
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-50">
              {loading ? '...' : items.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Categories
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-50">
              {loading ? '...' : categories.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Latest Session
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-50">
              {loading ? '...' : latestSession?.name || 'No sessions yet'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Current Term
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-50">
              {loading ? '...' : currentTerm?.name || 'Not configured'}
            </p>
          </div>
        </section>

        {/* Main content */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Inventory by Category */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-100">Inventory by Category</h2>
                <span className="text-xs text-slate-500">
                  {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {/* Search and Filter */}
              <div className="mb-4 space-y-2">
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                <div className="mt-4 text-sm text-slate-400">Loading...</div>
              ) : Object.keys(itemsByCategory).length === 0 ? (
                <div className="mt-4 text-sm text-slate-400">
                  {searchQuery || selectedCategory ? 'No items match your filters.' : 'No items yet. Add items manually.'}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {Object.entries(itemsByCategory).map(([categoryName, categoryItems]) => {
                    const isExpanded = expandedCategories.has(categoryName);
                    const totalQuantity = categoryItems.reduce((sum, item) => sum + getLatestCount(item.id), 0);
                    
                    return (
                      <div key={categoryName} className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
                        <button
                          onClick={() => toggleCategory(categoryName)}
                          className="w-full flex items-center justify-between p-3 hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400">{isExpanded ? '▼' : '▶'}</span>
                            <div className="text-left">
                              <h3 className="font-medium text-slate-200">{categoryName}</h3>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {categoryItems.length} {categoryItems.length === 1 ? 'item' : 'items'} • Total: {totalQuantity}
                              </p>
                            </div>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-slate-800 bg-slate-900/30">
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-slate-800/30">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Item</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Location</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Condition</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-400 uppercase">Latest Count</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                  {categoryItems.map((item) => {
                                    const latestCount = getLatestCount(item.id);
                                    return (
                                      <tr key={item.id} className="hover:bg-slate-800/20">
                                        <td className="px-4 py-2 text-sm font-medium text-slate-200">{item.name}</td>
                                        <td className="px-4 py-2 text-sm text-slate-400">{item.location || '-'}</td>
                                        <td className="px-4 py-2 text-sm text-slate-400">
                                          {item.condition ? (
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                                              item.condition.toLowerCase().includes('excellent') ? 'bg-emerald-500/20 text-emerald-400' :
                                              item.condition.toLowerCase().includes('good') ? 'bg-blue-500/20 text-blue-400' :
                                              item.condition.toLowerCase().includes('poor') || item.condition.toLowerCase().includes('bad') || item.condition.toLowerCase().includes('needs') ? 'bg-red-500/20 text-red-400' :
                                              'bg-slate-700/50 text-slate-300'
                                            }`}>
                                              {item.condition}
                                            </span>
                                          ) : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-slate-300 text-right font-medium">
                                          {latestCount > 0 ? (
                                            <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 font-semibold">
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

            {/* Recent Sessions */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100">Recent Sessions</h2>
                <button className="text-xs font-medium text-emerald-400 hover:text-emerald-300">
                  View all
                </button>
              </div>
              {loading ? (
                <div className="mt-4 text-sm text-slate-400">Loading...</div>
              ) : sessions.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">No sessions yet. Create one to get started.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {sessions.slice(0, 5).map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-200">{session.name}</p>
                        <p className="text-xs text-slate-500">
                          {session.date?.toDate?.().toLocaleDateString() || 'No date'}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          session.isComplete
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {session.isComplete ? 'Complete' : 'In Progress'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-slate-100">Quick Actions</h2>
              <div className="mt-3 space-y-2">
                <a
                  href="/users"
                  className="block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700"
                >
                  Manage Users
                </a>
                <Link
                  href="/items/new"
                  className="block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700"
                >
                  Add New Item
                </Link>
                <Link
                  href="/reports"
                  className="block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700"
                >
                  View Reports
                </Link>
                <Link
                  href="/semester-history"
                  className="block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700"
                >
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

