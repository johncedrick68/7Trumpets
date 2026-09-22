export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          barangay: string | null
          city_municipality: string
          country_code: string
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          phone: string
          postal_code: string
          province: string
          recipient_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          barangay?: string | null
          city_municipality: string
          country_code?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          phone: string
          postal_code: string
          province: string
          recipient_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          barangay?: string | null
          city_municipality?: string
          country_code?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          phone?: string
          postal_code?: string
          province?: string
          recipient_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_daily_briefs: {
        Row: {
          brief_date: string
          created_at: string
          generated_by: string
          id: string
          metrics_snapshot: Json
          summary: string
        }
        Insert: {
          brief_date: string
          created_at?: string
          generated_by?: string
          id?: string
          metrics_snapshot: Json
          summary: string
        }
        Update: {
          brief_date?: string
          created_at?: string
          generated_by?: string
          id?: string
          metrics_snapshot?: Json
          summary?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          conversation_id: string | null
          created_at: string
          error_code: string | null
          estimated_cost_minor: number | null
          feature: string
          id: string
          input_tokens: number | null
          latency_ms: number
          model: string
          output_tokens: number | null
          success: boolean
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          error_code?: string | null
          estimated_cost_minor?: number | null
          feature: string
          id?: string
          input_tokens?: number | null
          latency_ms: number
          model: string
          output_tokens?: number | null
          success: boolean
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          error_code?: string | null
          estimated_cost_minor?: number | null
          feature?: string
          id?: string
          input_tokens?: number | null
          latency_ms?: number
          model?: string
          output_tokens?: number | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          ip_address: unknown
          metadata: Json
          new_values: Json | null
          old_values: Json | null
          request_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_values?: Json | null
          old_values?: Json | null
          request_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_values?: Json | null
          old_values?: Json | null
          request_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      automation_outbox: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          attempt_count: number
          available_at: string
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          status: string
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          attempt_count?: number
          available_at?: string
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          status?: string
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          attempt_count?: number
          available_at?: string
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          quantity: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          quantity: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          quantity?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          on_hand: number
          reserved: number
          safety_stock: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          on_hand?: number
          reserved?: number
          safety_stock?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          on_hand?: number
          reserved?: number
          safety_stock?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          idempotency_key: string
          movement_type: string
          on_hand_after: number
          on_hand_delta: number
          order_item_id: string | null
          reason: string | null
          reservation_id: string | null
          reserved_after: number
          reserved_delta: number
          variant_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          movement_type: string
          on_hand_after: number
          on_hand_delta?: number
          order_item_id?: string | null
          reason?: string | null
          reservation_id?: string | null
          reserved_after: number
          reserved_delta?: number
          variant_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          movement_type?: string
          on_hand_after?: number
          on_hand_delta?: number
          order_item_id?: string | null
          reason?: string | null
          reservation_id?: string | null
          reserved_after?: number
          reserved_delta?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_reservation_id_fkey"
            columns: ["variant_id", "reservation_id"]
            isOneToOne: false
            referencedRelation: "inventory_reservations"
            referencedColumns: ["variant_id", "id"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string
          order_id: string
          quantity: number
          status: string
          terminal_at: string | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          idempotency_key: string
          order_id: string
          quantity: number
          status?: string
          terminal_at?: string | null
          variant_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          order_id?: string
          quantity?: number
          status?: string
          terminal_at?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_discount_minor: number
          line_subtotal_minor: number
          line_total_minor: number
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          selected_options: Json
          sku: string
          unit_discount_minor: number
          unit_price_minor: number
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_discount_minor: number
          line_subtotal_minor: number
          line_total_minor: number
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          selected_options?: Json
          sku: string
          unit_discount_minor?: number
          unit_price_minor: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_discount_minor?: number
          line_subtotal_minor?: number
          line_total_minor?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          selected_options?: Json
          sku?: string
          unit_discount_minor?: number
          unit_price_minor?: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          idempotency_key: string
          metadata: Json
          note: string | null
          order_id: string
          source: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          note?: string | null
          order_id: string
          source: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          note?: string | null
          order_id?: string
          source?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_line1: string
          address_line2: string | null
          barangay: string | null
          cancellation_reason: string | null
          city_municipality: string
          country_code: string
          created_at: string
          currency_code: string
          customer_email: string
          customer_note: string | null
          delivery_failure_reason: string | null
          discount_minor: number
          fulfillment_method: string
          id: string
          idempotency_key: string
          order_number: string
          placed_at: string
          postal_code: string
          province: string
          recipient_name: string
          recipient_phone: string
          register_session_id: string | null
          sales_channel: string
          shipping_minor: number
          status: string
          subtotal_minor: number
          total_minor: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          barangay?: string | null
          cancellation_reason?: string | null
          city_municipality: string
          country_code?: string
          created_at?: string
          currency_code?: string
          customer_email: string
          customer_note?: string | null
          delivery_failure_reason?: string | null
          discount_minor?: number
          fulfillment_method?: string
          id?: string
          idempotency_key: string
          order_number?: string
          placed_at?: string
          postal_code: string
          province: string
          recipient_name: string
          recipient_phone: string
          register_session_id?: string | null
          sales_channel?: string
          shipping_minor?: number
          status?: string
          subtotal_minor: number
          total_minor: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          barangay?: string | null
          cancellation_reason?: string | null
          city_municipality?: string
          country_code?: string
          created_at?: string
          currency_code?: string
          customer_email?: string
          customer_note?: string | null
          delivery_failure_reason?: string | null
          discount_minor?: number
          fulfillment_method?: string
          id?: string
          idempotency_key?: string
          order_number?: string
          placed_at?: string
          postal_code?: string
          province?: string
          recipient_name?: string
          recipient_phone?: string
          register_session_id?: string | null
          sales_channel?: string
          shipping_minor?: number
          status?: string
          subtotal_minor?: number
          total_minor?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_register_session_fk"
            columns: ["register_session_id"]
            isOneToOne: false
            referencedRelation: "register_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          idempotency_key: string
          metadata: Json
          payment_id: string
          reason: string | null
          submission_id: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          payment_id: string
          reason?: string | null
          submission_id?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          payment_id?: string
          reason?: string | null
          submission_id?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_payment_id_submission_id_fkey"
            columns: ["payment_id", "submission_id"]
            isOneToOne: false
            referencedRelation: "payment_submissions"
            referencedColumns: ["payment_id", "id"]
          },
        ]
      }
      payment_submissions: {
        Row: {
          claimed_amount_minor: number
          created_at: string
          id: string
          idempotency_key: string
          payment_id: string
          receipt_storage_path: string
          reference_number: string | null
          rejection_reason: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          claimed_amount_minor: number
          created_at?: string
          id?: string
          idempotency_key: string
          payment_id: string
          receipt_storage_path: string
          reference_number?: string | null
          rejection_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          claimed_amount_minor?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          payment_id?: string
          receipt_storage_path?: string
          reference_number?: string | null
          rejection_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_submissions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_minor: number
          created_at: string
          currency_code: string
          id: string
          idempotency_key: string
          method: string
          order_id: string
          paid_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency_code?: string
          id?: string
          idempotency_key: string
          method: string
          order_id: string
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency_code?: string
          id?: string
          idempotency_key?: string
          method?: string
          order_id?: string
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string
          created_at: string
          id: string
          position: number
          product_id: string
          storage_path: string
          variant_id: string | null
        }
        Insert: {
          alt_text: string
          created_at?: string
          id?: string
          position?: number
          product_id: string
          storage_path: string
          variant_id?: string | null
        }
        Update: {
          alt_text?: string
          created_at?: string
          id?: string
          position?: number
          product_id?: string
          storage_path?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_variant_id_fkey"
            columns: ["product_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["product_id", "id"]
          },
        ]
      }
      product_option_values: {
        Row: {
          created_at: string
          id: string
          option_id: string
          position: number
          product_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          position?: number
          product_id: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          position?: number
          product_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_values_product_id_option_id_fkey"
            columns: ["product_id", "option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["product_id", "id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          compare_at_price_minor: number | null
          created_at: string
          id: string
          name: string | null
          price_minor: number
          product_id: string
          sku: string
          status: string
          updated_at: string
        }
        Insert: {
          compare_at_price_minor?: number | null
          created_at?: string
          id?: string
          name?: string | null
          price_minor: number
          product_id: string
          sku: string
          status?: string
          updated_at?: string
        }
        Update: {
          compare_at_price_minor?: number | null
          created_at?: string
          id?: string
          name?: string | null
          price_minor?: number
          product_id?: string
          sku?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount_minor: number
          created_at: string
          currency_code: string
          id: string
          method: string
          order_id: string
          payment_id: string
          processed_by: string | null
          reason: string
          reference_number: string | null
          return_request_id: string | null
          status: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency_code?: string
          id?: string
          method: string
          order_id: string
          payment_id: string
          processed_by?: string | null
          reason: string
          reference_number?: string | null
          return_request_id?: string | null
          status?: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency_code?: string
          id?: string
          method?: string
          order_id?: string
          payment_id?: string
          processed_by?: string | null
          reason?: string
          reference_number?: string | null
          return_request_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_return_request_id_fkey"
            columns: ["return_request_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      register_session_activities: {
        Row: {
          activity_type: string
          amount_minor: number
          created_at: string
          created_by: string
          id: string
          notes: string | null
          order_id: string | null
          reference_id: string | null
          running_balance_minor: number
          session_id: string
        }
        Insert: {
          activity_type: string
          amount_minor: number
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          order_id?: string | null
          reference_id?: string | null
          running_balance_minor: number
          session_id: string
        }
        Update: {
          activity_type?: string
          amount_minor?: number
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          reference_id?: string | null
          running_balance_minor?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "register_session_activities_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "register_session_activities_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "register_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      register_sessions: {
        Row: {
          actual_cash_minor: number | null
          cash_difference_minor: number | null
          cashier_id: string
          closed_at: string | null
          created_at: string
          expected_cash_minor: number
          id: string
          notes: string | null
          opened_at: string
          opening_cash_minor: number
          status: string
          updated_at: string
        }
        Insert: {
          actual_cash_minor?: number | null
          cash_difference_minor?: number | null
          cashier_id: string
          closed_at?: string | null
          created_at?: string
          expected_cash_minor?: number
          id?: string
          notes?: string | null
          opened_at?: string
          opening_cash_minor?: number
          status?: string
          updated_at?: string
        }
        Update: {
          actual_cash_minor?: number | null
          cash_difference_minor?: number | null
          cashier_id?: string
          closed_at?: string | null
          created_at?: string
          expected_cash_minor?: number
          id?: string
          notes?: string | null
          opened_at?: string
          opening_cash_minor?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      return_requests: {
        Row: {
          admin_notes: string | null
          approved_refund_minor: number | null
          created_at: string
          exchange_variant_id: string | null
          id: string
          order_id: string
          proof_storage_paths: string[]
          reason: string
          reason_details: string | null
          requested_refund_minor: number
          status: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_refund_minor?: number | null
          created_at?: string
          exchange_variant_id?: string | null
          id?: string
          order_id: string
          proof_storage_paths?: string[]
          reason: string
          reason_details?: string | null
          requested_refund_minor?: number
          status?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_refund_minor?: number | null
          created_at?: string
          exchange_variant_id?: string | null
          id?: string
          order_id?: string
          proof_storage_paths?: string[]
          reason?: string
          reason_details?: string | null
          requested_refund_minor?: number
          status?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_exchange_variant_id_fkey"
            columns: ["exchange_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          actual_delivery_at: string | null
          carrier_notes: string | null
          created_at: string
          estimated_delivery_at: string | null
          id: string
          order_id: string
          provider: string
          shipped_at: string | null
          status: string
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          actual_delivery_at?: string | null
          carrier_notes?: string | null
          created_at?: string
          estimated_delivery_at?: string | null
          id?: string
          order_id: string
          provider?: string
          shipped_at?: string | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          actual_delivery_at?: string | null
          carrier_notes?: string | null
          created_at?: string
          estimated_delivery_at?: string | null
          id?: string
          order_id?: string
          provider?: string
          shipped_at?: string | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string
          requested_role: string
          status: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          full_name: string
          id?: string
          invited_by: string
          requested_role: string
          status?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string
          requested_role?: string
          status?: string
          token_hash?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          ai_state: string
          assigned_staff_id: string | null
          category: string
          created_at: string
          customer_id: string
          id: string
          last_message_at: string
          order_id: string | null
          priority: string
          resolved_at: string | null
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          ai_state?: string
          assigned_staff_id?: string | null
          category: string
          created_at?: string
          customer_id: string
          id?: string
          last_message_at?: string
          order_id?: string | null
          priority?: string
          resolved_at?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          ai_state?: string
          assigned_staff_id?: string | null
          category?: string
          created_at?: string
          customer_id?: string
          id?: string
          last_message_at?: string
          order_id?: string | null
          priority?: string
          resolved_at?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_internal: boolean
          metadata: Json
          sender_type: string
          sender_user_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_internal?: boolean
          metadata?: Json
          sender_type: string
          sender_user_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          metadata?: Json
          sender_type?: string
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_option_values: {
        Row: {
          option_id: string
          option_value_id: string
          product_id: string
          variant_id: string
        }
        Insert: {
          option_id: string
          option_value_id: string
          product_id: string
          variant_id: string
        }
        Update: {
          option_id?: string
          option_value_id?: string
          product_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_option_values_product_id_option_id_fkey"
            columns: ["product_id", "option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["product_id", "id"]
          },
          {
            foreignKeyName: "variant_option_values_product_id_option_id_option_value_id_fkey"
            columns: ["product_id", "option_id", "option_value_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["product_id", "option_id", "id"]
          },
          {
            foreignKeyName: "variant_option_values_product_id_variant_id_fkey"
            columns: ["product_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["product_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_variant_availability: {
        Args: Record<PropertyKey, never>
        Returns: {
          variant_id: string
          is_available: boolean
        }[]
      }
      admin_adjust_inventory: {
        Args: {
          p_delta: number
          p_idempotency_key: string
          p_reason: string
          p_type: string
          p_variant_id: string
        }
        Returns: Json
      }
      admin_create_shipment: {
        Args: {
          p_carrier_notes?: string
          p_order_id: string
          p_provider: string
          p_tracking_number: string
        }
        Returns: {
          actual_delivery_at: string | null
          carrier_notes: string | null
          created_at: string
          estimated_delivery_at: string | null
          id: string
          order_id: string
          provider: string
          shipped_at: string | null
          status: string
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_delete_product_image: {
        Args: { p_image_id: string }
        Returns: boolean
      }
      admin_issue_refund: {
        Args: {
          p_amount_minor: number
          p_method: string
          p_order_id: string
          p_reason: string
          p_reference_number?: string
          p_return_request_id?: string
        }
        Returns: {
          amount_minor: number
          created_at: string
          currency_code: string
          id: string
          method: string
          order_id: string
          payment_id: string
          processed_by: string | null
          reason: string
          reference_number: string | null
          return_request_id: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "refunds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_process_exchange: {
        Args: {
          p_cash_tendered_minor?: number
          p_new_variant_id: string
          p_order_id: string
          p_orig_variant_id: string
          p_reason: string
          p_register_session_id?: string
        }
        Returns: Json
      }
      admin_process_return_request: {
        Args: {
          p_admin_notes?: string
          p_approved_refund_minor?: number
          p_decision: string
          p_return_id: string
        }
        Returns: {
          admin_notes: string | null
          approved_refund_minor: number | null
          created_at: string
          exchange_variant_id: string | null
          id: string
          order_id: string
          proof_storage_paths: string[]
          reason: string
          reason_details: string | null
          requested_refund_minor: number
          status: string
          type: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "return_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_reorder_product_image: {
        Args: { p_action: string; p_image_id: string }
        Returns: boolean
      }
      admin_assign_staff: {
        Args: { p_conversation_id: string; p_staff_id: string }
        Returns: boolean
      }
      admin_reopen_support: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      admin_reply_support: {
        Args: {
          p_content: string
          p_conversation_id: string
          p_is_internal?: boolean
          p_new_status?: string
        }
        Returns: string
      }
      admin_resolve_support: {
        Args: { p_conversation_id: string; p_resolution_note?: string }
        Returns: boolean
      }
      admin_save_category: {
        Args: {
          p_archived?: boolean
          p_description?: string
          p_id?: string
          p_name?: string
          p_parent_id?: string
          p_position?: number
          p_slug?: string
        }
        Returns: string
      }
      admin_save_option_value: {
        Args: {
          p_id?: string
          p_option_id: string
          p_position?: number
          p_product_id: string
          p_value: string
        }
        Returns: string
      }
      admin_save_product: {
        Args: {
          p_category_id?: string
          p_description?: string
          p_id?: string
          p_name?: string
          p_slug?: string
          p_status?: string
        }
        Returns: string
      }
      admin_save_product_image: {
        Args: {
          p_alt_text: string
          p_position?: number
          p_product_id: string
          p_storage_path: string
          p_variant_id?: string
        }
        Returns: string
      }
      admin_save_product_option: {
        Args: {
          p_id?: string
          p_name: string
          p_position?: number
          p_product_id: string
        }
        Returns: string
      }
      admin_save_variant: {
        Args: {
          p_compare_at_price_minor?: number
          p_id?: string
          p_name?: string
          p_price_minor?: number
          p_product_id?: string
          p_sku?: string
          p_status?: string
        }
        Returns: string
      }
      admin_set_variant_option_value: {
        Args: {
          p_option_id: string
          p_option_value_id: string
          p_product_id: string
          p_variant_id: string
        }
        Returns: boolean
      }
      admin_settle_pickup_payment: {
        Args: {
          p_notes?: string
          p_order_id: string
          p_register_session_id?: string
          p_tendered_minor?: number
        }
        Returns: Json
      }
      admin_transition_order: {
        Args: {
          p_idempotency_key: string
          p_metadata?: Json
          p_note: string
          p_order_id: string
          p_source: string
          p_to_status: string
        }
        Returns: {
          address_line1: string
          address_line2: string | null
          barangay: string | null
          cancellation_reason: string | null
          city_municipality: string
          country_code: string
          created_at: string
          currency_code: string
          customer_email: string
          customer_note: string | null
          delivery_failure_reason: string | null
          discount_minor: number
          fulfillment_method: string
          id: string
          idempotency_key: string
          order_number: string
          placed_at: string
          postal_code: string
          province: string
          recipient_name: string
          recipient_phone: string
          register_session_id: string | null
          sales_channel: string
          shipping_minor: number
          status: string
          subtotal_minor: number
          total_minor: number
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      allow_checkout_attempt: {
        Args: { p_idempotency_key: string }
        Returns: boolean
      }
      allow_receipt_upload_attempt: {
        Args: { p_payment_id: string }
        Returns: boolean
      }
      approve_gcash_submission: {
        Args: {
          p_idempotency_key: string
          p_payment_id: string
          p_reason?: string
          p_submission_id: string
        }
        Returns: string
      }
      authorize_payment_receipt_preview: {
        Args: { p_submission_id: string }
        Returns: string
      }
      cancel_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: {
          address_line1: string
          address_line2: string | null
          barangay: string | null
          cancellation_reason: string | null
          city_municipality: string
          country_code: string
          created_at: string
          currency_code: string
          customer_email: string
          customer_note: string | null
          delivery_failure_reason: string | null
          discount_minor: number
          fulfillment_method: string
          id: string
          idempotency_key: string
          order_number: string
          placed_at: string
          postal_code: string
          province: string
          recipient_name: string
          recipient_phone: string
          register_session_id: string | null
          sales_channel: string
          shipping_minor: number
          status: string
          subtotal_minor: number
          total_minor: number
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      checkout_order: {
        Args: {
          p_customer_id: string
          p_customer_note?: string
          p_delivery: Json
          p_fulfillment_method: string
          p_gcash_expires_at: string
          p_idempotency_key: string
          p_lines: Json
          p_payment_method: string
          p_shipping_minor: number
        }
        Returns: {
          address_line1: string
          address_line2: string | null
          barangay: string | null
          cancellation_reason: string | null
          city_municipality: string
          country_code: string
          created_at: string
          currency_code: string
          customer_email: string
          customer_note: string | null
          delivery_failure_reason: string | null
          discount_minor: number
          fulfillment_method: string
          id: string
          idempotency_key: string
          order_number: string
          placed_at: string
          postal_code: string
          province: string
          recipient_name: string
          recipient_phone: string
          register_session_id: string | null
          sales_channel: string
          shipping_minor: number
          status: string
          subtotal_minor: number
          total_minor: number
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_expired_gcash_payment: {
        Args: {
          p_idempotency_key: string
          p_payment_id: string
          p_reason?: string
        }
        Returns: string
      }
      close_register_session: {
        Args: {
          p_actual_cash_minor: number
          p_notes?: string
          p_session_id: string
        }
        Returns: {
          actual_cash_minor: number | null
          cash_difference_minor: number | null
          cashier_id: string
          closed_at: string | null
          created_at: string
          expected_cash_minor: number
          id: string
          notes: string | null
          opened_at: string
          opening_cash_minor: number
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "register_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_customer_return_request: {
        Args: {
          p_exchange_variant_id?: string
          p_order_id: string
          p_proof_paths?: string[]
          p_reason: string
          p_reason_details: string
          p_requested_refund_minor: number
          p_type: string
        }
        Returns: {
          admin_notes: string | null
          approved_refund_minor: number | null
          created_at: string
          exchange_variant_id: string | null
          id: string
          order_id: string
          proof_storage_paths: string[]
          reason: string
          reason_details: string | null
          requested_refund_minor: number
          status: string
          type: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "return_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_pos_sale: {
        Args: {
          p_customer_email?: string
          p_customer_name: string
          p_customer_phone: string
          p_idempotency_key?: string
          p_items: Json
          p_payment_method: string
          p_register_session_id?: string
          p_tendered_minor: number
        }
        Returns: Json
      }
      create_support_conversation: {
        Args: {
          p_category: string
          p_initial_message: string
          p_order_id?: string
        }
        Returns: string
      }
      customer_close_support: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      customer_reopen_support: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      current_user_role: { Args: never; Returns: string }
      get_customer_growth_analytics: { Args: never; Returns: Json }
      list_expired_gcash_payments: {
        Args: never
        Returns: {
          active_reservation_count: number
          amount_minor: number
          customer_email: string
          order_id: string
          order_number: string
          payment_id: string
          payment_status: string
          recipient_name: string
          reservation_expires_at: string
        }[]
      }
      list_staff_roles: {
        Args: never
        Returns: {
          assigned_by: string
          created_at: string
          role: string
          user_id: string
        }[]
      }
      manage_user_role: {
        Args: { p_assign: boolean; p_role: string; p_user_id: string }
        Returns: boolean
      }
      open_register_session: {
        Args: { p_notes?: string; p_opening_cash_minor: number }
        Returns: {
          actual_cash_minor: number | null
          cash_difference_minor: number | null
          cashier_id: string
          closed_at: string | null
          created_at: string
          expected_cash_minor: number
          id: string
          notes: string | null
          opened_at: string
          opening_cash_minor: number
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "register_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_gcash_submission: {
        Args: {
          p_idempotency_key: string
          p_payment_id: string
          p_rejection_reason: string
          p_submission_id: string
        }
        Returns: string
      }
      request_human_support: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      send_customer_support_message: {
        Args: { p_content: string; p_conversation_id: string }
        Returns: string
      }
      settle_cod_payment: {
        Args: {
          p_idempotency_key: string
          p_metadata?: Json
          p_payment_id: string
          p_reason: string
        }
        Returns: string
      }
      submit_gcash_proof: {
        Args: {
          p_claimed_amount_minor: number
          p_event_idempotency_key: string
          p_payment_id: string
          p_receipt_storage_path: string
          p_reference_number?: string
          p_reservation_expires_at: string
          p_submission_idempotency_key: string
        }
        Returns: string
      }
      transition_order: {
        Args: {
          p_changed_by: string
          p_idempotency_key: string
          p_metadata?: Json
          p_note: string
          p_order_id: string
          p_source: string
          p_to_status: string
        }
        Returns: {
          address_line1: string
          address_line2: string | null
          barangay: string | null
          cancellation_reason: string | null
          city_municipality: string
          country_code: string
          created_at: string
          currency_code: string
          customer_email: string
          customer_note: string | null
          delivery_failure_reason: string | null
          discount_minor: number
          fulfillment_method: string
          id: string
          idempotency_key: string
          order_number: string
          placed_at: string
          postal_code: string
          province: string
          recipient_name: string
          recipient_phone: string
          register_session_id: string | null
          sales_channel: string
          shipping_minor: number
          status: string
          subtotal_minor: number
          total_minor: number
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
