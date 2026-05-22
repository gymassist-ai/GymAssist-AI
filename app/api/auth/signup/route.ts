import { NextResponse } from 'next/server';
import { assertRateLimit } from '@/lib/auth/rateLimit';
import { getAuthSetupError, isMissingColumnError, isUniqueConstraintError } from '@/lib/auth/database';
import { hashPassword } from '@/lib/auth/password';
import { normalizePlanSelection, syncGymAssistProfile } from '@/lib/auth/trial';
import { validateSignupInput } from '@/lib/auth/validation';
import { createAppSessionToken, createSessionCookie } from '@/lib/appSession';
import { resolveGymMemberTable, resolveGymPaymentTable } from '@/lib/gymMemberTables';
import { supabase } from '@/lib/supabase';

function isRecoverableUserShapeError(error: any) {
  return (
    isMissingColumnError(error, 'hashed_password') ||
    isMissingColumnError(error, 'password') ||
    isMissingColumnError(error, 'created_at') ||
    isMissingColumnError(error, 'updated_at') ||
    isMissingColumnError(error, 'upi_id')
  );
}

async function insertUserAccount(username: string, email: string, hashedPassword: string) {
  if (!supabase) throw new Error('Authentication is not configured');

  const now = new Date().toISOString();
  const insertPayloads: Record<string, string>[] = [
    {
      username,
      email,
      hashed_password: hashedPassword,
    },
    {
      username,
      email,
      hashed_password: hashedPassword,
      created_at: now,
    },
    {
      username,
      email,
      hashed_password: hashedPassword,
    },
    {
      username,
      email,
      password: hashedPassword,
    },
  ];

  let lastResult: any = null;

  for (const payload of insertPayloads) {
    const selectAttempts = ['username,email,upi_id', 'username,email'];

    for (const selectColumns of selectAttempts) {
      const insertResult = await supabase
        .from('users')
        .insert([payload])
        .select(selectColumns)
        .single();

      if (!insertResult.error || !isRecoverableUserShapeError(insertResult.error)) {
        return insertResult;
      }

      lastResult = insertResult;

      if (!isMissingColumnError(insertResult.error, 'upi_id')) {
        break;
      }
    }
  }

  return lastResult;
}

export async function POST(request: Request) {
  let createdEmail: string | null = null;
  let createdUsername: string | null = null;
  let createdGymAssistProfile = false;

  try {
    assertRateLimit(request, 'signup');

    if (!supabase) {
      return NextResponse.json({ error: 'Authentication is not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { email, password, username } = validateSignupInput(body);
    const planSelection = normalizePlanSelection(body);
    const { data: existingEmail, error: lookupError } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: getAuthSetupError(lookupError) }, { status: 500 });
    }

    if (existingEmail) {
      return NextResponse.json({ error: 'Account already exists' }, { status: 409 });
    }

    const { data: existingUsername, error: usernameLookupError } = await supabase
      .from('users')
      .select('username')
      .eq('username', username)
      .maybeSingle();

    if (usernameLookupError) {
      return NextResponse.json({ error: getAuthSetupError(usernameLookupError) }, { status: 500 });
    }

    if (existingUsername) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }

    const hashedPassword = await hashPassword(password);
    const { data: user, error: insertError } = await insertUserAccount(username, email, hashedPassword);

    if (insertError || !user) {
      const status = isUniqueConstraintError(insertError) ? 409 : 500;
      const error = status === 409 ? 'Account already exists' : getAuthSetupError(insertError);
      return NextResponse.json({ error }, { status });
    }

    createdEmail = email;
    createdUsername = username;
    const profile = await syncGymAssistProfile({
      authStatus: 'signed_up',
      initialCreatedAt: new Date().toISOString(),
      selection: planSelection,
      username,
    });
    createdGymAssistProfile = Boolean(profile);
    await resolveGymMemberTable(username);
    await resolveGymPaymentTable(username);

    const token = createAppSessionToken(username, 'password');
    if (!token) {
      throw new Error('Authentication session is not configured. Add JWT_SECRET to .env.local and Vercel.');
    }

    return NextResponse.json(
      {
        success: true,
        userId: user.username,
        upiId: user.upi_id || null,
      },
      {
        headers: {
          'Set-Cookie': createSessionCookie(token),
        },
      },
    );
  } catch (err: any) {
    if (createdEmail && supabase) {
      await supabase.from('users').delete().eq('email', createdEmail);
    }
    if (createdUsername && createdGymAssistProfile && supabase) {
      await supabase.from('gymassistai_users').delete().eq('username', createdUsername);
    }

    const message = err.message || 'Unable to create account';
    const status = message.startsWith('Too many') ? 429 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
