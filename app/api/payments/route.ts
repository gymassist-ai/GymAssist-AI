import { NextResponse } from 'next/server';
import { getDisplayMemberId, getPaymentStatus, isValidTransactionId, toMoney } from '@/lib/billing';
import { supabase } from '@/lib/supabase';
import { resolveActiveRequestOwner, resolveGymMemberTable, resolveGymPaymentTable } from '@/lib/gymMemberTables';
import { calculateRenewalWindow } from '@/lib/membership';

async function getOwnerAndTable(request: Request) {
  if (!supabase) {
    return { error: NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 }) };
  }

  const resolvedOwner = await resolveActiveRequestOwner(request);
  if (resolvedOwner.error) return { error: resolvedOwner.error };

  try {
    const memberTable = await resolveGymMemberTable(resolvedOwner.owner!.userId);
    const paymentTable = await resolveGymPaymentTable(resolvedOwner.owner!.userId);
    return { memberTable, paymentTable, owner: resolvedOwner.owner };
  } catch (err: any) {
    return { error: NextResponse.json({ error: err.message }, { status: 500 }) };
  }
}

function isMissingPaymentRpcError(error: any) {
  return ['42883', 'PGRST202'].includes(error?.code || '') || String(error?.message || '').includes('record_gymassist_payment');
}

function isSchemaColumnError(error: any) {
  return ['42703', 'PGRST204'].includes(error?.code || '') || String(error?.message || '').includes('schema cache');
}

function buildRenewalNote(body: any, details: { renewalPlan: string; renewalStartDate: string; newEndDate: string; previousEndDate?: string | null }) {
  const renewalSummary = `Renewal: ${details.renewalPlan} from ${details.renewalStartDate} to ${details.newEndDate}. Previous expiry: ${details.previousEndDate || 'N/A'}.`;
  return [body.notes, renewalSummary].filter(Boolean).join('\n');
}

async function recordPaymentDirectly({
  body,
  memberRecordId,
  memberTable,
  paymentAmount,
  paymentTable,
  transactionId,
}: {
  body: any;
  memberRecordId: string;
  memberTable: string;
  paymentAmount: number;
  paymentTable: string;
  transactionId: string;
}) {
  const { data: member, error: memberError } = await supabase!
    .from(memberTable)
    .select('*')
    .eq('name', memberRecordId)
    .single();

  if (memberError || !member) {
    throw new Error('Member not found.');
  }

  const totalFee = toMoney(member.total_fee ?? member.fee ?? 0);
  const previousPaid = toMoney(member.amount_paid ?? member['amount paid'] ?? member['amuont paid'] ?? member.amuont_paid ?? 0);
  const previousDue = toMoney(member.pending_dues ?? Math.max(totalFee - previousPaid, 0));

  if (paymentAmount > previousDue) {
    throw new Error('Payment amount cannot be greater than remaining dues.');
  }

  const amountPaid = toMoney(previousPaid + paymentAmount);
  const remainingDue = toMoney(Math.max(totalFee - amountPaid, 0));
  const paymentStatus = getPaymentStatus(totalFee, amountPaid);
  const actualMemberId = getDisplayMemberId(member.member_id || body.member_id);
  const paymentDate = String(body.payment_date);

  const fullPaymentRow = {
    transaction_id: transactionId,
    member_id: actualMemberId,
    amount_paid: String(paymentAmount),
    previous_due: String(previousDue),
    remaining_due: String(remainingDue),
    payment_date: paymentDate,
    notes: body.notes || null,
    member_record_id: memberRecordId,
    member_name: member.name || memberRecordId,
    payment_status: paymentStatus,
    member_upi_id: body.member_upi_id,
    owner_upi_id: body.owner_upi_id || null,
    bill_url: body.bill_url || null,
  };

  const { error: fullInsertError } = await supabase!.from(paymentTable).insert([fullPaymentRow]);
  if (fullInsertError) {
    if (!isSchemaColumnError(fullInsertError)) throw new Error(fullInsertError.message);

    const { error: legacyInsertError } = await supabase!.from(paymentTable).insert([
      {
        transaction_id: transactionId,
        member_id: actualMemberId,
        amount_paid: String(paymentAmount),
        previous_due: String(previousDue),
        remaining_due: String(remainingDue),
        payment_date: paymentDate,
        notes: body.notes || null,
      },
    ]);

    if (legacyInsertError) throw new Error(legacyInsertError.message);
  }

  const { error: updateError } = await supabase!
    .from(memberTable)
    .update({
      fee: totalFee,
      total_fee: totalFee,
      amount_paid: amountPaid,
      'amount paid': amountPaid,
      pending_dues: remainingDue,
      payment_status: paymentStatus,
      status: 'Active',
    })
    .eq('name', memberRecordId);

  if (updateError) throw new Error(updateError.message);

  return {
    payment: {
      transaction_id: transactionId,
      member_id: actualMemberId,
      amount_paid: paymentAmount,
      previous_due: previousDue,
      remaining_due: remainingDue,
      payment_date: paymentDate,
      payment_status: paymentStatus,
      notes: body.notes || null,
    },
    financials: {
      total_fee: totalFee,
      amount_paid: amountPaid,
      pending_dues: remainingDue,
      payment_status: paymentStatus,
    },
    fallback: false,
  };
}

