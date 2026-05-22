import { NextResponse } from 'next/server';
import { assertRateLimit } from '@/lib/auth/rateLimit';
import { isBcryptHash, isMissingColumnError } from '@/lib/auth/database';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import {
  evaluateTrialAccess,
  hasPlanSelection,
  normalizePlanSelection,
  syncGymAssistProfile,
  trialPaymentRequiredResponse,
} from '@/lib/auth/trial';
import { validateLoginInput } from '@/lib/auth/validation';
import { clearSessionCookie, createAppSessionToken, createSessionCookie } from '@/lib/appSession';
import { resolveGymMemberTable } from '@/lib/gymMemberTables';
import { supabase, supabaseAuth } from '@/lib/supabase';

const GENERIC_AUTH_ERROR = 'Invalid email or password';

type UserFetchResult = {
  data: unknown;
  error: any;
  supportsHashedPasswordColumn: boolean;
  supportsPasswordColumn: boolean;
};

type UserRecord = {
  created_at?: string | null;
  email: string;
  hashed_password?: string | null;
  password?: string | null;
  upi_id?: string | null;
  username: string;
};

function isRecoverableUserColumnError(error: any) {
  return (
    isMissingColumnError(error, 'hashed_password') ||
    isMissingColumnError(error, 'password') ||
    isMissingColumnError(error, 'upi_id')
  );
}

async function fetchUserByEmail(email: string) {
  if (!supabase) throw new Error('Authentication is not configured');

  const selectAttempts = [
    { columns: 'username,email,hashed_password,upi_id,created_at', supportsHashedPasswordColumn: true, supportsPasswordColumn: false },
    { columns: 'username,email,hashed_password,upi_id', supportsHashedPasswordColumn: true, supportsPasswordColumn: false },
    { columns: 'username,email,hashed_password,password,upi_id', supportsHashedPasswordColumn: true, supportsPasswordColumn: true },
    { columns: 'username,email,password,upi_id', supportsHashedPasswordColumn: false, supportsPasswordColumn: true },
    { columns: 'username,email,hashed_password', supportsHashedPasswordColumn: true, supportsPasswordColumn: false },
    { columns: 'username,email,hashed_password,password', supportsHashedPasswordColumn: true, supportsPasswordColumn: true },
    { columns: 'username,email,password', supportsHashedPasswordColumn: false, supportsPasswordColumn: true },
    { columns: 'username,email', supportsHashedPasswordColumn: false, supportsPasswordColumn: false },
  ];

  let lastResult: UserFetchResult | null = null;

  for (const attempt of selectAttempts) {
    const result = await supabase
      .from('users')
      .select(attempt.columns)
      .eq('email', email)
      .maybeSingle();

    const normalizedResult = {
      ...result,
      supportsHashedPasswordColumn: attempt.supportsHashedPasswordColumn,
      supportsPasswordColumn: attempt.supportsPasswordColumn,
    };

    if (!result.error || !isRecoverableUserColumnError(result.error)) {
      return normalizedResult;
    }

    lastResult = normalizedResult;
  }

  return lastResult || {
    data: null,
    error: null,
    supportsHashedPasswordColumn: false,
    supportsPasswordColumn: false,
  };
}

async function updateUserPassword(email: string, values: Record<string, string | null>) {
  if (!supabase) return;

  const withTimestamp = await supabase
    .from('users')
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq('email', email);

  if (!isMissingColumnError(withTimestamp.error, 'updated_at')) return;

  await supabase.from('users').update(values).eq('email', email);
}

async function savePasswordHash(
  email: string,
  username: string,
  hashedPassword: string,
  supportsHashedPasswordColumn: boolean,
  supportsPasswordColumn: boolean,
) {
  if (!supabase) return;

  if (supportsHashedPasswordColumn) {
    await updateUserPassword(email, {
      hashed_password: hashedPassword,
      ...(supportsPasswordColumn ? { password: null } : {}),
    });
  } else if (supportsPasswordColumn) {
    await updateUserPassword(email, {
      password: hashedPassword,
    });
  }
}

