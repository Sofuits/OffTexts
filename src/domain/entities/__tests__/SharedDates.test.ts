import { bothFree, sharedDateRows } from '@/domain/entities';

describe('sharedDateRows', () => {
  it('lists every date either member marked, in date order however they were tapped', () => {
    const rows = sharedDateRows(
      ['2026-10-20', '2026-10-05', '2026-10-12'],
      ['2026-10-06', '2026-10-05'],
    );

    expect(rows.map((row) => row.date)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-12',
      '2026-10-20',
    ]);
  });

  it('marks whose each date is, and which are both', () => {
    const rows = sharedDateRows(['2026-10-05', '2026-10-12'], ['2026-10-05', '2026-10-06']);

    expect(rows).toEqual([
      { date: '2026-10-05', mine: true, theirs: true, both: true },
      { date: '2026-10-06', mine: false, theirs: true, both: false },
      { date: '2026-10-12', mine: true, theirs: false, both: false },
    ]);
    expect(bothFree(rows)).toEqual(['2026-10-05']);
  });
});
