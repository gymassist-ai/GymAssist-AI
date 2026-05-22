import { NextResponse } from 'next/server';
import { getOwnerTrialAccess, trialPaymentRequiredResponse } from '@/lib/auth/trial';
import { resolveRequestOwner } from '@/lib/gymMemberTables';
import { supabase } from '@/lib/supabase';

async function getLegacyUpiId(ownerId: string) {
  if (!supabase) return null;

  const usernameMatch = await supabase
    .from('users')
    .select('upi_id')
    .eq('username', ownerId)
    .maybeSingle();

  if (!usernameMatch.error && usernameMatch.data) return usernameMatch.data.upi_id || null;

  const emailMatch = await supabase
    .from('users')
    .select('upi_id')
    .eq('email', ownerId)
    .maybeSingle();

  if (!emailMatch.error && emailMatch.data) return emailMatch.data.upi_id || null;
  return null;
}

export async function GET(request: Request) {
  const owner = await resolveRequestOwner(request);

  if (!owner?.userId) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const access = await getOwnerTrialAccess(owner.userId);
  if (access.requiresPayment) {
    return trialPaymentRequiredResponse(access);
  }

  return NextResponse.json({
    authenticated: true,
    subscription: access,
    upiId: await getLegacyUpiId(owner.userId),
    userId: owner.userId,
  });
}
