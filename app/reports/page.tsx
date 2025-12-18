'use client';

import { useEffect, useState } from 'react';
import { getItems, getCategories, getAcademicTerms, getHistoricalCounts } from '../lib/firestore';
import type { Item, Category, AcademicTerm, HistoricalCount } from '../types';
import Link from 'next/link';
import AuthGuard from '../components/AuthGuard';

function ReportsPageContent() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [historicalCounts, setHistoricalCounts] = useState<HistoricalCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTerm, setSelectedTerm] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [itemsData, categoriesData, termsData, countsData] = await Promise.all([
        getItems(),
        getCategories(),
        getAcademicTerms(),
        getHistoricalCounts(),
      ]);
      setItems(itemsData);
      setCategories(categoriesData);
      setTerms(termsData);
      setHistoricalCounts(countsData);
      if (termsData.length > 0) {
        setSelectedTerm(termsData[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Get latest count for each item
  const getLatestCount = (itemId: string): number => {
    const itemCounts = historicalCounts
      .filter((hc) => hc.itemId === itemId)
      .sort((a, b) => {
        const termA = terms.find((t) => t.id === a.academicTermId);
        const termB = terms.find((t) => t.id === b.academicTermId);
        if (!termA || !termB) return 0;
        if (termA.year !== termB.year) return termB.year - termA.year;
        const termOrder = { SPRING: 1, SUMMER: 2, FALL: 3, WINTER: 4 };
        return termOrder[termB.term] - termOrder[termA.term];
      });
    return itemCounts[0]?.countedQuantity || 0;
  };

  // Get previous count for comparison
  const getPreviousCount = (itemId: string): number => {
    const itemCounts = historicalCounts
      .filter((hc) => hc.itemId === itemId)
      .sort((a, b) => {
        const termA = terms.find((t) => t.id === a.academicTermId);
        const termB = terms.find((t) => t.id === b.academicTermId);
        if (!termA || !termB) return 0;
        if (termA.year !== termB.year) return termB.year - termA.year;
        const termOrder = { SPRING: 1, SUMMER: 2, FALL: 3, WINTER: 4 };
        return termOrder[termB.term] - termOrder[termA.term];
      });
    return itemCounts[1]?.countedQuantity || 0;
  };

  // Items with shortages (decreasing)
  const itemsWithShortages = items
    .map((item) => {
      const latest = getLatestCount(item.id);
      const previous = getPreviousCount(item.id);
      return {
        item,
        latest,
        previous,
        change: latest - previous,
      };
    })
    .filter((data) => data.change < 0)
    .sort((a, b) => a.change - b.change);

  // Items with increases
  const itemsWithIncreases = items
    .map((item) => {
      const latest = getLatestCount(item.id);
      const previous = getPreviousCount(item.id);
      return {
        item,
        latest,
        previous,
        change: latest - previous,
      };
    })
    .filter((data) => data.change > 0)
    .sort((a, b) => b.change - a.change);

  // Items with no recent activity
  const latestTerm = terms[0];
  const itemsNoRecentActivity = items.filter((item) => {
    const counts = historicalCounts.filter((hc) => hc.itemId === item.id);
    if (counts.length === 0) return true;
    if (!latestTerm) return false;
    return !counts.some((hc) => hc.academicTermId === latestTerm.id);
  });

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-50 via-emerald-100 to-slate-50 bg-clip-text text-transparent flex items-center gap-3">
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Inventory Reports
            </h1>
            <p className="text-sm text-slate-400">View inventory trends and analysis</p>
          </div>
          <Link
            href="/"
            className="group rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-4 py-2.5 text-sm font-medium text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-700/50 hover:shadow-lg hover:shadow-slate-900/50"
          >
            ← Back to Dashboard
          </Link>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-slate-400">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-500"></div>
              <span className="text-sm">Loading reports...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-6 shadow-xl shadow-slate-900/50 transition-all hover:scale-105 hover:border-slate-700/50">
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Items</p>
                </div>
                <p className="text-3xl font-bold text-slate-50">{items.length.toLocaleString()}</p>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border border-red-800/50 bg-gradient-to-br from-red-950/50 to-slate-900/40 backdrop-blur-xl p-6 shadow-xl shadow-slate-900/50 transition-all hover:scale-105 hover:border-red-700/50">
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-lg bg-red-500/10 p-2">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Decreasing Items</p>
                </div>
                <p className="text-3xl font-bold text-red-400">{itemsWithShortages.length.toLocaleString()}</p>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border border-emerald-800/50 bg-gradient-to-br from-emerald-950/50 to-slate-900/40 backdrop-blur-xl p-6 shadow-xl shadow-slate-900/50 transition-all hover:scale-105 hover:border-emerald-700/50">
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-500/10 p-2">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Increasing Items</p>
                </div>
                <p className="text-3xl font-bold text-emerald-400">{itemsWithIncreases.length.toLocaleString()}</p>
              </div>
            </section>

            {/* Items with Decreases */}
            {itemsWithShortages.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-2">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                  Items with Decreases
                </h2>
                <div className="rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl overflow-hidden shadow-xl shadow-slate-900/50">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-800/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Item</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Category</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Previous</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Current</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {itemsWithShortages.slice(0, 20).map(({ item, latest, previous, change }) => {
                          const category = categories.find((c) => c.id === item.categoryId);
                          return (
                            <tr key={item.id} className="hover:bg-slate-800/30">
                              <td className="px-4 py-3 text-sm font-medium text-slate-200">{item.name}</td>
                              <td className="px-4 py-3 text-sm text-slate-400">{category?.name || 'Unknown'}</td>
                              <td className="px-4 py-3 text-sm text-slate-300">{previous}</td>
                              <td className="px-4 py-3 text-sm text-slate-300">{latest}</td>
                              <td className="px-4 py-3 text-sm font-medium text-red-400">{change}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* Items with Increases */}
            {itemsWithIncreases.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-2">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Items with Increases
                </h2>
                <div className="rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl overflow-hidden shadow-xl shadow-slate-900/50">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-800/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Item</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Category</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Previous</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Current</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {itemsWithIncreases.slice(0, 20).map(({ item, latest, previous, change }) => {
                          const category = categories.find((c) => c.id === item.categoryId);
                          return (
                            <tr key={item.id} className="hover:bg-slate-800/30">
                              <td className="px-4 py-3 text-sm font-medium text-slate-200">{item.name}</td>
                              <td className="px-4 py-3 text-sm text-slate-400">{category?.name || 'Unknown'}</td>
                              <td className="px-4 py-3 text-sm text-slate-300">{previous}</td>
                              <td className="px-4 py-3 text-sm text-slate-300">{latest}</td>
                              <td className="px-4 py-3 text-sm font-medium text-emerald-400">+{change}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* Items with No Recent Activity */}
            {itemsNoRecentActivity.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-2">
                  <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Items with No Recent Activity
                </h2>
                <div className="rounded-2xl border border-yellow-800/50 bg-gradient-to-br from-yellow-950/50 to-slate-900/40 backdrop-blur-xl p-6 shadow-xl shadow-slate-900/50">
                  <p className="text-sm text-slate-400 mb-3">
                    {itemsNoRecentActivity.length} items have no counts in the latest term ({latestTerm?.name || 'N/A'})
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {itemsNoRecentActivity.slice(0, 12).map((item) => {
                      const category = categories.find((c) => c.id === item.categoryId);
                      return (
                        <div key={item.id} className="text-sm text-slate-300">
                          {item.name} <span className="text-slate-500">({category?.name})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <AuthGuard>
      <ReportsPageContent />
    </AuthGuard>
  );
}

