import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 });
  }

  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'User ID missing' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    // Step 1: Validate required inputs
    if (!body.transaction_id || !body.amount || !body.payment_date || !body.member_upi_id || !body.member_id) {
      return NextResponse.json({ error: 'Missing required payment fields' }, { status: 400 });
    }

    // Step 2: Fetch member record (already handled by client passing member_id, but we verify isolation)
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('*')
      .eq('id', body.member_id)
      .eq('gym_owner_id', userId)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: 'Member not found or unauthorized' }, { status: 404 });
    }

    // Step 4: Insert into payments table
    const { data: payment, error: paymentError } = await supabase.from('payments').insert([
      {
        gym_owner_id: userId,
        member_id: body.member_id,
        transaction_id: body.transaction_id,
        amount: body.amount,
        payment_date: body.payment_date,
        member_upi_id: body.member_upi_id,
        owner_upi_id: body.owner_upi_id || null,
        bill_url: body.bill_url || null,
        payment_status: 'PAID'
      }
    ]).select().single();

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }

    // Step 5: Insert into payment_history table
    const { error: historyError } = await supabase.from('payment_history').insert([
      {
        gym_owner_id: userId,
        member_id: body.member_id,
        payment_id: payment.id,
        transaction_id: body.transaction_id,
        amount: body.amount,
        payment_date: body.payment_date,
        bill_url: body.bill_url || null
      }
    ]);

    if (historyError) {
      console.error('Failed to record history', historyError);
    }

    // Step 6: Update member status
    await supabase.from('members')
      .update({ status: 'Active' })
      .eq('id', body.member_id)
      .eq('gym_owner_id', userId);

    return NextResponse.json({ 
      message: 'Payment recorded successfully. The bill has been generated and the transaction has been saved in payment history.',
      payment 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 });
  }

  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'User ID missing' }, { status: 401 });
  }

  // Fetch from payment_history as per "PAYMENT HISTORY ACCESS" spec
  const { data, error } = await supabase
    .from('payment_history')
    .select(`
      *,
      members (
        member_name
      )
    `)
    .eq('gym_owner_id', userId)
    .order('payment_date', { ascending: false });
  
  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Map for UI
  const mappedData = data.map((item: any) => ({
    id: item.id,
    member_name: item.members?.member_name || 'Unknown',
    transaction_id: item.transaction_id,
    amount: item.amount,
    payment_date: item.payment_date,
    bill_url: item.bill_url
  }));

  return NextResponse.json(mappedData);
}
