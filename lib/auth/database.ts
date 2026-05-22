export function isMissingColumnError(error: any, columnName: string) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');
  const normalizedColumn = columnName.toLowerCase();

  return (
    (code === 'PGRST204' || code === '42703') &&
    message.includes(normalizedColumn) &&
    (message.includes('schema cache') || message.includes('column') || message.includes('does not exist'))
  );
}

export function isPermissionError(error: any) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');

  return code === '42501' || message.includes('permission denied');
}

export function isUniqueConstraintError(error: any) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');

  return code === '23505' || message.includes('duplicate key');
}

export function isBcryptHash(value: unknown) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

export function getAuthSetupError(error: any, fallback = 'Unable to create account') {
  if (!error) return fallback;

  if (isPermissionError(error)) {
    return 'Supabase service role permissions are not configured. Add SUPABASE_SERVICE_ROLE_KEY and restart the app.';
  }

  if (String(error?.code || '') === 'PGRST204' || String(error?.code || '') === '42703') {
    return 'Database auth schema is not up to date. Run the SQL in supabase/auth_security.sql, then retry.';
  }

  return fallback;
}
