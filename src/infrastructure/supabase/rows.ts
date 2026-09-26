/**
 * Named row types, derived from the generated schema.
 *
 * WHY THIS FILE EXISTS
 * `database.types.ts` is generated, and a generator only ever exports `Json`
 * and `Database` — not `ProfileRow`, not `MeetRow`. Every import of a named
 * type therefore breaks the moment the file is regenerated, which is exactly
 * when nobody wants to be fixing imports.
 *
 * So the names live here instead, defined by indexing into `Database` rather
 * than by restating it. Regenerating the schema updates every one of them
 * automatically, and a column that disappears becomes a compile error at the
 * point it is used rather than a silent `undefined`.
 *
 * Import from here, never from `./database.types` directly.
 */

import type { Database } from './database.types';

export type { Database, Json } from './database.types';

type Public = Database['public'];
type ApiV1 = Database['api_v1'];

/* ------------------------------------------------------------- helpers ---- */

/** A row as it comes out of a `public` table. */
export type Table<T extends keyof Public['Tables']> = Public['Tables'][T]['Row'];

/** What a `public` table accepts on insert — defaults and nullables optional. */
export type Insertable<T extends keyof Public['Tables']> = Public['Tables'][T]['Insert'];

/** What a `public` table accepts on update — everything optional. */
export type Updatable<T extends keyof Public['Tables']> = Public['Tables'][T]['Update'];

/** A database enum as a TypeScript union. */
export type Enum<T extends keyof Public['Enums']> = Public['Enums'][T];

/**
 * A row from the published contract.
 *
 * Prefer these over the table rows for anything a client reads: `api_v1` is
 * what the product promises not to break, and `public` is free to be
 * refactored underneath it. See docs/api/v1.md.
 */
export type ApiView<T extends keyof ApiV1['Views']> = ApiV1['Views'][T]['Row'];

export type ApiArgs<T extends keyof ApiV1['Functions']> = ApiV1['Functions'][T]['Args'];
export type ApiReturns<T extends keyof ApiV1['Functions']> = ApiV1['Functions'][T]['Returns'];

/* -------------------------------------------------------------- tables ---- */

export type ProfileRow = Table<'profiles'>;
export type ProfileInsert = Insertable<'profiles'>;
export type ProfileUpdate = Updatable<'profiles'>;

export type PreferencesRow = Table<'preferences'>;
export type PreferencesUpdate = Updatable<'preferences'>;
export type DecisionInsert = Insertable<'decisions'>;

export type ProfileDetailsRow = Table<'profile_details'>;
export type ProfileDetailsInsert = Insertable<'profile_details'>;

export type PhotoRow = Table<'photos'>;
export type PhotoInsert = Insertable<'photos'>;

export type AvailabilityRow = Table<'availability'>;
export type AvailabilityInsert = Insertable<'availability'>;

export type CafeRow = Table<'cafes'>;
export type CafeContactRow = Table<'cafe_contacts'>;
export type CafeHoursRow = Table<'cafe_hours'>;

export type CandidateSetRow = Table<'candidate_sets'>;
export type CandidateRow = Table<'candidates'>;
export type DecisionRow = Table<'decisions'>;
export type MatchRow = Table<'matches'>;

export type MeetRow = Table<'meets'>;
export type MeetInsert = Insertable<'meets'>;
export type MeetUpdate = Updatable<'meets'>;

export type PaymentRow = Table<'payments'>;
export type RefundRow = Table<'refunds'>;

export type ReviewRow = Table<'reviews'>;
export type ReviewInsert = Insertable<'reviews'>;

export type ReportRow = Table<'reports'>;
export type ReportEvidenceRow = Table<'report_evidence'>;

export type NotificationRow = Table<'notifications'>;
export type PushTokenRow = Table<'push_tokens'>;
export type AuditLogRow = Table<'audit_log'>;

export type StaffRow = Table<'staff'>;

/* --------------------------------------------------------------- enums ---- */

export type GenderValue = Enum<'gender'>;
export type MeetIntentValue = Enum<'meet_intent'>;
export type VerificationStatusValue = Enum<'verification_status'>;
export type MeetStatusValue = Enum<'meet_status'>;
export type PhotoModerationValue = Enum<'photo_moderation'>;
export type CafeStatusValue = Enum<'cafe_status'>;
export type DecisionKindValue = Enum<'decision_kind'>;
export type MatchStatusValue = Enum<'match_status'>;
export type PaymentStatusValue = Enum<'payment_status'>;
export type RefundStatusValue = Enum<'refund_status'>;
export type ReportCategoryValue = Enum<'report_category'>;
export type ReportSeverityValue = Enum<'report_severity'>;
export type ReportStatusValue = Enum<'report_status'>;
export type NotificationKindValue = Enum<'notification_kind'>;
export type DevicePlatformValue = Enum<'device_platform'>;

/* ------------------------------------------------------------ contract ---- */

export type MeRow = ApiView<'me'>;
export type MyPreferencesRow = ApiView<'my_preferences'>;
export type MyPhotoRow = ApiView<'my_photos'>;
export type MyAvailabilityRow = ApiView<'my_availability'>;
export type DailyCandidateRow = ApiView<'daily_candidates'>;
export type MyMatchRow = ApiView<'my_matches'>;
export type MeetingRow = ApiView<'meetings'>;
export type VenueRow = ApiView<'venues'>;
export type MyNotificationRow = ApiView<'my_notifications'>;
export type MyPaymentRow = ApiView<'my_payments'>;

export type StaffMemberRow = ApiView<'staff_members'>;
export type StaffMeetingRow = ApiView<'staff_meetings'>;
export type StaffReviewRow = ApiView<'staff_reviews'>;
export type StaffReportRow = ApiView<'staff_reports'>;
export type StaffVenueRow = ApiView<'staff_venues'>;
