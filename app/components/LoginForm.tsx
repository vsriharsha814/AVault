'use client';

import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function LoginForm() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    if (!auth) {
      setError('Firebase is not configured. Please set up your environment variables.');
      setLoading(false);
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      // signInWithPopup opens a popup window (similar to a new tab)
      // This is the standard Firebase Auth popup method
      await signInWithPopup(auth, provider);
      // User record will be created/updated in AuthGuard after successful sign-in
      setLoading(false);
    } catch (err) {
      // Handle specific error codes
      const error = err as { code?: string; message?: string };
      console.error('Authentication error:', {
        code: error.code,
        message: error.message,
        currentDomain: window.location.hostname,
        currentOrigin: window.location.origin,
        fullUrl: window.location.href,
      });
      
      if (error.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please allow popups for this site and try again.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled. Please try again.');
      } else if (error.code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        const currentOrigin = window.location.origin;
        setError(
          `This domain is not authorized. Current domain: ${currentDomain} (${currentOrigin}). ` +
          `Please ensure this domain is added to Firebase Console > Authentication > Settings > Authorized domains.`
        );
      } else {
        setError(error.message || 'Authentication failed');
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/90 to-slate-800/50 backdrop-blur-xl p-10 shadow-2xl shadow-slate-900/50">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25 mb-2">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-50 via-emerald-100 to-slate-50 bg-clip-text text-transparent">
            AVault
          </h1>
          <p className="text-sm text-slate-400">
            Sign in with your Google account to continue
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 backdrop-blur-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="group relative w-full flex items-center justify-center gap-3 rounded-xl border border-slate-700/50 bg-white px-5 py-3.5 font-semibold text-slate-900 shadow-lg shadow-slate-900/20 transition-all hover:shadow-xl hover:scale-[1.02] hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 active:scale-[0.98]"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div>
              <span>Signing in...</span>
            </div>
          ) : (
            <>
              <svg className="h-5 w-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </>
          )}
        </button>

        <p className="text-center text-xs text-slate-500">
          By signing in, you agree to access the AVault inventory system
        </p>
      </div>
    </div>
  );
}

