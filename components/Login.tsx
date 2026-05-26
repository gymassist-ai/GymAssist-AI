'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Dumbbell, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles, TicketPercent, User } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLogin: (userId: string, upiId: string | null, accessToken?: string | null) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referral, setReferral] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get('authMode') === 'signup') {
      setMode('signup');
    }
    if (params.get('trialExpired') === '1') {
      setError(localStorage.getItem('gymassist_trial_expired_message') || 'Your 15-day free trial has ended. Please choose a paid plan to continue.');
      localStorage.removeItem('gymassist_trial_expired_message');
    }
  }, []);

  const readPendingPlanSelection = () => {
    if (typeof window === 'undefined') return {};

    const params = new URLSearchParams(window.location.search);
    const selectedPlan = localStorage.getItem('selectedPlan') || sessionStorage.getItem('selectedPlan') || '';
    const billingCycle = localStorage.getItem('billingCycle') || sessionStorage.getItem('billingCycle') || '';
    const storedPaymentLink = localStorage.getItem('paymentLink') || sessionStorage.getItem('paymentLink') || '';
    const shouldSendPlan = mode === 'signup' || params.get('continueAfterLogin') === '1' || (selectedPlan && selectedPlan !== 'trial');

    if (!shouldSendPlan) return {};

    return {
      billingCycle: billingCycle || selectedPlan || 'trial',
      paymentLink: storedPaymentLink,
      selectedPlan: selectedPlan || 'trial',
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPaymentLink('');
    setSuccess('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();
    const cleanReferral = referral.trim();
    if (!cleanEmail || !password || (mode === 'signup' && !cleanUsername)) {
      setError('Please fill all required fields.');
      return;
    }

    if (mode === 'signup' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(mode === 'signup' ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          ...(mode === 'signup' ? { referral: cleanReferral || null, username: cleanUsername } : {}),
          ...readPendingPlanSelection(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(mode === 'signup' ? 'Account created. Opening dashboard...' : 'Login successful. Opening dashboard...');
        setPassword('');
        setReferral('');
        onLogin(data.userId, data.upiId);
      } else {
        setPaymentLink(data.paymentLink || '');
        setError(data.error || (mode === 'signup' ? 'Unable to create account' : 'Invalid email or password'));
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) {
    return <div className="min-h-screen bg-[#050806]" />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050806] p-4 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,#050806_0%,#0e1711_48%,#050806_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-emerald-300/12 to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative grid w-full max-w-5xl overflow-hidden rounded-lg border border-white/10 bg-white/[0.055] shadow-2xl shadow-black/40 backdrop-blur-xl lg:grid-cols-[1fr_0.9fr]"
      >
        <div className="p-6 sm:p-8">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-300 text-emerald-950 shadow-lg shadow-emerald-500/20">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">GymAssist AI</h1>
              <p className="text-xs text-white/40">AI gym operations center</p>
            </div>
          </div>

          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/80">{mode === 'signup' ? 'Owner Signup' : 'Owner Login'}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {mode === 'signup' ? 'Create your secure gym workspace.' : 'Run your gym from one calm command center.'}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/52">Payments, renewals, reminders, members, diet plans, and workouts stay visible the moment you sign in.</p>
          </div>

          <div className="mb-5 grid grid-cols-2 rounded-lg border border-white/10 bg-black/25 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setPaymentLink('');
                setSuccess('');
              }}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${mode === 'login' ? 'bg-emerald-300 text-emerald-950' : 'text-white/55 hover:text-white'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
                setPaymentLink('');
                setSuccess('');
              }}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${mode === 'signup' ? 'bg-emerald-300 text-emerald-950' : 'text-white/55 hover:text-white'}`}
            >
              Signup
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-100">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>
                  {error}
                  {paymentLink && (
                    <a className="ml-2 font-semibold text-emerald-200 underline decoration-emerald-200/40 underline-offset-4" href={paymentLink}>
                      Pay now
                    </a>
                  )}
                </span>
              </div>
            )}
            {success && (
              <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">
                {success}
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/45">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/25 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-emerald-300/60 focus:ring-4 focus:ring-emerald-300/10"
                    placeholder="shivam"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/45">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/25 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-emerald-300/60 focus:ring-4 focus:ring-emerald-300/10"
                  placeholder="owner@gym.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/45">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={mode === 'signup' ? 8 : undefined}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/25 py-3 pl-10 pr-12 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-emerald-300/60 focus:ring-4 focus:ring-emerald-300/10"
                  placeholder={mode === 'signup' ? 'Minimum 8 characters' : 'Enter password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-white/45 transition hover:bg-white/10 hover:text-white"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/45">Referral Code</label>
                <div className="relative">
                  <TicketPercent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    type="text"
                    autoComplete="off"
                    value={referral}
                    onChange={(e) => setReferral(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/25 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-emerald-300/60 focus:ring-4 focus:ring-emerald-300/10"
                    placeholder="Referral code (optional)"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-200 disabled:bg-white/10 disabled:text-white/30 disabled:shadow-none"
            >
              <Sparkles className="h-4 w-4" />
              {isLoading ? (mode === 'signup' ? 'Creating secure account...' : 'Verifying...') : mode === 'signup' ? 'Create Account' : 'Login to Dashboard'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-white/35">
            {mode === 'signup' ? 'Your account is ready for dashboard access immediately after signup.' : 'Use the email and password used during signup.'}
          </p>
        </div>

        <div className="hidden border-l border-white/10 bg-black/20 p-8 lg:block">
          <div className="flex h-full flex-col justify-between rounded-lg border border-emerald-300/15 bg-emerald-300/[0.07] p-5">
            <div>
              <div className="mb-5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/80">Live Preview</span>
                <ShieldCheck className="h-5 w-5 text-emerald-200" />
              </div>
              <div className="space-y-3">
                <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                  <p className="text-xs text-white/40">Monthly revenue</p>
                  <p className="mt-2 text-3xl font-semibold">INR 1.84L</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                  <p className="text-xs text-white/40">AI reminder</p>
                  <p className="mt-2 text-sm text-white/78">Rahul is due in 3 days. WhatsApp follow-up is ready.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                  <p className="text-xs text-white/40">Command</p>
                  <p className="mt-2 text-sm font-medium text-emerald-100">Add member Priya, paid INR 1800</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
                <p className="text-lg font-semibold">248</p>
                <p className="text-[11px] text-white/40">Members</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
                <p className="text-lg font-semibold">14</p>
                <p className="text-[11px] text-white/40">Renewals</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
                <p className="text-lg font-semibold">92%</p>
                <p className="text-[11px] text-white/40">Collected</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
