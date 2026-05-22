import { getCloudflareContext } from '@opennextjs/cloudflare';

type RuntimeEnvMap = Record<string, unknown>;

function readCloudflareEnv(key: string) {
  try {
    const env = getCloudflareContext().env as RuntimeEnvMap;
    const value = env?.[key];
    return typeof value === 'string' ? value : undefined;
  } catch {
    return undefined;
  }
}

export function getRuntimeEnv(key: string) {
  return process.env[key] || readCloudflareEnv(key) || '';
}

export function firstRuntimeEnv(keys: string[]) {
  for (const key of keys) {
    const value = getRuntimeEnv(key);
    if (value) return value;
  }
  return '';
}
