'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Chat from '@/components/Chat';

function subscribeToStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function readLocalValue(key: string) {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
}

export default function DashboardPage() {
  const router = useRouter();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const userId = useSyncExternalStore(
    subscribeToStorage,
    () => readLocalValue('gym_assist_user_id'),
    () => null,
  );
  const upiId = useSyncExternalStore(
    subscribeToStorage,
    () => readLocalValue('gym_assist_upi_id'),
    () => null,
  );

  useEffect(() => {
    let isActive = true;

    if (!userId) {
      const restoreSession = async () => {
        try {
          const res = await fetch('/api/auth/session');
          const data = await res.json().catch(() => ({}));

          if (!isActive) return;

          if (res.status === 402) {
            localStorage.setItem('gymassist_trial_expired_message', data.error || 'Your 15-day free trial has ended. Please choose a paid plan to continue.');
            localStorage.removeItem('gym_assist_user_id');
            localStorage.removeItem('gym_assist_upi_id');
            localStorage.removeItem('gym_assist_access_token');
            router.replace('/login?trialExpired=1');
            return;
          }

          if (res.ok && data.userId) {
            localStorage.setItem('gym_assist_user_id', data.userId);
            if (data.upiId) {
              localStorage.setItem('gym_assist_upi_id', data.upiId);
            } else {
              localStorage.removeItem('gym_assist_upi_id');
            }
            window.dispatchEvent(new Event('storage'));
            return;
          }

          router.replace('/login');
        } finally {
          if (isActive) setIsCheckingAccess(false);
        }
      };

      restoreSession();
      return () => {
        isActive = false;
      };
    }

    const verifyAccess = async () => {
      try {
        const accessToken = localStorage.getItem('gym_assist_access_token');
        const res = await fetch('/api/auth/profile', {
          headers: {
            'x-user-id': userId,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
        });
        const data = await res.json().catch(() => ({}));

        if (!isActive) return;

        if (res.status === 402) {
          localStorage.setItem('gymassist_trial_expired_message', data.error || 'Your 15-day free trial has ended. Please choose a paid plan to continue.');
          localStorage.removeItem('gym_assist_user_id');
          localStorage.removeItem('gym_assist_upi_id');
          localStorage.removeItem('gym_assist_access_token');
          router.replace('/login?trialExpired=1');
          return;
        }

        if (res.status === 401) {
          localStorage.removeItem('gym_assist_user_id');
          localStorage.removeItem('gym_assist_upi_id');
          localStorage.removeItem('gym_assist_access_token');
          router.replace('/login');
          return;
        }

        if (res.ok && data.upiId) {
          localStorage.setItem('gym_assist_upi_id', data.upiId);
        }
      } finally {
        if (isActive) setIsCheckingAccess(false);
      }
    };

    verifyAccess();
    return () => {
      isActive = false;
    };
  }, [router, userId]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    localStorage.removeItem('gym_assist_user_id');
    localStorage.removeItem('gym_assist_upi_id');
    localStorage.removeItem('gym_assist_access_token');
    router.replace('/login');
  };

  if (!userId || isCheckingAccess) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#050806] text-white">
        <div className="rounded-lg border border-white/10 bg-white/[0.055] px-5 py-4 text-sm text-white/60 backdrop-blur-xl">
          Loading dashboard...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050806] transition-colors">
      <Chat userId={userId} upiId={upiId} onLogout={handleLogout} />
    </main>
  );
}
