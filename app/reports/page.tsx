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
    <div className="min-h-screen px-6 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Inventory Reports</h1>
            <p className="mt-1 text-sm text-slate-400">View inventory trends and analysis</p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
          >
            Back to Dashboard
          </Link>
        </header>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading reports...</div>
        ) : (
          <div className="space-y-8">
            {/* Summary Cards */}
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Items</p>
                <p className="mt-2 text-2xl font-semibold text-slate-50">{items.length}</p>
              </div>
              <div className="rounded-xl border border-red-800 bg-red-500/10 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-red-400">Decreasing Items</p>
                <p className="mt-2 text-2xl font-semibold text-red-400">{itemsWithShortages.length}</p>
              </div>
              <div className="rounded-xl border border-emerald-800 bg-emerald-500/10 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-400">Increasing Items</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-400">{itemsWithIncreases.length}</p>
              </div>
            </section>

            {/* Items with Decreases */}
            {itemsWithShortages.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold text-slate-100 mb-4">Items with Decreases</h2>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
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
                <h2 className="text-xl font-semibold text-slate-100 mb-4">Items with Increases</h2>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
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
                <h2 className="text-xl font-semibold text-slate-100 mb-4">Items with No Recent Activity</h2>
                <div className="rounded-xl border border-yellow-800 bg-yellow-500/10 p-4">
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

