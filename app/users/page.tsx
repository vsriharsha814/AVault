'use client';

import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import {
  getAllUsers,
  getUser,
  authorizeUser,
  revokeUserAccess,
  deleteUser,
} from '../lib/firestore';
import type { User } from '../types';
import Link from 'next/link';

export default function UsersPage() {
  const [currentUser, userLoading] = useAuthState(auth || undefined);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser && !userLoading) {
      // Check admin status first, then load users
      checkCurrentUser().then(() => {
        loadUsers();
      });
    } else if (!currentUser && !userLoading) {
      setCheckingAdmin(false);
    }
  }, [currentUser, userLoading]);

  async function loadUsers() {
    try {
      setLoading(true);
      const usersData = await getAllUsers();
      setUsers(usersData);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function checkCurrentUser() {
    if (currentUser) {
      try {
        const userData = await getUser(currentUser.uid);
        setCurrentUserData(userData);
      } catch (err: any) {
        console.error('Error checking current user:', err);
        setCurrentUserData(null);
      } finally {
        setCheckingAdmin(false);
      }
    }
  }

  const handleAuthorize = async (uid: string) => {
    try {
      await authorizeUser(uid);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to authorize user');
    }
  };

  const handleRevoke = async (uid: string) => {
    try {
      await revokeUserAccess(uid);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke access');
    }
  };

  const handleDelete = async (uid: string) => {
    if (!confirm('Are you sure you want to remove this user? This action cannot be undone.')) {
      return;
    }
    try {
      await deleteUser(uid);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    }
  };

  // Show loading while checking authentication or admin status
  if (userLoading || checkingAdmin || (currentUser && currentUserData === null)) {
    return (
      <div className="min-h-screen px-6 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-400">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  // Check if current user is admin
  const isAdmin = currentUserData?.isAdmin === true;

  if (!currentUser) {
    return (
      <div className="min-h-screen px-6 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-xl border border-red-800 bg-slate-900/60 p-8">
            <h1 className="text-2xl font-semibold text-red-400 mb-2">Not Authenticated</h1>
            <p className="text-slate-400 mb-4">Please sign in to access user management.</p>
            <Link
              href="/"
              className="inline-block rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-50 hover:bg-emerald-400"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen px-6 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-xl border border-red-800 bg-slate-900/60 p-8">
            <h1 className="text-2xl font-semibold text-red-400 mb-2">Access Denied</h1>
            <p className="text-slate-400 mb-4">You need administrator privileges to access user management.</p>
            <Link
              href="/"
              className="inline-block rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-50 hover:bg-emerald-400"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const authorizedUsers = users.filter((u) => u.isAuthorized);
  const unauthorizedUsers = users.filter((u) => !u.isAuthorized);

  return (
    <div className="min-h-screen px-6 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">User Management</h1>
            <p className="mt-1 text-sm text-slate-400">
              Manage user access to AVault
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
          >
            Back to Dashboard
          </Link>
        </header>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading users...</div>
        ) : (
          <div className="space-y-8">
            {/* Authorized Users */}
            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                Authorized Users ({authorizedUsers.length})
              </h2>
              {authorizedUsers.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">
                  No authorized users yet
                </div>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-800/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Last Login
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {authorizedUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-slate-800/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {user.photoURL ? (
                                  <img
                                    src={user.photoURL}
                                    alt={user.displayName || user.email}
                                    className="h-8 w-8 rounded-full"
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-sm">
                                    {user.email[0].toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div className="text-sm font-medium text-slate-200">
                                    {user.displayName || 'No name'}
                                  </div>
                                  {user.isAdmin && (
                                    <span className="text-xs text-emerald-400">Admin</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-300">{user.email}</td>
                            <td className="px-4 py-3 text-sm text-slate-400">
                              {user.lastLoginAt?.toDate?.().toLocaleDateString() || 'Never'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleRevoke(user.id)}
                                  className="rounded-lg border border-yellow-700 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-400 hover:bg-yellow-500/20"
                                >
                                  Revoke Access
                                </button>
                                {user.id !== currentUser?.uid && (
                                  <button
                                    onClick={() => handleDelete(user.id)}
                                    className="rounded-lg border border-red-700 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {/* Unauthorized Users */}
            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                Pending Access ({unauthorizedUsers.length})
              </h2>
              {unauthorizedUsers.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">
                  No pending users
                </div>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-800/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Requested
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {unauthorizedUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-slate-800/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {user.photoURL ? (
                                  <img
                                    src={user.photoURL}
                                    alt={user.displayName || user.email}
                                    className="h-8 w-8 rounded-full"
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-sm">
                                    {user.email[0].toUpperCase()}
                                  </div>
                                )}
                                <div className="text-sm font-medium text-slate-200">
                                  {user.displayName || 'No name'}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-300">{user.email}</td>
                            <td className="px-4 py-3 text-sm text-slate-400">
                              {user.createdAt?.toDate?.().toLocaleDateString() || 'Unknown'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAuthorize(user.id)}
                                  className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-medium text-emerald-50 hover:bg-emerald-400"
                                >
                                  Grant Access
                                </button>
                                <button
                                  onClick={() => handleDelete(user.id)}
                                  className="rounded-lg border border-red-700 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20"
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

