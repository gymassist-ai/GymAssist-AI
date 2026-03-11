import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!supabase || !username) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('upi_id')
      .eq('username', username)
      .single();

    if (error) throw error;

    return NextResponse.json({ upiId: data.upi_id || null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 });
  }

  try {
    const { username, upiId } = await request.json();

    const { error } = await supabase
      .from('users')
      .update({ upi_id: upiId })
      .eq('username', username);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
