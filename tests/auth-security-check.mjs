import assert from 'node:assert/strict';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';

const password = 'correct-horse-battery-staple';
const hash = await bcrypt.hash(password, 10);

assert.notEqual(hash, password, 'bcrypt hash must not equal plaintext password');
assert.match(hash, /^\$2[abxy]\$/, 'bcrypt hash should use the bcrypt format');
assert.equal(await bcrypt.compare(password, hash), true, 'correct password should verify');
assert.equal(await bcrypt.compare('wrong-password', hash), false, 'wrong password should be rejected');

const loginRoute = fs.readFileSync('app/api/auth/login/route.ts', 'utf8');
const signupRoute = fs.readFileSync('app/api/auth/signup/route.ts', 'utf8');
const loginUi = fs.readFileSync('components/Login.tsx', 'utf8');
const trialLogic = fs.readFileSync('lib/auth/trial.ts', 'utf8');

assert.match(
  loginRoute,
  /username,email,hashed_password,upi_id/,
  'login must support the live users schema without requiring a password column',
);
assert.doesNotMatch(
  signupRoute,
  /password:\s*null/,
  'signup must not write the removed users.password column',
);
assert.doesNotMatch(
  loginUi,
  /hashed before storage/i,
  'login UI should not expose implementation-specific password wording',
);
assert.match(trialLogic, /TRIAL_DAYS\s*=\s*15/, 'free trial must remain capped at 15 days');
assert.match(trialLogic, /created_at/, 'trial access must be anchored to gymassistai_users.created_at');
assert.match(trialLogic, /paid_until/, 'paid access should have a non-trial unlock path');

console.log('Auth schema checks passed');
