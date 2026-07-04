import type { TranslationKey } from '../i18n/LanguageContext';

export const recurrenceWeekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type RecurrenceWeekday = (typeof recurrenceWeekdays)[number];
export type RecurrenceFrequency = 'none' | 'weekly' | 'monthly-date' | 'monthly-weekday';
export type RecurrenceOrdinal = '1' | '2' | '3' | '4' | '-1';
export type RecurrenceEndMode = 'rolling' | 'on-date' | 'after-count';

export type RecurrenceFormState = {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays: RecurrenceWeekday[];
  monthDay: number;
  ordinal: RecurrenceOrdinal;
  weekday: RecurrenceWeekday;
  endMode: RecurrenceEndMode;
  until: string;
  count: number;
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
  endMode: 'rolling',
  until: '',
  count: 12,
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

function formatUntilDate(until: string | undefined) {
  return until && /^\d{8}T\d{6}Z$/.test(until) ? `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}` : '';
}

function getEndState(parts: Record<string, string>): Pick<RecurrenceFormState, 'endMode' | 'until' | 'count'> {
  const count = positiveInteger(parts.COUNT, defaultRecurrence.count);
  const until = formatUntilDate(parts.UNTIL);

  if (parts.COUNT) return { endMode: 'after-count', until: '', count };
  if (until) return { endMode: 'on-date', until, count: defaultRecurrence.count };
  return { endMode: 'rolling', until: '', count: defaultRecurrence.count };
}

export function parseRecurrenceRule(rule: string | null | undefined): RecurrenceFormState {
  if (!rule) return defaultRecurrence;

  const parts = parseParts(rule);
  const interval = positiveInteger(parts.INTERVAL);
  const endState = getEndState(parts);

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
      ...endState,
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
        ...endState,
      };
    }

    if (monthDay >= 1 && monthDay <= 31) {
      return {
        ...defaultRecurrence,
        frequency: 'monthly-date',
        interval,
        monthDay,
        ...endState,
      };
    }
  }

  return defaultRecurrence;
}

export function buildRecurrenceRule(state: RecurrenceFormState): string | null {
  const interval = Math.max(1, Math.floor(state.interval));
  const endParts: string[] = [];

  if (state.endMode === 'after-count') {
    endParts.push(`COUNT=${Math.max(1, Math.floor(state.count))}`);
  } else if (state.endMode === 'on-date' && state.until) {
    endParts.push(`UNTIL=${state.until.replace(/-/g, '')}T235959Z`);
  }

  if (state.frequency === 'weekly') {
    const weekdays = state.weekdays.filter(validWeekday);
    if (!weekdays.length) return null;
    return ['FREQ=WEEKLY', `INTERVAL=${interval}`, `BYDAY=${weekdays.join(',')}`, ...endParts].join(';');
  }

  if (state.frequency === 'monthly-date') {
    const monthDay = Math.min(Math.max(1, Math.floor(state.monthDay)), 31);
    return ['FREQ=MONTHLY', `INTERVAL=${interval}`, `BYMONTHDAY=${monthDay}`, ...endParts].join(';');
  }

  if (state.frequency === 'monthly-weekday') {
    return ['FREQ=MONTHLY', `INTERVAL=${interval}`, `BYDAY=${state.ordinal}${state.weekday}`, ...endParts].join(';');
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

function copyTime(target: Date, source: Date) {
  target.setHours(source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds());
  return target;
}

function addMonths(value: Date, months: number) {
  const next = new Date(value);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getWeekStart(value: Date) {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function getMonthCandidate(start: Date, monthOffset: number, dayOfMonth: number) {
  const candidate = new Date(start);
  candidate.setDate(1);
  candidate.setMonth(start.getMonth() + monthOffset);
  const month = candidate.getMonth();
  candidate.setDate(dayOfMonth);
  if (candidate.getMonth() !== month) return null;
  return copyTime(candidate, start);
}

function getOrdinalWeekdayDate(start: Date, monthOffset: number, ordinal: RecurrenceOrdinal, weekday: RecurrenceWeekday) {
  const targetWeekdayIndex = recurrenceWeekdays.indexOf(weekday);
  const firstOfMonth = new Date(start);
  firstOfMonth.setDate(1);
  firstOfMonth.setMonth(start.getMonth() + monthOffset);

  if (ordinal === '-1') {
    const lastOfMonth = new Date(firstOfMonth);
    lastOfMonth.setMonth(lastOfMonth.getMonth() + 1);
    lastOfMonth.setDate(0);
    const distance = ((lastOfMonth.getDay() + 6) % 7) - targetWeekdayIndex;
    lastOfMonth.setDate(lastOfMonth.getDate() - (distance >= 0 ? distance : distance + 7));
    return copyTime(lastOfMonth, start);
  }

  const firstWeekdayIndex = (firstOfMonth.getDay() + 6) % 7;
  const distance = targetWeekdayIndex - firstWeekdayIndex;
  firstOfMonth.setDate(1 + (distance >= 0 ? distance : distance + 7) + (Number(ordinal) - 1) * 7);
  return firstOfMonth.getMonth() === new Date(start.getFullYear(), start.getMonth() + monthOffset, 1).getMonth()
    ? copyTime(firstOfMonth, start)
    : null;
}

function getGenerationEnd(start: Date, state: RecurrenceFormState) {
  if (state.endMode === 'on-date' && state.until) return new Date(`${state.until}T23:59:59.999`);
  if (state.endMode === 'after-count') return addMonths(start, 1200);
  return addMonths(start, 12);
}

export function getRecurrenceOccurrenceStarts(rule: string | null, startAt: string, maxOccurrences = 100) {
  const state = parseRecurrenceRule(rule);
  if (state.frequency === 'none') return [new Date(startAt)];

  const start = new Date(startAt);
  const starts = [start];
  const targetCount = state.endMode === 'after-count' ? Math.min(Math.max(1, state.count), maxOccurrences) : maxOccurrences;
  const generationEnd = getGenerationEnd(start, state);

  if (state.frequency === 'weekly') {
    const startWeek = getWeekStart(start);
    const cursor = new Date(start);
    cursor.setDate(cursor.getDate() + 1);

    while (starts.length < targetCount && cursor <= generationEnd) {
      const weekOffset = Math.floor((getWeekStart(cursor).getTime() - startWeek.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const weekday = getWeekdayCode(cursor);
      if (weekOffset % state.interval === 0 && state.weekdays.includes(weekday)) {
        starts.push(copyTime(new Date(cursor), start));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (state.frequency === 'monthly-date') {
    for (let monthOffset = state.interval; starts.length < targetCount; monthOffset += state.interval) {
      const candidate = getMonthCandidate(start, monthOffset, state.monthDay);
      if (candidate && candidate > generationEnd) break;
      if (candidate) starts.push(candidate);
    }
  } else if (state.frequency === 'monthly-weekday') {
    for (let monthOffset = state.interval; starts.length < targetCount; monthOffset += state.interval) {
      const candidate = getOrdinalWeekdayDate(start, monthOffset, state.ordinal, state.weekday);
      if (candidate && candidate > generationEnd) break;
      if (candidate) starts.push(candidate);
    }
  }

  return starts;
}
