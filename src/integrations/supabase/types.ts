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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      disease_scans: {
        Row: {
          confidence: number | null
          created_at: string
          disease: string | null
          field_id: string | null
          id: string
          image_url: string
          raw: Json | null
          recommendation: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          disease?: string | null
          field_id?: string | null
          id?: string
          image_url: string
          raw?: Json | null
          recommendation?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          disease?: string | null
          field_id?: string | null
          id?: string
          image_url?: string
          raw?: Json | null
          recommendation?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disease_scans_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
        ]
      }
      fields: {
        Row: {
          area_acres: number
          centroid_lat: number
          centroid_lng: number
          created_at: string
          crop: string | null
          id: string
          image_url: string | null
          name: string
          polygon: Json
          soil_type: string | null
          updated_at: string
          user_id: string
          water_source: string | null
        }
        Insert: {
          area_acres: number
          centroid_lat: number
          centroid_lng: number
          created_at?: string
          crop?: string | null
          id?: string
          image_url?: string | null
          name: string
          polygon: Json
          soil_type?: string | null
          updated_at?: string
          user_id: string
          water_source?: string | null
        }
        Update: {
          area_acres?: number
          centroid_lat?: number
          centroid_lng?: number
          created_at?: string
          crop?: string | null
          id?: string
          image_url?: string | null
          name?: string
          polygon?: Json
          soil_type?: string | null
          updated_at?: string
          user_id?: string
          water_source?: string | null
        }
        Relationships: []
      }
      government_schemes: {
        Row: {
          apply_url: string
          benefits: string
          category: string
          created_at: string
          description: string
          documents: string
          eligibility: string
          id: string
          image_url: string | null
          official_url: string
          title: string
        }
        Insert: {
          apply_url: string
          benefits: string
          category: string
          created_at?: string
          description: string
          documents: string
          eligibility: string
          id?: string
          image_url?: string | null
          official_url: string
          title: string
        }
        Update: {
          apply_url?: string
          benefits?: string
          category?: string
          created_at?: string
          description?: string
          documents?: string
          eligibility?: string
          id?: string
          image_url?: string | null
          official_url?: string
          title?: string
        }
        Relationships: []
      }
      market_prices: {
        Row: {
          created_at: string
          crop: string
          id: string
          market: string
          prev_price: number | null
          price_per_quintal: number
          recorded_on: string
          state: string
        }
        Insert: {
          created_at?: string
          crop: string
          id?: string
          market: string
          prev_price?: number | null
          price_per_quintal: number
          recorded_on?: string
          state: string
        }
        Update: {
          created_at?: string
          crop?: string
          id?: string
          market?: string
          prev_price?: number | null
          price_per_quintal?: number
          recorded_on?: string
          state?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          dark_mode: boolean
          district: string | null
          email: string | null
          full_name: string | null
          id: string
          language: string
          notify_disease: boolean
          notify_recommendations: boolean
          notify_weather: boolean
          phone: string | null
          quiet_end: string
          quiet_hours_enabled: boolean
          quiet_start: string
          state: string | null
          updated_at: string
          village: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          dark_mode?: boolean
          district?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          language?: string
          notify_disease?: boolean
          notify_recommendations?: boolean
          notify_weather?: boolean
          phone?: string | null
          quiet_end?: string
          quiet_hours_enabled?: boolean
          quiet_start?: string
          state?: string | null
          updated_at?: string
          village?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          dark_mode?: boolean
          district?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          language?: string
          notify_disease?: boolean
          notify_recommendations?: boolean
          notify_weather?: boolean
          phone?: string | null
          quiet_end?: string
          quiet_hours_enabled?: boolean
          quiet_start?: string
          state?: string | null
          updated_at?: string
          village?: string | null
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          created_at: string
          field_id: string | null
          id: string
          kind: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          field_id?: string | null
          id?: string
          kind: string
          payload: Json
          user_id: string
        }
        Update: {
          created_at?: string
          field_id?: string | null
          id?: string
          kind?: string
          payload?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
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
