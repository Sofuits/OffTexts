import { toMeet } from '@/data/mappers';
import type { MeetingRow } from '@/infrastructure/supabase/rows';

/** An api_v1.meetings row as PostgREST returns it, for a caller who was asked. */
const ROW: MeetingRow = {
  meeting_id: 'meet-1',
  status: 'confirmed',
  scheduled_for: '2026-09-28T13:30:00+00:00',
  duration_minutes: 60,
  booking_fee_paise: 0,
  venue_name: 'Two Chairs Coffee Room (demo)',
  venue_area: 'Aundh',
  cafe_id: 'cafe-1',
  match_id: 'match-1',
  i_requested_it: false,
  with_member_id: 'kavya',
  with_name: 'Kavya Iyer',
  with_photo_urls: ['https://example.test/kavya.jpg', 'https://example.test/second.jpg'],
  confirmed_at: null,
  completed_at: null,
  cancelled_at: null,
  cancellation_reason: null,
  my_check_in: null,
  created_at: '2026-09-25T09:00:00+00:00',
};

describe('toMeet', () => {
  it('names the other member, as the view resolved them', () => {
    const meet = toMeet(ROW);

    expect(meet.personName).toBe('Kavya Iyer');
    expect(meet.personId).toBe('kavya');
    expect(meet.personPhotoUrl).toBe('https://example.test/kavya.jpg');
  });

  it('is the same whichever side of the booking the caller is on', () => {
    // The view flips with_* for the caller; the mapper must not flip it again.
    expect(toMeet({ ...ROW, i_requested_it: true }).personName).toBe('Kavya Iyer');
  });

  it('carries the meeting, venue and instant through', () => {
    const meet = toMeet(ROW);

    expect(meet.id).toBe('meet-1');
    expect(meet.status).toBe('confirmed');
    expect(meet.venueName).toBe('Two Chairs Coffee Room (demo)');
    expect(meet.venueArea).toBe('Aundh');
    expect(meet.scheduledFor.toISOString()).toBe('2026-09-28T13:30:00.000Z');
  });

  it('has no photo rather than an empty one', () => {
    expect(toMeet({ ...ROW, with_photo_urls: [] }).personPhotoUrl).toBeUndefined();
  });
});
