import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculatePendingDues, getPaymentStatus, toMoney } from '@/lib/billing';
import { resolveActiveRequestOwner, resolveGymMemberTable } from '@/lib/gymMemberTables';
import { getMembershipStatus } from '@/lib/membership';

function mapMemberRow(row: any, ownerId: string) {
  const name = row.name || row.member_name || '';
  const totalFee = toMoney(row.total_fee ?? row.fee ?? 0);
  const paid = toMoney(row.amount_paid ?? row['amount paid'] ?? row['amuont paid'] ?? row.amuont_paid ?? 0);
  const pendingDues =
    row.pending_dues === null || row.pending_dues === undefined
      ? calculatePendingDues(totalFee, paid)
      : toMoney(row.pending_dues);
  const paymentStatus = row.payment_status || getPaymentStatus(totalFee, paid);
  const membershipEnd = row['end date'] || row.membership_end || '';
  const status = getMembershipStatus(membershipEnd, row.status);

  return {
    id: name,
    gym_owner_id: ownerId,
    member_id: row.member_id || undefined,
    member_name: name,
    phone: row.phone || '',
    email: row.email || undefined,
    membership_plan: row['plan type'] || row.membership_plan || '',
    membership_start: row['start date'] || row.membership_start || '',
    membership_end: membershipEnd,
    member_upi_id: row['upi id'] || row.member_upi_id || undefined,
    fee: totalFee,
    total_fee: totalFee,
    amount_paid: paid,
    pending_dues: pendingDues,
    payment_status: paymentStatus,
    amuont_paid: paid,
    status,
    last_renewal_date: row.last_renewal_date || undefined,
    last_renewal_plan: row.last_renewal_plan || undefined,
    renewal_count: Number(row.renewal_count || 0),
    recurring_fee: toMoney(row.recurring_fee || 0),
    current_period_start: row.current_period_start || undefined,
    created_at: row.created_at,
  };
}

function mapMemberBody(body: any) {
  const totalFee = toMoney(body.total_fee ?? body.fee ?? 0);
  const amountPaid = toMoney(body.amount_paid ?? body.amuont_paid ?? 0);
  const pendingDues = calculatePendingDues(totalFee, amountPaid);

  return {
    member_id: body.member_id || null,
    name: body.member_name,
    phone: body.phone,
    'plan type': body.membership_plan || null,
    'start date': body.membership_start || null,
    'end date': body.membership_end || null,
    email: body.email || null,
    'upi id': body.member_upi_id || null,
    fee: totalFee,
    amount_paid: amountPaid,
    pending_dues: pendingDues,
    payment_status: getPaymentStatus(totalFee, amountPaid),
    'amount paid': amountPaid,
    total_fee: totalFee,
    status: getMembershipStatus(body.membership_end, body.status),
  };
}

async function getOwnerAndTable(request: Request) {
  if (!supabase) {
    return { error: NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 }) };
  }

  const resolvedOwner = await resolveActiveRequestOwner(request);
  if (resolvedOwner.error) return { error: resolvedOwner.error };

  try {
    const tableName = await resolveGymMemberTable(resolvedOwner.owner!.userId);
    return { owner: resolvedOwner.owner, tableName };
  } catch (err: any) {
    return { error: NextResponse.json({ error: err.message }, { status: 500 }) };
  }
}

export async function GET(request: Request) {
  const resolved = await getOwnerAndTable(request);
  if (resolved.error) return resolved.error;

  const { data, error } = await supabase!
    .from(resolved.tableName!)
    .select('*');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data || []).map((row) => mapMemberRow(row, resolved.owner!.userId)));
}

export async function POST(request: Request) {
  const resolved = await getOwnerAndTable(request);
  if (resolved.error) return resolved.error;

  try {
    const body = await request.json();
    if (!body.member_name || !body.phone) {
      return NextResponse.json({ error: 'Member name and phone are required' }, { status: 400 });
    }

    const { data, error } = await supabase!
      .from(resolved.tableName!)
      .insert([mapMemberBody(body)])
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data?.[0] ? mapMemberRow(data[0], resolved.owner!.userId) : null);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const resolved = await getOwnerAndTable(request);
  if (resolved.error) return resolved.error;

  try {
    const body = await request.json();

    const { data, error } = await supabase!
      .from(resolved.tableName!)
      .update(mapMemberBody(body))
      .eq('name', body.id || body.member_name)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json(mapMemberRow(data[0], resolved.owner!.userId));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
