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
          campaign_name: string
          copy_options: Json | null
          created_at: string
          daily_budget: number
          error_message: string | null
          id: string
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
          campaign_name: string
          copy_options?: Json | null
          created_at?: string
          daily_budget?: number
          error_message?: string | null
          id?: string
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
          campaign_name?: string
          copy_options?: Json | null
          created_at?: string
          daily_budget?: number
          error_message?: string | null
          id?: string
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
      client_profiles: {
        Row: {
          ad_account_id: string
          avatar_dossier: string | null
          budget_frequency: string
          budget_maximo: number
          cpa_max_toleravel: number
          cpa_meta: number
          created_at: string
          gemini_api_key: string | null
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
          teto_diario_escala: number
          ticket_medio: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_account_id?: string
          avatar_dossier?: string | null
          budget_frequency?: string
          budget_maximo?: number
          cpa_max_toleravel?: number
          cpa_meta?: number
          created_at?: string
          gemini_api_key?: string | null
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
          teto_diario_escala?: number
          ticket_medio?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_account_id?: string
          avatar_dossier?: string | null
          budget_frequency?: string
          budget_maximo?: number
          cpa_max_toleravel?: number
          cpa_meta?: number
          created_at?: string
          gemini_api_key?: string | null
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
          teto_diario_escala?: number
          ticket_medio?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      vsl_scripts: {
        Row: {
          angle: string
          created_at: string
          duration: string
          id: string
          profile_id: string | null
          script_content: string
          tone: string
          user_id: string
        }
        Insert: {
          angle?: string
          created_at?: string
          duration?: string
          id?: string
          profile_id?: string | null
          script_content?: string
          tone?: string
          user_id: string
        }
        Update: {
          angle?: string
          created_at?: string
          duration?: string
          id?: string
          profile_id?: string | null
          script_content?: string
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
  public: {
    Enums: {},
  },
} as const
