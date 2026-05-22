'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Login from '@/components/Login';

export default function LoginPage() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let isActive = true;

    const restoreSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json().catch(() => ({}));

        if (!isActive) return;

        if (res.ok && data.userId) {
          localStorage.setItem('gym_assist_user_id', data.userId);
          if (data.upiId) {
            localStorage.setItem('gym_assist_upi_id', data.upiId);
          } else {
            localStorage.removeItem('gym_assist_upi_id');
          }
          localStorage.removeItem('gym_assist_access_token');
          router.replace('/dashboard');
          return;
        }
      } finally {
        if (isActive) setIsCheckingSession(false);
      }
    };

    restoreSession();
    return () => {
      isActive = false;
    };
  }, [router]);

  const handleLogin = (id: string, upi: string | null) => {
    localStorage.setItem('gym_assist_user_id', id);
    if (upi) {
      localStorage.setItem('gym_assist_upi_id', upi);
    } else {
      localStorage.removeItem('gym_assist_upi_id');
    }
    localStorage.removeItem('gym_assist_access_token');
    router.replace('/dashboard');
  };

  if (isCheckingSession) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#050806] text-white">
        <div className="rounded-lg border border-white/10 bg-white/[0.055] px-5 py-4 text-sm text-white/60 backdrop-blur-xl">
          Checking saved login...
        </div>
      </main>
    );
  }

  return <Login onLogin={handleLogin} />;
}
