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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      campaign_drafts: {
        Row: {
          ai_reasoning: string | null
          andromeda_targeting: Json | null
          campaign_name: string
          copy_options: Json | null
          created_at: string
          creative_urls: string[] | null
          daily_budget: number
          error_message: string | null
          id: string
          injected_creative_url: string | null
          meta_ad_id: string | null
          meta_adset_id: string | null
          meta_campaign_id: string | null
          objective: string
          profile_id: string | null
          status: string
          targeting_suggestion: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_reasoning?: string | null
          andromeda_targeting?: Json | null
          campaign_name: string
          copy_options?: Json | null
          created_at?: string
          creative_urls?: string[] | null
          daily_budget?: number
          error_message?: string | null
          id?: string
          injected_creative_url?: string | null
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          objective: string
          profile_id?: string | null
          status?: string
          targeting_suggestion?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_reasoning?: string | null
          andromeda_targeting?: Json | null
          campaign_name?: string
          copy_options?: Json | null
          created_at?: string
          creative_urls?: string[] | null
          daily_budget?: number
          error_message?: string | null
          id?: string
          injected_creative_url?: string | null
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          objective?: string
          profile_id?: string | null
          status?: string
          targeting_suggestion?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_drafts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          profile_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profiles: {
        Row: {
          ad_account_id: string
          api_base_url: string | null
          avatar_dossier: string | null
          budget_frequency: string
          budget_maximo: number
          business_hours_end: number
          business_hours_start: number
          catalog_id: string | null
          cpa_max_toleravel: number
          cpa_meta: number
          created_at: string
          daypart_config: Json
          gemini_api_key: string | null
          hourly_optimizer_enabled: boolean
          id: string
          is_active: boolean
          limite_escala: number
          meta_access_token: string | null
          name: string
          page_id: string | null
          pixel_id: string | null
          product_context: string | null
          product_urls: string[] | null
          roas_min_escala: number
          rollback_enabled: boolean
          rollback_roas_threshold: number
          teto_diario_escala: number
          ticket_medio: number
          updated_at: string
          user_id: string
          vertical_scale_enabled: boolean
        }
        Insert: {
          ad_account_id?: string
          api_base_url?: string | null
          avatar_dossier?: string | null
          budget_frequency?: string
          budget_maximo?: number
          business_hours_end?: number
          business_hours_start?: number
          catalog_id?: string | null
          cpa_max_toleravel?: number
          cpa_meta?: number
          created_at?: string
          daypart_config?: Json
          gemini_api_key?: string | null
          hourly_optimizer_enabled?: boolean
          id?: string
          is_active?: boolean
          limite_escala?: number
          meta_access_token?: string | null
          name: string
          page_id?: string | null
          pixel_id?: string | null
          product_context?: string | null
          product_urls?: string[] | null
          roas_min_escala?: number
          rollback_enabled?: boolean
          rollback_roas_threshold?: number
          teto_diario_escala?: number
          ticket_medio?: number
          updated_at?: string
          user_id: string
          vertical_scale_enabled?: boolean
        }
        Update: {
          ad_account_id?: string
          api_base_url?: string | null
          avatar_dossier?: string | null
          budget_frequency?: string
          budget_maximo?: number
          business_hours_end?: number
          business_hours_start?: number
          catalog_id?: string | null
          cpa_max_toleravel?: number
          cpa_meta?: number
          created_at?: string
          daypart_config?: Json
          gemini_api_key?: string | null
          hourly_optimizer_enabled?: boolean
          id?: string
          is_active?: boolean
          limite_escala?: number
          meta_access_token?: string | null
          name?: string
          page_id?: string | null
          pixel_id?: string | null
          product_context?: string | null
          product_urls?: string[] | null
          roas_min_escala?: number
          rollback_enabled?: boolean
          rollback_roas_threshold?: number
          teto_diario_escala?: number
          ticket_medio?: number
          updated_at?: string
          user_id?: string
          vertical_scale_enabled?: boolean
        }
        Relationships: []
      }
      copy_feedback: {
        Row: {
          admin_notes: string | null
          copy_type: string | null
          created_at: string
          draft_id: string | null
          id: string
          original_copy: string
          profile_id: string | null
          status: string
          suggested_correction: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          copy_type?: string | null
          created_at?: string
          draft_id?: string | null
          id?: string
          original_copy: string
          profile_id?: string | null
          status?: string
          suggested_correction: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          copy_type?: string | null
          created_at?: string
          draft_id?: string | null
          id?: string
          original_copy?: string
          profile_id?: string | null
          status?: string
          suggested_correction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copy_feedback_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "campaign_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_feedback_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_assets: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_type: string
          file_url: string
          id: string
          profile_id: string | null
          source_tag: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          profile_id?: string | null
          source_tag?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          profile_id?: string | null
          source_tag?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_assets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          id: string
          profile_id: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          id?: string
          profile_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          profile_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          created_at: string
          doc_type: string
          extracted_text: string | null
          field_key: string | null
          file_name: string | null
          file_url: string | null
          id: string
          profile_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type?: string
          extracted_text?: string | null
          field_key?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          profile_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          extracted_text?: string | null
          field_key?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          profile_id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_connections: {
        Row: {
          created_at: string
          credentials: Json
          display_name: string
          id: string
          is_active: boolean
          last_synced_at: string | null
          platform: Database["public"]["Enums"]["ad_platform"]
          platform_account_id: string | null
          profile_id: string
          status: string
          sync_error: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credentials?: Json
          display_name?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          platform: Database["public"]["Enums"]["ad_platform"]
          platform_account_id?: string | null
          profile_id: string
          status?: string
          sync_error?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credentials?: Json
          display_name?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          platform?: Database["public"]["Enums"]["ad_platform"]
          platform_account_id?: string | null
          profile_id?: string
          status?: string
          sync_error?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_connections_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ugc_characters: {
        Row: {
          created_at: string
          fixed_description: string
          id: string
          image_references: string[] | null
          name: string
          profile_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fixed_description?: string
          id?: string
          image_references?: string[] | null
          name: string
          profile_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fixed_description?: string
          id?: string
          image_references?: string[] | null
          name?: string
          profile_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ugc_characters_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_metrics: {
        Row: {
          campaign_id: string | null
          campaign_name: string | null
          clicks: number
          connection_id: string
          conversion_value: number
          conversions: number
          cpa: number
          cpc: number
          cpm: number
          created_at: string
          ctr: number
          date: string
          extra_metrics: Json | null
          id: string
          impressions: number
          platform: Database["public"]["Enums"]["ad_platform"]
          profile_id: string
          roas: number
          spend: number
          synced_at: string
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number
          connection_id: string
          conversion_value?: number
          conversions?: number
          cpa?: number
          cpc?: number
          cpm?: number
          created_at?: string
          ctr?: number
          date: string
          extra_metrics?: Json | null
          id?: string
          impressions?: number
          platform: Database["public"]["Enums"]["ad_platform"]
          profile_id: string
          roas?: number
          spend?: number
          synced_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number
          connection_id?: string
          conversion_value?: number
          conversions?: number
          cpa?: number
          cpc?: number
          cpm?: number
          created_at?: string
          ctr?: number
          date?: string
          extra_metrics?: Json | null
          id?: string
          impressions?: number
          platform?: Database["public"]["Enums"]["ad_platform"]
          profile_id?: string
          roas?: number
          spend?: number
          synced_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unified_metrics_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "platform_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_metrics_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vsl_scripts: {
        Row: {
          angle: string
          content_json: Json | null
          created_at: string
          duration: string
          id: string
          profile_id: string | null
          script_content: string
          title: string
          tone: string
          user_id: string
        }
        Insert: {
          angle?: string
          content_json?: Json | null
          created_at?: string
          duration?: string
          id?: string
          profile_id?: string | null
          script_content?: string
          title?: string
          tone?: string
          user_id: string
        }
        Update: {
          angle?: string
          content_json?: Json | null
          created_at?: string
          duration?: string
          id?: string
          profile_id?: string | null
          script_content?: string
          title?: string
          tone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vsl_scripts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      ad_platform: "meta" | "google" | "tiktok" | "linkedin" | "pinterest"
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
  public: {
    Enums: {
      ad_platform: ["meta", "google", "tiktok", "linkedin", "pinterest"],
    },
  },
} as const
