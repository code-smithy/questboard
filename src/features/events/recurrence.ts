import type { TranslationKey } from '../i18n/LanguageContext';

export const recurrenceWeekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type RecurrenceWeekday = (typeof recurrenceWeekdays)[number];
export type RecurrenceFrequency = 'none' | 'weekly' | 'monthly-date' | 'monthly-weekday';
export type RecurrenceOrdinal = '1' | '2' | '3' | '4' | '-1';

export type RecurrenceFormState = {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays: RecurrenceWeekday[];
  monthDay: number;
  ordinal: RecurrenceOrdinal;
  weekday: RecurrenceWeekday;
};

type RecurrenceTranslator = (key: TranslationKey, values?: Record<string, string | number>) => string;

const weekdaySet = new Set<string>(recurrenceWeekdays);

export const recurrenceOrdinalOptions: RecurrenceOrdinal[] = ['1', '2', '3', '4', '-1'];

export const defaultRecurrence: RecurrenceFormState = {
  frequency: 'none',
  interval: 1,
  weekdays: [],
  monthDay: 1,
  ordinal: '1',
  weekday: 'MO',
};

export function getWeekdayCode(value: string | Date): RecurrenceWeekday {
  const date = typeof value === 'string' ? new Date(value) : value;
  return recurrenceWeekdays[(date.getDay() + 6) % 7];
}

export function getMonthDay(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.getDate();
}

export function getOrdinalWeekday(value: string | Date): Pick<RecurrenceFormState, 'ordinal' | 'weekday'> {
  const date = typeof value === 'string' ? new Date(value) : value;
  const weekday = getWeekdayCode(date);
  const dayOfMonth = date.getDate();
  const nextWeek = new Date(date);
  nextWeek.setDate(dayOfMonth + 7);

  return {
    ordinal: nextWeek.getMonth() !== date.getMonth() ? '-1' : (String(Math.ceil(dayOfMonth / 7)) as RecurrenceOrdinal),
    weekday,
  };
}

function positiveInteger(value: string | undefined, fallback = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function validWeekday(value: string | undefined): value is RecurrenceWeekday {
  return Boolean(value && weekdaySet.has(value));
}

function parseParts(rule: string) {
  return rule.split(';').reduce<Record<string, string>>((parts, segment) => {
    const [key, value] = segment.split('=');
    if (key && value) parts[key.toUpperCase()] = value.toUpperCase();
    return parts;
  }, {});
}

export function parseRecurrenceRule(rule: string | null | undefined): RecurrenceFormState {
  if (!rule) return defaultRecurrence;

  const parts = parseParts(rule);
  const interval = positiveInteger(parts.INTERVAL);

  if (parts.FREQ === 'WEEKLY') {
    const weekdays = (parts.BYDAY ?? '')
      .split(',')
      .filter(validWeekday);

    return {
      ...defaultRecurrence,
      frequency: 'weekly',
      interval,
      weekdays,
      weekday: weekdays[0] ?? defaultRecurrence.weekday,
    };
  }

  if (parts.FREQ === 'MONTHLY') {
    const monthDay = positiveInteger(parts.BYMONTHDAY);
    const byDay = parts.BYDAY ?? '';
    const weekday = byDay.slice(-2);
    const ordinal = byDay.slice(0, -2);

    if (validWeekday(weekday) && recurrenceOrdinalOptions.includes(ordinal as RecurrenceOrdinal)) {
      return {
        ...defaultRecurrence,
        frequency: 'monthly-weekday',
        interval,
        ordinal: ordinal as RecurrenceOrdinal,
        weekday,
      };
    }

    if (monthDay >= 1 && monthDay <= 31) {
      return {
        ...defaultRecurrence,
        frequency: 'monthly-date',
        interval,
        monthDay,
      };
    }
  }

  return defaultRecurrence;
}

export function buildRecurrenceRule(state: RecurrenceFormState): string | null {
  const interval = Math.max(1, Math.floor(state.interval));

  if (state.frequency === 'weekly') {
    const weekdays = state.weekdays.filter(validWeekday);
    if (!weekdays.length) return null;
    return `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${weekdays.join(',')}`;
  }

  if (state.frequency === 'monthly-date') {
    const monthDay = Math.min(Math.max(1, Math.floor(state.monthDay)), 31);
    return `FREQ=MONTHLY;INTERVAL=${interval};BYMONTHDAY=${monthDay}`;
  }

  if (state.frequency === 'monthly-weekday') {
    return `FREQ=MONTHLY;INTERVAL=${interval};BYDAY=${state.ordinal}${state.weekday}`;
  }

  return null;
}

export function formatRecurrenceRule(t: RecurrenceTranslator, rule: string | null | undefined) {
  const state = parseRecurrenceRule(rule);
  const interval = state.interval;

  if (state.frequency === 'weekly') {
    const days = state.weekdays.map((weekday) => t(`weekday.${weekday}`)).join(', ');
    return t('recurrence.summary.weekly', { interval, days });
  }

  if (state.frequency === 'monthly-date') {
    return t('recurrence.summary.monthlyDate', { interval, day: state.monthDay });
  }

  if (state.frequency === 'monthly-weekday') {
    return t('recurrence.summary.monthlyWeekday', {
      interval,
      ordinal: t(`ordinal.${state.ordinal}`),
      weekday: t(`weekday.${state.weekday}`),
    });
  }

  return t('recurrence.none');
}
