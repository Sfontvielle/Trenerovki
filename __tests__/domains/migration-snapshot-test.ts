import { newestFirst } from '@/features/profile/migration-snapshot';

describe('migration snapshots', () => {
  it('orders copies by time, so version 10 does not sort before version 9', () => {
    const files = [
      { name: 'before-update-v9-1000.json' },
      { name: 'before-update-v10-2000.json' },
      { name: 'before-update-v3-500.json' },
    ];

    expect(newestFirst(files).map(({ name }) => name)).toEqual([
      'before-update-v10-2000.json',
      'before-update-v9-1000.json',
      'before-update-v3-500.json',
    ]);
  });
});
