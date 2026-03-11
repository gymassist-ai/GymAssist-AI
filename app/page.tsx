'use client';

import { useState, useEffect } from 'react';
import Chat from '@/components/Chat';
import Login from '@/components/Login';

export default function Home() {
  const [userId, setUserId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gym_assist_user_id');
    }
    return null;
  });
  const [upiId, setUpiId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gym_assist_upi_id');
    }
    return null;
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsReady(true), 0);
  }, []);

  const handleLogin = (id: string, upi: string | null) => {
    setUserId(id);
    setUpiId(upi);
    localStorage.setItem('gym_assist_user_id', id);
    if (upi) {
      localStorage.setItem('gym_assist_upi_id', upi);
    } else {
      localStorage.removeItem('gym_assist_upi_id');
    }
  };

  const handleLogout = () => {
    setUserId(null);
    setUpiId(null);
    localStorage.removeItem('gym_assist_user_id');
    localStorage.removeItem('gym_assist_upi_id');
  };

  if (!isReady) return null;

  if (!userId) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <Chat userId={userId} upiId={upiId} onLogout={handleLogout} />
    </main>
  );
}

