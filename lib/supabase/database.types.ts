export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_connection: {
        Row: {
          base_url: string | null
          company_id: string
          key_hint: string | null
          model: string
          monthly_limit_cents: number
          provider: string
          status: string
          tested_at: string | null
          vault_secret_id: string | null
        }
        Insert: {
          base_url?: string | null
          company_id: string
          key_hint?: string | null
          model: string
          monthly_limit_cents?: number
          provider: string
          status?: string
          tested_at?: string | null
          vault_secret_id?: string | null
        }
        Update: {
          base_url?: string | null
          company_id?: string
          key_hint?: string | null
          model?: string
          monthly_limit_cents?: number
          provider?: string
          status?: string
          tested_at?: string | null
          vault_secret_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_connection_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          company_id: string
          cost_estimate_cents: number | null
          created_at: string
          feature: string
          id: number
          input_tokens: number | null
          output_tokens: number | null
        }
        Insert: {
          company_id: string
          cost_estimate_cents?: number | null
          created_at?: string
          feature: string
          id?: never
          input_tokens?: number | null
          output_tokens?: number | null
        }
        Update: {
          company_id?: string
          cost_estimate_cents?: number | null
          created_at?: string
          feature?: string
          id?: never
          input_tokens?: number | null
          output_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_item: {
        Row: {
          agent: string
          company_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          payload: Json
          reasoning: string | null
          status: string
          title: string
        }
        Insert: {
          agent: string
          company_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          payload: Json
          reasoning?: string | null
          status?: string
          title: string
        }
        Update: {
          agent?: string
          company_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          payload?: Json
          reasoning?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_item_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_item_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_kind: string
          actor_profile_id: string | null
          after: Json | null
          before: Json | null
          company_id: string
          created_at: string
          id: number
          row_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_kind?: string
          actor_profile_id?: string | null
          after?: Json | null
          before?: Json | null
          company_id: string
          created_at?: string
          id?: never
          row_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_kind?: string
          actor_profile_id?: string | null
          after?: Json | null
          before?: Json | null
          company_id?: string
          created_at?: string
          id?: never
          row_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      charge: {
        Row: {
          amount_cents: number
          charge_type: string
          company_id: string
          created_at: string
          description: string
          due_date: string
          id: string
          journal_entry_id: string | null
          lease_id: string
        }
        Insert: {
          amount_cents: number
          charge_type: string
          company_id: string
          created_at?: string
          description: string
          due_date: string
          id?: string
          journal_entry_id?: string | null
          lease_id: string
        }
        Update: {
          amount_cents?: number
          charge_type?: string
          company_id?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          journal_entry_id?: string | null
          lease_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "charge_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
        ]
      }
      company: {
        Row: {
          address: string | null
          created_at: string
          default_county: string | null
          id: string
          legal_name: string | null
          name: string
          office_email: string | null
          office_phone: string | null
          settings: Json
          subdomain: string | null
          time_zone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          default_county?: string | null
          id?: string
          legal_name?: string | null
          name: string
          office_email?: string | null
          office_phone?: string | null
          settings?: Json
          subdomain?: string | null
          time_zone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          default_county?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          office_email?: string | null
          office_phone?: string | null
          settings?: Json
          subdomain?: string | null
          time_zone?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_name: string | null
          city: string | null
          company_id: string
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          kind: string
          last_name: string | null
          mobile: string | null
          notes: string | null
          phone: string | null
          portal_profile_id: string | null
          postal_code: string | null
          preferred_contact: string | null
          sms_opt_in: boolean
          sms_opt_in_at: string | null
          sms_opt_out_at: string | null
          state: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          business_name?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          kind: string
          last_name?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          portal_profile_id?: string | null
          postal_code?: string | null
          preferred_contact?: string | null
          sms_opt_in?: boolean
          sms_opt_in_at?: string | null
          sms_opt_out_at?: string | null
          state?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          business_name?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          kind?: string
          last_name?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          portal_profile_id?: string | null
          postal_code?: string | null
          preferred_contact?: string | null
          sms_opt_in?: boolean
          sms_opt_in_at?: string | null
          sms_opt_out_at?: string | null
          state?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_portal_profile_id_fkey"
            columns: ["portal_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      document: {
        Row: {
          category: string
          company_id: string
          contact_id: string | null
          created_at: string
          file_name: string
          id: string
          lease_id: string | null
          property_id: string | null
          source: string | null
          storage_path: string
          uploaded_by: string | null
          work_order_id: string | null
        }
        Insert: {
          category?: string
          company_id: string
          contact_id?: string | null
          created_at?: string
          file_name: string
          id?: string
          lease_id?: string | null
          property_id?: string | null
          source?: string | null
          storage_path: string
          uploaded_by?: string | null
          work_order_id?: string | null
        }
        Update: {
          category?: string
          company_id?: string
          contact_id?: string | null
          created_at?: string
          file_name?: string
          id?: string
          lease_id?: string | null
          property_id?: string | null
          source?: string | null
          storage_path?: string
          uploaded_by?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contact: {
        Row: {
          company_id: string
          id: string
          name: string
          phone: string
          relationship: string | null
          tenant_contact_id: string
          updated_at: string
          updated_source: string
        }
        Insert: {
          company_id: string
          id?: string
          name: string
          phone: string
          relationship?: string | null
          tenant_contact_id: string
          updated_at?: string
          updated_source?: string
        }
        Update: {
          company_id?: string
          id?: string
          name?: string
          phone?: string
          relationship?: string | null
          tenant_contact_id?: string
          updated_at?: string
          updated_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contact_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_contact_tenant_contact_id_fkey"
            columns: ["tenant_contact_id"]
            isOneToOne: false
            referencedRelation: "contact"
            referencedColumns: ["id"]
          },
        ]
      }
      entity: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          entity_type: string | null
          id: string
          mailing_address: string | null
          management_fee: Json
          name: string
          notes: string | null
          phone: string | null
          tax_id_last4: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          entity_type?: string | null
          id?: string
          mailing_address?: string | null
          management_fee?: Json
          name: string
          notes?: string | null
          phone?: string | null
          tax_id_last4?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          entity_type?: string | null
          id?: string
          mailing_address?: string | null
          management_fee?: Json
          name?: string
          notes?: string | null
          phone?: string | null
          tax_id_last4?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_account: {
        Row: {
          company_id: string
          id: string
          is_trust: boolean
          name: string
          number: string
          type: string
        }
        Insert: {
          company_id: string
          id?: string
          is_trust?: boolean
          name: string
          number: string
          type: string
        }
        Update: {
          company_id?: string
          id?: string
          is_trust?: boolean
          name?: string
          number?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "gl_account_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          all_properties: boolean
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          property_ids: string[]
          role: Database["public"]["Enums"]["member_role"]
          status: string
          title: string | null
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          all_properties?: boolean
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          property_ids?: string[]
          role?: Database["public"]["Enums"]["member_role"]
          status?: string
          title?: string | null
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          all_properties?: boolean
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          property_ids?: string[]
          role?: Database["public"]["Enums"]["member_role"]
          status?: string
          title?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          entity_id: string
          entry_date: string
          id: string
          memo: string
          posted_at: string | null
          reversal_of: string | null
          source: string
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          entry_date: string
          id?: string
          memo: string
          posted_at?: string | null
          reversal_of?: string | null
          source?: string
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entry_date?: string
          id?: string
          memo?: string
          posted_at?: string | null
          reversal_of?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "journal_entry"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_line: {
        Row: {
          company_id: string
          credit_cents: number
          debit_cents: number
          gl_account_id: string
          id: string
          journal_entry_id: string
          memo: string | null
          property_id: string | null
          unit_id: string | null
        }
        Insert: {
          company_id: string
          credit_cents?: number
          debit_cents?: number
          gl_account_id: string
          id?: string
          journal_entry_id: string
          memo?: string | null
          property_id?: string | null
          unit_id?: string | null
        }
        Update: {
          company_id?: string
          credit_cents?: number
          debit_cents?: number
          gl_account_id?: string
          id?: string
          journal_entry_id?: string
          memo?: string | null
          property_id?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_line_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_line_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_line_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_line_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_line_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit"
            referencedColumns: ["id"]
          },
        ]
      }
      lease: {
        Row: {
          autopay: boolean
          certified_funds_only: boolean
          commercial_lease_type: string | null
          company_id: string
          created_at: string
          deposit_cents: number
          deposit_pending_cents: number
          email_notices_agreed: boolean
          end_date: string | null
          id: string
          late_fee_basis: string | null
          late_fee_daily_cents: number | null
          late_fee_daily_max_cents: number | null
          late_fee_flat_cents: number | null
          late_fee_grace_days: number | null
          late_fee_pct: number | null
          move_in_on: string | null
          move_out_on: string | null
          next_rent_cents: number | null
          next_rent_increase_on: string | null
          notes: string | null
          nsf_fee_cents: number | null
          opening_balance_as_of: string | null
          opening_balance_cents: number | null
          rent_cents: number
          rent_reminders: boolean
          short_term_surcharge_cents: number
          start_date: string
          status: string
          term_months: number | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          autopay?: boolean
          certified_funds_only?: boolean
          commercial_lease_type?: string | null
          company_id: string
          created_at?: string
          deposit_cents?: number
          deposit_pending_cents?: number
          email_notices_agreed?: boolean
          end_date?: string | null
          id?: string
          late_fee_basis?: string | null
          late_fee_daily_cents?: number | null
          late_fee_daily_max_cents?: number | null
          late_fee_flat_cents?: number | null
          late_fee_grace_days?: number | null
          late_fee_pct?: number | null
          move_in_on?: string | null
          move_out_on?: string | null
          next_rent_cents?: number | null
          next_rent_increase_on?: string | null
          notes?: string | null
          nsf_fee_cents?: number | null
          opening_balance_as_of?: string | null
          opening_balance_cents?: number | null
          rent_cents: number
          rent_reminders?: boolean
          short_term_surcharge_cents?: number
          start_date: string
          status?: string
          term_months?: number | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          autopay?: boolean
          certified_funds_only?: boolean
          commercial_lease_type?: string | null
          company_id?: string
          created_at?: string
          deposit_cents?: number
          deposit_pending_cents?: number
          email_notices_agreed?: boolean
          end_date?: string | null
          id?: string
          late_fee_basis?: string | null
          late_fee_daily_cents?: number | null
          late_fee_daily_max_cents?: number | null
          late_fee_flat_cents?: number | null
          late_fee_grace_days?: number | null
          late_fee_pct?: number | null
          move_in_on?: string | null
          move_out_on?: string | null
          next_rent_cents?: number | null
          next_rent_increase_on?: string | null
          notes?: string | null
          nsf_fee_cents?: number | null
          opening_balance_as_of?: string | null
          opening_balance_cents?: number | null
          rent_cents?: number
          rent_reminders?: boolean
          short_term_surcharge_cents?: number
          start_date?: string
          status?: string
          term_months?: number | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_tenant: {
        Row: {
          company_id: string
          contact_id: string
          is_primary: boolean
          lease_id: string
          role: string
        }
        Insert: {
          company_id: string
          contact_id: string
          is_primary?: boolean
          lease_id: string
          role?: string
        }
        Update: {
          company_id?: string
          contact_id?: string
          is_primary?: boolean
          lease_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_tenant_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_tenant_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_tenant_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
        ]
      }
      membership: {
        Row: {
          all_properties: boolean
          company_id: string
          created_at: string
          id: string
          profile_id: string
          role: Database["public"]["Enums"]["member_role"]
          status: string
          title: string | null
        }
        Insert: {
          all_properties?: boolean
          company_id: string
          created_at?: string
          id?: string
          profile_id: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: string
          title?: string | null
        }
        Update: {
          all_properties?: boolean
          company_id?: string
          created_at?: string
          id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_property: {
        Row: {
          membership_id: string
          property_id: string
        }
        Insert: {
          membership_id: string
          property_id: string
        }
        Update: {
          membership_id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_property_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_property_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["id"]
          },
        ]
      }
      message: {
        Row: {
          body: string
          channel: string
          company_id: string
          contact_id: string | null
          created_at: string
          direction: string
          id: string
          provider_ref: string | null
          sender_membership_id: string | null
          sender_name: string | null
          sender_title: string | null
          status: string
          thread_key: string
        }
        Insert: {
          body: string
          channel: string
          company_id: string
          contact_id?: string | null
          created_at?: string
          direction: string
          id?: string
          provider_ref?: string | null
          sender_membership_id?: string | null
          sender_name?: string | null
          sender_title?: string | null
          status?: string
          thread_key: string
        }
        Update: {
          body?: string
          channel?: string
          company_id?: string
          contact_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          provider_ref?: string | null
          sender_membership_id?: string | null
          sender_name?: string | null
          sender_title?: string | null
          status?: string
          thread_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_sender_membership_id_fkey"
            columns: ["sender_membership_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_snapshot: {
        Row: {
          company_id: string
          metric_key: string
          on_date: string
          scope_key: string
          value: number
        }
        Insert: {
          company_id: string
          metric_key: string
          on_date: string
          scope_key?: string
          value: number
        }
        Update: {
          company_id?: string
          metric_key?: string
          on_date?: string
          scope_key?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "metric_snapshot_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_target: {
        Row: {
          alert: boolean
          company_id: string
          metric_key: string
          target: number
        }
        Insert: {
          alert?: boolean
          company_id: string
          metric_key: string
          target: number
        }
        Update: {
          alert?: boolean
          company_id?: string
          metric_key?: string
          target?: number
        }
        Relationships: [
          {
            foreignKeyName: "metric_target_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      payment: {
        Row: {
          amount_cents: number
          company_id: string
          created_at: string
          fee_cents: number
          id: string
          journal_entry_id: string | null
          lease_id: string
          method: string
          processor_ref: string | null
          received_on: string
          status: string
        }
        Insert: {
          amount_cents: number
          company_id: string
          created_at?: string
          fee_cents?: number
          id?: string
          journal_entry_id?: string | null
          lease_id: string
          method: string
          processor_ref?: string | null
          received_on: string
          status?: string
        }
        Update: {
          amount_cents?: number
          company_id?: string
          created_at?: string
          fee_cents?: number
          id?: string
          journal_entry_id?: string | null
          lease_id?: string
          method?: string
          processor_ref?: string | null
          received_on?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
        ]
      }
      pet: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_assistance_animal: boolean
          kind: string
          lease_id: string
          name: string | null
          notes: string | null
          updated_at: string
          updated_source: string
          weight_lbs: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_assistance_animal?: boolean
          kind: string
          lease_id: string
          name?: string | null
          notes?: string | null
          updated_at?: string
          updated_source?: string
          weight_lbs?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_assistance_animal?: boolean
          kind?: string
          lease_id?: string
          name?: string | null
          notes?: string | null
          updated_at?: string
          updated_source?: string
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          preferences: Json
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          preferences?: Json
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          preferences?: Json
        }
        Relationships: []
      }
      property: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          amenities: string[]
          city: string | null
          company_id: string
          county: string | null
          created_at: string
          entity_id: string
          id: string
          kind: string
          lease_settings: Json
          management_fee: Json | null
          name: string
          notes: string | null
          postal_code: string | null
          property_type: string | null
          state: string | null
          updated_at: string
          year_built: number | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          amenities?: string[]
          city?: string | null
          company_id: string
          county?: string | null
          created_at?: string
          entity_id: string
          id?: string
          kind: string
          lease_settings?: Json
          management_fee?: Json | null
          name: string
          notes?: string | null
          postal_code?: string | null
          property_type?: string | null
          state?: string | null
          updated_at?: string
          year_built?: number | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          amenities?: string[]
          city?: string | null
          company_id?: string
          county?: string | null
          created_at?: string
          entity_id?: string
          id?: string
          kind?: string
          lease_settings?: Json
          management_fee?: Json | null
          name?: string
          notes?: string | null
          postal_code?: string | null
          property_type?: string | null
          state?: string | null
          updated_at?: string
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "property_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
        ]
      }
      property_owner: {
        Row: {
          company_id: string
          id: string
          owner_contact_id: string
          ownership_pct: number
          property_id: string
        }
        Insert: {
          company_id: string
          id?: string
          owner_contact_id: string
          ownership_pct: number
          property_id: string
        }
        Update: {
          company_id?: string
          id?: string
          owner_contact_id?: string
          ownership_pct?: number
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_owner_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owner_owner_contact_id_fkey"
            columns: ["owner_contact_id"]
            isOneToOne: false
            referencedRelation: "contact"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owner_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_charge: {
        Row: {
          amount_cents: number
          charge_type: string
          company_id: string
          created_at: string
          description: string
          ends_on: string | null
          id: string
          lease_id: string
          starts_on: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          charge_type?: string
          company_id: string
          created_at?: string
          description: string
          ends_on?: string | null
          id?: string
          lease_id: string
          starts_on?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          charge_type?: string
          company_id?: string
          created_at?: string
          description?: string
          ends_on?: string | null
          id?: string
          lease_id?: string
          starts_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_charge_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_charge_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
        ]
      }
      renters_insurance: {
        Row: {
          carrier: string | null
          company_id: string
          company_is_interested_party: boolean
          document_id: string | null
          expires_on: string | null
          id: string
          lease_id: string | null
          liability_cents: number | null
          policy_number: string | null
          status: string
          tenant_contact_id: string
          updated_at: string
          updated_source: string
        }
        Insert: {
          carrier?: string | null
          company_id: string
          company_is_interested_party?: boolean
          document_id?: string | null
          expires_on?: string | null
          id?: string
          lease_id?: string | null
          liability_cents?: number | null
          policy_number?: string | null
          status?: string
          tenant_contact_id: string
          updated_at?: string
          updated_source?: string
        }
        Update: {
          carrier?: string | null
          company_id?: string
          company_is_interested_party?: boolean
          document_id?: string | null
          expires_on?: string | null
          id?: string
          lease_id?: string | null
          liability_cents?: number | null
          policy_number?: string | null
          status?: string
          tenant_contact_id?: string
          updated_at?: string
          updated_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "renters_insurance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renters_insurance_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renters_insurance_tenant_contact_id_fkey"
            columns: ["tenant_contact_id"]
            isOneToOne: false
            referencedRelation: "contact"
            referencedColumns: ["id"]
          },
        ]
      }
      reserved_subdomain: {
        Row: {
          name: string
        }
        Insert: {
          name: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      scheduled_report: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          format: string
          frequency: string
          id: string
          next_send_at: string | null
          recipients: Json
          report_key: string
          scope: Json
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          format: string
          frequency: string
          id?: string
          next_send_at?: string | null
          recipients: Json
          report_key: string
          scope?: Json
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          format?: string
          frequency?: string
          id?: string
          next_send_at?: string | null
          recipients?: Json
          report_key?: string
          scope?: Json
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_report_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      unit: {
        Row: {
          access_notes: string | null
          amenities: string[]
          baths: number | null
          beds: number | null
          company_id: string
          created_at: string
          id: string
          kind: string
          label: string
          market_rent_cents: number | null
          notes: string | null
          property_id: string
          sqft: number | null
          status: string
          updated_at: string
        }
        Insert: {
          access_notes?: string | null
          amenities?: string[]
          baths?: number | null
          beds?: number | null
          company_id: string
          created_at?: string
          id?: string
          kind: string
          label: string
          market_rent_cents?: number | null
          notes?: string | null
          property_id: string
          sqft?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          access_notes?: string | null
          amenities?: string[]
          baths?: number | null
          beds?: number | null
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          label?: string
          market_rent_cents?: number | null
          notes?: string | null
          property_id?: string
          sqft?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle: {
        Row: {
          color: string | null
          company_id: string
          id: string
          lease_id: string | null
          make_model: string | null
          parking_permit_number: string | null
          tag_number: string | null
          tag_state: string | null
          tenant_contact_id: string
          updated_at: string
          updated_source: string
        }
        Insert: {
          color?: string | null
          company_id: string
          id?: string
          lease_id?: string | null
          make_model?: string | null
          parking_permit_number?: string | null
          tag_number?: string | null
          tag_state?: string | null
          tenant_contact_id: string
          updated_at?: string
          updated_source?: string
        }
        Update: {
          color?: string | null
          company_id?: string
          id?: string
          lease_id?: string | null
          make_model?: string | null
          parking_permit_number?: string | null
          tag_number?: string | null
          tag_state?: string | null
          tenant_contact_id?: string
          updated_at?: string
          updated_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_tenant_contact_id_fkey"
            columns: ["tenant_contact_id"]
            isOneToOne: false
            referencedRelation: "contact"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor: {
        Row: {
          auto_insurance_expires_on: string | null
          coi_expires_on: string | null
          company_id: string
          contact_id: string
          contract_expires_on: string | null
          created_at: string
          dispatch_override: boolean
          epa_cert_expires_on: string | null
          id: string
          is_1099: boolean
          is_active: boolean
          is_in_house: boolean
          last_paid_on: string | null
          license_expires_on: string | null
          notes: string | null
          payment_method: string | null
          trade: string | null
          updated_at: string
          w9_on_file: boolean
          w9_received_on: string | null
          workers_comp_expires_on: string | null
        }
        Insert: {
          auto_insurance_expires_on?: string | null
          coi_expires_on?: string | null
          company_id: string
          contact_id: string
          contract_expires_on?: string | null
          created_at?: string
          dispatch_override?: boolean
          epa_cert_expires_on?: string | null
          id?: string
          is_1099?: boolean
          is_active?: boolean
          is_in_house?: boolean
          last_paid_on?: string | null
          license_expires_on?: string | null
          notes?: string | null
          payment_method?: string | null
          trade?: string | null
          updated_at?: string
          w9_on_file?: boolean
          w9_received_on?: string | null
          workers_comp_expires_on?: string | null
        }
        Update: {
          auto_insurance_expires_on?: string | null
          coi_expires_on?: string | null
          company_id?: string
          contact_id?: string
          contract_expires_on?: string | null
          created_at?: string
          dispatch_override?: boolean
          epa_cert_expires_on?: string | null
          id?: string
          is_1099?: boolean
          is_active?: boolean
          is_in_house?: boolean
          last_paid_on?: string | null
          license_expires_on?: string | null
          notes?: string | null
          payment_method?: string | null
          trade?: string | null
          updated_at?: string
          w9_on_file?: boolean
          w9_received_on?: string | null
          workers_comp_expires_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order: {
        Row: {
          ai_summary: string | null
          company_id: string
          completed_at: string | null
          cost_cents: number | null
          created_at: string
          emergency_ack: Json | null
          entry_basis: string | null
          entry_notice_at: string | null
          entry_notice_method: string | null
          entry_ok: boolean | null
          id: string
          number: number
          pets_in_home: boolean | null
          priority: string
          priority_reason: string | null
          property_id: string
          reported_by_contact_id: string | null
          resolution: string | null
          room: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          self_resolved: boolean
          source: string
          status: string
          tech_arrived_at: string | null
          tenant_note: string | null
          title: string
          triage_answers: Json
          triage_category: string | null
          triage_item: string | null
          triage_symptom: string | null
          unit_id: string | null
          updated_at: string
          vendor_id: string | null
          vendor_notified_at: string | null
        }
        Insert: {
          ai_summary?: string | null
          company_id: string
          completed_at?: string | null
          cost_cents?: number | null
          created_at?: string
          emergency_ack?: Json | null
          entry_basis?: string | null
          entry_notice_at?: string | null
          entry_notice_method?: string | null
          entry_ok?: boolean | null
          id?: string
          number?: number
          pets_in_home?: boolean | null
          priority?: string
          priority_reason?: string | null
          property_id: string
          reported_by_contact_id?: string | null
          resolution?: string | null
          room?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          self_resolved?: boolean
          source?: string
          status?: string
          tech_arrived_at?: string | null
          tenant_note?: string | null
          title: string
          triage_answers?: Json
          triage_category?: string | null
          triage_item?: string | null
          triage_symptom?: string | null
          unit_id?: string | null
          updated_at?: string
          vendor_id?: string | null
          vendor_notified_at?: string | null
        }
        Update: {
          ai_summary?: string | null
          company_id?: string
          completed_at?: string | null
          cost_cents?: number | null
          created_at?: string
          emergency_ack?: Json | null
          entry_basis?: string | null
          entry_notice_at?: string | null
          entry_notice_method?: string | null
          entry_ok?: boolean | null
          id?: string
          number?: number
          pets_in_home?: boolean | null
          priority?: string
          priority_reason?: string | null
          property_id?: string
          reported_by_contact_id?: string | null
          resolution?: string | null
          room?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          self_resolved?: boolean
          source?: string
          status?: string
          tech_arrived_at?: string | null
          tenant_note?: string | null
          title?: string
          triage_answers?: Json
          triage_category?: string | null
          triage_item?: string | null
          triage_symptom?: string | null
          unit_id?: string | null
          updated_at?: string
          vendor_id?: string | null
          vendor_notified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_order_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_reported_by_contact_id_fkey"
            columns: ["reported_by_contact_id"]
            isOneToOne: false
            referencedRelation: "contact"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_event: {
        Row: {
          actor_profile_id: string | null
          company_id: string
          created_at: string
          detail: Json
          id: string
          kind: string
          work_order_id: string
        }
        Insert: {
          actor_profile_id?: string | null
          company_id: string
          created_at?: string
          detail?: Json
          id?: string
          kind: string
          work_order_id: string
        }
        Update: {
          actor_profile_id?: string | null
          company_id?: string
          created_at?: string
          detail?: Json
          id?: string
          kind?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_event_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_event_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_event_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      company_by_subdomain: {
        Args: { p_subdomain: string }
        Returns: {
          id: string
          name: string
          office_phone: string
        }[]
      }
      create_company: {
        Args: { p_name: string; p_subdomain: string; p_time_zone?: string }
        Returns: string
      }
      has_role: {
        Args: {
          cid: string
          roles: Database["public"]["Enums"]["member_role"][]
        }
        Returns: boolean
      }
      is_member: { Args: { cid: string }; Returns: boolean }
      shares_company: { Args: { pid: string }; Returns: boolean }
      subdomain_available: { Args: { p_subdomain: string }; Returns: boolean }
    }
    Enums: {
      member_role:
        | "admin"
        | "property_manager"
        | "accountant"
        | "maintenance_coordinator"
        | "leasing_agent"
        | "read_only"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      member_role: [
        "admin",
        "property_manager",
        "accountant",
        "maintenance_coordinator",
        "leasing_agent",
        "read_only",
      ],
    },
  },
} as const
