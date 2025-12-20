'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCategories, createItem } from '../../lib/firestore';
import type { Category } from '../../types';
import Link from 'next/link';
import AuthGuard from '../../components/AuthGuard';

function AddItemPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    categoryId: searchParams?.get('categoryId') || '',
    location: '',
    condition: '',
    serialFrequency: '',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    // Update categoryId if it's provided in URL params
    if (searchParams?.get('categoryId')) {
      setFormData(prev => ({ ...prev, categoryId: searchParams.get('categoryId') || '' }));
    }
  }, [searchParams]);

  async function loadCategories() {
    try {
      const cats = await getCategories();
      setCategories(cats);
    } catch (err: any) {
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (!formData.name || !formData.categoryId) {
      setError('Name and category are required');
      setSubmitting(false);
      return;
    }

    try {
      await createItem({
        name: formData.name,
        categoryId: formData.categoryId,
        location: formData.location || undefined,
        condition: formData.condition || undefined,
        serialFrequency: formData.serialFrequency || undefined,
      });
      // Redirect to returnTo URL if provided, otherwise go to dashboard
      const returnTo = searchParams?.get('returnTo') || '/';
      router.push(returnTo);
    } catch (err: any) {
      setError(err.message || 'Failed to create item');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen px-6 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Add New Item</h1>
            <p className="mt-1 text-sm text-slate-400">Add a new inventory item to the system</p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
          >
            Back to Dashboard
          </Link>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
              Item Name <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="e.g., Shure SM-57"
            />
          </div>

          <div>
            <label htmlFor="categoryId" className="block text-sm font-medium text-slate-300 mb-2">
              Category <span className="text-red-400">*</span>
            </label>
            {loading ? (
              <div className="text-sm text-slate-400">Loading categories...</div>
            ) : (
              <select
                id="categoryId"
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-slate-300 mb-2">
              Location
            </label>
            <input
              id="location"
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="e.g., GMB, Basement, Aspens"
            />
          </div>

          <div>
            <label htmlFor="condition" className="block text-sm font-medium text-slate-300 mb-2">
              Condition
            </label>
            <input
              id="condition"
              type="text"
              value={formData.condition}
              onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="e.g., Good, Excellent, Needs Replacement"
            />
          </div>

          <div>
            <label htmlFor="serialFrequency" className="block text-sm font-medium text-slate-300 mb-2">
              Serial Number / Frequency
            </label>
            <input
              id="serialFrequency"
              type="text"
              value={formData.serialFrequency}
              onChange={(e) => setFormData({ ...formData, serialFrequency: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="e.g., SN123456 or Freq 5.84-6.08"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 font-medium text-emerald-50 shadow-sm hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Item'}
            </button>
            <Link
              href="/"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-slate-200 hover:bg-slate-700"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AddItemPage() {
  return (
    <AuthGuard>
      <AddItemPageContent />
    </AuthGuard>
  );
}

