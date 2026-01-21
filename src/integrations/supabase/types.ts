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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      approved_wave_counts: {
        Row: {
          confidence: number | null
          created_at: string
          historical_low: Json
          id: string
          is_reference: boolean | null
          notes: string | null
          source: string
          supercycle: Json
          symbol: string
          timeframe: string
          updated_at: string
          user_id: string
          version_number: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          historical_low: Json
          id?: string
          is_reference?: boolean | null
          notes?: string | null
          source?: string
          supercycle: Json
          symbol: string
          timeframe?: string
          updated_at?: string
          user_id: string
          version_number?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          historical_low?: Json
          id?: string
          is_reference?: boolean | null
          notes?: string | null
          source?: string
          supercycle?: Json
          symbol?: string
          timeframe?: string
          updated_at?: string
          user_id?: string
          version_number?: number | null
        }
        Relationships: []
      }
      deep_analyses: {
        Row: {
          analysis_json: Json
          created_at: string
          evidence_score: number | null
          id: string
          primary_pattern: string | null
          scan_id: string
          symbol: string
          timeframe: string
        }
        Insert: {
          analysis_json: Json
          created_at?: string
          evidence_score?: number | null
          id?: string
          primary_pattern?: string | null
          scan_id: string
          symbol: string
          timeframe?: string
        }
        Update: {
          analysis_json?: Json
          created_at?: string
          evidence_score?: number | null
          id?: string
          primary_pattern?: string | null
          scan_id?: string
          symbol?: string
          timeframe?: string
        }
        Relationships: [
          {
            foreignKeyName: "deep_analyses_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      instruments: {
        Row: {
          created_at: string
          exchange: string | null
          id: string
          market: string
          name: string | null
          symbol: string
        }
        Insert: {
          created_at?: string
          exchange?: string | null
          id?: string
          market: string
          name?: string | null
          symbol: string
        }
        Update: {
          created_at?: string
          exchange?: string | null
          id?: string
          market?: string
          name?: string | null
          symbol?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scan_symbols: {
        Row: {
          atr_pct: number | null
          attention_score_13f: number | null
          avg_volume_30d: number | null
          created_at: string
          error: string | null
          final_score: number | null
          fundamentals: Json | null
          fundamentals_score: number | null
          id: string
          last_price: number | null
          liquidity_score: number | null
          pivot_cleanliness: number | null
          regime: string | null
          scan_id: string
          structure_score: number | null
          symbol: string
          volatility_score: number | null
        }
        Insert: {
          atr_pct?: number | null
          attention_score_13f?: number | null
          avg_volume_30d?: number | null
          created_at?: string
          error?: string | null
          final_score?: number | null
          fundamentals?: Json | null
          fundamentals_score?: number | null
          id?: string
          last_price?: number | null
          liquidity_score?: number | null
          pivot_cleanliness?: number | null
          regime?: string | null
          scan_id: string
          structure_score?: number | null
          symbol: string
          volatility_score?: number | null
        }
        Update: {
          atr_pct?: number | null
          attention_score_13f?: number | null
          avg_volume_30d?: number | null
          created_at?: string
          error?: string | null
          final_score?: number | null
          fundamentals?: Json | null
          fundamentals_score?: number | null
          id?: string
          last_price?: number | null
          liquidity_score?: number | null
          pivot_cleanliness?: number | null
          regime?: string | null
          scan_id?: string
          structure_score?: number | null
          symbol?: string
          volatility_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_symbols_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          base_timeframe: string
          completed_at: string | null
          completed_count: number | null
          created_at: string
          id: string
          include_fundamentals: boolean | null
          include_structure_score: boolean | null
          params: Json
          results_summary: Json | null
          status: string
          symbols_count: number | null
          top_n: number | null
          universe_size: number | null
          user_id: string
          watchlist_id: string | null
        }
        Insert: {
          base_timeframe?: string
          completed_at?: string | null
          completed_count?: number | null
          created_at?: string
          id?: string
          include_fundamentals?: boolean | null
          include_structure_score?: boolean | null
          params?: Json
          results_summary?: Json | null
          status?: string
          symbols_count?: number | null
          top_n?: number | null
          universe_size?: number | null
          user_id: string
          watchlist_id?: string | null
        }
        Update: {
          base_timeframe?: string
          completed_at?: string | null
          completed_count?: number | null
          created_at?: string
          id?: string
          include_fundamentals?: boolean | null
          include_structure_score?: boolean | null
          params?: Json
          results_summary?: Json | null
          status?: string
          symbols_count?: number | null
          top_n?: number | null
          universe_size?: number | null
          user_id?: string
          watchlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scans_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      symbol_analysis: {
        Row: {
          alternates: Json | null
          cage_features: Json | null
          created_at: string
          data_hash: string | null
          evidence_score: number | null
          fundamentals: Json | null
          id: string
          levels: Json | null
          pre_filter_score: number | null
          primary_count: Json | null
          raw_analysis: Json | null
          scan_id: string | null
          symbol: string
          timeframe_set: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          alternates?: Json | null
          cage_features?: Json | null
          created_at?: string
          data_hash?: string | null
          evidence_score?: number | null
          fundamentals?: Json | null
          id?: string
          levels?: Json | null
          pre_filter_score?: number | null
          primary_count?: Json | null
          raw_analysis?: Json | null
          scan_id?: string | null
          symbol: string
          timeframe_set?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          alternates?: Json | null
          cage_features?: Json | null
          created_at?: string
          data_hash?: string | null
          evidence_score?: number | null
          fundamentals?: Json | null
          id?: string
          levels?: Json | null
          pre_filter_score?: number | null
          primary_count?: Json | null
          raw_analysis?: Json | null
          scan_id?: string | null
          symbol?: string
          timeframe_set?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "symbol_analysis_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_adjustments: {
        Row: {
          adjustment_json: Json
          created_at: string
          id: string
          notes: string | null
          symbol: string
          timeframe: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adjustment_json: Json
          created_at?: string
          id?: string
          notes?: string | null
          symbol: string
          timeframe?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          adjustment_json?: Json
          created_at?: string
          id?: string
          notes?: string | null
          symbol?: string
          timeframe?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          notes: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notes?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notes?: string | null
          source?: string | null
        }
        Relationships: []
      }
      watchlist_symbols: {
        Row: {
          added_at: string
          id: string
          notes: string | null
          symbol: string
          watchlist_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          notes?: string | null
          symbol: string
          watchlist_id: string
        }
        Update: {
          added_at?: string
          id?: string
          notes?: string | null
          symbol?: string
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_symbols_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wave_counts: {
        Row: {
          candle_frequency: string
          created_at: string
          end_date: string | null
          end_price: number | null
          id: string
          instrument_id: string
          is_validated: boolean | null
          next_level_parent_degree: string | null
          next_level_parent_id: string | null
          notes: string | null
          parent_degree: string | null
          parent_wave_id: string | null
          price_level: string | null
          session_id: string
          start_date: string
          start_price: number
          updated_at: string
          user_id: string
          validation_notes: string | null
          version_number: number | null
          wave_degree: string
          wave_label: string
          wave_type: string
        }
        Insert: {
          candle_frequency?: string
          created_at?: string
          end_date?: string | null
          end_price?: number | null
          id?: string
          instrument_id: string
          is_validated?: boolean | null
          next_level_parent_degree?: string | null
          next_level_parent_id?: string | null
          notes?: string | null
          parent_degree?: string | null
          parent_wave_id?: string | null
          price_level?: string | null
          session_id: string
          start_date: string
          start_price: number
          updated_at?: string
          user_id: string
          validation_notes?: string | null
          version_number?: number | null
          wave_degree: string
          wave_label: string
          wave_type: string
        }
        Update: {
          candle_frequency?: string
          created_at?: string
          end_date?: string | null
          end_price?: number | null
          id?: string
          instrument_id?: string
          is_validated?: boolean | null
          next_level_parent_degree?: string | null
          next_level_parent_id?: string | null
          notes?: string | null
          parent_degree?: string | null
          parent_wave_id?: string | null
          price_level?: string | null
          session_id?: string
          start_date?: string
          start_price?: number
          updated_at?: string
          user_id?: string
          validation_notes?: string | null
          version_number?: number | null
          wave_degree?: string
          wave_label?: string
          wave_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wave_counts_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wave_counts_next_level_parent_id_fkey"
            columns: ["next_level_parent_id"]
            isOneToOne: false
            referencedRelation: "wave_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wave_counts_parent_wave_id_fkey"
            columns: ["parent_wave_id"]
            isOneToOne: false
            referencedRelation: "wave_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wave_counts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "wave_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      wave_drawings: {
        Row: {
          created_at: string
          drawing_data: Json
          drawing_type: string
          id: string
          session_id: string
          updated_at: string
          user_id: string
          wave_degree: string | null
          wave_label: string | null
        }
        Insert: {
          created_at?: string
          drawing_data: Json
          drawing_type?: string
          id?: string
          session_id: string
          updated_at?: string
          user_id: string
          wave_degree?: string | null
          wave_label?: string | null
        }
        Update: {
          created_at?: string
          drawing_data?: Json
          drawing_type?: string
          id?: string
          session_id?: string
          updated_at?: string
          user_id?: string
          wave_degree?: string | null
          wave_label?: string | null
        }
        Relationships: []
      }
      wave_sessions: {
        Row: {
          created_at: string
          id: string
          instrument_id: string
          is_active: boolean | null
          notes: string | null
          session_name: string | null
          timeframe: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instrument_id: string
          is_active?: boolean | null
          notes?: string | null
          session_name?: string | null
          timeframe?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instrument_id?: string
          is_active?: boolean | null
          notes?: string | null
          session_name?: string | null
          timeframe?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wave_sessions_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
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
