'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const restoreSession = async () => {
      const userId = localStorage.getItem('gym_assist_user_id');
      if (userId) {
        router.replace('/dashboard');
        return;
      }

      const res = await fetch('/api/auth/session').catch(() => null);
      if (!res?.ok) {
        router.replace('/login');
        return;
      }

      const data = await res.json();
      if (data.userId) {
        localStorage.setItem('gym_assist_user_id', data.userId);
        if (data.upiId) localStorage.setItem('gym_assist_upi_id', data.upiId);
        router.replace('/dashboard');
        return;
      }

      router.replace('/login');
    };

    restoreSession();
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#050806] text-white">
      <div className="rounded-lg border border-white/10 bg-white/[0.055] px-5 py-4 text-sm text-white/60 backdrop-blur-xl">
        Opening GymAssist AI...
      </div>
    </main>
  );
}
