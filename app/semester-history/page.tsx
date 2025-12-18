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
    <div className="min-h-screen px-6 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Semester History</h1>
            <p className="mt-1 text-sm text-slate-400">View inventory data by academic term</p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
          >
            Back to Dashboard
          </Link>
        </header>

        {/* Term Selector */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <label htmlFor="term" className="block text-sm font-medium text-slate-300 mb-2">
            Select Academic Term
          </label>
          <select
            id="term"
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="w-full sm:w-auto rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : selectedTerm ? (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Items</p>
                <p className="mt-2 text-2xl font-semibold text-slate-50">{historicalCounts.length}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Quantity</p>
                <p className="mt-2 text-2xl font-semibold text-slate-50">
                  {historicalCounts.reduce((sum, hc) => sum + hc.countedQuantity, 0)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Categories</p>
                <p className="mt-2 text-2xl font-semibold text-slate-50">{Object.keys(countsByCategory).length}</p>
              </div>
            </div>

            {/* Inventory by Category */}
            {Object.keys(countsByCategory).length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">
                No data found for {selectedTerm.name}
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(countsByCategory).map(([categoryName, categoryCounts]) => (
                  <div key={categoryName} className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                    <div className="bg-slate-800/50 px-4 py-3">
                      <h2 className="text-lg font-semibold text-slate-100">
                        {categoryName} ({categoryCounts.length} items)
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

