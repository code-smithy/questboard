export type SupabaseConfig = {
  isConfigured: boolean;
  url: string;
  anonKey: string;
};

const fallbackSupabaseUrl = 'http://localhost:54321';
const fallbackSupabaseAnonKey = 'missing-anon-key';

function normalizeSupabaseUrl(value: string | undefined) {
  if (!value) return undefined;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;

    url.pathname = url.pathname.replace(/\/rest\/v1\/?$/, '');
    return url.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

export function getSupabaseConfig(rawUrl: string | undefined, rawAnonKey: string | undefined): SupabaseConfig {
  const normalizedUrl = normalizeSupabaseUrl(rawUrl);
  const trimmedAnonKey = rawAnonKey?.trim();
  const isConfigured = Boolean(normalizedUrl && trimmedAnonKey);

  return {
    isConfigured,
    url: isConfigured ? normalizedUrl! : fallbackSupabaseUrl,
    anonKey: isConfigured ? trimmedAnonKey! : fallbackSupabaseAnonKey,
  };
}
