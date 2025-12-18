'use client';

import { useEffect, useState } from 'react';
import { getAcademicTerms, getHistoricalCounts, getItems, getCategories } from '../lib/firestore';
import type { AcademicTerm, HistoricalCount, Item, Category } from '../types';
import Link from 'next/link';
import AuthGuard from '../components/AuthGuard';

function SemesterHistoryPageContent() {
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [historicalCounts, setHistoricalCounts] = useState<HistoricalCount[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedTermId) {
      loadTermData();
    }
  }, [selectedTermId]);

  async function loadData() {
    try {
      setLoading(true);
      const [termsData, itemsData, categoriesData] = await Promise.all([
        getAcademicTerms(),
        getItems(),
        getCategories(),
      ]);
      setTerms(termsData);
      setItems(itemsData);
      setCategories(categoriesData);
      if (termsData.length > 0) {
        setSelectedTermId(termsData[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTermData() {
    if (!selectedTermId) return;
    try {
      const counts = await getHistoricalCounts(undefined, selectedTermId);
      setHistoricalCounts(counts);
    } catch (error) {
      console.error('Error loading term data:', error);
    }
  }

  const selectedTerm = terms.find((t) => t.id === selectedTermId);
  
  // Group counts by category
  const countsByCategory: Record<string, Array<{ item: Item; count: HistoricalCount }>> = {};
  historicalCounts.forEach((count) => {
    const item = items.find((i) => i.id === count.itemId);
    if (!item) return;
    const category = categories.find((c) => c.id === item.categoryId);
    const categoryName = category?.name || 'Uncategorized';
    if (!countsByCategory[categoryName]) {
      countsByCategory[categoryName] = [];
    }
    countsByCategory[categoryName].push({ item, count });
  });

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-50 via-emerald-100 to-slate-50 bg-clip-text text-transparent flex items-center gap-3">
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Semester History
            </h1>
            <p className="text-sm text-slate-400">View inventory data by academic term</p>
          </div>
          <Link
            href="/"
            className="group rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-4 py-2.5 text-sm font-medium text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-700/50 hover:shadow-lg hover:shadow-slate-900/50"
          >
            ← Back to Dashboard
          </Link>
        </header>

        {/* Term Selector */}
        <div className="rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-6 shadow-xl shadow-slate-900/50">
          <label htmlFor="term" className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Select Academic Term
          </label>
          <select
            id="term"
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="w-full sm:w-auto rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-4 py-3 text-slate-100 transition-all focus:border-emerald-500/50 focus:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-slate-400">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-500"></div>
              <span className="text-sm">Loading...</span>
            </div>
          </div>
        ) : selectedTerm ? (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-6 shadow-xl shadow-slate-900/50 transition-all hover:scale-105">
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Items</p>
                </div>
                <p className="text-3xl font-bold text-slate-50">{historicalCounts.length.toLocaleString()}</p>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-6 shadow-xl shadow-slate-900/50 transition-all hover:scale-105">
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-500/10 p-2">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-5m-6 5h.01M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Quantity</p>
                </div>
                <p className="text-3xl font-bold text-slate-50">
                  {historicalCounts.reduce((sum, hc) => sum + hc.countedQuantity, 0).toLocaleString()}
                </p>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-6 shadow-xl shadow-slate-900/50 transition-all hover:scale-105">
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-lg bg-purple-500/10 p-2">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Categories</p>
                </div>
                <p className="text-3xl font-bold text-slate-50">{Object.keys(countsByCategory).length.toLocaleString()}</p>
              </div>
            </div>

            {/* Inventory by Category */}
            {Object.keys(countsByCategory).length === 0 ? (
              <div className="rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-12 text-center shadow-xl shadow-slate-900/50">
                <svg className="mx-auto h-12 w-12 text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-slate-400">No data found for {selectedTerm.name}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(countsByCategory).map(([categoryName, categoryCounts]) => (
                  <div key={categoryName} className="rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl overflow-hidden shadow-xl shadow-slate-900/50">
                    <div className="bg-slate-800/30 backdrop-blur-sm px-6 py-4 border-b border-slate-800/50">
                      <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {categoryName} <span className="text-sm font-normal text-slate-400">({categoryCounts.length} items)</span>
                      </h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-800/30">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Item</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Location</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Condition</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Quantity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {categoryCounts.map(({ item, count }) => (
                            <tr key={item.id} className="hover:bg-slate-800/30">
                              <td className="px-4 py-3 text-sm font-medium text-slate-200">{item.name}</td>
                              <td className="px-4 py-3 text-sm text-slate-400">{item.location || '-'}</td>
                              <td className="px-4 py-3 text-sm text-slate-400">{item.condition || '-'}</td>
                              <td className="px-4 py-3 text-sm text-slate-300 text-right font-medium">
                                {count.countedQuantity}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">No terms available</div>
        )}
      </div>
    </div>
  );
}

export default function SemesterHistoryPage() {
  return (
    <AuthGuard>
      <SemesterHistoryPageContent />
    </AuthGuard>
  );
}