async function recordRenewalDirectly({
  body,
  memberRecordId,
  memberTable,
  paymentAmount,
  paymentTable,
  transactionId,
}: {
  body: any;
  memberRecordId: string;
  memberTable: string;
  paymentAmount: number;
  paymentTable: string;
  transactionId: string;
}) {
  const { data: member, error: memberError } = await supabase!
    .from(memberTable)
    .select('*')
    .eq('name', memberRecordId)
    .single();

  if (memberError || !member) {
    throw new Error('Member not found.');
  }

  const renewalPlan = String(body.renewal_plan || body.membership_plan || '1 Month');
  const renewalFee = toMoney(body.renewal_fee ?? body.plan_fee ?? paymentAmount);
  const paymentDate = String(body.payment_date);

  if (renewalFee <= 0) {
    throw new Error('Renewal fee must be greater than zero.');
  }

  const totalFee = toMoney(member.total_fee ?? member.fee ?? 0);
  const previousPaid = toMoney(member.amount_paid ?? member['amount paid'] ?? member['amuont paid'] ?? member.amuont_paid ?? 0);
  const previousDue = toMoney(member.pending_dues ?? Math.max(totalFee - previousPaid, 0));
  const payableNow = toMoney(previousDue + renewalFee);

  if (paymentAmount > payableNow) {
    throw new Error('Payment amount cannot be greater than previous dues plus the renewal fee.');
  }

  const previousEndDate = member['end date'] || member.membership_end || null;
  const renewalWindow = calculateRenewalWindow({
    currentEndDate: previousEndDate,
    paymentDate,
    renewalPlan,
  });
  const nextTotalFee = toMoney(totalFee + renewalFee);
  const nextPaid = toMoney(previousPaid + paymentAmount);
  const nextDue = toMoney(Math.max(nextTotalFee - nextPaid, 0));
  const nextStatus = getPaymentStatus(nextTotalFee, nextPaid);
  const actualMemberId = getDisplayMemberId(member.member_id || body.member_id);
  const renewalNote = buildRenewalNote(body, {
    renewalPlan,
    renewalStartDate: renewalWindow.renewalStartDate,
    newEndDate: renewalWindow.newEndDate,
    previousEndDate,
  });

  const fullPaymentRow = {
    transaction_id: transactionId,
    member_id: actualMemberId,
    amount_paid: String(paymentAmount),
    previous_due: String(previousDue),
    remaining_due: String(nextDue),
    payment_date: paymentDate,
    notes: renewalNote || null,
    member_record_id: memberRecordId,
    member_name: member.name || memberRecordId,
    payment_status: nextStatus,
    member_upi_id: body.member_upi_id,
    owner_upi_id: body.owner_upi_id || null,
    bill_url: body.bill_url || null,
    payment_type: 'renewal',
    renewal_plan: renewalPlan,
    renewal_months: renewalWindow.months,
    renewal_fee: renewalFee,
    previous_membership_end: previousEndDate,
    renewal_start_date: renewalWindow.renewalStartDate,
    new_membership_end: renewalWindow.newEndDate,
    total_fee_after: nextTotalFee,
    amount_paid_after: nextPaid,
    pending_dues_after: nextDue,
  };

  const { error: fullInsertError } = await supabase!.from(paymentTable).insert([fullPaymentRow]);
  if (fullInsertError) {
    if (!isSchemaColumnError(fullInsertError)) throw new Error(fullInsertError.message);

    const { error: legacyInsertError } = await supabase!.from(paymentTable).insert([
      {
        transaction_id: transactionId,
        member_id: actualMemberId,
        amount_paid: String(paymentAmount),
        previous_due: String(previousDue),
        remaining_due: String(nextDue),
        payment_date: paymentDate,
        notes: renewalNote || null,
      },
    ]);

    if (legacyInsertError) throw new Error(legacyInsertError.message);
  }

  const baseMemberUpdate = {
    'plan type': renewalPlan,
    'end date': renewalWindow.newEndDate,
    fee: nextTotalFee,
    total_fee: nextTotalFee,
    amount_paid: nextPaid,
    'amount paid': nextPaid,
    pending_dues: nextDue,
    payment_status: nextStatus,
    status: 'Active',
  };
  const { error: fullUpdateError } = await supabase!
    .from(memberTable)
    .update({
      ...baseMemberUpdate,
      recurring_fee: renewalFee,
      renewal_count: Number(member.renewal_count || 0) + 1,
      last_renewal_date: paymentDate,
      last_renewal_plan: renewalPlan,
      current_period_start: renewalWindow.renewalStartDate,
    })
    .eq('name', memberRecordId);

  if (fullUpdateError) {
    if (!isSchemaColumnError(fullUpdateError)) throw new Error(fullUpdateError.message);

    const { error: legacyUpdateError } = await supabase!
      .from(memberTable)
      .update(baseMemberUpdate)
      .eq('name', memberRecordId);

    if (legacyUpdateError) throw new Error(legacyUpdateError.message);
  }

  return {
    payment: {
      transaction_id: transactionId,
      member_id: actualMemberId,
      amount_paid: paymentAmount,
      previous_due: previousDue,
      remaining_due: nextDue,
      payment_date: paymentDate,
      payment_status: nextStatus,
      notes: renewalNote || null,
      payment_type: 'renewal',
      renewal_plan: renewalPlan,
      renewal_months: renewalWindow.months,
      renewal_fee: renewalFee,
      previous_membership_end: previousEndDate,
      renewal_start_date: renewalWindow.renewalStartDate,
      new_membership_end: renewalWindow.newEndDate,
    },
    financials: {
      total_fee: nextTotalFee,
      amount_paid: nextPaid,
      pending_dues: nextDue,
      payment_status: nextStatus,
      membership_plan: renewalPlan,
      membership_end: renewalWindow.newEndDate,
    },
    membership: {
      previous_end: previousEndDate,
      renewal_start_date: renewalWindow.renewalStartDate,
      new_end: renewalWindow.newEndDate,
      renewal_plan: renewalPlan,
      renewal_months: renewalWindow.months,
    },
    fallback: true,
  };
}

