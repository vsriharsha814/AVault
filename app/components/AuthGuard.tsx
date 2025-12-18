'use client';

import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { createOrUpdateUser } from '../lib/firestore';
import LoginForm from './LoginForm';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [user, loading, error] = useAuthState(auth || undefined);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Create/update user record in Firestore when user signs in
  useEffect(() => {
    if (user && auth) {
      createOrUpdateUser(
        user.uid,
        user.email || '',
        user.displayName || undefined,
        user.photoURL || undefined
      ).catch((err) => {
        console.error('Error creating/updating user record:', err);
      });
    }
  }, [user]);

  // Show setup message if Firebase is not configured
  if (!auth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-8">
          <h1 className="text-2xl font-semibold text-slate-50">Firebase Not Configured</h1>
          <p className="text-sm text-slate-400">
            Please set up your Firebase configuration to use AVault.
          </p>
          <div className="space-y-2 rounded-lg bg-slate-800/50 p-4 text-sm">
            <p className="font-medium text-slate-300">Steps to configure:</p>
            <ol className="ml-4 list-decimal space-y-1 text-slate-400">
              <li>Create a Firebase project at console.firebase.google.com</li>
              <li>Enable Authentication (Email/Password)</li>
              <li>Enable Cloud Firestore</li>
              <li>Create a <code className="rounded bg-slate-900 px-1">.env.local</code> file with your Firebase config</li>
            </ol>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-4 text-xs">
            <p className="font-medium text-slate-300 mb-2">Required environment variables:</p>
            <code className="block text-slate-400 whitespace-pre-wrap">
              NEXT_PUBLIC_FIREBASE_API_KEY=...{'\n'}
              NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...{'\n'}
              NEXT_PUBLIC_FIREBASE_PROJECT_ID=...{'\n'}
              NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...{'\n'}
              NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...{'\n'}
              NEXT_PUBLIC_FIREBASE_APP_ID=...
            </code>
          </div>
        </div>
      </div>
    );
  }

  if (!mounted || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md rounded-xl border border-red-800 bg-slate-900/60 p-8">
          <h1 className="text-xl font-semibold text-red-400 mb-2">Authentication Error</h1>
          <p className="text-sm text-slate-400">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return <>{children}</>;
}

