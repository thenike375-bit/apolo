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
      lessons: {
        Row: {
          created_at: string
          id: string
          key_points: Json
          status: string
          subject: string | null
          summary: string | null
          title: string
          topics: Json
          transcript: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_points?: Json
          status?: string
          subject?: string | null
          summary?: string | null
          title?: string
          topics?: Json
          transcript?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          key_points?: Json
          status?: string
          subject?: string | null
          summary?: string | null
          title?: string
          topics?: Json
          transcript?: string
          user_id?: string
        }
        Relationships: []
      }
      ltx_clip_submissions: {
        Row: {
          clip_index: number
          created_at: string
          preparation_id: string
          provider_id: string | null
        }
        Insert: {
          clip_index: number
          created_at?: string
          preparation_id: string
          provider_id?: string | null
        }
        Update: {
          clip_index?: number
          created_at?: string
          preparation_id?: string
          provider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ltx_clip_submissions_preparation_id_fkey"
            columns: ["preparation_id"]
            isOneToOne: false
            referencedRelation: "ltx_demo_reservations"
            referencedColumns: ["preparation_id"]
          },
        ]
      }
      ltx_demo_reservations: {
        Row: {
          created_at: string
          preparation_id: string
          reserved_cents: number
        }
        Insert: {
          created_at?: string
          preparation_id: string
          reserved_cents?: number
        }
        Update: {
          created_at?: string
          preparation_id?: string
          reserved_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "ltx_demo_reservations_preparation_id_fkey"
            columns: ["preparation_id"]
            isOneToOne: true
            referencedRelation: "prepared_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          id: string
          parts: Json
          role: string
          thread_id: string
          ui_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parts?: Json
          role: string
          thread_id: string
          ui_id?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          thread_id?: string
          ui_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      preparation_control: {
        Row: {
          blocked_kind: string | null
          id: boolean
          lease_until: string | null
          paused_reason: string | null
        }
        Insert: {
          blocked_kind?: string | null
          id?: boolean
          lease_until?: string | null
          paused_reason?: string | null
        }
        Update: {
          blocked_kind?: string | null
          id?: boolean
          lease_until?: string | null
          paused_reason?: string | null
        }
        Relationships: []
      }
      prepared_lessons: {
        Row: {
          callback_token: string
          completed: boolean
          created_at: string
          error: string | null
          film: Json
          film_version: number
          id: string
          lease_until: string | null
          lesson_id: string | null
          playback_seconds: number
          question: string
          scene_index: number
          scenes: Json
          stage: string
          status: string
          updated_at: string
          user_id: string
          video_provider: string
        }
        Insert: {
          callback_token?: string
          completed?: boolean
          created_at?: string
          error?: string | null
          film?: Json
          film_version?: number
          id?: string
          lease_until?: string | null
          lesson_id?: string | null
          playback_seconds?: number
          question: string
          scene_index?: number
          scenes?: Json
          stage?: string
          status?: string
          updated_at?: string
          user_id: string
          video_provider?: string
        }
        Update: {
          callback_token?: string
          completed?: boolean
          created_at?: string
          error?: string | null
          film?: Json
          film_version?: number
          id?: string
          lease_until?: string | null
          lesson_id?: string | null
          playback_seconds?: number
          question?: string
          scene_index?: number
          scenes?: Json
          stage?: string
          status?: string
          updated_at?: string
          user_id?: string
          video_provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "prepared_lessons_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_id: string
          avatar_url: string | null
          created_at: string
          display_name: string | null
          education_level: string | null
          id: string
          language: string
          learning_style: string | null
          onboarded: boolean
          subjects: string[]
          teacher_name: string
          teacher_voice: string
          updated_at: string
        }
        Insert: {
          avatar_id?: string
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          education_level?: string | null
          id: string
          language?: string
          learning_style?: string | null
          onboarded?: boolean
          subjects?: string[]
          teacher_name?: string
          teacher_voice?: string
          updated_at?: string
        }
        Update: {
          avatar_id?: string
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          education_level?: string | null
          id?: string
          language?: string
          learning_style?: string | null
          onboarded?: boolean
          subjects?: string[]
          teacher_name?: string
          teacher_voice?: string
          updated_at?: string
        }
        Relationships: []
      }
      quizzes: {
        Row: {
          answers: Json | null
          completed_at: string | null
          created_at: string
          id: string
          lesson_id: string | null
          questions: Json
          score: number | null
          topic: string
          total: number | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          questions?: Json
          score?: number | null
          topic: string
          total?: number | null
          user_id?: string
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          questions?: Json
          score?: number | null
          topic?: string
          total?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          created_at: string
          id: string
          lesson_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_preparation: { Args: never; Returns: string }
      claim_preparation_job: {
        Args: { job_id: string; secret: string }
        Returns: boolean
      }
      reserve_ltx_demo: { Args: { job_id: string }; Returns: boolean }
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
    Enums: {},
  },
} as const
