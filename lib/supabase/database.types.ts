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
      agreement_template: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          parts: Json
          source_name: string | null
          source_path: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parts?: Json
          source_name?: string | null
          source_path?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parts?: Json
          source_name?: string | null
          source_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_template_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_template_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
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
      api_key: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          prefix: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          prefix: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "api_key_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_key_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      application: {
        Row: {
          admin_fee_refunded_cents: number
          adverse_action_sent_at: string | null
          adverse_agency: Json | null
          answers: Json
          company_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          decision_note: string | null
          deposit_cents: number | null
          desired_move_in: string | null
          fees_due_cents: number
          fees_paid_cents: number
          guest_card_id: string | null
          id: string
          kind: string
          lease_id: string | null
          payment_ref: string | null
          recommendation: Json | null
          rent_cents: number
          status: string
          submitted_at: string | null
          unit_id: string
        }
        Insert: {
          admin_fee_refunded_cents?: number
          adverse_action_sent_at?: string | null
          adverse_agency?: Json | null
          answers?: Json
          company_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_note?: string | null
          deposit_cents?: number | null
          desired_move_in?: string | null
          fees_due_cents?: number
          fees_paid_cents?: number
          guest_card_id?: string | null
          id?: string
          kind: string
          lease_id?: string | null
          payment_ref?: string | null
          recommendation?: Json | null
          rent_cents: number
          status?: string
          submitted_at?: string | null
          unit_id: string
        }
        Update: {
          admin_fee_refunded_cents?: number
          adverse_action_sent_at?: string | null
          adverse_agency?: Json | null
          answers?: Json
          company_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_note?: string | null
          deposit_cents?: number | null
          desired_move_in?: string | null
          fees_due_cents?: number
          fees_paid_cents?: number
          guest_card_id?: string | null
          id?: string
          kind?: string
          lease_id?: string | null
          payment_ref?: string | null
          recommendation?: Json | null
          rent_cents?: number
          status?: string
          submitted_at?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_guest_card_id_fkey"
            columns: ["guest_card_id"]
            isOneToOne: false
            referencedRelation: "guest_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit"
            referencedColumns: ["id"]
          },
        ]
      }
      application_member: {
        Row: {
          answers: Json
          application_id: string
          applied_at: string | null
          company_id: string
          created_at: string
          email: string | null
          first_name: string
          id: string
          invited_at: string
          last_name: string
          monthly_income_cents: number
          opened_at: string | null
          phone: string | null
          role: string
          status: string
          token_hash: string | null
        }
        Insert: {
          answers?: Json
          application_id: string
          applied_at?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          invited_at?: string
          last_name?: string
          monthly_income_cents?: number
          opened_at?: string | null
          phone?: string | null
          role?: string
          status?: string
          token_hash?: string | null
        }
        Update: {
          answers?: Json
          application_id?: string
          applied_at?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          invited_at?: string
          last_name?: string
          monthly_income_cents?: number
          opened_at?: string | null
          phone?: string | null
          role?: string
          status?: string
          token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_member_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "application"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_member_company_id_fkey"
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
      automation_task: {
        Row: {
          company_id: string
          created_at: string
          detail: string
          done_at: string | null
          done_by: string | null
          due_on: string | null
          id: string
          key: string
          kind: string
          lease_id: string | null
          letter_template: string | null
          status: string
          title: string
          work_order_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          detail?: string
          done_at?: string | null
          done_by?: string | null
          due_on?: string | null
          id?: string
          key: string
          kind: string
          lease_id?: string | null
          letter_template?: string | null
          status?: string
          title: string
          work_order_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          detail?: string
          done_at?: string | null
          done_by?: string | null
          due_on?: string | null
          id?: string
          key?: string
          kind?: string
          lease_id?: string | null
          letter_template?: string | null
          status?: string
          title?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_task_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_task_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_task_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_task_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
      autopay: {
        Row: {
          active: boolean
          bank_label: string | null
          company_id: string
          contact_id: string | null
          created_at: string
          day_of_month: number
          id: string
          last_result: string | null
          last_run_month: string | null
          lease_id: string
          max_cents: number | null
          stripe_account_id: string | null
          stripe_customer_id: string
          stripe_payment_method_id: string
        }
        Insert: {
          active?: boolean
          bank_label?: string | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          day_of_month?: number
          id?: string
          last_result?: string | null
          last_run_month?: string | null
          lease_id: string
          max_cents?: number | null
          stripe_account_id?: string | null
          stripe_customer_id: string
          stripe_payment_method_id: string
        }
        Update: {
          active?: boolean
          bank_label?: string | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          day_of_month?: number
          id?: string
          last_result?: string | null
          last_run_month?: string | null
          lease_id?: string
          max_cents?: number | null
          stripe_account_id?: string | null
          stripe_customer_id?: string
          stripe_payment_method_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopay_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopay_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopay_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_account: {
        Row: {
          company_id: string
          created_at: string
          entity_id: string
          fc_account_id: string | null
          fc_balance_as_of: string | null
          fc_balance_cents: number | null
          fc_institution: string | null
          fc_linked_at: string | null
          fc_status: string | null
          fc_synced_at: string | null
          gl_number: string
          id: string
          institution: string | null
          last4: string | null
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          entity_id: string
          fc_account_id?: string | null
          fc_balance_as_of?: string | null
          fc_balance_cents?: number | null
          fc_institution?: string | null
          fc_linked_at?: string | null
          fc_status?: string | null
          fc_synced_at?: string | null
          gl_number?: string
          id?: string
          institution?: string | null
          last4?: string | null
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          entity_id?: string
          fc_account_id?: string | null
          fc_balance_as_of?: string | null
          fc_balance_cents?: number | null
          fc_institution?: string | null
          fc_linked_at?: string | null
          fc_status?: string | null
          fc_synced_at?: string | null
          gl_number?: string
          id?: string
          institution?: string | null
          last4?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_account_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_account_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_cleared_line: {
        Row: {
          company_id: string
          journal_line_id: string
          reconciliation_id: string
        }
        Insert: {
          company_id: string
          journal_line_id: string
          reconciliation_id: string
        }
        Update: {
          company_id?: string
          journal_line_id?: string
          reconciliation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_cleared_line_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_cleared_line_journal_line_id_fkey"
            columns: ["journal_line_id"]
            isOneToOne: true
            referencedRelation: "journal_line"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_cleared_line_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "reconciliation"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_feed_usage: {
        Row: {
          balance_pulls: number
          company_id: string
          linked_accounts: number
          month: string
        }
        Insert: {
          balance_pulls?: number
          company_id: string
          linked_accounts?: number
          month: string
        }
        Update: {
          balance_pulls?: number
          company_id?: string
          linked_accounts?: number
          month?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_feed_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transaction: {
        Row: {
          amount_cents: number
          bank_account_id: string
          company_id: string
          created_at: string
          description: string
          fingerprint: string
          id: string
          journal_line_id: string | null
          posted_on: string
          status: string
        }
        Insert: {
          amount_cents: number
          bank_account_id: string
          company_id: string
          created_at?: string
          description: string
          fingerprint: string
          id?: string
          journal_line_id?: string | null
          posted_on: string
          status?: string
        }
        Update: {
          amount_cents?: number
          bank_account_id?: string
          company_id?: string
          created_at?: string
          description?: string
          fingerprint?: string
          id?: string
          journal_line_id?: string | null
          posted_on?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transaction_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transaction_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transaction_journal_line_id_fkey"
            columns: ["journal_line_id"]
            isOneToOne: false
            referencedRelation: "journal_line"
            referencedColumns: ["id"]
          },
        ]
      }
      bill: {
        Row: {
          amount_cents: number
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          document_id: string | null
          due_date: string | null
          entity_id: string | null
          expense_account: string
          from_email: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          journal_entry_id: string | null
          memo: string | null
          paid_entry_id: string | null
          paid_on: string | null
          payment_method: string | null
          payment_reference: string | null
          project_id: string | null
          property_id: string | null
          purchase_order_id: string | null
          review_notes: string[]
          source: string
          status: string
          unit_id: string | null
          updated_at: string
          vendor_id: string | null
          work_order_id: string | null
        }
        Insert: {
          amount_cents: number
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          document_id?: string | null
          due_date?: string | null
          entity_id?: string | null
          expense_account?: string
          from_email?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          journal_entry_id?: string | null
          memo?: string | null
          paid_entry_id?: string | null
          paid_on?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          project_id?: string | null
          property_id?: string | null
          purchase_order_id?: string | null
          review_notes?: string[]
          source?: string
          status?: string
          unit_id?: string | null
          updated_at?: string
          vendor_id?: string | null
          work_order_id?: string | null
        }
        Update: {
          amount_cents?: number
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          document_id?: string | null
          due_date?: string | null
          entity_id?: string | null
          expense_account?: string
          from_email?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          journal_entry_id?: string | null
          memo?: string | null
          paid_entry_id?: string | null
          paid_on?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          project_id?: string | null
          property_id?: string | null
          purchase_order_id?: string | null
          review_notes?: string[]
          source?: string
          status?: string
          unit_id?: string | null
          updated_at?: string
          vendor_id?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_paid_entry_id_fkey"
            columns: ["paid_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_feed: {
        Row: {
          company_id: string
          created_at: string
          id: string
          last_read_at: string | null
          profile_id: string
          token_hash: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          profile_id: string
          token_hash: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          profile_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_feed_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_feed_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
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
          created_by: string | null
          description: string
          due_date: string
          id: string
          journal_entry_id: string | null
          lease_id: string
          memo: string | null
        }
        Insert: {
          amount_cents: number
          charge_type: string
          company_id: string
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          id?: string
          journal_entry_id?: string | null
          lease_id: string
          memo?: string | null
        }
        Update: {
          amount_cents?: number
          charge_type?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          journal_entry_id?: string | null
          lease_id?: string
          memo?: string | null
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
            foreignKeyName: "charge_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
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
      checkr_event: {
        Row: {
          id: string
          received_at: string
          type: string
        }
        Insert: {
          id: string
          received_at?: string
          type: string
        }
        Update: {
          id?: string
          received_at?: string
          type?: string
        }
        Relationships: []
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
          sms_alert_number: string | null
          sms_from_number: string | null
          sms_live: boolean
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_fc_customer_id: string | null
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
          sms_alert_number?: string | null
          sms_from_number?: string | null
          sms_live?: boolean
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_fc_customer_id?: string | null
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
          sms_alert_number?: string | null
          sms_from_number?: string | null
          sms_live?: boolean
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_fc_customer_id?: string | null
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
          mobile_digits: string | null
          notes: string | null
          owner_portal_invited_at: string | null
          phone: string | null
          portal_invited_at: string | null
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
          mobile_digits?: string | null
          notes?: string | null
          owner_portal_invited_at?: string | null
          phone?: string | null
          portal_invited_at?: string | null
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
          mobile_digits?: string | null
          notes?: string | null
          owner_portal_invited_at?: string | null
          phone?: string | null
          portal_invited_at?: string | null
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
          bill_id: string | null
          category: string
          company_id: string
          contact_id: string | null
          created_at: string
          entity_id: string | null
          expires_on: string | null
          file_name: string
          id: string
          lease_id: string | null
          management_agreement_id: string | null
          office_only: boolean
          photo_stage: string | null
          property_id: string | null
          shared_with_owner: boolean
          source: string | null
          storage_path: string
          uploaded_by: string | null
          vendor_id: string | null
          work_order_id: string | null
        }
        Insert: {
          bill_id?: string | null
          category?: string
          company_id: string
          contact_id?: string | null
          created_at?: string
          entity_id?: string | null
          expires_on?: string | null
          file_name: string
          id?: string
          lease_id?: string | null
          management_agreement_id?: string | null
          office_only?: boolean
          photo_stage?: string | null
          property_id?: string | null
          shared_with_owner?: boolean
          source?: string | null
          storage_path: string
          uploaded_by?: string | null
          vendor_id?: string | null
          work_order_id?: string | null
        }
        Update: {
          bill_id?: string | null
          category?: string
          company_id?: string
          contact_id?: string | null
          created_at?: string
          entity_id?: string | null
          expires_on?: string | null
          file_name?: string
          id?: string
          lease_id?: string | null
          management_agreement_id?: string | null
          office_only?: boolean
          photo_stage?: string | null
          property_id?: string | null
          shared_with_owner?: boolean
          source?: string | null
          storage_path?: string
          uploaded_by?: string | null
          vendor_id?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "document_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
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
            foreignKeyName: "document_management_agreement_id_fkey"
            columns: ["management_agreement_id"]
            isOneToOne: false
            referencedRelation: "management_agreement"
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
            foreignKeyName: "document_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor"
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
          books_mode: string
          company_id: string
          created_at: string
          email: string | null
          entity_type: string | null
          id: string
          is_manager: boolean
          mailing_address: string | null
          management_fee: Json
          name: string
          notes: string | null
          phone: string | null
          portal_invited_at: string | null
          reserve_cents: number
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          tax_id_last4: string | null
          updated_at: string
        }
        Insert: {
          books_mode?: string
          company_id: string
          created_at?: string
          email?: string | null
          entity_type?: string | null
          id?: string
          is_manager?: boolean
          mailing_address?: string | null
          management_fee?: Json
          name: string
          notes?: string | null
          phone?: string | null
          portal_invited_at?: string | null
          reserve_cents?: number
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          tax_id_last4?: string | null
          updated_at?: string
        }
        Update: {
          books_mode?: string
          company_id?: string
          created_at?: string
          email?: string | null
          entity_type?: string | null
          id?: string
          is_manager?: boolean
          mailing_address?: string | null
          management_fee?: Json
          name?: string
          notes?: string | null
          phone?: string | null
          portal_invited_at?: string | null
          reserve_cents?: number
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
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
      external_calendar: {
        Row: {
          company_id: string
          created_at: string
          ics_url: string
          id: string
          last_error: string | null
          last_fetched_at: string | null
          name: string
          profile_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          ics_url: string
          id?: string
          last_error?: string | null
          last_fetched_at?: string | null
          name: string
          profile_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          ics_url?: string
          id?: string
          last_error?: string | null
          last_fetched_at?: string | null
          name?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_calendar_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_calendar_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_invoice: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          lines: Json
          manager_entity_id: string
          manager_entry_id: string | null
          manager_payment_entry_id: string | null
          method: string | null
          number: number
          owner_entity_id: string
          owner_entry_id: string | null
          owner_payment_entry_id: string | null
          paid_on: string | null
          period_end: string
          period_start: string
          reference: string | null
          sent_at: string | null
          status: string
          total_cents: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          lines: Json
          manager_entity_id: string
          manager_entry_id?: string | null
          manager_payment_entry_id?: string | null
          method?: string | null
          number: number
          owner_entity_id: string
          owner_entry_id?: string | null
          owner_payment_entry_id?: string | null
          paid_on?: string | null
          period_end: string
          period_start: string
          reference?: string | null
          sent_at?: string | null
          status?: string
          total_cents: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lines?: Json
          manager_entity_id?: string
          manager_entry_id?: string | null
          manager_payment_entry_id?: string | null
          method?: string | null
          number?: number
          owner_entity_id?: string
          owner_entry_id?: string | null
          owner_payment_entry_id?: string | null
          paid_on?: string | null
          period_end?: string
          period_start?: string
          reference?: string | null
          sent_at?: string | null
          status?: string
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "fee_invoice_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoice_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoice_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoice_manager_entity_id_fkey"
            columns: ["manager_entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoice_manager_entry_id_fkey"
            columns: ["manager_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoice_manager_payment_entry_id_fkey"
            columns: ["manager_payment_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoice_owner_entity_id_fkey"
            columns: ["owner_entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoice_owner_entry_id_fkey"
            columns: ["owner_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoice_owner_payment_entry_id_fkey"
            columns: ["owner_payment_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entry"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_account: {
        Row: {
          active: boolean
          company_id: string
          id: string
          is_trust: boolean
          name: string
          number: string
          section: string | null
          system: boolean
          tax_line: string | null
          type: string
        }
        Insert: {
          active?: boolean
          company_id: string
          id?: string
          is_trust?: boolean
          name: string
          number: string
          section?: string | null
          system?: boolean
          tax_line?: string | null
          type: string
        }
        Update: {
          active?: boolean
          company_id?: string
          id?: string
          is_trust?: boolean
          name?: string
          number?: string
          section?: string | null
          system?: boolean
          tax_line?: string | null
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
      guest_card: {
        Row: {
          company_id: string
          created_at: string
          desired_move_in: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          notes: string
          phone: string | null
          sms_opt_in: boolean
          source: string
          status: string
          unit_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          desired_move_in?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name?: string
          notes?: string
          phone?: string | null
          sms_opt_in?: boolean
          source?: string
          status?: string
          unit_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          desired_move_in?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string
          phone?: string | null
          sms_opt_in?: boolean
          source?: string
          status?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_card_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_card_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batch: {
        Row: {
          company_id: string
          created: Json
          created_at: string
          created_by: string | null
          file_name: string | null
          id: string
          kind: string
          summary: string | null
          undone_at: string | null
          undone_by: string | null
        }
        Insert: {
          company_id: string
          created?: Json
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          kind: string
          summary?: string | null
          undone_at?: string | null
          undone_by?: string | null
        }
        Update: {
          company_id?: string
          created?: Json
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          kind?: string
          summary?: string | null
          undone_at?: string | null
          undone_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_batch_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batch_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batch_undone_by_fkey"
            columns: ["undone_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_email: {
        Row: {
          bill_id: string | null
          company_id: string
          created_at: string
          from_address: string
          id: string
          note: string | null
          provider_id: string
          status: string
          subject: string | null
        }
        Insert: {
          bill_id?: string | null
          company_id: string
          created_at?: string
          from_address: string
          id?: string
          note?: string | null
          provider_id: string
          status: string
          subject?: string | null
        }
        Update: {
          bill_id?: string | null
          company_id?: string
          created_at?: string
          from_address?: string
          id?: string
          note?: string | null
          provider_id?: string
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_email_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_email_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          inspected_on: string
          kind: string
          lease_id: string
          notes: string | null
          rooms: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          inspected_on: string
          kind: string
          lease_id: string
          notes?: string | null
          rooms?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          inspected_on?: string
          kind?: string
          lease_id?: string
          notes?: string | null
          rooms?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_item: {
        Row: {
          company_id: string
          created_at: string
          id: string
          location: string | null
          name: string
          quantity: number
          reorder_at: number
          unit_cost_cents: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          location?: string | null
          name: string
          quantity?: number
          reorder_at?: number
          unit_cost_cents?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          quantity?: number
          reorder_at?: number
          unit_cost_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_item_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_move: {
        Row: {
          change: number
          company_id: string
          created_at: string
          id: string
          item_id: string
          moved_by: string | null
          note: string | null
          work_order_id: string | null
        }
        Insert: {
          change: number
          company_id: string
          created_at?: string
          id?: string
          item_id: string
          moved_by?: string | null
          note?: string | null
          work_order_id?: string | null
        }
        Update: {
          change?: number
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string
          moved_by?: string | null
          note?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_move_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_move_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_move_moved_by_fkey"
            columns: ["moved_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_move_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
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
      key_checkout: {
        Row: {
          checked_out_by: string | null
          company_id: string
          due_back_on: string | null
          holder: string
          id: string
          key_set_id: string
          out_at: string
          returned_at: string | null
          vendor_id: string | null
          work_order_id: string | null
        }
        Insert: {
          checked_out_by?: string | null
          company_id: string
          due_back_on?: string | null
          holder: string
          id?: string
          key_set_id: string
          out_at?: string
          returned_at?: string | null
          vendor_id?: string | null
          work_order_id?: string | null
        }
        Update: {
          checked_out_by?: string | null
          company_id?: string
          due_back_on?: string | null
          holder?: string
          id?: string
          key_set_id?: string
          out_at?: string
          returned_at?: string | null
          vendor_id?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_checkout_checked_out_by_fkey"
            columns: ["checked_out_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_checkout_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_checkout_key_set_id_fkey"
            columns: ["key_set_id"]
            isOneToOne: false
            referencedRelation: "key_set"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_checkout_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_checkout_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
      key_set: {
        Row: {
          company_id: string
          copies: number
          created_at: string
          id: string
          label: string
          location: string | null
          property_id: string
          tag: string | null
          unit_id: string | null
        }
        Insert: {
          company_id: string
          copies?: number
          created_at?: string
          id?: string
          label: string
          location?: string | null
          property_id: string
          tag?: string | null
          unit_id?: string | null
        }
        Update: {
          company_id?: string
          copies?: number
          created_at?: string
          id?: string
          label?: string
          location?: string | null
          property_id?: string
          tag?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_set_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_set_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_set_unit_id_fkey"
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
          commercial_terms: Json | null
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
          commercial_terms?: Json | null
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
          commercial_terms?: Json | null
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
      listing: {
        Row: {
          amenities: string[]
          available_on: string | null
          company_id: string
          created_at: string
          deposit_cents: number | null
          description: string
          headline: string
          id: string
          pets_allowed: boolean
          photos: string[]
          published_at: string | null
          rent_cents: number
          status: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          amenities?: string[]
          available_on?: string | null
          company_id: string
          created_at?: string
          deposit_cents?: number | null
          description?: string
          headline: string
          id?: string
          pets_allowed?: boolean
          photos?: string[]
          published_at?: string | null
          rent_cents: number
          status?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          amenities?: string[]
          available_on?: string | null
          company_id?: string
          created_at?: string
          deposit_cents?: number | null
          description?: string
          headline?: string
          id?: string
          pets_allowed?: boolean
          photos?: string[]
          published_at?: string | null
          rent_cents?: number
          status?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "unit"
            referencedColumns: ["id"]
          },
        ]
      }
      management_agreement: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          end_date: string
          ended_on: string | null
          entity_id: string
          id: string
          owner_signer_email: string | null
          owner_signer_name: string | null
          owner_signer_title: string | null
          property_ids: string[]
          signed_at: string | null
          start_date: string
          status: string
          template_id: string | null
          template_name: string | null
          template_parts: Json | null
          terms: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          end_date: string
          ended_on?: string | null
          entity_id: string
          id?: string
          owner_signer_email?: string | null
          owner_signer_name?: string | null
          owner_signer_title?: string | null
          property_ids?: string[]
          signed_at?: string | null
          start_date: string
          status?: string
          template_id?: string | null
          template_name?: string | null
          template_parts?: Json | null
          terms?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string
          ended_on?: string | null
          entity_id?: string
          id?: string
          owner_signer_email?: string | null
          owner_signer_name?: string | null
          owner_signer_title?: string | null
          property_ids?: string[]
          signed_at?: string | null
          start_date?: string
          status?: string
          template_id?: string | null
          template_name?: string | null
          template_parts?: Json | null
          terms?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_agreement_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_agreement_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_agreement_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_agreement_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "agreement_template"
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
          delivery: string | null
          direction: string
          document_id: string | null
          id: string
          lease_id: string | null
          legal: boolean
          provider_ref: string | null
          sender_membership_id: string | null
          sender_name: string | null
          sender_title: string | null
          status: string
          subject: string | null
          template_id: string | null
          thread_key: string
          work_order_id: string | null
        }
        Insert: {
          body: string
          channel: string
          company_id: string
          contact_id?: string | null
          created_at?: string
          delivery?: string | null
          direction: string
          document_id?: string | null
          id?: string
          lease_id?: string | null
          legal?: boolean
          provider_ref?: string | null
          sender_membership_id?: string | null
          sender_name?: string | null
          sender_title?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          thread_key: string
          work_order_id?: string | null
        }
        Update: {
          body?: string
          channel?: string
          company_id?: string
          contact_id?: string | null
          created_at?: string
          delivery?: string | null
          direction?: string
          document_id?: string | null
          id?: string
          lease_id?: string | null
          legal?: boolean
          provider_ref?: string | null
          sender_membership_id?: string | null
          sender_name?: string | null
          sender_title?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          thread_key?: string
          work_order_id?: string | null
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
            foreignKeyName: "message_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_sender_membership_id_fkey"
            columns: ["sender_membership_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
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
      move_out: {
        Row: {
          claim_notice_message_id: string | null
          claim_notice_method: string | null
          claim_notice_sent_on: string | null
          closed_at: string | null
          company_id: string
          created_at: string
          created_by: string | null
          decision: string | null
          deductions: Json
          forwarding_address: string | null
          id: string
          inspection_notes: string | null
          lease_id: string
          objection_received_on: string | null
          refund_cents: number | null
          refund_paid_on: string | null
          refund_reference: string | null
          suggested_deductions: Json
          updated_at: string
          vacated_on: string
        }
        Insert: {
          claim_notice_message_id?: string | null
          claim_notice_method?: string | null
          claim_notice_sent_on?: string | null
          closed_at?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          decision?: string | null
          deductions?: Json
          forwarding_address?: string | null
          id?: string
          inspection_notes?: string | null
          lease_id: string
          objection_received_on?: string | null
          refund_cents?: number | null
          refund_paid_on?: string | null
          refund_reference?: string | null
          suggested_deductions?: Json
          updated_at?: string
          vacated_on: string
        }
        Update: {
          claim_notice_message_id?: string | null
          claim_notice_method?: string | null
          claim_notice_sent_on?: string | null
          closed_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          decision?: string | null
          deductions?: Json
          forwarding_address?: string | null
          id?: string
          inspection_notes?: string | null
          lease_id?: string
          objection_received_on?: string | null
          refund_cents?: number | null
          refund_paid_on?: string | null
          refund_reference?: string | null
          suggested_deductions?: Json
          updated_at?: string
          vacated_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "move_out_claim_notice_message_id_fkey"
            columns: ["claim_notice_message_id"]
            isOneToOne: false
            referencedRelation: "message"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_out_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_out_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_out_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: true
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_distribution: {
        Row: {
          amount_cents: number
          company_id: string
          created_at: string
          entity_id: string
          id: string
          journal_entry_id: string | null
          method: string | null
          ownership_pct: number
          paid_on: string | null
          payee_contact_id: string | null
          payee_name: string
          reference: string | null
          statement_id: string
          status: string
        }
        Insert: {
          amount_cents: number
          company_id: string
          created_at?: string
          entity_id: string
          id?: string
          journal_entry_id?: string | null
          method?: string | null
          ownership_pct: number
          paid_on?: string | null
          payee_contact_id?: string | null
          payee_name: string
          reference?: string | null
          statement_id: string
          status?: string
        }
        Update: {
          amount_cents?: number
          company_id?: string
          created_at?: string
          entity_id?: string
          id?: string
          journal_entry_id?: string | null
          method?: string | null
          ownership_pct?: number
          paid_on?: string | null
          payee_contact_id?: string | null
          payee_name?: string
          reference?: string | null
          statement_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_distribution_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_distribution_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_distribution_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_distribution_payee_contact_id_fkey"
            columns: ["payee_contact_id"]
            isOneToOne: false
            referencedRelation: "contact"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_distribution_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "owner_statement"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_statement: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          entity_id: string
          fee_entry_ids: string[]
          id: string
          lines: Json
          period_end: string
          period_start: string
          sent_at: string | null
          totals: Json
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          fee_entry_ids?: string[]
          id?: string
          lines?: Json
          period_end: string
          period_start: string
          sent_at?: string | null
          totals: Json
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          fee_entry_ids?: string[]
          id?: string
          lines?: Json
          period_end?: string
          period_start?: string
          sent_at?: string | null
          totals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "owner_statement_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_statement_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_statement_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
        ]
      }
      payment: {
        Row: {
          amount_cents: number
          company_id: string
          created_at: string
          created_by: string | null
          fee_cents: number
          id: string
          journal_entry_id: string | null
          lease_id: string
          memo: string | null
          method: string
          processor_ref: string | null
          purpose: string
          received_on: string
          reference: string | null
          returned_on: string | null
          status: string
        }
        Insert: {
          amount_cents: number
          company_id: string
          created_at?: string
          created_by?: string | null
          fee_cents?: number
          id?: string
          journal_entry_id?: string | null
          lease_id: string
          memo?: string | null
          method: string
          processor_ref?: string | null
          purpose?: string
          received_on: string
          reference?: string | null
          returned_on?: string | null
          status?: string
        }
        Update: {
          amount_cents?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          fee_cents?: number
          id?: string
          journal_entry_id?: string | null
          lease_id?: string
          memo?: string | null
          method?: string
          processor_ref?: string | null
          purpose?: string
          received_on?: string
          reference?: string | null
          returned_on?: string | null
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
            foreignKeyName: "payment_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
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
      project: {
        Row: {
          budget_cents: number
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          property_id: string
          start_on: string | null
          status: string
          target_on: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          budget_cents?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          property_id: string
          start_on?: string | null
          status?: string
          target_on?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          budget_cents?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          property_id?: string
          start_on?: string | null
          status?: string
          target_on?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit"
            referencedColumns: ["id"]
          },
        ]
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
      purchase_order: {
        Row: {
          amount_cents: number
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          number: number
          project_id: string | null
          property_id: string
          status: string
          updated_at: string
          vendor_id: string
          work_order_id: string | null
        }
        Insert: {
          amount_cents: number
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          number: number
          project_id?: string | null
          property_id: string
          status?: string
          updated_at?: string
          vendor_id: string
          work_order_id?: string | null
        }
        Update: {
          amount_cents?: number
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          number?: number
          project_id?: string | null
          property_id?: string
          status?: string
          updated_at?: string
          vendor_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_hit: {
        Row: {
          at: string
          key: string
        }
        Insert: {
          at?: string
          key: string
        }
        Update: {
          at?: string
          key?: string
        }
        Relationships: []
      }
      reconciliation: {
        Row: {
          automatic: boolean
          bank_account_id: string
          cleared_balance_cents: number
          company_id: string
          completed_at: string
          completed_by: string | null
          id: string
          statement_balance_cents: number
          statement_date: string
        }
        Insert: {
          automatic?: boolean
          bank_account_id: string
          cleared_balance_cents: number
          company_id: string
          completed_at?: string
          completed_by?: string | null
          id?: string
          statement_balance_cents: number
          statement_date: string
        }
        Update: {
          automatic?: boolean
          bank_account_id?: string
          cleared_balance_cents?: number
          company_id?: string
          completed_at?: string
          completed_by?: string | null
          id?: string
          statement_balance_cents?: number
          statement_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_bill: {
        Row: {
          active: boolean
          amount_cents: number
          company_id: string
          created_at: string
          expense_account: string
          frequency: string
          id: string
          memo: string
          next_on: string
          property_id: string
          vendor_id: string
        }
        Insert: {
          active?: boolean
          amount_cents: number
          company_id: string
          created_at?: string
          expense_account?: string
          frequency?: string
          id?: string
          memo: string
          next_on: string
          property_id: string
          vendor_id: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          company_id?: string
          created_at?: string
          expense_account?: string
          frequency?: string
          id?: string
          memo?: string
          next_on?: string
          property_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_bill_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_bill_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_bill_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor"
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
      recurring_work_order: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          details: string | null
          frequency: string
          id: string
          last_work_order_id: string | null
          next_on: string
          property_id: string
          title: string
          unit_id: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          details?: string | null
          frequency?: string
          id?: string
          last_work_order_id?: string | null
          next_on: string
          property_id: string
          title: string
          unit_id?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          details?: string | null
          frequency?: string
          id?: string
          last_work_order_id?: string | null
          next_on?: string
          property_id?: string
          title?: string
          unit_id?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_work_order_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_work_order_last_work_order_id_fkey"
            columns: ["last_work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_work_order_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_work_order_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_work_order_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor"
            referencedColumns: ["id"]
          },
        ]
      }
      renewal_offer: {
        Row: {
          applied_at: string | null
          chosen_option: number | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          increase_percent: number
          lease_id: string
          message: string | null
          options: Json
          respond_by: string
          responded_at: string | null
          responded_by: string | null
          sent_at: string
          sent_to: string[]
          status: string
        }
        Insert: {
          applied_at?: string | null
          chosen_option?: number | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          increase_percent: number
          lease_id: string
          message?: string | null
          options: Json
          respond_by: string
          responded_at?: string | null
          responded_by?: string | null
          sent_at?: string
          sent_to?: string[]
          status?: string
        }
        Update: {
          applied_at?: string | null
          chosen_option?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          increase_percent?: number
          lease_id?: string
          message?: string | null
          options?: Json
          respond_by?: string
          responded_at?: string | null
          responded_by?: string | null
          sent_at?: string
          sent_to?: string[]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewal_offer_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_offer_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_offer_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_offer_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "contact"
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
      screening_order: {
        Row: {
          application_member_id: string
          application_url: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          idempotency_key: string
          live_mode: boolean | null
          notes: string[]
          order_id: string | null
          package: string
          product_statuses: Json
          provider: string
          report_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          application_member_id: string
          application_url?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          idempotency_key: string
          live_mode?: boolean | null
          notes?: string[]
          order_id?: string | null
          package: string
          product_statuses?: Json
          provider?: string
          report_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          application_member_id?: string
          application_url?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string
          live_mode?: boolean | null
          notes?: string[]
          order_id?: string | null
          package?: string
          product_statuses?: Json
          provider?: string
          report_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_order_application_member_id_fkey"
            columns: ["application_member_id"]
            isOneToOne: false
            referencedRelation: "application_member"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_order_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_order_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_report: {
        Row: {
          agency_name: string | null
          application_member_id: string
          company_id: string
          credit_score: number | null
          criminal_records: boolean
          entered_by: string | null
          eviction_years_ago: number | null
          id: string
          owes_landlord: boolean
          provider: string
          received_at: string
          report_ref: string | null
          utility_or_car_problems: boolean
        }
        Insert: {
          agency_name?: string | null
          application_member_id: string
          company_id: string
          credit_score?: number | null
          criminal_records?: boolean
          entered_by?: string | null
          eviction_years_ago?: number | null
          id?: string
          owes_landlord?: boolean
          provider?: string
          received_at?: string
          report_ref?: string | null
          utility_or_car_problems?: boolean
        }
        Update: {
          agency_name?: string | null
          application_member_id?: string
          company_id?: string
          credit_score?: number | null
          criminal_records?: boolean
          entered_by?: string | null
          eviction_years_ago?: number | null
          id?: string
          owes_landlord?: boolean
          provider?: string
          received_at?: string
          report_ref?: string | null
          utility_or_car_problems?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "screening_report_application_member_id_fkey"
            columns: ["application_member_id"]
            isOneToOne: true
            referencedRelation: "application_member"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_report_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_report_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      showing: {
        Row: {
          company_id: string
          created_at: string
          guest_card_id: string
          id: string
          notes: string
          starts_at: string
          status: string
          unit_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          guest_card_id: string
          id?: string
          notes?: string
          starts_at: string
          status?: string
          unit_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          guest_card_id?: string
          id?: string
          notes?: string
          starts_at?: string
          status?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "showing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showing_guest_card_id_fkey"
            columns: ["guest_card_id"]
            isOneToOne: false
            referencedRelation: "guest_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showing_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_event: {
        Row: {
          company_id: string
          created_at: string
          id: number
          ip: string | null
          kind: string
          request_id: string
          signer_id: string | null
          user_agent: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: never
          ip?: string | null
          kind: string
          request_id: string
          signer_id?: string | null
          user_agent?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: never
          ip?: string | null
          kind?: string
          request_id?: string
          signer_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_event_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_event_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "signature_request"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_event_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "signature_signer"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_request: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          lease_id: string | null
          management_agreement_id: string | null
          signed_document_id: string | null
          snapshot: Json
          snapshot_sha256: string
          source_path: string | null
          status: string
          title: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lease_id?: string | null
          management_agreement_id?: string | null
          signed_document_id?: string | null
          snapshot: Json
          snapshot_sha256: string
          source_path?: string | null
          status?: string
          title: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lease_id?: string | null
          management_agreement_id?: string | null
          signed_document_id?: string | null
          snapshot?: Json
          snapshot_sha256?: string
          source_path?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_request_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_request_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_request_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_request_management_agreement_id_fkey"
            columns: ["management_agreement_id"]
            isOneToOne: false
            referencedRelation: "management_agreement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_request_signed_document_id_fkey"
            columns: ["signed_document_id"]
            isOneToOne: false
            referencedRelation: "document"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_signer: {
        Row: {
          company_id: string
          consented_at: string | null
          email: string
          id: string
          initials: string | null
          ip: string | null
          name: string
          request_id: string
          role: string
          sign_order: number
          signed_at: string | null
          status: string
          token_hash: string | null
          typed_signature: string | null
          user_agent: string | null
        }
        Insert: {
          company_id: string
          consented_at?: string | null
          email: string
          id?: string
          initials?: string | null
          ip?: string | null
          name: string
          request_id: string
          role: string
          sign_order: number
          signed_at?: string | null
          status?: string
          token_hash?: string | null
          typed_signature?: string | null
          user_agent?: string | null
        }
        Update: {
          company_id?: string
          consented_at?: string | null
          email?: string
          id?: string
          initials?: string | null
          ip?: string | null
          name?: string
          request_id?: string
          role?: string
          sign_order?: number
          signed_at?: string | null
          status?: string
          token_hash?: string | null
          typed_signature?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_signer_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_signer_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "signature_request"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_event: {
        Row: {
          company_id: string | null
          id: string
          received_at: string
          type: string
        }
        Insert: {
          company_id?: string | null
          id: string
          received_at?: string
          type: string
        }
        Update: {
          company_id?: string | null
          id?: string
          received_at?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_event_company_id_fkey"
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
      vendor_request: {
        Row: {
          cancelled_at: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          first_sent_at: string
          id: string
          items: string[]
          last_sent_at: string
          opened_at: string | null
          send_count: number
          sent_to: string
          token_hash: string
          vendor_id: string
        }
        Insert: {
          cancelled_at?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          first_sent_at?: string
          id?: string
          items: string[]
          last_sent_at?: string
          opened_at?: string | null
          send_count?: number
          sent_to: string
          token_hash: string
          vendor_id: string
        }
        Update: {
          cancelled_at?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          first_sent_at?: string
          id?: string
          items?: string[]
          last_sent_at?: string
          opened_at?: string | null
          send_count?: number
          sent_to?: string
          token_hash?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_request_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_request_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_request_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order: {
        Row: {
          ai_summary: string | null
          appfolio_ref: string | null
          company_id: string
          completed_at: string | null
          completion_ai: Json | null
          cost_cents: number | null
          created_at: string
          emergency_ack: Json | null
          entry_basis: string | null
          entry_notice_at: string | null
          entry_notice_method: string | null
          entry_ok: boolean | null
          follow_up_needed: boolean
          follow_up_note: string | null
          hours_on_site: number | null
          id: string
          number: number
          parts_used: string | null
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
          tenant_damage_note: string | null
          tenant_damage_suspected: boolean
          tenant_note: string | null
          title: string
          triage_answers: Json
          triage_category: string | null
          triage_item: string | null
          triage_symptom: string | null
          unit_id: string | null
          updated_at: string
          vendor_accepted_at: string | null
          vendor_completed_at: string | null
          vendor_decline_reason: string | null
          vendor_declined_at: string | null
          vendor_id: string | null
          vendor_notified_at: string | null
          vendor_token_hash: string | null
        }
        Insert: {
          ai_summary?: string | null
          appfolio_ref?: string | null
          company_id: string
          completed_at?: string | null
          completion_ai?: Json | null
          cost_cents?: number | null
          created_at?: string
          emergency_ack?: Json | null
          entry_basis?: string | null
          entry_notice_at?: string | null
          entry_notice_method?: string | null
          entry_ok?: boolean | null
          follow_up_needed?: boolean
          follow_up_note?: string | null
          hours_on_site?: number | null
          id?: string
          number?: number
          parts_used?: string | null
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
          tenant_damage_note?: string | null
          tenant_damage_suspected?: boolean
          tenant_note?: string | null
          title: string
          triage_answers?: Json
          triage_category?: string | null
          triage_item?: string | null
          triage_symptom?: string | null
          unit_id?: string | null
          updated_at?: string
          vendor_accepted_at?: string | null
          vendor_completed_at?: string | null
          vendor_decline_reason?: string | null
          vendor_declined_at?: string | null
          vendor_id?: string | null
          vendor_notified_at?: string | null
          vendor_token_hash?: string | null
        }
        Update: {
          ai_summary?: string | null
          appfolio_ref?: string | null
          company_id?: string
          completed_at?: string | null
          completion_ai?: Json | null
          cost_cents?: number | null
          created_at?: string
          emergency_ack?: Json | null
          entry_basis?: string | null
          entry_notice_at?: string | null
          entry_notice_method?: string | null
          entry_ok?: boolean | null
          follow_up_needed?: boolean
          follow_up_note?: string | null
          hours_on_site?: number | null
          id?: string
          number?: number
          parts_used?: string | null
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
          tenant_damage_note?: string | null
          tenant_damage_suspected?: boolean
          tenant_note?: string | null
          title?: string
          triage_answers?: Json
          triage_category?: string | null
          triage_item?: string | null
          triage_symptom?: string | null
          unit_id?: string | null
          updated_at?: string
          vendor_accepted_at?: string | null
          vendor_completed_at?: string | null
          vendor_decline_reason?: string | null
          vendor_declined_at?: string | null
          vendor_id?: string | null
          vendor_notified_at?: string | null
          vendor_token_hash?: string | null
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
      account_balances: {
        Args: {
          p_company: string
          p_entity: string
          p_from: string
          p_to: string
        }
        Returns: {
          account_id: string
          credit_cents: number
          debit_cents: number
          is_trust: boolean
          name: string
          number: string
          type: string
        }[]
      }
      ai_key_for: { Args: { p_company: string }; Returns: string }
      charge_income_account: { Args: { p_type: string }; Returns: string }
      claim_portal: { Args: { p_company: string }; Returns: number }
      clear_ai_connection: { Args: { p_company: string }; Returns: undefined }
      company_by_subdomain: {
        Args: { p_subdomain: string }
        Returns: {
          id: string
          name: string
          office_phone: string
        }[]
      }
      count_balance_pull: { Args: { p_company: string }; Returns: undefined }
      create_company: {
        Args: { p_name: string; p_subdomain: string; p_time_zone?: string }
        Returns: string
      }
      ensure_chart_of_accounts: {
        Args: { p_company: string }
        Returns: undefined
      }
      gl_id: { Args: { p_company: string; p_number: string }; Returns: string }
      has_password: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          cid: string
          roles: Database["public"]["Enums"]["member_role"][]
        }
        Returns: boolean
      }
      import_ids: { Args: { c: Json; k: string }; Returns: string[] }
      is_member: { Args: { cid: string }; Returns: boolean }
      owner_entity_ids: { Args: never; Returns: string[] }
      owner_property_ids: { Args: never; Returns: string[] }
      portal_contact_ids: { Args: never; Returns: string[] }
      portal_lease_ids: { Args: never; Returns: string[] }
      portal_unit_ids: { Args: never; Returns: string[] }
      post_charge: {
        Args: {
          p_amount: number
          p_description: string
          p_due: string
          p_lease: string
          p_memo?: string
          p_type: string
        }
        Returns: string
      }
      post_journal_entry: {
        Args: {
          p_company: string
          p_date: string
          p_entity: string
          p_lines: Json
          p_memo: string
          p_source: string
        }
        Returns: string
      }
      record_payment: {
        Args: {
          p_amount: number
          p_lease: string
          p_memo?: string
          p_method: string
          p_purpose?: string
          p_received: string
          p_reference?: string
          p_status?: string
        }
        Returns: string
      }
      return_payment: {
        Args: { p_date: string; p_fee?: number; p_payment: string }
        Returns: undefined
      }
      reverse_journal_entry: {
        Args: { p_date: string; p_entry: string; p_memo: string }
        Returns: string
      }
      set_ai_key: {
        Args: { p_company: string; p_key: string }
        Returns: undefined
      }
      settle_deposit: {
        Args: {
          p_apply: number
          p_date: string
          p_lease: string
          p_reference?: string
          p_refund: number
        }
        Returns: undefined
      }
      shares_company: { Args: { pid: string }; Returns: boolean }
      subdomain_available: { Args: { p_subdomain: string }; Returns: boolean }
      undo_import: { Args: { p_batch: string }; Returns: undefined }
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
