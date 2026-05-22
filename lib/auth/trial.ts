import { NextResponse } from 'next/server';
import { isMissingColumnError } from '@/lib/auth/database';
import { supabase } from '@/lib/supabase';

export const TRIAL_DAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;
const PAYMENT_REQUIRED_STATUS = 402;

const TRIAL_VALUES = new Set(['', 'trial', 'free', 'free_trial', '15-day-free', '15_day_free']);
const PAID_STATUSES = new Set(['active', 'paid', 'subscribed', 'subscription_active', 'payment_received']);

type PlanSelection = {
  billingCycle: string;
  paymentLink: string;
  selectedPlan: string;
};

export type GymAssistProfile = {
  auth_status?: string | null;
  billingCycle?: string | null;
  created_at?: string | null;
  paid_until?: string | null;
  paymentLink?: string | null;
  selectedPlan?: string | null;
  subscription_status?: string | null;
  trial_status?: string | null;
  upi_id?: string | null;
  gym_name?: string | null;
  gst_number?: string | null;
  fee_1_month?: number | string | null;
  fee_3_months?: number | string | null;
  fee_6_months?: number | string | null;
  fee_1_year?: number | string | null;
  username: string;
};

export type TrialAccess = {
  billingCycle: string;
  createdAt: string | null;
  daysRemaining: number;
  isPaid: boolean;
  paymentLink: string;
  requiresPayment: boolean;
  selectedPlan: string;
  trialEndsAt: string | null;
  trialExpired: boolean;
  trialStatus: string;
};

type SyncProfileOptions = {
  authStatus: string;
  initialCreatedAt?: string | null;
  selection?: PlanSelection | null;
  username: string;
};

const profileSelects = [
  'username,selectedPlan,billingCycle,paymentLink,trial_status,auth_status,created_at,upi_id,gym_name,gst_number,fee_1_month,fee_3_months,fee_6_months,fee_1_year,subscription_status,paid_until',
  'username,selectedPlan,billingCycle,paymentLink,trial_status,auth_status,created_at,upi_id,subscription_status,paid_until',
  'username,selectedPlan,billingCycle,paymentLink,trial_status,auth_status,created_at,upi_id',
  'username,selectedPlan,billingCycle,paymentLink,trial_status,auth_status,created_at',
  'username,selectedPlan,billingCycle,paymentLink,trial_status,auth_status',
  'username,created_at',
  'username',
];

function normalizeValue(value: unknown) {
  return String(value || '').trim();
}

function normalizeStatus(value: unknown) {
  return normalizeValue(value).toLowerCase();
}

export function hasPlanSelection(body: any) {
  return body?.selectedPlan !== undefined || body?.billingCycle !== undefined || body?.paymentLink !== undefined;
}

export function normalizePlanSelection(body: any, fallback?: Partial<PlanSelection> | null): PlanSelection {
  const selectedPlan = normalizeValue(body?.selectedPlan || fallback?.selectedPlan || 'trial') || 'trial';
  const billingCycle = normalizeValue(body?.billingCycle || fallback?.billingCycle || selectedPlan || 'trial') || 'trial';
  const paymentLink = normalizeValue(body?.paymentLink || fallback?.paymentLink || '');

  return {
    billingCycle,
    paymentLink,
    selectedPlan,
  };
}

function isTrialSelection(profile: Partial<GymAssistProfile>) {
  const selectedPlan = normalizeStatus(profile.selectedPlan);
  const billingCycle = normalizeStatus(profile.billingCycle);
  return TRIAL_VALUES.has(selectedPlan) || TRIAL_VALUES.has(billingCycle);
}

function isPaidProfile(profile: Partial<GymAssistProfile>) {
  const subscriptionStatus = normalizeStatus(profile.subscription_status);
  const trialStatus = normalizeStatus(profile.trial_status);
  const paidUntil = profile.paid_until ? new Date(profile.paid_until) : null;

  if (PAID_STATUSES.has(subscriptionStatus) || PAID_STATUSES.has(trialStatus)) return true;
  return Boolean(paidUntil && Number.isFinite(paidUntil.getTime()) && paidUntil.getTime() > Date.now());
}

export function evaluateTrialAccess(profile: Partial<GymAssistProfile> | null): TrialAccess {
  const selectedPlan = normalizeValue(profile?.selectedPlan || 'trial') || 'trial';
  const billingCycle = normalizeValue(profile?.billingCycle || 'trial') || 'trial';
  const created = profile?.created_at ? new Date(profile.created_at) : null;
  const createdAt = created && Number.isFinite(created.getTime()) ? created : null;
  const trialEndsAt = createdAt ? new Date(createdAt.getTime() + TRIAL_DAYS * DAY_MS) : null;
  const trialExpired = Boolean(trialEndsAt && Date.now() > trialEndsAt.getTime());
  const isPaid = isPaidProfile(profile || {});
  const requiresPayment = !isPaid && (trialExpired || (!isTrialSelection({ selectedPlan, billingCycle }) && trialExpired));

  return {
    billingCycle,
    createdAt: createdAt ? createdAt.toISOString() : null,
    daysRemaining: trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / DAY_MS)) : TRIAL_DAYS,
    isPaid,
    paymentLink: normalizeValue(profile?.paymentLink || ''),
    requiresPayment,
    selectedPlan,
    trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
    trialExpired,
    trialStatus: normalizeValue(profile?.trial_status || (isPaid ? 'paid' : 'active')),
  };
}

