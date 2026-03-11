'use client';

import { useState } from 'react';
import { Dumbbell, Lock, Mail, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLogin: (userId: string, upiId: string | null) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        onLogin(data.userId, data.upiId);
      } else {
        setError(data.error || 'Invalid Email or Password');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-neutral-200 p-8"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
            <Dumbbell className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">GymAssist AI</h1>
          <p className="text-neutral-500 text-sm mt-1">Owner Login</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-start gap-3 border border-red-100">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700 ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                placeholder="Enter your email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                placeholder="Enter your password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/20 disabled:bg-neutral-300 disabled:shadow-none"
          >
            {isLoading ? 'Verifying...' : 'Login to Dashboard'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-neutral-100 text-center">
          <p className="text-xs text-neutral-400">
            Contact admin if you haven&apos;t received your credentials.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
