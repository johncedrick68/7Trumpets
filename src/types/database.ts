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
          id: string
          idempotency_key: string
          order_number: string
          placed_at: string
          postal_code: string
          province: string
          recipient_name: string
          recipient_phone: string
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
          id?: string
          idempotency_key: string
          order_number?: string
          placed_at?: string
          postal_code: string
          province: string
          recipient_name: string
          recipient_phone: string
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
          id?: string
          idempotency_key?: string
          order_number?: string
          placed_at?: string
          postal_code?: string
          province?: string
          recipient_name?: string
          recipient_phone?: string
          shipping_minor?: number
          status?: string
          subtotal_minor?: number
          total_minor?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
      checkout_order: {
        Args: {
          p_customer_id: string
          p_customer_note?: string
          p_delivery: Json
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
          id: string
          idempotency_key: string
          order_number: string
          placed_at: string
          postal_code: string
          province: string
          recipient_name: string
          recipient_phone: string
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
      manage_user_role: {
        Args: { p_assign: boolean; p_role: string; p_user_id: string }
        Returns: boolean
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
          id: string
          idempotency_key: string
          order_number: string
          placed_at: string
          postal_code: string
          province: string
          recipient_name: string
          recipient_phone: string
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

