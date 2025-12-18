'use client';

import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { createOrUpdateUser, getUser } from '../lib/firestore';
import LoginForm from './LoginForm';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [user, loading, error] = useAuthState(auth || undefined);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Create/update user record in Firestore when user signs in
  useEffect(() => {
    // Reset state when user changes
    if (user && auth) {
      setCheckingAuth(true);
      setIsAuthorized(null); // Reset to prevent showing wrong state
      
      console.log('Creating/updating user record for:', user.email);
      createOrUpdateUser(
        user.uid,
        user.email || '',
        user.displayName || undefined,
        user.photoURL || undefined
      )
        .then(() => {
          console.log('User record created/updated successfully');
          // Check if user is authorized
          return getUser(user.uid);
        })
        .then((userData) => {
          console.log('User data retrieved:', userData);
          const authorized = userData?.isAuthorized ?? false;
          setIsAuthorized(authorized);
          setCheckingAuth(false);
        })
        .catch((err) => {
          console.error('Error creating/updating user record:', err);
          console.error('Error details:', {
            code: err.code,
            message: err.message,
            stack: err.stack,
          });
          setIsAuthorized(false);
          setCheckingAuth(false);
        });
    } else if (!user && !loading) {
      // No user and not loading - show login
      setIsAuthorized(null);
      setCheckingAuth(false);
    } else if (!user && loading) {
      // Still loading auth state
      setCheckingAuth(true);
    }
  }, [user, loading]);

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

  // Show loading while checking authentication or authorization
  if (!mounted || loading || checkingAuth || (user && isAuthorized === null)) {
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

  // Check if user is authorized - only show this after we've checked
  if (isAuthorized === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-red-800 bg-slate-900/60 p-8">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-red-400 mb-2">Access Denied</h1>
            <p className="text-sm text-slate-400">
              You don't have permission to access AVault.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Please contact an administrator to grant you access.
            </p>
          </div>
          <button
            onClick={() => signOut(auth!)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

