import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 });
  }

  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'User ID missing' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('gym_owner_id', userId);
  
  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json(data);
}

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
      
      let memberId = body.member_id;
      if (!memberId) {
        // Generate Member ID
        const { data: existingMembers } = await supabase
          .from('members')
          .select('member_id')
          .eq('gym_owner_id', userId);
        
        const existingIds = existingMembers?.map(m => m.member_id).filter(Boolean) || [];
        
        // Extract 3 letters from member name or gym name
        let prefix = '';
        if (body.member_name && body.member_name.length >= 3) {
          prefix = body.member_name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
        }
        if (prefix.length < 3) {
          prefix = (prefix + 'ABC').substring(0, 3);
        }
        
        let counter = 1;
        while (true) {
          const candidate = `#${prefix}${counter.toString().padStart(3, '0')}`;
          if (!existingIds.includes(candidate)) {
            memberId = candidate;
            break;
          }
          counter++;
        }
      }
      
      const { data, error } = await supabase.from('members').insert([
        {
          gym_owner_id: userId,
          member_id: memberId,
          member_name: body.member_name,
        phone: body.phone,
        email: body.email || null,
        membership_plan: body.membership_plan,
        membership_start: body.membership_start,
        membership_end: body.membership_end,
        member_upi_id: body.member_upi_id || null,
        fee: body.fee || 0,
        amuont_paid: body.amuont_paid || 0,
        status: body.status || 'Active',
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

export async function PUT(request: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 });
  }

  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'User ID missing' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    const { data, error } = await supabase.from('members')
      .update({
        member_id: body.member_id || undefined,
        member_name: body.member_name,
        phone: body.phone,
        email: body.email || null,
        membership_plan: body.membership_plan,
        membership_start: body.membership_start,
        membership_end: body.membership_end,
        member_upi_id: body.member_upi_id || null,
        fee: body.fee,
        amuont_paid: body.amuont_paid,
        status: body.status,
      })
      .eq('id', body.id)
      .eq('gym_owner_id', userId)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json(data[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
