'use client';

import { useEffect, useState } from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory, getItems, updateItemsCategory } from '../lib/firestore';
import type { Category, Item } from '../types';
import Link from 'next/link';
import AuthGuard from '../components/AuthGuard';

function CategoriesPageContent() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [categoryItemCounts, setCategoryItemCounts] = useState<Record<string, number>>({});
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [itemsToReassign, setItemsToReassign] = useState<Item[]>([]);
  const [itemReassignments, setItemReassignments] = useState<Record<string, string>>({});

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      setLoading(true);
      const cats = await getCategories();
      setCategories(cats);
      
      // Load item counts for each category
      const counts: Record<string, number> = {};
      for (const cat of cats) {
        const items = await getItems(cat.id);
        counts[cat.id] = items.length;
      }
      setCategoryItemCounts(counts);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newCategoryName.trim()) {
      setError('Category name is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await createCategory(newCategoryName.trim());
      setNewCategoryName('');
      setShowAddForm(false);
      await loadCategories();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) {
      setError('Category name is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await updateCategory(id, editName.trim());
      setEditingId(null);
      setEditName('');
      await loadCategories();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update category');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    const itemCount = categoryItemCounts[id] || 0;
    const category = categories.find(c => c.id === id);
    
    if (!category) return;
    
    if (itemCount > 0) {
      // Load items and show reassignment modal
      const items = await getItems(id);
      setItemsToReassign(items);
      setCategoryToDelete(category);
      setItemReassignments({});
      setShowReassignModal(true);
      return;
    }

    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await deleteCategory(id);
      await loadCategories();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReassignAndDelete() {
    if (!categoryToDelete) return;

    // Check if all items have been reassigned
    const unassignedItems = itemsToReassign.filter(item => !itemReassignments[item.id]);
    if (unassignedItems.length > 0) {
      setError(`Please assign all ${unassignedItems.length} ${unassignedItems.length === 1 ? 'item' : 'items'} to a category before deleting.`);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Reassign items in batches
      const reassignmentsByCategory: Record<string, string[]> = {};
      Object.entries(itemReassignments).forEach(([itemId, categoryId]) => {
        if (!reassignmentsByCategory[categoryId]) {
          reassignmentsByCategory[categoryId] = [];
        }
        reassignmentsByCategory[categoryId].push(itemId);
      });

      // Update items by category
      for (const [categoryId, itemIds] of Object.entries(reassignmentsByCategory)) {
        await updateItemsCategory(itemIds, categoryId);
      }

      // Delete the category
      await deleteCategory(categoryToDelete.id);
      
      // Close modal and reload
      setShowReassignModal(false);
      setCategoryToDelete(null);
      setItemsToReassign([]);
      setItemReassignments({});
      await loadCategories();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reassign items and delete category');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditName(category.name);
    setShowAddForm(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-50 via-emerald-100 to-slate-50 bg-clip-text text-transparent flex items-center gap-2 sm:gap-3">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Manage Categories
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">Create, edit, and delete inventory categories</p>
          </div>
          <Link
            href="/"
            className="group rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-700/50 hover:shadow-lg hover:shadow-slate-900/50"
          >
            ← Back
          </Link>
        </header>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 backdrop-blur-sm">
            {error}
          </div>
        )}

        {/* Add Category Form */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-4 sm:p-5 lg:p-6 shadow-xl shadow-slate-900/50">
          {!showAddForm ? (
            <button
              onClick={() => {
                setShowAddForm(true);
                setEditingId(null);
              }}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New Category
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="newCategory" className="block text-sm font-medium text-slate-300 mb-2">
                  Category Name
                </label>
                <input
                  id="newCategory"
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Wired Mics, Wireless Kits"
                  className="w-full rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-2.5 text-sm text-slate-100 placeholder-slate-500 transition-all focus:border-emerald-500/50 focus:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={submitting || !newCategoryName.trim()}
                  className="flex-1 rounded-lg sm:rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewCategoryName('');
                  }}
                  disabled={submitting}
                  className="rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Categories List */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl p-4 sm:p-5 lg:p-6 shadow-xl shadow-slate-900/50">
          <h2 className="text-lg sm:text-xl font-bold text-slate-50 mb-4 sm:mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Categories ({categories.length})
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-slate-400">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-500"></div>
                <span className="text-sm">Loading categories...</span>
              </div>
            </div>
          ) : categories.length === 0 ? (
            <div className="rounded-xl border border-slate-800/50 bg-slate-900/30 p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <p className="text-sm text-slate-400">No categories yet. Create your first category above.</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="group rounded-lg sm:rounded-xl border border-slate-800/50 bg-slate-900/30 backdrop-blur-sm p-3 sm:p-4 transition-all hover:border-slate-700/50 hover:bg-slate-800/30 hover:shadow-md"
                >
                  {editingId === category.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-2.5 text-sm text-slate-100 transition-all focus:border-emerald-500/50 focus:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdate(category.id)}
                          disabled={submitting || !editName.trim()}
                          className="flex-1 rounded-lg sm:rounded-xl bg-emerald-500 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submitting ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={submitting}
                          className="rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/50 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm sm:text-base font-semibold text-slate-200 truncate">{category.name}</h3>
                          {categoryItemCounts[category.id] !== undefined && (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                              {categoryItemCounts[category.id]} {categoryItemCounts[category.id] === 1 ? 'item' : 'items'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Created {category.createdAt?.toDate?.().toLocaleDateString() || 'Unknown date'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <button
                          onClick={() => startEdit(category)}
                          disabled={submitting}
                          className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-2 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Edit category"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(category.id, category.name)}
                          disabled={submitting}
                          className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-2 text-slate-400 hover:text-red-400 hover:border-red-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete category"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reassignment Modal */}
      {showReassignModal && categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl shadow-2xl shadow-slate-900/50 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-800/50">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-slate-50 flex items-center gap-2">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Reassign Items Before Deleting
                </h2>
                <button
                  onClick={() => {
                    setShowReassignModal(false);
                    setCategoryToDelete(null);
                    setItemsToReassign([]);
                    setItemReassignments({});
                  }}
                  disabled={submitting}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-slate-400">
                The category <span className="font-semibold text-slate-300">"{categoryToDelete.name}"</span> contains {itemsToReassign.length} {itemsToReassign.length === 1 ? 'item' : 'items'}. Please assign each item to a new category before deleting.
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {itemsToReassign.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-800/50 bg-slate-900/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{item.name}</p>
                    {item.location && (
                      <p className="text-xs text-slate-500 mt-0.5">{item.location}</p>
                    )}
                  </div>
                  <select
                    value={itemReassignments[item.id] || ''}
                    onChange={(e) => {
                      setItemReassignments({
                        ...itemReassignments,
                        [item.id]: e.target.value,
                      });
                    }}
                    className="rounded-lg border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-3 py-2 text-sm text-slate-100 transition-all focus:border-emerald-500/50 focus:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 min-w-[180px]"
                  >
                    <option value="">Select category...</option>
                    {categories
                      .filter(cat => cat.id !== categoryToDelete.id)
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-slate-800/50 flex gap-3">
              <button
                onClick={handleReassignAndDelete}
                disabled={submitting || itemsToReassign.some(item => !itemReassignments[item.id])}
                className="flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition-all hover:shadow-xl hover:shadow-red-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Processing...' : `Reassign & Delete "${categoryToDelete.name}"`}
              </button>
              <button
                onClick={() => {
                  setShowReassignModal(false);
                  setCategoryToDelete(null);
                  setItemsToReassign([]);
                  setItemReassignments({});
                }}
                disabled={submitting}
                className="rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <AuthGuard>
      <CategoriesPageContent />
    </AuthGuard>
  );
}