export async function POST(request: Request) {
  const resolved = await getOwnerAndTable(request);
  if (resolved.error) return resolved.error;

  try {
    const body = await request.json();
    const memberRecordId = String(body.member_record_id || body.member_name || body.member_id || '').trim();
    const transactionId = String(body.transaction_id || '').trim();
    const paymentAmount = toMoney(body.amount);

    if (!memberRecordId || !transactionId || !body.payment_date || !body.member_upi_id) {
      return NextResponse.json({ error: 'Missing required payment fields' }, { status: 400 });
    }

    if (!isValidTransactionId(transactionId)) {
      return NextResponse.json(
        { error: 'Transaction ID must be 3-64 characters and can only include letters, numbers, dot, slash, underscore, or hyphen.' },
        { status: 400 },
      );
    }

    if (paymentAmount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be greater than zero.' }, { status: 400 });
    }

    if (String(body.payment_type || '').toLowerCase() === 'renewal') {
      const renewalResult = await recordRenewalDirectly({
        body,
        memberRecordId,
        memberTable: resolved.memberTable!,
        paymentAmount,
        paymentTable: resolved.paymentTable!,
        transactionId,
      });

      return NextResponse.json({
        message: 'Membership renewed successfully. Validity, dues, payment history, and reminders were updated together.',
        payment: renewalResult.payment,
        financials: renewalResult.financials,
        membership: renewalResult.membership,
        fallback: renewalResult.fallback,
      });
    }

    const { data, error } = await supabase!.rpc('record_gymassist_payment', {
      p_gym_owner_id: resolved.owner!.userId,
      p_member_table: resolved.memberTable!,
      p_payment_table: resolved.paymentTable!,
      p_member_record_id: memberRecordId,
      p_transaction_id: transactionId,
      p_amount: paymentAmount,
      p_payment_date: body.payment_date,
      p_member_upi_id: body.member_upi_id,
      p_owner_upi_id: body.owner_upi_id || null,
      p_bill_url: body.bill_url || null,
      p_notes: body.notes || null,
    });

    if (error) {
      if (isMissingPaymentRpcError(error)) {
        const fallbackResult = await recordPaymentDirectly({
          body,
          memberRecordId,
          memberTable: resolved.memberTable!,
          paymentAmount,
          paymentTable: resolved.paymentTable!,
          transactionId,
        });

        return NextResponse.json({
          message: 'Payment recorded successfully. Install the billing RPC migration for transaction-safe writes.',
          payment: fallbackResult.payment,
          financials: fallbackResult.financials,
          fallback: true,
        });
      }

      const migrationHint = ['42883', 'PGRST202'].includes(error.code || '')
        ? ' Run supabase/billing_payment_tracking.sql in Supabase SQL Editor, then retry.'
        : '';
      const status = error.message?.toLowerCase().includes('not found') ? 404 : 400;
      return NextResponse.json({ error: `${error.message}${migrationHint}` }, { status });
    }

    return NextResponse.json({
      message: 'Payment recorded successfully. Dues, payment history, and member profile were updated together.',
      payment: data?.payment || data,
      financials: data?.financials,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const resolved = await getOwnerAndTable(request);
  if (resolved.error) return resolved.error;

  const { data, error } = await supabase!
    .from(resolved.paymentTable!)
    .select('*')
    .order('payment_date', { ascending: false });

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const mappedData = (data || []).map((item: any) => ({
    id: item.id,
    member_id: item.member_id || 'N/A',
    member_name: item.member_name || item.member_record_id || item.member_id || 'Unknown',
    transaction_id: item.transaction_id,
    amount: Number(item.amount_paid || item.amount || 0),
    amount_paid: item.amount_paid,
    previous_due: item.previous_due,
    remaining_due: item.remaining_due,
    payment_status: item.payment_status,
    payment_type: item.payment_type || (item.renewal_plan || item.new_membership_end ? 'renewal' : 'payment'),
    renewal_plan: item.renewal_plan,
    renewal_months: item.renewal_months,
    renewal_fee: item.renewal_fee,
    previous_membership_end: item.previous_membership_end,
    renewal_start_date: item.renewal_start_date,
    new_membership_end: item.new_membership_end,
    total_fee_after: item.total_fee_after,
    amount_paid_after: item.amount_paid_after,
    pending_dues_after: item.pending_dues_after,
    notes: item.notes,
    payment_date: item.payment_date,
    bill_url: item.bill_url,
  }));

  return NextResponse.json(mappedData);
}
