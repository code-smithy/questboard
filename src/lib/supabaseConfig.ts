export type SupabaseConfig = {
  isConfigured: boolean;
  url: string;
  anonKey: string;
};

const fallbackSupabaseUrl = 'http://localhost:54321';
const fallbackSupabaseAnonKey = 'missing-anon-key';

function isValidHttpUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getSupabaseConfig(rawUrl: string | undefined, rawAnonKey: string | undefined): SupabaseConfig {
  const trimmedUrl = rawUrl?.trim();
  const trimmedAnonKey = rawAnonKey?.trim();
  const isConfigured = Boolean(isValidHttpUrl(trimmedUrl) && trimmedAnonKey);

  return {
    isConfigured,
    url: isConfigured ? trimmedUrl! : fallbackSupabaseUrl,
    anonKey: isConfigured ? trimmedAnonKey! : fallbackSupabaseAnonKey,
  };
}
