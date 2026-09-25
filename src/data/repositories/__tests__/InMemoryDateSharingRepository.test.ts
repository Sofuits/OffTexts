import { InMemoryDateSharingRepository } from '@/data/repositories';
import { unwrap } from '@/domain/repositories';

describe('InMemoryDateSharingRepository (the placeholder second member)', () => {
  const repository = new InMemoryDateSharingRepository();

  it('says it is a placeholder', async () => {
    const theirs = unwrap(await repository.theirDates(['2026-10-05']));

    expect(theirs.isPlaceholder).toBe(true);
  });

  it('overlaps with whatever was picked — no fixed dates to hit', async () => {
    // The old fake knew two days in October 2026; anything else left no
    // overlap and the flow could not continue. Any dates, any year, now.
    for (const mine of [
      ['2031-02-17'],
      ['2026-12-31', '2027-01-01'],
      ['2026-11-03', '2026-11-19', '2026-11-08', '2026-11-26'],
    ]) {
      const theirs = unwrap(await repository.theirDates(mine));
      expect(theirs.dates.some((day) => mine.includes(day))).toBe(true);
    }
  });

  it('marks days of their own too, and is the same every time', async () => {
    const mine = ['2026-10-20', '2026-10-05', '2026-10-12'];

    const first = unwrap(await repository.theirDates(mine));
    const second = unwrap(await repository.theirDates(mine));

    // Every other one of mine (sorted), plus the day after the first and last.
    expect(first.dates).toEqual(['2026-10-05', '2026-10-06', '2026-10-20', '2026-10-21']);
    expect(second.dates).toEqual(first.dates);
  });

  it('rolls over month and year ends by the calendar, not by adding hours', async () => {
    const theirs = unwrap(await repository.theirDates(['2026-12-31']));

    expect(theirs.dates).toEqual(['2026-12-31', '2027-01-01']);
  });
});
