import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { ArrowRight, CheckCircle2, Lock, Mail, ShieldCheck, User as UserIcon } from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase';

type AuthMode = 'login' | 'register' | 'forgot';

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setError(msg.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email.trim());
        setInfo('Password reset link sent. Please check your inbox.');
      } else if (mode === 'register') {
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
        await sendEmailVerification(cred.user);
        setInfo('Account created! Please verify your email address via the link sent to your inbox, or continue with Google.');
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      if (msg.includes('operation-not-allowed')) {
        setError(
          'Email/Password sign-in is not enabled on this Firebase project yet. Please use "Continue with Google" below, or enable Email/Password in Firebase Console.'
        );
      } else {
        setError(msg.replace('Firebase: ', ''));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09080f] text-slate-100 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 bg-[#120e1f] border border-violet-500/20 rounded-2xl overflow-hidden shadow-2xl shadow-violet-950/30">
        {/* Left Editorial Column */}
        <div className="lg:col-span-6 relative flex flex-col justify-between p-8 md:p-10 bg-gradient-to-br from-[#19112e] via-[#120d22] to-[#0a0812] border-b lg:border-b-0 lg:border-r border-violet-500/15">
          <div className="space-y-6">
            <div>
              <span className="text-xl font-bold tracking-tight text-white font-display">MoneyWise</span>
              <p className="text-xs text-violet-300/80 mt-1">Your Smart Money Manager · Indian Rupees (₹)</p>
            </div>

            <div className="relative rounded-xl overflow-hidden border border-violet-500/20 aspect-[4/3] bg-[#161026]">
              {!imgError ? (
                <img
                  src="/src/assets/images/auth_vault_visual_1795505075201.jpg"
                  alt="MoneyWise architectural wealth vault sculpture"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-950/60 via-[#151026] to-black">
                  <ShieldCheck className="w-12 h-12 text-violet-400/70" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#09080f]/90 via-[#09080f]/25 to-transparent flex items-end p-5">
                <p className="text-sm text-slate-200 leading-relaxed">
                  Track every rupee across salary, rent, UPI spends, budgets, savings goals, and loans in one private workspace.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-6 mt-6 border-t border-violet-500/15 text-xs text-slate-300">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>AI advisor grounded in your actual records</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Voice entry, receipt OCR & PDF/Excel exports</span>
            </div>
          </div>
        </div>

        {/* Right Auth Panel */}
        <div className="lg:col-span-6 p-8 md:p-10 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {mode === 'login' ? 'Sign in to MoneyWise' : mode === 'register' ? 'Create your account' : 'Reset password'}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Every user account keeps completely isolated personal financial records.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-medium text-sm transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                />
              </svg>
              Continue with Google
            </button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-violet-500/15" />
              <span className="px-3 text-xs text-slate-500">or use email</span>
              <div className="flex-grow border-t border-violet-500/15" />
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#0b0914] border border-violet-500/15 rounded-lg">
              {(['login', 'register', 'forgot'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                    setInfo(null);
                  }}
                  className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    mode === m
                      ? 'bg-violet-600/25 text-violet-200 border border-violet-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m === 'login' ? 'Sign In' : m === 'register' ? 'Register' : 'Forgot Password'}
                </button>
              ))}
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 leading-relaxed">
                {error}
              </div>
            )}
            {info && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 leading-relaxed">
                {info}
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Aarav Sharma"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0b0914] border border-violet-500/20 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1d1632] hover:bg-[#261d42] border border-violet-500/30 text-slate-100 text-sm font-medium transition-colors cursor-pointer disabled:opacity-60"
              >
                {loading
                  ? 'Please wait...'
                  : mode === 'login'
                  ? 'Sign In with Email'
                  : mode === 'register'
                  ? 'Create Account'
                  : 'Send Reset Link'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
