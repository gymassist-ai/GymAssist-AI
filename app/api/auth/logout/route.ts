import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/appSession';

export async function POST() {
  return NextResponse.json(
    { success: true },
    {
      headers: {
        'Set-Cookie': clearSessionCookie(),
      },
    },
  );
}
