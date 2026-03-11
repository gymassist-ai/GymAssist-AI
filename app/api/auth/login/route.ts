import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 });
  }

  try {
    const { email, password } = await request.json();

    // In a real app, passwords should be hashed. 
    // For this manual registration requirement, we check the 'users' table.
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Invalid Email or Password' }, { status: 401 });
    }

    return NextResponse.json({ 
      success: true, 
      userId: data.username, // username column now stores the Gym Name
      upiId: data.upi_id || null
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
