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
} from '../lib/firestore';
import type { Category, Item, InventorySession, AcademicTerm } from '../types';

export default function Dashboard() {
  const [user] = useAuthState(auth);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      const [itemsData, categoriesData, sessionsData, termsData] = await Promise.all([
        getItems(),
        getCategories(),
        getInventorySessions(),
        getAcademicTerms(),
      ]);
      setItems(itemsData);
      setCategories(categoriesData);
      setSessions(sessionsData);
      setTerms(termsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  const currentTerm = terms[0]; // Most recent term
  const latestSession = sessions[0]; // Most recent session

  // Group items by category
  const itemsByCategory: Record<string, Item[]> = {};
  items.forEach((item) => {
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
              onClick={() => signOut(auth)}
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
            >
              Sign Out
            </button>
            <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-50 shadow-sm hover:bg-emerald-400">
              New Count Session
            </button>
            <button className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800">
              Import from Excel
            </button>
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
              <h2 className="text-sm font-semibold text-slate-100">Inventory by Category</h2>
              {loading ? (
                <div className="mt-4 text-sm text-slate-400">Loading...</div>
              ) : Object.keys(itemsByCategory).length === 0 ? (
                <div className="mt-4 text-sm text-slate-400">
                  No items yet. Import from Excel or add items manually.
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {Object.entries(itemsByCategory).map(([categoryName, categoryItems]) => (
                    <div key={categoryName} className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                      <h3 className="font-medium text-slate-200">{categoryName}</h3>
                      <div className="mt-2 space-y-1">
                        {categoryItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-sm text-slate-300">
                            <span>{item.name}</span>
                            {item.location && (
                              <span className="text-xs text-slate-500">{item.location}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
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
                <button className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700">
                  Add New Item
                </button>
                <button className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700">
                  View Reports
                </button>
                <button className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700">
                  Semester History
                </button>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

