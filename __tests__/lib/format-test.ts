import { WorkoutError } from '@/domains/workout/types';
import { describeFailure } from '@/lib/describe-failure';
import {
  formatDate,
  formatInputNumber,
  formatRepRange,
  formatWeight,
  normalizeSearch,
  parseDecimal,
  pluralize,
} from '@/lib/format';

describe('parseDecimal', () => {
  it.each([
    ['62,5', 62.5],
    ['62.5', 62.5],
    [' 80 ', 80],
    ['0', 0],
    ['', null],
    ['   ', null],
  ])('reads %j as %j', (text, expected) => {
    expect(parseDecimal(text)).toBe(expected);
  });

  it.each(['1,5,5', 'abc', '1e3', '0x10', '-5', '1 000'])('rejects %j', (text) => {
    expect(parseDecimal(text)).toBeNaN();
  });
});

describe('formatInputNumber', () => {
  it.each([0, 2.5, 61.25, 61.125, 999.75, 1000])('keeps %d through a form round trip', (value) => {
    expect(parseDecimal(formatInputNumber(value))).toBe(value);
  });

  it('leaves missing values empty', () => {
    expect(formatInputNumber(null)).toBe('');
    expect(formatInputNumber(undefined)).toBe('');
  });
});

describe('pluralize', () => {
  const forms: [string, string, string] = ['подход', 'подхода', 'подходов'];

  it.each([
    [0, 'подходов'],
    [1, 'подход'],
    [2, 'подхода'],
    [4, 'подхода'],
    [5, 'подходов'],
    [11, 'подходов'],
    [12, 'подходов'],
    [14, 'подходов'],
    [21, 'подход'],
    [22, 'подхода'],
    [101, 'подход'],
    [111, 'подходов'],
  ])('chooses the form for %d', (count, expected) => {
    expect(pluralize(count, forms)).toBe(expected);
  });
});

describe('labels', () => {
  it('formats weights and ranges', () => {
    expect(formatWeight(null)).toBe('Свой вес');
    expect(formatWeight(82.5)).toBe('82,5 кг');
    expect(formatRepRange(8, 12)).toBe('8–12');
    expect(formatRepRange(8, 8)).toBe('8');
    expect(formatRepRange(null, null)).toBeNull();
  });

  it('formats a date in Russian', () => {
    expect(formatDate('2026-11-15T12:00:00.000Z')).toBe('15 ноября 2026 г.');
  });

  it('treats е and ё as the same letter when searching', () => {
    expect(normalizeSearch(' Жим Лёжа ')).toBe(normalizeSearch('жим лежа'));
  });
});

describe('describeFailure', () => {
  it('explains engine errors', () => {
    expect(describeFailure(new WorkoutError('session_already_open', 'open'))).toMatch(/незавершённая/);
  });

  it('recognises a full disk', () => {
    expect(describeFailure(new Error('database or disk is full'))).toMatch(/место/);
  });

  it('falls back to a generic message', () => {
    expect(describeFailure('unknown')).toBe('Не получилось. Попробуйте ещё раз.');
  });
});
