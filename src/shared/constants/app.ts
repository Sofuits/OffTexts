/** Values that are the same everywhere and are not design tokens. */

export const APP_NAME = 'Offtexts';

/** How long a network request may run before it is abandoned. */
export const REQUEST_TIMEOUT_MS = 15_000;

/** Page size for any list that pages. */
export const DEFAULT_PAGE_SIZE = 20;

/** Copy shown wherever a list renders nothing. */
export const EMPTY_STATE_FALLBACK = 'Nothing here yet.';

/** Screen names as literals, for analytics and deep-link building. */
export const ROUTES = {
  rootTabs: 'RootTabs',
  profile: 'Profile',
  today: 'Today',
  scheduledMeets: 'ScheduledMeets',
  onboarding: 'Onboarding',
  browse: 'Browse',
  editProfile: 'EditProfile',
  personProfile: 'PersonProfile',
  meetDetails: 'MeetDetails',
  ratingsReviews: 'RatingsReviews',
} as const;

/**
 * Cities Offtexts has partner cafés in.
 *
 * Offered as shortcuts, not as a closed list — the field still accepts anything
 * typed. A member in a city with no cafés yet should be able to say so; that is
 * how you find out where to open next.
 */
export const SUGGESTED_CITIES = ['Pune', 'Mumbai', 'Bengaluru', 'Delhi', 'Hyderabad'] as const;

/** Offered on the languages question. Anything else may be typed. */
export const SUGGESTED_LANGUAGES = [
  'English',
  'Hindi',
  'Marathi',
  'Bengali',
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Gujarati',
  'Punjabi',
  'Urdu',
  'Odia',
] as const;

/** Shortcuts on the pronouns field. It is free text; these just save typing. */
export const SUGGESTED_PRONOUNS = ['she/her', 'he/him', 'they/them'] as const;

/** Starting points for a student's career interests. */
export const SUGGESTED_CAREER_INTERESTS = [
  'Software',
  'Design',
  'Product',
  'Finance',
  'Consulting',
  'Research',
  'Medicine',
  'Law',
  'Marketing',
  'Startups',
  'Public policy',
  'Education',
] as const;

/** Starting points for skills. */
export const SUGGESTED_SKILLS = [
  'Programming',
  'Data analysis',
  'Writing',
  'Public speaking',
  'Design',
  'Sales',
  'Marketing',
  'Research',
  'Leadership',
  'Languages',
] as const;

/** Starting points for a co-founder's industries. Anything else may be typed. */
export const SUGGESTED_STARTUP_INDUSTRIES = [
  'Fintech',
  'Healthtech',
  'Edtech',
  'Climate',
  'SaaS',
  'Consumer',
  'AI',
  'D2C',
  'Logistics',
  'Agritech',
] as const;

/** Starting points for industry. Free text, like everything here. */
export const SUGGESTED_INDUSTRIES = [
  'Technology',
  'Finance',
  'Healthcare',
  'Education',
  'Consulting',
  'Media',
  'Manufacturing',
  'Government',
] as const;

/**
 * Starting points for the interests question.
 *
 * A blank text box gets "music, travel, food" from everybody, which tells the
 * next person nothing and gives the matching rules nothing to work with. A list
 * to tap produces both more answers and more specific ones.
 *
 * Anything may still be typed. The list is a prompt, not a vocabulary.
 */
export const SUGGESTED_INTERESTS = [
  'Coffee',
  'Books',
  'Startups',
  'Running',
  'Cooking',
  'Film',
  'Live music',
  'Design',
  'Hiking',
  'Photography',
  'Board games',
  'Cricket',
  'Travel',
  'Theatre',
  'Cycling',
  'Investing',
  'Gaming',
  'Art',
  'Climbing',
  'Writing',
  'Podcasts',
  'Food',
  'Yoga',
  'Football',
] as const;

/**
 * What everyone agrees to before they are shown to anybody.
 *
 * These are the rules the reporting flow and the admin portal enforce, written
 * where a member reads them. Changing one here without changing it there is how
 * a moderator ends up acting on a rule nobody was shown.
 */
export const COMMUNITY_GUIDELINES = [
  {
    icon: 'person-circle-outline',
    title: 'Be the person in your photos',
    body: 'One real face, recent. Every profile is ID-checked before it is shown to anyone.',
  },
  {
    icon: 'cafe-outline',
    title: 'Show up, or say you cannot',
    body: 'A table is booked for you both. Cancelling is fine; not appearing is not.',
  },
  {
    icon: 'hand-left-outline',
    title: 'Take a no the first time',
    body: 'Nobody here owes anybody a second meet, or a reason.',
  },
  {
    icon: 'flag-outline',
    title: 'Tell us when something is wrong',
    body: 'Reports are read by a person, and the member you report is not told who reported them.',
  },
] as const;
