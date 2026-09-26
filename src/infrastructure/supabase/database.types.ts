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
      profile_details: {
        Row: {
          member_id: string;
          last_name: string | null;
          pronouns: string | null;
          hometown: string | null;
          languages: string[];
          occupation_status: Database['public']['Enums']['occupation_status'] | null;
          education_level: Database['public']['Enums']['education_level'] | null;
          institution: string | null;
          degree: string | null;
          field_of_study: string | null;
          graduation_year: number | null;
          study_year: number | null;
          study_mode: Database['public']['Enums']['study_mode'] | null;
          previous_education: string | null;
          internship: string | null;
          career_interests: string[];
          skills: string[];
          occupation: string | null;
          job_title: string | null;
          company: string | null;
          industry: string | null;
          years_experience: number | null;
          work_location: string | null;
          work_mode: Database['public']['Enums']['work_mode'] | null;
          smoking: Database['public']['Enums']['smoking_habit'] | null;
          drinking: Database['public']['Enums']['drinking_habit'] | null;
          diet: Database['public']['Enums']['diet_preference'] | null;
          exercise: Database['public']['Enums']['exercise_habit'] | null;
          sleep: Database['public']['Enums']['sleep_schedule'] | null;
          pets: Database['public']['Enums']['pet_preference'] | null;
          prompts: Json;
          hidden_fields: string[];
          onboarding_step: string | null;
          created_at: string;
          updated_at: string;
          relationship_goal: Database['public']['Enums']['relationship_goal'] | null;
          children_plan: Database['public']['Enums']['children_plan'] | null;
          partner_values: string[];
          marriage_timeline: Database['public']['Enums']['marriage_timeline'] | null;
          marital_status: Database['public']['Enums']['marital_status'] | null;
          religion: Database['public']['Enums']['religion'] | null;
          faith_importance: Database['public']['Enums']['importance_level'] | null;
          living_arrangement: Database['public']['Enums']['living_arrangement'] | null;
          family_involvement: Database['public']['Enums']['family_involvement'] | null;
          open_to_relocate: Database['public']['Enums']['relocation_openness'] | null;
          cofounder_role: Database['public']['Enums']['cofounder_role'] | null;
          startup_stage: Database['public']['Enums']['startup_stage'] | null;
          founder_skills: Database['public']['Enums']['founder_skill'][];
          seeking_skills: Database['public']['Enums']['founder_skill'][];
          founder_commitment: Database['public']['Enums']['founder_commitment'] | null;
          startup_industries: string[];
          funding_plan: Database['public']['Enums']['funding_plan'] | null;
        };
        Insert: {
          member_id: string;
          last_name?: string | null;
          pronouns?: string | null;
          hometown?: string | null;
          languages?: string[];
          occupation_status?: Database['public']['Enums']['occupation_status'] | null;
          education_level?: Database['public']['Enums']['education_level'] | null;
          institution?: string | null;
          degree?: string | null;
          field_of_study?: string | null;
          graduation_year?: number | null;
          study_year?: number | null;
          study_mode?: Database['public']['Enums']['study_mode'] | null;
          previous_education?: string | null;
          internship?: string | null;
          career_interests?: string[];
          skills?: string[];
          occupation?: string | null;
          job_title?: string | null;
          company?: string | null;
          industry?: string | null;
          years_experience?: number | null;
          work_location?: string | null;
          work_mode?: Database['public']['Enums']['work_mode'] | null;
          smoking?: Database['public']['Enums']['smoking_habit'] | null;
          drinking?: Database['public']['Enums']['drinking_habit'] | null;
          diet?: Database['public']['Enums']['diet_preference'] | null;
          exercise?: Database['public']['Enums']['exercise_habit'] | null;
          sleep?: Database['public']['Enums']['sleep_schedule'] | null;
          pets?: Database['public']['Enums']['pet_preference'] | null;
          prompts?: Json;
          hidden_fields?: string[];
          onboarding_step?: string | null;
          created_at?: string;
          updated_at?: string;
          relationship_goal?: Database['public']['Enums']['relationship_goal'] | null;
          children_plan?: Database['public']['Enums']['children_plan'] | null;
          partner_values?: string[];
          marriage_timeline?: Database['public']['Enums']['marriage_timeline'] | null;
          marital_status?: Database['public']['Enums']['marital_status'] | null;
          religion?: Database['public']['Enums']['religion'] | null;
          faith_importance?: Database['public']['Enums']['importance_level'] | null;
          living_arrangement?: Database['public']['Enums']['living_arrangement'] | null;
          family_involvement?: Database['public']['Enums']['family_involvement'] | null;
          open_to_relocate?: Database['public']['Enums']['relocation_openness'] | null;
          cofounder_role?: Database['public']['Enums']['cofounder_role'] | null;
          startup_stage?: Database['public']['Enums']['startup_stage'] | null;
          founder_skills?: Database['public']['Enums']['founder_skill'][];
          seeking_skills?: Database['public']['Enums']['founder_skill'][];
          founder_commitment?: Database['public']['Enums']['founder_commitment'] | null;
          startup_industries?: string[];
          funding_plan?: Database['public']['Enums']['funding_plan'] | null;
        };
        Update: {
          member_id?: string;
          last_name?: string | null;
          pronouns?: string | null;
          hometown?: string | null;
          languages?: string[];
          occupation_status?: Database['public']['Enums']['occupation_status'] | null;
          education_level?: Database['public']['Enums']['education_level'] | null;
          institution?: string | null;
          degree?: string | null;
          field_of_study?: string | null;
          graduation_year?: number | null;
          study_year?: number | null;
          study_mode?: Database['public']['Enums']['study_mode'] | null;
          previous_education?: string | null;
          internship?: string | null;
          career_interests?: string[];
          skills?: string[];
          occupation?: string | null;
          job_title?: string | null;
          company?: string | null;
          industry?: string | null;
          years_experience?: number | null;
          work_location?: string | null;
          work_mode?: Database['public']['Enums']['work_mode'] | null;
          smoking?: Database['public']['Enums']['smoking_habit'] | null;
          drinking?: Database['public']['Enums']['drinking_habit'] | null;
          diet?: Database['public']['Enums']['diet_preference'] | null;
          exercise?: Database['public']['Enums']['exercise_habit'] | null;
          sleep?: Database['public']['Enums']['sleep_schedule'] | null;
          pets?: Database['public']['Enums']['pet_preference'] | null;
          prompts?: Json;
          hidden_fields?: string[];
          onboarding_step?: string | null;
          created_at?: string;
          updated_at?: string;
          relationship_goal?: Database['public']['Enums']['relationship_goal'] | null;
          children_plan?: Database['public']['Enums']['children_plan'] | null;
          partner_values?: string[];
          marriage_timeline?: Database['public']['Enums']['marriage_timeline'] | null;
          marital_status?: Database['public']['Enums']['marital_status'] | null;
          religion?: Database['public']['Enums']['religion'] | null;
          faith_importance?: Database['public']['Enums']['importance_level'] | null;
          living_arrangement?: Database['public']['Enums']['living_arrangement'] | null;
          family_involvement?: Database['public']['Enums']['family_involvement'] | null;
          open_to_relocate?: Database['public']['Enums']['relocation_openness'] | null;
          cofounder_role?: Database['public']['Enums']['cofounder_role'] | null;
          startup_stage?: Database['public']['Enums']['startup_stage'] | null;
          founder_skills?: Database['public']['Enums']['founder_skill'][];
          seeking_skills?: Database['public']['Enums']['founder_skill'][];
          founder_commitment?: Database['public']['Enums']['founder_commitment'] | null;
          startup_industries?: string[];
          funding_plan?: Database['public']['Enums']['funding_plan'] | null;
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
          onboarding_completed_at: string | null;
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
          onboarding_completed_at?: string | null;
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
          onboarding_completed_at?: string | null;
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
      valid_list_items: {
        Args: {
          items: string[];
          max_length: number;
        };
        Returns: boolean;
      };
      valid_profile_prompts: {
        Args: {
          p: Json;
        };
        Returns: boolean;
      };
    };
    Enums: {
      cafe_status: 'prospect' | 'active' | 'paused' | 'ended';
      children_plan:
        'want' | 'dont_want' | 'have_want_more' | 'have_dont_want_more' | 'open' | 'not_sure';
      cofounder_role: 'have_startup' | 'want_to_join' | 'either';
      decision_kind: 'pass' | 'like';
      device_platform: 'ios' | 'android' | 'web';
      diet_preference:
        | 'vegetarian'
        | 'eggetarian'
        | 'non_vegetarian'
        | 'vegan'
        | 'jain'
        | 'other'
        | 'prefer_not_to_say';
      drinking_habit: 'never' | 'socially' | 'regularly' | 'prefer_not_to_say';
      education_level:
        | 'high_school'
        | 'diploma'
        | 'bachelors'
        | 'masters'
        | 'doctorate'
        | 'other'
        | 'prefer_not_to_say';
      exercise_habit: 'never' | 'sometimes' | 'regularly' | 'daily';
      family_involvement: 'my_decision' | 'family_involved' | 'family_led';
      founder_commitment: 'full_time_now' | 'full_time_soon' | 'part_time';
      founder_skill:
        | 'engineering'
        | 'product'
        | 'design'
        | 'sales'
        | 'marketing'
        | 'operations'
        | 'finance'
        | 'domain_expert';
      funding_plan: 'bootstrapping' | 'raised' | 'planning_to_raise' | 'can_invest' | 'not_sure';
      gender: 'woman' | 'man' | 'non_binary' | 'other' | 'prefer_not_to_say';
      importance_level: 'very' | 'somewhat' | 'not_really';
      living_arrangement: 'with_family' | 'on_our_own' | 'open' | 'not_sure';
      marital_status: 'never_married' | 'divorced' | 'separated' | 'widowed' | 'prefer_not_to_say';
      marriage_timeline: 'within_1_year' | 'one_to_two_years' | 'two_to_three_years' | 'not_sure';
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
      occupation_status: 'working' | 'studying' | 'both' | 'neither' | 'prefer_not_to_say';
      payment_order_status: 'created' | 'attempted' | 'paid';
      payment_status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
      pet_preference: 'have_pets' | 'want_pets' | 'no_pets' | 'allergic';
      photo_moderation: 'pending' | 'approved' | 'rejected';
      refund_speed: 'normal' | 'optimum';
      refund_status: 'pending' | 'processed' | 'failed';
      relationship_goal:
        | 'long_term'
        | 'long_term_open_to_short'
        | 'short_term_open_to_long'
        | 'short_term'
        | 'figuring_out';
      religion:
        | 'hindu'
        | 'muslim'
        | 'christian'
        | 'sikh'
        | 'jain'
        | 'buddhist'
        | 'parsi'
        | 'jewish'
        | 'spiritual'
        | 'not_religious'
        | 'other'
        | 'prefer_not_to_say';
      relocation_openness: 'yes' | 'maybe' | 'no';
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
      sleep_schedule: 'early_bird' | 'night_owl' | 'varies';
      smoking_habit: 'never' | 'socially' | 'regularly' | 'trying_to_quit' | 'prefer_not_to_say';
      startup_stage: 'idea' | 'prototype' | 'launched' | 'revenue';
      study_mode: 'full_time' | 'part_time';
      verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
      work_mode: 'on_site' | 'hybrid' | 'remote' | 'flexible';
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
          onboarding_completed_at: string | null;
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
      my_profile_details: {
        Row: {
          member_id: string | null;
          last_name: string | null;
          pronouns: string | null;
          hometown: string | null;
          languages: string[] | null;
          occupation_status: Database['public']['Enums']['occupation_status'] | null;
          education_level: Database['public']['Enums']['education_level'] | null;
          institution: string | null;
          degree: string | null;
          field_of_study: string | null;
          graduation_year: number | null;
          study_year: number | null;
          study_mode: Database['public']['Enums']['study_mode'] | null;
          previous_education: string | null;
          internship: string | null;
          career_interests: string[] | null;
          skills: string[] | null;
          occupation: string | null;
          job_title: string | null;
          company: string | null;
          industry: string | null;
          years_experience: number | null;
          work_location: string | null;
          work_mode: Database['public']['Enums']['work_mode'] | null;
          smoking: Database['public']['Enums']['smoking_habit'] | null;
          drinking: Database['public']['Enums']['drinking_habit'] | null;
          diet: Database['public']['Enums']['diet_preference'] | null;
          exercise: Database['public']['Enums']['exercise_habit'] | null;
          sleep: Database['public']['Enums']['sleep_schedule'] | null;
          pets: Database['public']['Enums']['pet_preference'] | null;
          prompts: Json | null;
          hidden_fields: string[] | null;
          onboarding_step: string | null;
          created_at: string | null;
          updated_at: string | null;
          relationship_goal: Database['public']['Enums']['relationship_goal'] | null;
          children_plan: Database['public']['Enums']['children_plan'] | null;
          partner_values: string[] | null;
          marriage_timeline: Database['public']['Enums']['marriage_timeline'] | null;
          marital_status: Database['public']['Enums']['marital_status'] | null;
          religion: Database['public']['Enums']['religion'] | null;
          faith_importance: Database['public']['Enums']['importance_level'] | null;
          living_arrangement: Database['public']['Enums']['living_arrangement'] | null;
          family_involvement: Database['public']['Enums']['family_involvement'] | null;
          open_to_relocate: Database['public']['Enums']['relocation_openness'] | null;
          cofounder_role: Database['public']['Enums']['cofounder_role'] | null;
          startup_stage: Database['public']['Enums']['startup_stage'] | null;
          founder_skills: Database['public']['Enums']['founder_skill'][] | null;
          seeking_skills: Database['public']['Enums']['founder_skill'][] | null;
          founder_commitment: Database['public']['Enums']['founder_commitment'] | null;
          startup_industries: string[] | null;
          funding_plan: Database['public']['Enums']['funding_plan'] | null;
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
      complete_my_onboarding: {
        Args: Record<never, never>;
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
      profile_details_for: {
        Args: {
          p_member_id: string;
        };
        Returns: unknown[];
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
