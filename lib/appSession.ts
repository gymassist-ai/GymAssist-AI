import { createHmac, timingSafeEqual } from 'crypto';

type AppSessionPayload = {
  exp: number;
  mode: 'password' | 'legacy' | 'supabase';
  sub: string;
};

export const SESSION_COOKIE_NAME = 'gym_assist_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getSessionSecret() {
  const configuredSecret =
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.AUTH_SESSION_SECRET ||
    '';

  if (configuredSecret) return configuredSecret;

  if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_LOCAL_AUTH_FALLBACK === 'true') {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || 'gymassist-local-dev-session-secret';
  }

  return '';
}

function signPayload(payload: string) {
  const secret = getSessionSecret();
  if (!secret) return null;
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createAppSessionToken(sub: string, mode: AppSessionPayload['mode'] = 'legacy') {
  const payload = base64UrlEncode(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    mode,
    sub,
  } satisfies AppSessionPayload));
  const signature = signPayload(payload);
  if (!signature) return null;
  return `ga.${payload}.${signature}`;
}

export function verifyAppSessionToken(token: string) {
  const [, payload, signature] = token.split('.');
  if (!token.startsWith('ga.') || !payload || !signature) return null;

  const expectedSignature = signPayload(payload);
  if (!expectedSignature) return null;

  const incoming = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (incoming.length !== expected.length || !timingSafeEqual(incoming, expected)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as AppSessionPayload;
    if (!parsed.sub || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function createSessionCookie(token: string) {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax;${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax;${secure}`;
}

export function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
