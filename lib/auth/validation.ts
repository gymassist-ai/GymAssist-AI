export type AuthInput = {
  email: string;
  password: string;
  referral?: string | null;
  username?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,40}$/;

export function normalizeEmail(email: unknown) {
  return String(email || '').trim().toLowerCase();
}

export function normalizeUsername(username: unknown) {
  return String(username || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

export function normalizeReferral(referral: unknown) {
  const value = typeof referral === 'string' ? referral : String(referral || '');
  return value.trim() || null;
}

export function validateLoginInput(body: any): AuthInput {
  const email = normalizeEmail(body?.email);
  const password = String(body?.password || '');

  if (!EMAIL_PATTERN.test(email) || !password) {
    throw new Error('Invalid email or password');
  }

  return { email, password };
}

export function validateSignupInput(body: any): Required<AuthInput> {
  const email = normalizeEmail(body?.email);
  const password = String(body?.password || '');
  const referral = normalizeReferral(body?.referral ?? body?.referal);
  const username = normalizeUsername(body?.username);

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('Enter a valid email address');
  }

  if (!USERNAME_PATTERN.test(username)) {
    throw new Error('Username must be 3-40 characters and use only letters, numbers, hyphens, or underscores');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  return { email, password, referral, username };
}