function isRecoverableProfileColumnError(error: any) {
  return (
    isMissingColumnError(error, 'selectedPlan') ||
    isMissingColumnError(error, 'billingCycle') ||
    isMissingColumnError(error, 'paymentLink') ||
    isMissingColumnError(error, 'trial_status') ||
    isMissingColumnError(error, 'auth_status') ||
    isMissingColumnError(error, 'created_at') ||
    isMissingColumnError(error, 'upi_id') ||
    isMissingColumnError(error, 'gym_name') ||
    isMissingColumnError(error, 'gst_number') ||
    isMissingColumnError(error, 'fee_1_month') ||
    isMissingColumnError(error, 'fee_3_months') ||
    isMissingColumnError(error, 'fee_6_months') ||
    isMissingColumnError(error, 'fee_1_year') ||
    isMissingColumnError(error, 'subscription_status') ||
    isMissingColumnError(error, 'paid_until')
  );
}

export async function fetchGymAssistProfile(username: string) {
  if (!supabase) throw new Error('Authentication is not configured');

  let lastResult: any = null;

  for (const columns of profileSelects) {
    const result = await supabase
      .from('gymassistai_users')
      .select(columns)
      .eq('username', username)
      .maybeSingle();

    if (!result.error || !isRecoverableProfileColumnError(result.error)) {
      return result as { data: GymAssistProfile | null; error: any };
    }

    lastResult = result;
  }

  return lastResult as { data: GymAssistProfile | null; error: any };
}

async function writeProfile(
  mode: 'insert' | 'update',
  username: string,
  payload: Record<string, string | null>,
) {
  if (!supabase) throw new Error('Authentication is not configured');

  const nextPayload = { ...payload };
  const removableColumns = ['paymentLink', 'billingCycle', 'selectedPlan', 'trial_status', 'auth_status', 'created_at', 'upi_id', 'gym_name', 'gst_number', 'fee_1_month', 'fee_3_months', 'fee_6_months', 'fee_1_year'];

  for (let attempt = 0; attempt <= removableColumns.length; attempt += 1) {
    const result = mode === 'insert'
      ? await supabase.from('gymassistai_users').insert([{ username, ...nextPayload }]).select('username').single()
      : await supabase.from('gymassistai_users').update(nextPayload).eq('username', username).select('username').maybeSingle();

    if (!result.error || !isRecoverableProfileColumnError(result.error)) return result;

    const missingColumn = removableColumns.find((column) => isMissingColumnError(result.error, column));
    if (!missingColumn) return result;
    delete nextPayload[missingColumn];
  }

  return { data: null, error: null };
}

export async function syncGymAssistProfile(options: SyncProfileOptions) {
  const { authStatus, initialCreatedAt, username } = options;
  const lookup = await fetchGymAssistProfile(username);
  if (lookup.error) throw lookup.error;

  const existing = lookup.data;
  const selection = options.selection || null;
  const selectedPlan = selection?.selectedPlan || existing?.selectedPlan || 'trial';
  const billingCycle = selection?.billingCycle || existing?.billingCycle || 'trial';
  const existingPaid = isPaidProfile(existing || {});
  const nextTrialStatus = existingPaid
    ? existing?.trial_status || 'paid'
    : isTrialSelection({ selectedPlan, billingCycle })
      ? existing?.trial_status || 'active'
      : 'payment_pending';

  const payload: Record<string, string | null> = {
    auth_status: authStatus,
  };

  if (!existing || selection) {
    payload.selectedPlan = selectedPlan;
    payload.billingCycle = billingCycle;
    payload.paymentLink = selection?.paymentLink || existing?.paymentLink || '';
    payload.trial_status = nextTrialStatus;
  }

  if (!existing && initialCreatedAt) {
    payload.created_at = initialCreatedAt;
  }

  const result = existing
    ? await writeProfile('update', username, payload)
    : await writeProfile('insert', username, payload);

  if (result.error) throw result.error;

  const updated = await fetchGymAssistProfile(username);
  if (updated.error) throw updated.error;

  return updated.data || ({
    username,
    ...payload,
  } as GymAssistProfile);
}

export async function getOwnerTrialAccess(username: string) {
  const { data, error } = await fetchGymAssistProfile(username);
  if (error) throw error;
  return evaluateTrialAccess(data);
}

export function trialPaymentRequiredResponse(access: TrialAccess) {
  return NextResponse.json(
    {
      billingCycle: access.billingCycle,
      daysRemaining: access.daysRemaining,
      error: 'Your 15-day free trial has ended. Please choose a paid plan to continue using GymAssist AI.',
      paymentLink: access.paymentLink || null,
      requiresPayment: true,
      selectedPlan: access.selectedPlan,
      trialEndsAt: access.trialEndsAt,
      trialExpired: true,
    },
    { status: PAYMENT_REQUIRED_STATUS },
  );
}
