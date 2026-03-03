import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 });
  }

  const { data, error } = await supabase.from('members').select('*');
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    
    // Calculate end_date based on start_date and plan_type
    const startDate = new Date(body.start_date);
    let endDate = new Date(startDate);
    
    if (body.plan_type === '1 Month') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (body.plan_type === '3 Months') {
      endDate.setMonth(endDate.getMonth() + 3);
    } else if (body.plan_type === '6 Months') {
      endDate.setMonth(endDate.getMonth() + 6);
    } else if (body.plan_type === '1 Year') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Determine status
    let status = 'Unpaid';
    if (body.amount_paid >= body.fee) {
      status = 'Paid';
    } else if (body.amount_paid > 0) {
      status = 'Partial';
    }
    
    const now = new Date();
    if (now > endDate && status !== 'Paid') {
      status = 'Overdue';
    }

    const { data, error } = await supabase.from('members').insert([
      {
        name: body.name,
        phone: body.phone,
        plan_type: body.plan_type,
        start_date: body.start_date,
        end_date: endDate.toISOString().split('T')[0],
        fee: body.fee,
        amount_paid: body.amount_paid,
        status: status,
      }
    ]).select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
