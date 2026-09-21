import type { Meet, Person, Review, Session } from '@/domain/entities';

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

export const SEED_PEOPLE: Person[] = [
  {
    id: 'person-1',
    name: 'Aanya Rao',
    age: 27,
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
    headline: 'Doctor, amateur baker, terrible at small talk over text.',
    bio: 'Paediatrician. Weekend baker. Prefers a long coffee to a long thread.',
    city: 'Pune',
    photoUrls: [],
    interests: ['Medicine', 'Baking', 'Film'],
    intents: ['life_partner'],
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

export const SEED_SESSION: Session = {
  user: { id: 'person-0', email: 'you@example.com', profileId: 'person-1' },
};
