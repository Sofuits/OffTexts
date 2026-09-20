/**
 * The database schema, as TypeScript.
 *
 * Hand-written for now. Once the real Supabase project exists, REPLACE this
 * file with generated output and never edit it by hand again:
 *
 *   npx supabase gen types typescript --project-id <id> > src/infrastructure/supabase/database.types.ts
 *
 * Generating it is what makes a column rename a compile error instead of an
 * undefined at runtime. Note that these are ROW types — snake_case, nullable,
 * shaped by the database. They are deliberately not the domain entities;
 * `data/mappers` converts between the two, and that conversion is the seam
 * that lets the database change without the app noticing.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type ProfileRow = {
  id: string;
  /** FK to auth.users. */
  user_id: string;
  name: string;
  age: number | null;
  headline: string;
  bio: string | null;
  city: string;
  photo_urls: string[] | null;
  interests: string[] | null;
  intents: string[] | null;
  verification: string;
  created_at: string;
  updated_at: string;
};

export type MeetRow = {
  id: string;
  requester_id: string;
  recipient_id: string;
  venue_name: string;
  venue_area: string;
  scheduled_for: string;
  status: string;
  created_at: string;
};

export type ReviewRow = {
  id: string;
  meet_id: string;
  author_id: string;
  rating: number;
  comment: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<ProfileRow, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
      meets: {
        Row: MeetRow;
        Insert: Omit<MeetRow, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Omit<MeetRow, 'id' | 'created_at'>>;
        Relationships: [];
      };
      reviews: {
        Row: ReviewRow;
        Insert: Omit<ReviewRow, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Omit<ReviewRow, 'id' | 'meet_id' | 'author_id' | 'created_at'>>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
