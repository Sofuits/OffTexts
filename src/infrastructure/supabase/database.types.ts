/**
 * The database schema, as TypeScript. GENERATED — DO NOT EDIT BY HAND.
 *
 *   node scripts/generate-types.mjs --local > src/infrastructure/supabase/database.types.ts
 *
 * or, where Docker is available, the canonical Supabase command:
 *
 *   npx supabase gen types typescript \
 *     --project-id dxggtnpnyxqjyarxvczh --schema public,api_v1 \
 *     > src/infrastructure/supabase/database.types.ts
 *
 * Both produce the same shape and either may be used. Regenerating is what
 * makes a column rename a compile error instead of an undefined at runtime.
 *
 * These are ROW types: snake_case, nullable, shaped by the database. They are
 * deliberately not the domain entities — `data/mappers` converts between the
 * two, and that conversion is the seam that lets the database change without
 * the rest of the app noticing.
 *
 * Named aliases (ProfileRow, MeetRow, …) live in ./rows.ts, so that
 * regenerating this file cannot break an import.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          actor_kind: string;
          actor_label: string | null;
          action: string;
          entity_table: string;
          entity_id: string | null;
          old_row: Json | null;
          new_row: Json | null;
          created_at: string;
        };
        Insert: {
          actor_id?: string | null;
          actor_kind: string;
          actor_label?: string | null;
          action: string;
          entity_table: string;
          entity_id?: string | null;
          old_row?: Json | null;
          new_row?: Json | null;
          created_at?: string;
        };
        Update: {
          actor_id?: string | null;
          actor_kind?: string;
          actor_label?: string | null;
          action?: string;
          entity_table?: string;
          entity_id?: string | null;
          old_row?: Json | null;
          new_row?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      availability: {
        Row: {
          id: string;
          member_id: string;
          weekday: number;
          starts_at: string;
          ends_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          weekday: number;
          starts_at: string;
          ends_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          weekday?: number;
          starts_at?: string;
          ends_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      cafe_contacts: {
        Row: {
          id: string;
          cafe_id: string;
          name: string;
          role: string | null;
          phone: string | null;
          email: string | null;
          is_primary: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cafe_id: string;
          name: string;
          role?: string | null;
          phone?: string | null;
          email?: string | null;
          is_primary?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cafe_id?: string;
          name?: string;
          role?: string | null;
          phone?: string | null;
          email?: string | null;
          is_primary?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cafe_hours: {
        Row: {
          id: string;
          cafe_id: string;
          weekday: number;
          opens_at: string;
          closes_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          cafe_id: string;
          weekday: number;
          opens_at: string;
          closes_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          cafe_id?: string;
          weekday?: number;
          opens_at?: string;
          closes_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      cafes: {
        Row: {
          id: string;
          name: string;
          slug: string;
          status: Database['public']['Enums']['cafe_status'];
          address_line: string;
          area: string;
          city: string;
          postal_code: string | null;
          latitude: number | null;
          longitude: number | null;
          maps_url: string | null;
          phone: string | null;
          concurrent_meet_capacity: number;
          partner_since: string | null;
          partner_until: string | null;
          razorpay_linked_account_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          status?: Database['public']['Enums']['cafe_status'];
          address_line: string;
          area: string;
          city: string;
          postal_code?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          maps_url?: string | null;
          phone?: string | null;
          concurrent_meet_capacity?: number;
          partner_since?: string | null;
          partner_until?: string | null;
          razorpay_linked_account_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          status?: Database['public']['Enums']['cafe_status'];
          address_line?: string;
          area?: string;
          city?: string;
          postal_code?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          maps_url?: string | null;
          phone?: string | null;
          concurrent_meet_capacity?: number;
          partner_since?: string | null;
          partner_until?: string | null;
          razorpay_linked_account_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      candidate_sets: {
        Row: {
          id: string;
          member_id: string;
          for_date: string;
          rule_version: string;
          generated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          for_date: string;
          rule_version: string;
          generated_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          for_date?: string;
          rule_version?: string;
          generated_at?: string;
        };
        Relationships: [];
      };
      candidates: {
        Row: {
          id: string;
          set_id: string;
          member_id: string;
          subject_id: string;
          slot: number;
          score: number | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          set_id: string;
          member_id: string;
          subject_id: string;
          slot: number;
          score?: number | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          set_id?: string;
          member_id?: string;
          subject_id?: string;
          slot?: number;
          score?: number | null;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      decisions: {
        Row: {
          id: string;
          actor_id: string;
          subject_id: string;
          kind: Database['public']['Enums']['decision_kind'];
          candidate_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          subject_id: string;
          kind: Database['public']['Enums']['decision_kind'];
          candidate_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string;
          subject_id?: string;
          kind?: Database['public']['Enums']['decision_kind'];
          candidate_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          member_a: string;
          member_b: string;
          status: Database['public']['Enums']['match_status'];
          closed_at: string | null;
          closed_by: string | null;
          close_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          member_a: string;
          member_b: string;
          status?: Database['public']['Enums']['match_status'];
          closed_at?: string | null;
          closed_by?: string | null;
          close_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          member_a?: string;
          member_b?: string;
          status?: Database['public']['Enums']['match_status'];
          closed_at?: string | null;
          closed_by?: string | null;
          close_reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      meets: {
        Row: {
          id: string;
          requester_id: string;
          recipient_id: string;
          venue_name: string;
          venue_area: string;
          scheduled_for: string;
          status: Database['public']['Enums']['meet_status'];
          created_at: string;
          match_id: string | null;
          cafe_id: string | null;
          duration_minutes: number;
          booking_fee_paise: number;
          confirmed_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          cancellation_reason: string | null;
          requester_checked_in_at: string | null;
          recipient_checked_in_at: string | null;
        };
        Insert: {
          id?: string;
          requester_id: string;
          recipient_id: string;
          venue_name?: string;
          venue_area?: string;
          scheduled_for: string;
          status?: Database['public']['Enums']['meet_status'];
          created_at?: string;
          match_id?: string | null;
          cafe_id?: string | null;
          duration_minutes?: number;
          booking_fee_paise?: number;
          confirmed_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancellation_reason?: string | null;
          requester_checked_in_at?: string | null;
          recipient_checked_in_at?: string | null;
        };
        Update: {
          id?: string;
          requester_id?: string;
          recipient_id?: string;
          venue_name?: string;
          venue_area?: string;
          scheduled_for?: string;
          status?: Database['public']['Enums']['meet_status'];
          created_at?: string;
          match_id?: string | null;
          cafe_id?: string | null;
          duration_minutes?: number;
          booking_fee_paise?: number;
          confirmed_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancellation_reason?: string | null;
          requester_checked_in_at?: string | null;
          recipient_checked_in_at?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          kind: Database['public']['Enums']['notification_kind'];
          title: string;
          body: string;
          data: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          kind: Database['public']['Enums']['notification_kind'];
          title: string;
          body: string;
          data?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          kind?: Database['public']['Enums']['notification_kind'];
          title?: string;
          body?: string;
          data?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      payment_webhook_events: {
        Row: {
          event_id: string;
          event_type: string;
          payload: Json;
          received_at: string;
          processed_at: string | null;
          processing_error: string | null;
        };
        Insert: {
          event_id: string;
          event_type: string;
          payload: Json;
          received_at?: string;
          processed_at?: string | null;
          processing_error?: string | null;
        };
        Update: {
          event_id?: string;
          event_type?: string;
          payload?: Json;
          received_at?: string;
          processed_at?: string | null;
          processing_error?: string | null;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          meet_id: string | null;
          payer_id: string | null;
          meet_reference: string;
          razorpay_order_id: string;
          razorpay_payment_id: string | null;
          receipt: string;
          amount_paise: number;
          amount_refunded_paise: number;
          currency: string;
          order_status: Database['public']['Enums']['payment_order_status'];
          status: Database['public']['Enums']['payment_status'];
          refund_coverage: string | null;
          captured: boolean;
          method: string | null;
          card_last4: string | null;
          card_network: string | null;
          signature_verified_at: string | null;
          authorized_at: string | null;
          captured_at: string | null;
          capture_deadline_at: string | null;
          error_code: string | null;
          error_description: string | null;
          error_source: string | null;
          error_step: string | null;
          error_reason: string | null;
          notes: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          meet_id?: string | null;
          payer_id?: string | null;
          meet_reference: string;
          razorpay_order_id: string;
          razorpay_payment_id?: string | null;
          receipt: string;
          amount_paise: number;
          amount_refunded_paise?: number;
          currency?: string;
          order_status?: Database['public']['Enums']['payment_order_status'];
          status?: Database['public']['Enums']['payment_status'];
          refund_coverage?: string | null;
          captured?: boolean;
          method?: string | null;
          card_last4?: string | null;
          card_network?: string | null;
          signature_verified_at?: string | null;
          authorized_at?: string | null;
          captured_at?: string | null;
          capture_deadline_at?: string | null;
          error_code?: string | null;
          error_description?: string | null;
          error_source?: string | null;
          error_step?: string | null;
          error_reason?: string | null;
          notes?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          meet_id?: string | null;
          payer_id?: string | null;
          meet_reference?: string;
          razorpay_order_id?: string;
          razorpay_payment_id?: string | null;
          receipt?: string;
          amount_paise?: number;
          amount_refunded_paise?: number;
          currency?: string;
          order_status?: Database['public']['Enums']['payment_order_status'];
          status?: Database['public']['Enums']['payment_status'];
          refund_coverage?: string | null;
          captured?: boolean;
          method?: string | null;
          card_last4?: string | null;
          card_network?: string | null;
          signature_verified_at?: string | null;
          authorized_at?: string | null;
          captured_at?: string | null;
          capture_deadline_at?: string | null;
          error_code?: string | null;
          error_description?: string | null;
          error_source?: string | null;
          error_step?: string | null;
          error_reason?: string | null;
          notes?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      photos: {
        Row: {
          id: string;
          member_id: string;
          storage_path: string;
          url: string;
          sort_order: number;
          moderation: Database['public']['Enums']['photo_moderation'];
          moderated_by: string | null;
          moderated_at: string | null;
          rejection_reason: string | null;
          width: number | null;
          height: number | null;
          bytes: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          storage_path: string;
          url: string;
          sort_order: number;
          moderation?: Database['public']['Enums']['photo_moderation'];
          moderated_by?: string | null;
          moderated_at?: string | null;
          rejection_reason?: string | null;
          width?: number | null;
          height?: number | null;
          bytes?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          storage_path?: string;
          url?: string;
          sort_order?: number;
          moderation?: Database['public']['Enums']['photo_moderation'];
          moderated_by?: string | null;
          moderated_at?: string | null;
          rejection_reason?: string | null;
          width?: number | null;
          height?: number | null;
          bytes?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      preferences: {
        Row: {
          member_id: string;
          age_min: number;
          age_max: number;
          interested_in: Database['public']['Enums']['gender'][];
          intents: Database['public']['Enums']['meet_intent'][];
          cities: string[];
          max_distance_km: number | null;
          push_enabled: boolean;
          email_enabled: boolean;
          quiet_hours_start: string | null;
          quiet_hours_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          member_id: string;
          age_min?: number;
          age_max?: number;
          interested_in?: Database['public']['Enums']['gender'][];
          intents?: Database['public']['Enums']['meet_intent'][];
          cities?: string[];
          max_distance_km?: number | null;
          push_enabled?: boolean;
          email_enabled?: boolean;
          quiet_hours_start?: string | null;
          quiet_hours_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          member_id?: string;
          age_min?: number;
          age_max?: number;
          interested_in?: Database['public']['Enums']['gender'][];
          intents?: Database['public']['Enums']['meet_intent'][];
          cities?: string[];
          max_distance_km?: number | null;
          push_enabled?: boolean;
          email_enabled?: boolean;
          quiet_hours_start?: string | null;
          quiet_hours_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          name: string;
          age: number | null;
          headline: string;
          bio: string | null;
          city: string;
          photo_urls: string[];
          interests: string[];
          intents: Database['public']['Enums']['meet_intent'][];
          verification: Database['public']['Enums']['verification_status'];
          created_at: string;
          updated_at: string;
          gender: Database['public']['Enums']['gender'] | null;
          date_of_birth: string | null;
          last_active_at: string;
          is_paused: boolean;
        };
        Insert: {
          id: string;
          name: string;
          age?: number | null;
          headline?: string;
          bio?: string | null;
          city: string;
          photo_urls?: string[];
          interests?: string[];
          intents?: Database['public']['Enums']['meet_intent'][];
          verification?: Database['public']['Enums']['verification_status'];
          created_at?: string;
          updated_at?: string;
          gender?: Database['public']['Enums']['gender'] | null;
          date_of_birth?: string | null;
          last_active_at?: string;
          is_paused?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          age?: number | null;
          headline?: string;
          bio?: string | null;
          city?: string;
          photo_urls?: string[];
          interests?: string[];
          intents?: Database['public']['Enums']['meet_intent'][];
          verification?: Database['public']['Enums']['verification_status'];
          created_at?: string;
          updated_at?: string;
          gender?: Database['public']['Enums']['gender'] | null;
          date_of_birth?: string | null;
          last_active_at?: string;
          is_paused?: boolean;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          id: string;
          member_id: string;
          token: string;
          platform: Database['public']['Enums']['device_platform'];
          created_at: string;
          last_seen_at: string;
          disabled_at: string | null;
          disabled_reason: string | null;
        };
        Insert: {
          id?: string;
          member_id: string;
          token: string;
          platform: Database['public']['Enums']['device_platform'];
          created_at?: string;
          last_seen_at?: string;
          disabled_at?: string | null;
          disabled_reason?: string | null;
        };
        Update: {
          id?: string;
          member_id?: string;
          token?: string;
          platform?: Database['public']['Enums']['device_platform'];
          created_at?: string;
          last_seen_at?: string;
          disabled_at?: string | null;
          disabled_reason?: string | null;
        };
        Relationships: [];
      };
      refunds: {
        Row: {
          id: string;
          payment_id: string;
          razorpay_refund_id: string;
          amount_paise: number;
          currency: string;
          status: Database['public']['Enums']['refund_status'];
          speed_requested: Database['public']['Enums']['refund_speed'] | null;
          speed_processed: Database['public']['Enums']['refund_speed'] | null;
          is_partial: boolean;
          acquirer_reference: string | null;
          reason: string | null;
          notes: Json;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          payment_id: string;
          razorpay_refund_id: string;
          amount_paise: number;
          currency?: string;
          status?: Database['public']['Enums']['refund_status'];
          speed_requested?: Database['public']['Enums']['refund_speed'] | null;
          speed_processed?: Database['public']['Enums']['refund_speed'] | null;
          is_partial?: boolean;
          acquirer_reference?: string | null;
          reason?: string | null;
          notes?: Json;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          payment_id?: string;
          razorpay_refund_id?: string;
          amount_paise?: number;
          currency?: string;
          status?: Database['public']['Enums']['refund_status'];
          speed_requested?: Database['public']['Enums']['refund_speed'] | null;
          speed_processed?: Database['public']['Enums']['refund_speed'] | null;
          is_partial?: boolean;
          acquirer_reference?: string | null;
          reason?: string | null;
          notes?: Json;
          created_at?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      report_evidence: {
        Row: {
          id: string;
          report_id: string;
          storage_path: string;
          content_type: string;
          bytes: number | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          storage_path: string;
          content_type: string;
          bytes?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          storage_path?: string;
          content_type?: string;
          bytes?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string | null;
          subject_id: string;
          meet_id: string | null;
          category: Database['public']['Enums']['report_category'];
          severity: Database['public']['Enums']['report_severity'];
          details: string;
          status: Database['public']['Enums']['report_status'];
          assigned_to: string | null;
          resolution: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reporter_id?: string | null;
          subject_id: string;
          meet_id?: string | null;
          category: Database['public']['Enums']['report_category'];
          severity?: Database['public']['Enums']['report_severity'];
          details: string;
          status?: Database['public']['Enums']['report_status'];
          assigned_to?: string | null;
          resolution?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string | null;
          subject_id?: string;
          meet_id?: string | null;
          category?: Database['public']['Enums']['report_category'];
          severity?: Database['public']['Enums']['report_severity'];
          details?: string;
          status?: Database['public']['Enums']['report_status'];
          assigned_to?: string | null;
          resolution?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          meet_id: string;
          author_id: string;
          rating: number;
          comment: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          meet_id: string;
          author_id: string;
          rating: number;
          comment: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          meet_id?: string;
          author_id?: string;
          rating?: number;
          comment?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      staff: {
        Row: {
          id: string;
          role: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          role?: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: string;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      current_booking_fee_paise: {
        Args: Record<never, never>;
        Returns: number;
      };
      distance_km: {
        Args: {
          lat1: number;
          lon1: number;
          lat2: number;
          lon2: number;
        };
        Returns: number;
      };
      generate_candidates: {
        Args: {
          p_for_date?: string;
          p_per_member?: number;
          p_repeat_window_days?: number;
        };
        Returns: number;
      };
      is_staff: {
        Args: Record<never, never>;
        Returns: boolean;
      };
      refresh_ages: {
        Args: Record<never, never>;
        Returns: number;
      };
    };
    Enums: {
      cafe_status: 'prospect' | 'active' | 'paused' | 'ended';
      decision_kind: 'pass' | 'like';
      device_platform: 'ios' | 'android' | 'web';
      gender: 'woman' | 'man' | 'non_binary' | 'other' | 'prefer_not_to_say';
      match_status: 'active' | 'closed';
      meet_intent: 'dating' | 'life_partner' | 'networking' | 'co_founder';
      meet_status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
      notification_kind:
        | 'new_candidates'
        | 'new_match'
        | 'meet_requested'
        | 'meet_confirmed'
        | 'meet_cancelled'
        | 'meet_reminder'
        | 'review_requested'
        | 'payment_receipt'
        | 'payment_failed'
        | 'photo_approved'
        | 'photo_rejected'
        | 'verification_approved'
        | 'verification_rejected'
        | 'safety_update';
      payment_order_status: 'created' | 'attempted' | 'paid';
      payment_status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
      photo_moderation: 'pending' | 'approved' | 'rejected';
      refund_speed: 'normal' | 'optimum';
      refund_status: 'pending' | 'processed' | 'failed';
      report_category:
        | 'harassment'
        | 'safety'
        | 'fake_profile'
        | 'inappropriate_content'
        | 'no_show'
        | 'spam'
        | 'other';
      report_severity: 'low' | 'medium' | 'high' | 'critical';
      report_status: 'open' | 'investigating' | 'actioned' | 'dismissed';
      verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
    };
    CompositeTypes: Record<never, never>;
  };
  api_v1: {
    Tables: Record<never, never>;
    Views: {
      daily_candidates: {
        Row: {
          candidate_id: string | null;
          for_date: string | null;
          slot: number | null;
          member_id: string | null;
          name: string | null;
          headline: string | null;
          bio: string | null;
          city: string | null;
          age: number | null;
          gender: Database['public']['Enums']['gender'] | null;
          interests: string[] | null;
          intents: Database['public']['Enums']['meet_intent'][] | null;
          photo_urls: string[] | null;
          my_decision: Database['public']['Enums']['decision_kind'] | null;
        };
        Relationships: [];
      };
      me: {
        Row: {
          id: string | null;
          name: string | null;
          headline: string | null;
          bio: string | null;
          city: string | null;
          age: number | null;
          date_of_birth: string | null;
          gender: Database['public']['Enums']['gender'] | null;
          interests: string[] | null;
          intents: Database['public']['Enums']['meet_intent'][] | null;
          photo_urls: string[] | null;
          verification: Database['public']['Enums']['verification_status'] | null;
          is_paused: boolean | null;
          last_active_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
      meetings: {
        Row: {
          meeting_id: string | null;
          status: Database['public']['Enums']['meet_status'] | null;
          scheduled_for: string | null;
          duration_minutes: number | null;
          booking_fee_paise: number | null;
          venue_name: string | null;
          venue_area: string | null;
          cafe_id: string | null;
          match_id: string | null;
          i_requested_it: boolean | null;
          with_member_id: string | null;
          with_name: string | null;
          with_photo_urls: string[] | null;
          confirmed_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          my_check_in: string | null;
          created_at: string | null;
        };
        Relationships: [];
      };
      my_availability: {
        Row: {
          id: string | null;
          weekday: number | null;
          starts_at: string | null;
          ends_at: string | null;
        };
        Relationships: [];
      };
      my_matches: {
        Row: {
          match_id: string | null;
          status: Database['public']['Enums']['match_status'] | null;
          matched_at: string | null;
          member_id: string | null;
          name: string | null;
          headline: string | null;
          city: string | null;
          age: number | null;
          photo_urls: string[] | null;
          meeting_count: number | null;
        };
        Relationships: [];
      };
      my_notifications: {
        Row: {
          id: string | null;
          kind: Database['public']['Enums']['notification_kind'] | null;
          title: string | null;
          body: string | null;
          data: Json | null;
          read_at: string | null;
          created_at: string | null;
        };
        Relationships: [];
      };
      my_payments: {
        Row: {
          payment_id: string | null;
          meeting_id: string | null;
          receipt: string | null;
          razorpay_order_id: string | null;
          razorpay_payment_id: string | null;
          amount_paise: number | null;
          amount_refunded_paise: number | null;
          currency: string | null;
          status: Database['public']['Enums']['payment_status'] | null;
          refund_coverage: string | null;
          method: string | null;
          card_last4: string | null;
          card_network: string | null;
          captured_at: string | null;
          created_at: string | null;
        };
        Relationships: [];
      };
      my_photos: {
        Row: {
          id: string | null;
          url: string | null;
          storage_path: string | null;
          sort_order: number | null;
          moderation: Database['public']['Enums']['photo_moderation'] | null;
          rejection_reason: string | null;
          width: number | null;
          height: number | null;
          created_at: string | null;
        };
        Relationships: [];
      };
      my_preferences: {
        Row: {
          member_id: string | null;
          age_min: number | null;
          age_max: number | null;
          interested_in: Database['public']['Enums']['gender'][] | null;
          intents: Database['public']['Enums']['meet_intent'][] | null;
          cities: string[] | null;
          max_distance_km: number | null;
          push_enabled: boolean | null;
          email_enabled: boolean | null;
          quiet_hours_start: string | null;
          quiet_hours_end: string | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
      staff_meetings: {
        Row: {
          meeting_id: string | null;
          status: Database['public']['Enums']['meet_status'] | null;
          scheduled_for: string | null;
          venue_name: string | null;
          venue_area: string | null;
          booking_fee_paise: number | null;
          requester_id: string | null;
          requester_name: string | null;
          recipient_id: string | null;
          recipient_name: string | null;
          requester_checked_in_at: string | null;
          recipient_checked_in_at: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          payment_status: Database['public']['Enums']['payment_status'] | null;
          paid_paise: number | null;
          created_at: string | null;
        };
        Relationships: [];
      };
      staff_members: {
        Row: {
          id: string | null;
          name: string | null;
          city: string | null;
          age: number | null;
          gender: Database['public']['Enums']['gender'] | null;
          intents: Database['public']['Enums']['meet_intent'][] | null;
          verification: Database['public']['Enums']['verification_status'] | null;
          is_paused: boolean | null;
          last_active_at: string | null;
          created_at: string | null;
          photos_awaiting_moderation: number | null;
          reports_against: number | null;
        };
        Relationships: [];
      };
      staff_reports: {
        Row: {
          id: string | null;
          category: Database['public']['Enums']['report_category'] | null;
          severity: Database['public']['Enums']['report_severity'] | null;
          status: Database['public']['Enums']['report_status'] | null;
          details: string | null;
          created_at: string | null;
          resolved_at: string | null;
          resolution: string | null;
          reporter_id: string | null;
          reporter_name: string | null;
          subject_id: string | null;
          subject_name: string | null;
          meet_id: string | null;
          assigned_to: string | null;
          evidence_count: number | null;
        };
        Relationships: [];
      };
      staff_reviews: {
        Row: {
          id: string | null;
          rating: number | null;
          comment: string | null;
          created_at: string | null;
          author_id: string | null;
          author_name: string | null;
          meeting_id: string | null;
          scheduled_for: string | null;
          venue_name: string | null;
        };
        Relationships: [];
      };
      staff_venues: {
        Row: {
          id: string | null;
          name: string | null;
          slug: string | null;
          status: Database['public']['Enums']['cafe_status'] | null;
          address_line: string | null;
          area: string | null;
          city: string | null;
          phone: string | null;
          concurrent_meet_capacity: number | null;
          partner_since: string | null;
          partner_until: string | null;
          notes: string | null;
          contacts: Json | null;
          meetings_hosted: number | null;
        };
        Relationships: [];
      };
      venues: {
        Row: {
          id: string | null;
          name: string | null;
          slug: string | null;
          address_line: string | null;
          area: string | null;
          city: string | null;
          latitude: number | null;
          longitude: number | null;
          maps_url: string | null;
          concurrent_meet_capacity: number | null;
          hours: Json | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      check_in: {
        Args: {
          p_meeting_id: string;
        };
        Returns: string;
      };
      contract_version: {
        Args: Record<never, never>;
        Returns: string;
      };
      file_report: {
        Args: {
          p_subject_id: string;
          p_category: Database['public']['Enums']['report_category'];
          p_details: string;
          p_meeting_id?: string;
        };
        Returns: string;
      };
      mark_notifications_read: {
        Args: {
          p_ids: string[];
        };
        Returns: number;
      };
      record_decision: {
        Args: {
          p_subject_id: string;
          p_kind: Database['public']['Enums']['decision_kind'];
          p_candidate_id?: string;
        };
        Returns: string;
      };
      register_push_token: {
        Args: {
          p_token: string;
          p_platform: Database['public']['Enums']['device_platform'];
        };
        Returns: undefined;
      };
      request_meeting: {
        Args: {
          p_match_id: string;
          p_cafe_id: string;
          p_scheduled_for: string;
          p_duration_minutes?: number;
        };
        Returns: string;
      };
      respond_to_meeting: {
        Args: {
          p_meeting_id: string;
          p_accept: boolean;
          p_reason?: string;
        };
        Returns: Database['public']['Enums']['meet_status'];
      };
      set_photo_order: {
        Args: {
          p_ids: string[];
        };
        Returns: number;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