async function passwordMatchesRecord(
  password: string,
  userRecord: UserRecord,
  supportsHashedPasswordColumn: boolean,
  supportsPasswordColumn: boolean,
) {
  if (userRecord.hashed_password) {
    return verifyPassword(password, userRecord.hashed_password);
  }

  if (isBcryptHash(userRecord.password)) {
    return verifyPassword(password, userRecord.password || '');
  }

  if (!userRecord.password) return false;

  const matches = userRecord.password === password;
  if (matches) {
    const migratedHash = await hashPassword(password);
    await savePasswordHash(
      userRecord.email,
      userRecord.username,
      migratedHash,
      supportsHashedPasswordColumn,
      supportsPasswordColumn,
    );
  }

  return matches;
}

async function signInWithSupabaseAuth(email: string, password: string, selection: ReturnType<typeof normalizePlanSelection> | null) {
  if (!supabaseAuth) return null;

  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;

  const userId = data.user.email || data.user.id;
  if (!userId) return null;

  const profile = await syncGymAssistProfile({
    authStatus: 'logged_in',
    initialCreatedAt: data.user.created_at || null,
    selection,
    username: userId,
  });
  await resolveGymMemberTable(userId);
  const access = evaluateTrialAccess(profile);
  if (access.requiresPayment) {
    return {
      access,
      authMode: 'supabase' as const,
      requiresPayment: true,
      upiId: null,
      userId,
    };
  }

  return {
    access,
    authMode: 'supabase' as const,
    requiresPayment: false,
    upiId: null,
    userId,
  };
}

function buildLoginResponse(userId: string, upiId: string | null, authMode: 'password' | 'supabase') {
  const token = createAppSessionToken(userId, authMode);
  if (!token) {
    return NextResponse.json({ error: 'Authentication session is not configured' }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      userId,
      upiId,
    },
    {
      headers: {
        'Set-Cookie': createSessionCookie(token),
      },
    },
  );
}

export async function POST(request: Request) {
  try {
    assertRateLimit(request, 'login');

    if (!supabase) {
      return NextResponse.json({ error: 'Authentication is not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { email, password } = validateLoginInput(body);
    const planSelection = hasPlanSelection(body) ? normalizePlanSelection(body) : null;
    const { data: user, error, supportsHashedPasswordColumn, supportsPasswordColumn } = await fetchUserByEmail(email);

    if (!error && user) {
      const userRecord = user as UserRecord;
      if (await passwordMatchesRecord(password, userRecord, supportsHashedPasswordColumn, supportsPasswordColumn)) {
        const profile = await syncGymAssistProfile({
          authStatus: 'logged_in',
          initialCreatedAt: userRecord.created_at || null,
          selection: planSelection,
          username: userRecord.username,
        });
        await resolveGymMemberTable(userRecord.username);
        const access = evaluateTrialAccess(profile);
        if (access.requiresPayment) {
          return trialPaymentRequiredResponse(access);
        }

        return buildLoginResponse(userRecord.username, userRecord.upi_id || null, 'password');
      }
    }

    const supabaseAuthUser = await signInWithSupabaseAuth(email, password, planSelection);
    if (supabaseAuthUser) {
      if (supabaseAuthUser.requiresPayment) {
        return trialPaymentRequiredResponse(supabaseAuthUser.access);
      }

      return buildLoginResponse(supabaseAuthUser.userId, supabaseAuthUser.upiId, supabaseAuthUser.authMode);
    }

    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
  } catch (err: any) {
    const message = err.message || GENERIC_AUTH_ERROR;
    const status = message.startsWith('Too many') ? 429 : 400;

    return NextResponse.json(
      { error: status === 400 ? GENERIC_AUTH_ERROR : message },
      {
        status,
        headers: {
          'Set-Cookie': clearSessionCookie(),
        },
      },
    );
  }
}
