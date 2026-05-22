import { NextResponse } from 'next/server';
import { fetchGymAssistProfile, getOwnerTrialAccess, trialPaymentRequiredResponse } from '@/lib/auth/trial';
import { supabase } from '@/lib/supabase';
import { resolveActiveRequestOwner, resolveRequestOwner } from '@/lib/gymMemberTables';
import { isMissingColumnError } from '@/lib/auth/database';

type ProfileSettings = {
  gymName: string;
  gstNumber: string;
  standardFees: {
    oneMonth: number;
    threeMonths: number;
    sixMonths: number;
    oneYear: number;
  };
  upiId: string;
};

function toMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
}

function mapSettings(row: any, ownerId: string): ProfileSettings {
  return {
    gymName: String(row?.gym_name || ownerId || '').trim(),
    gstNumber: String(row?.gst_number || '').trim(),
    standardFees: {
      oneMonth: toMoney(row?.fee_1_month),
      threeMonths: toMoney(row?.fee_3_months),
      sixMonths: toMoney(row?.fee_6_months),
      oneYear: toMoney(row?.fee_1_year),
    },
    upiId: String(row?.upi_id || '').trim(),
  };
}

function settingsPayload(body: any) {
  const standardFees = body?.standardFees || {};
  return {
    gym_name: String(body?.gymName || '').trim(),
    gst_number: String(body?.gstNumber || '').trim().toUpperCase(),
    upi_id: String(body?.upiId || '').trim(),
    fee_1_month: toMoney(standardFees.oneMonth),
    fee_3_months: toMoney(standardFees.threeMonths),
    fee_6_months: toMoney(standardFees.sixMonths),
    fee_1_year: toMoney(standardFees.oneYear),
  };
}

function isSettingsColumnError(error: any) {
  return (
    isMissingColumnError(error, 'gym_name') ||
    isMissingColumnError(error, 'gst_number') ||
    isMissingColumnError(error, 'fee_1_month') ||
    isMissingColumnError(error, 'fee_3_months') ||
    isMissingColumnError(error, 'fee_6_months') ||
    isMissingColumnError(error, 'fee_1_year')
  );
}

async function getOwnerId(request: Request) {
  const owner = await resolveRequestOwner(request);
  return owner?.userId || null;
}

async function getLegacySettings(ownerId: string) {
  if (!supabase) return null;

  const usernameMatch = await supabase
    .from('users')
    .select('upi_id,gym_name,gst_number,fee_1_month,fee_3_months,fee_6_months,fee_1_year')
    .eq('username', ownerId)
    .maybeSingle();

  if (!usernameMatch.error && usernameMatch.data) return mapSettings(usernameMatch.data, ownerId);

  const emailMatch = await supabase
    .from('users')
    .select('upi_id,gym_name,gst_number,fee_1_month,fee_3_months,fee_6_months,fee_1_year')
    .eq('email', ownerId)
    .maybeSingle();

  if (!emailMatch.error && emailMatch.data) return mapSettings(emailMatch.data, ownerId);
  if (isSettingsColumnError(usernameMatch.error) || isSettingsColumnError(emailMatch.error)) {
    const usernameUpi = await supabase
      .from('users')
      .select('upi_id')
      .eq('username', ownerId)
      .maybeSingle();

    if (!usernameUpi.error && usernameUpi.data) return mapSettings(usernameUpi.data, ownerId);

    const emailUpi = await supabase
      .from('users')
      .select('upi_id')
      .eq('email', ownerId)
      .maybeSingle();

    if (!emailUpi.error && emailUpi.data) return mapSettings(emailUpi.data, ownerId);
  }
  return null;
}

async function updateLegacySettings(ownerId: string, payload: ReturnType<typeof settingsPayload>) {
  if (!supabase) return false;

  const byUsername = await supabase
    .from('users')
    .update(payload)
    .eq('username', ownerId)
    .select('username')
    .maybeSingle();

  if (!byUsername.error && byUsername.data) return true;
  if (isSettingsColumnError(byUsername.error)) {
    const upiOnly = await supabase.from('users').update({ upi_id: payload.upi_id }).eq('username', ownerId).select('username').maybeSingle();
    if (!upiOnly.error && upiOnly.data) return true;
  }

  const byEmail = await supabase
    .from('users')
    .update(payload)
    .eq('email', ownerId)
    .select('username')
    .maybeSingle();

  if (!byEmail.error && byEmail.data) return true;
  if (isSettingsColumnError(byEmail.error)) {
    const upiOnly = await supabase.from('users').update({ upi_id: payload.upi_id }).eq('email', ownerId).select('username').maybeSingle();
    return !upiOnly.error && Boolean(upiOnly.data);
  }

  return false;
}

export async function GET(request: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 });
  }

  const ownerId = await getOwnerId(request);
  if (!ownerId) {
    return NextResponse.json({ error: 'Unauthorized session. Please login again.' }, { status: 401 });
  }

  try {
    const access = await getOwnerTrialAccess(ownerId);
    if (access.requiresPayment) {
      return trialPaymentRequiredResponse(access);
    }

    const { data: appProfile, error: appProfileError } = await fetchGymAssistProfile(ownerId);

    if (!appProfileError && appProfile && Object.prototype.hasOwnProperty.call(appProfile, 'upi_id')) {
      const settings = mapSettings(appProfile, ownerId);
      return NextResponse.json({ subscription: access, ...settings });
    }

    const legacySettings = await getLegacySettings(ownerId);
    return NextResponse.json({ subscription: access, ...(legacySettings || mapSettings(null, ownerId)) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 });
  }

  const resolved = await resolveActiveRequestOwner(request);
  if (resolved.error) return resolved.error;
  const ownerId = resolved.owner!.userId;

  try {
    const body = await request.json();
    const payload = settingsPayload(body);

    const { data: appProfile, error: appProfileError } = await supabase
      .from('gymassistai_users')
      .select('*')
      .eq('username', ownerId)
      .maybeSingle();

    if (!appProfileError && appProfile && Object.prototype.hasOwnProperty.call(appProfile, 'upi_id')) {
      const { error } = await supabase
        .from('gymassistai_users')
        .update(payload)
        .eq('username', ownerId);

      if (error) {
        if (!isSettingsColumnError(error)) throw error;
        const { error: upiOnlyError } = await supabase
          .from('gymassistai_users')
          .update({ upi_id: payload.upi_id })
          .eq('username', ownerId);
        if (upiOnlyError) throw upiOnlyError;
      }
      return NextResponse.json({ success: true });
    }

    await updateLegacySettings(ownerId, payload);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
