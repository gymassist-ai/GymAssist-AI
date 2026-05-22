import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { getOwnerTrialAccess, trialPaymentRequiredResponse } from '@/lib/auth/trial';
import { hasSupabaseServiceRoleKey, supabase, supabaseAuth } from '@/lib/supabase';
import { getCookieValue, SESSION_COOKIE_NAME, verifyAppSessionToken } from '@/lib/appSession';

const MEMBER_TABLE_PREFIX = 'GYM AI_';
const PAYMENT_TABLE_SUFFIX = '_payments';

export type RequestOwner = {
  authMode: 'supabase' | 'app_session';
  userId: string;
};

function buildSafeMemberTableName(owner: string) {
  const slug = owner
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const safeSlug = slug || 'owner';
  const baseName = `${MEMBER_TABLE_PREFIX}${safeSlug}`;
  if (baseName.length <= 63) return baseName;

  const hash = createHash('sha1').update(owner).digest('hex').slice(0, 8);
  return `${MEMBER_TABLE_PREFIX}${safeSlug.slice(0, 47)}_${hash}`;
}

export function normalizeGymOwnerName(owner: string) {
  const rawOwner = owner.trim() || 'owner';
  const exactName = `${MEMBER_TABLE_PREFIX}${rawOwner}`;
  return exactName.length <= 63 ? exactName : buildSafeMemberTableName(owner);
}

export function getCandidateMemberTables(owner: string) {
  const rawOwner = owner.trim() || 'owner';
  const exactName = `${MEMBER_TABLE_PREFIX}${rawOwner}`;
  const preferredName = normalizeGymOwnerName(owner);
  const safeName = buildSafeMemberTableName(owner);
  return Array.from(new Set([preferredName, exactName, safeName].filter((name) => name.length <= 63)));
}

export function normalizeGymPaymentTableName(owner: string) {
  const rawOwner = owner.trim() || 'owner';
  const exactName = `${rawOwner}${PAYMENT_TABLE_SUFFIX}`;
  if (exactName.length <= 63) return exactName;

  const safeOwner = rawOwner
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'owner';
  const hash = createHash('sha1').update(rawOwner).digest('hex').slice(0, 8);
  return `${safeOwner.slice(0, 45)}_${hash}${PAYMENT_TABLE_SUFFIX}`;
}

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

function isMissingRelationError(error: any) {
  return ['42P01', 'PGRST106', 'PGRST205', 'PGRST202'].includes(error?.code);
}

export async function resolveRequestOwner(request: Request): Promise<RequestOwner | null> {
  const bearerToken = getBearerToken(request);
  const cookieToken = getCookieValue(request.headers.get('cookie'), SESSION_COOKIE_NAME);
  const appSessionToken = bearerToken?.startsWith('ga.') ? bearerToken : cookieToken;

  if (appSessionToken?.startsWith('ga.')) {
    const payload = verifyAppSessionToken(appSessionToken);
    if (payload) {
      return {
        authMode: 'app_session',
        userId: payload.sub,
      };
    }
  }

  if (bearerToken && supabaseAuth) {
    const { data, error } = await supabaseAuth.auth.getUser(bearerToken);
    if (!error && data.user) {
      const userId = data.user.email || data.user.id;
      if (userId) {
        return {
          authMode: 'supabase',
          userId,
        };
      }
    }
  }

  return null;
}

export async function resolveActiveRequestOwner(request: Request) {
  const owner = await resolveRequestOwner(request);
  if (!owner) {
    return { error: NextResponse.json({ error: 'Unauthorized session. Please login again.' }, { status: 401 }) };
  }

  const access = await getOwnerTrialAccess(owner.userId);
  if (access.requiresPayment) {
    return { error: trialPaymentRequiredResponse(access) };
  }

  return { access, owner };
}

export async function resolveGymMemberTable(owner: string) {
  if (!supabase) throw new Error('Supabase credentials not configured');
  if (!hasSupabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required on the server for secure per-gym member tables. Add it to .env.local and Vercel environment variables, then restart the app.');
  }

  for (const tableName of getCandidateMemberTables(owner)) {
    const { error } = await supabase.from(tableName).select('*').limit(1);
    if (!error || !isMissingRelationError(error)) {
      const { data, error: ensureError } = await supabase.rpc('ensure_gymassist_member_table', {
        owner_username: owner,
      });

      if (ensureError) {
        throw new Error(
          `Could not update ${tableName}. Run supabase/gymassist_user_tables.sql once in Supabase SQL Editor, then retry. ${ensureError.message}`,
        );
      }

      return typeof data === 'string' && data ? data : tableName;
    }
  }

  const normalizedTableName = normalizeGymOwnerName(owner);
  const { data, error } = await supabase.rpc('ensure_gymassist_member_table', {
    owner_username: owner,
  });

  if (error) {
    throw new Error(
      `Could not create ${normalizedTableName}. Run supabase/gymassist_user_tables.sql once in Supabase SQL Editor, then retry. ${error.message}`,
    );
  }

  return typeof data === 'string' && data ? data : normalizedTableName;
}

export async function resolveGymPaymentTable(owner: string) {
  if (!supabase) throw new Error('Supabase credentials not configured');
  if (!hasSupabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required on the server for secure per-gym payment tables. Add it to .env.local and Vercel environment variables, then restart the app.');
  }

  const normalizedTableName = normalizeGymPaymentTableName(owner);
  const { error } = await supabase.from(normalizedTableName).select('*').limit(1);
  if (!error || !isMissingRelationError(error)) return normalizedTableName;

  const { data, error: createError } = await supabase.rpc('ensure_gymassist_payment_table', {
    owner_username: owner,
  });

  if (createError) {
    throw new Error(
      `Could not create ${normalizedTableName}. Run supabase/billing_payment_tracking.sql in Supabase SQL Editor, then retry. ${createError.message}`,
    );
  }

  return typeof data === 'string' && data ? data : normalizedTableName;
}
