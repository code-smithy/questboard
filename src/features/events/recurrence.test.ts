import { describe, expect, it } from 'vitest';
import { buildRecurrenceRule, formatRecurrenceRule, parseRecurrenceRule } from './recurrence';

const t = (key: string, values?: Record<string, string | number>) => {
  const labels: Record<string, string> = {
    'recurrence.none': 'Does not repeat',
    'recurrence.summary.weekly': 'Every {interval} week(s) on {days}',
    'recurrence.summary.monthlyDate': 'Every {interval} month(s) on day {day}',
    'recurrence.summary.monthlyWeekday': 'Every {interval} month(s) on the {ordinal} {weekday}',
    'weekday.MO': 'Monday',
    'weekday.WE': 'Wednesday',
    'weekday.FR': 'Friday',
    'ordinal.2': 'second',
  };

  return Object.entries(values ?? {}).reduce(
    (message, [name, value]) => message.split(`{${name}}`).join(String(value)),
    labels[key] ?? key,
  );
};

describe('recurrence', () => {
  it('builds weekly recurrence rules with multiple weekdays', () => {
    expect(buildRecurrenceRule({
      frequency: 'weekly',
      interval: 2,
      weekdays: ['MO', 'WE'],
      monthDay: 1,
      ordinal: '1',
      weekday: 'MO',
      endMode: 'rolling',
      until: '',
      count: 12,
    })).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE');
  });

  it('builds monthly recurrence rules by date and ordinal weekday', () => {
    expect(buildRecurrenceRule({
      frequency: 'monthly-date',
      interval: 3,
      weekdays: [],
      monthDay: 15,
      ordinal: '1',
      weekday: 'MO',
      endMode: 'rolling',
      until: '',
      count: 12,
    })).toBe('FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=15');

    expect(buildRecurrenceRule({
      frequency: 'monthly-weekday',
      interval: 1,
      weekdays: [],
      monthDay: 1,
      ordinal: '2',
      weekday: 'FR',
      endMode: 'rolling',
      until: '',
      count: 12,
    })).toBe('FREQ=MONTHLY;INTERVAL=1;BYDAY=2FR');
  });

  it('builds recurrence rules with count and until limits', () => {
    const until = '2026-12-31T20:30';
    const expectedUntil = new Date(until).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

    expect(buildRecurrenceRule({
      frequency: 'weekly',
      interval: 1,
      weekdays: ['MO'],
      monthDay: 1,
      ordinal: '1',
      weekday: 'MO',
      endMode: 'after-count',
      until: '',
      count: 4,
    })).toBe('FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;COUNT=4');

    expect(buildRecurrenceRule({
      frequency: 'monthly-date',
      interval: 1,
      weekdays: [],
      monthDay: 10,
      ordinal: '1',
      weekday: 'MO',
      endMode: 'on-date',
      until,
      count: 12,
    })).toBe(`FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=10;UNTIL=${expectedUntil}`);

    expect(parseRecurrenceRule(`FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=10;UNTIL=${expectedUntil}`)).toMatchObject({
      endMode: 'on-date',
      until,
    });
  });

  it('parses and formats recurrence summaries', () => {
    expect(parseRecurrenceRule('FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE')).toMatchObject({
      frequency: 'weekly',
      weekdays: ['MO', 'WE'],
    });
    expect(formatRecurrenceRule(t, 'FREQ=MONTHLY;INTERVAL=1;BYDAY=2FR')).toBe('Every 1 month(s) on the second Friday');
  });
});
