import type { Meet, Person, Review, Session, Venue } from '@/domain/entities';

/**
 * Seed data for the in-memory repositories.
 *
 * Used when no Supabase credentials are configured, and by tests. It is typed
 * as domain entities, not as database rows, so it exercises the same shapes the
 * real repositories return.
 *
 * Deleting this file is how you find everything still running on fake data.
 */

const inDays = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

/**
 * Four, not three, and the count matters.
 *
 * `SEED_PEOPLE[0]` is also the signed-in member — `InMemoryProfileRepository`
 * reads their profile from it — so the matching fake has to leave them out of
 * their own candidate set, exactly as `generate_candidates` does. With three
 * seeded people that would leave two candidates and a demo where you are shown
 * yourself or come up short.
 */
export const SEED_PEOPLE: Person[] = [
  {
    id: 'person-1',
    name: 'Aanya Rao',
    age: 27,
    // Seeded because `hasCompletedOnboarding` reads it. Without a date of
    // birth the fake profile looks half-finished and the app lands every
    // developer in the onboarding wizard on first run.
    dateOfBirth: '1999-04-12',
    gender: 'woman',
    headline: 'Product designer who would rather meet than message.',
    bio: 'Designs for a fintech, runs on weekends, reads far too much non-fiction.',
    city: 'Pune',
    photoUrls: [],
    interests: ['Design', 'Running', 'Books'],
    intents: ['networking', 'dating'],
    verification: 'verified',
  },
  {
    id: 'person-2',
    name: 'Rohan Mehta',
    age: 31,
    dateOfBirth: '1995-01-30',
    gender: 'man',
    headline: 'Building something in climate tech. Looking for a co-founder.',
    bio: 'Ex-infrastructure engineer. Two years into carbon accounting.',
    city: 'Pune',
    photoUrls: [],
    interests: ['Startups', 'Climate', 'Cycling'],
    intents: ['co_founder', 'networking'],
    verification: 'verified',
  },
  {
    id: 'person-3',
    name: 'Meera Nair',
    age: 29,
    dateOfBirth: '1997-08-03',
    gender: 'woman',
    headline: 'Doctor, amateur baker, terrible at small talk over text.',
    bio: 'Paediatrician. Weekend baker. Prefers a long coffee to a long thread.',
    city: 'Pune',
    photoUrls: [],
    interests: ['Medicine', 'Baking', 'Film'],
    intents: ['life_partner'],
    verification: 'verified',
  },
  {
    id: 'person-4',
    name: 'Kabir Shah',
    age: 33,
    dateOfBirth: '1993-11-18',
    gender: 'man',
    headline: 'Chef. Off on Mondays, which is when I actually see anyone.',
    bio: 'Runs the kitchen at a small place in Kalyani Nagar. Reads cookbooks in bed.',
    city: 'Pune',
    photoUrls: [],
    interests: ['Cooking', 'Food', 'Live music'],
    intents: ['dating', 'networking'],
    verification: 'verified',
  },
];

export const SEED_MEETS: Meet[] = [
  {
    id: 'meet-1',
    personId: 'person-2',
    personName: 'Rohan Mehta',
    venueName: 'The Daily Grind',
    venueArea: 'Baner',
    scheduledFor: inDays(2),
    status: 'confirmed',
  },
  {
    id: 'meet-2',
    personId: 'person-1',
    personName: 'Aanya Rao',
    venueName: 'Cozy Café',
    venueArea: 'Koregaon Park',
    scheduledFor: inDays(5),
    status: 'confirmed',
  },
  {
    id: 'meet-3',
    personId: 'person-3',
    personName: 'Meera Nair',
    venueName: 'Pagdandi',
    venueArea: 'Baner',
    scheduledFor: inDays(-6),
    status: 'completed',
  },
  {
    id: 'meet-4',
    personId: 'person-1',
    personName: 'Aanya Rao',
    venueName: 'Vohuman Café',
    venueArea: 'Camp',
    scheduledFor: inDays(-21),
    status: 'completed',
  },
];

export const SEED_REVIEWS: Review[] = [
  {
    id: 'review-1',
    meetId: 'meet-3',
    authorId: 'person-0',
    authorName: 'You',
    rating: 5,
    comment: 'Turned up on time and was easy to talk to. Would meet again.',
    createdAt: inDays(-5),
  },
  {
    id: 'review-2',
    meetId: 'meet-3',
    authorId: 'person-3',
    authorName: 'Meera Nair',
    rating: 4,
    comment: 'Good conversation, though it felt slightly rushed at the end.',
    createdAt: inDays(-5),
  },
];

/**
 * Partner cafés.
 *
 * The hours are the point. A venue with an empty `hours` array offers no
 * bookable slots at all, so seeding a café without them would make the booking
 * screen look broken when it is working exactly as written. Every one here is
 * open seven days, with one deliberately shut on Mondays so the "closed that
 * day" path is reachable by tapping rather than only in a test.
 */
const allWeek = (opensAt: string, closesAt: string): Venue['hours'] =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opensAt, closesAt }));

export const SEED_VENUES: Venue[] = [
  {
    id: 'venue-1',
    name: 'The Daily Grind',
    slug: 'the-daily-grind',
    addressLine: '12 Baner Road',
    area: 'Baner',
    city: 'Pune',
    concurrentCapacity: 3,
    hours: allWeek('08:00:00', '22:00:00'),
  },
  {
    id: 'venue-2',
    name: 'Pagdandi',
    slug: 'pagdandi',
    addressLine: 'Lane 5, Baner',
    area: 'Baner',
    city: 'Pune',
    concurrentCapacity: 2,
    // Closed Mondays.
    hours: [0, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      opensAt: '09:30:00',
      closesAt: '21:00:00',
    })),
  },
  {
    id: 'venue-3',
    name: 'Cozy Café',
    slug: 'cozy-cafe',
    addressLine: 'North Main Road',
    area: 'Koregaon Park',
    city: 'Pune',
    concurrentCapacity: 4,
    hours: allWeek('07:30:00', '23:00:00'),
  },
  {
    id: 'venue-4',
    name: 'Vohuman Café',
    slug: 'vohuman-cafe',
    addressLine: 'Sassoon Road, Camp',
    area: 'Camp',
    city: 'Pune',
    concurrentCapacity: 2,
    hours: allWeek('07:00:00', '19:00:00'),
  },
];

export const SEED_SESSION: Session = {
  user: { id: 'person-0', email: 'you@example.com', profileId: 'person-1' },
};
