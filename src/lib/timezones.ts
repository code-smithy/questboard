const fallbackTimezones = [
  'UTC',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'America/Argentina/Buenos_Aires',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Sao_Paulo',
  'America/Toronto',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Jerusalem',
  'Asia/Kolkata',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Melbourne',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Rome',
  'Europe/Zurich',
  'Pacific/Auckland',
] as const;

type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf?: (key: 'timeZone') => string[];
};

export type TimezoneOption = {
  value: string;
  label: string;
};

export function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function isKnownTimezone(value: string | null | undefined) {
  if (!value) return false;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimezone(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  if (trimmedValue && isKnownTimezone(trimmedValue)) return trimmedValue;

  const browserTimezone = getBrowserTimezone();
  return isKnownTimezone(browserTimezone) ? browserTimezone : 'UTC';
}

function getSupportedTimezones() {
  const supportedValuesOf = (Intl as IntlWithSupportedValues).supportedValuesOf;
  const supportedTimezones = typeof supportedValuesOf === 'function'
    ? supportedValuesOf('timeZone')
    : fallbackTimezones;

  return supportedTimezones.filter(isKnownTimezone);
}

function getTimezoneOffsetLabel(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());

    return parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

function formatTimezoneLabel(timezone: string) {
  const displayName = timezone.replace(/_/g, ' ');
  const offsetLabel = getTimezoneOffsetLabel(timezone);
  return offsetLabel ? `${displayName} (${offsetLabel})` : displayName;
}

export function getTimezoneOptions(extraTimezones: Array<string | null | undefined> = []): TimezoneOption[] {
  const timezoneValues = new Set<string>(['UTC', getBrowserTimezone(), ...getSupportedTimezones()]);

  extraTimezones.forEach((timezone) => {
    const normalizedTimezone = normalizeTimezone(timezone);
    if (isKnownTimezone(normalizedTimezone)) timezoneValues.add(normalizedTimezone);
  });

  const collator = new Intl.Collator('en-US');

  return Array.from(timezoneValues)
    .sort((firstTimezone, secondTimezone) => collator.compare(firstTimezone, secondTimezone))
    .map((timezone) => ({
      value: timezone,
      label: formatTimezoneLabel(timezone),
    }));
}
