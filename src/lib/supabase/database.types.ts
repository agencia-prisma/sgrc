export type AppRole =
  | "super_admin"
  | "director"
  | "sales_manager"
  | "representative"
  | "promoter"
  | "finance"
  | "operations_marketing"
  | "legal_compliance"
  | "auditor";

export type CommercialMemberType = "representative" | "promoter";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          role: AppRole;
          assigned_at: string;
          assigned_by: string | null;
        };
        Insert: {
          user_id: string;
          role: AppRole;
          assigned_at?: string;
          assigned_by?: string | null;
        };
        Update: {
          user_id?: string;
          role?: AppRole;
          assigned_at?: string;
          assigned_by?: string | null;
        };
        Relationships: [];
      };
      territories: {
        Row: {
          id: string;
          name: string;
          code: string | null;
          parent_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code?: string | null;
          parent_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string | null;
          parent_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      commercial_team_members: {
        Row: {
          user_id: string;
          member_type: CommercialMemberType;
          manager_user_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          member_type: CommercialMemberType;
          manager_user_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          member_type?: CommercialMemberType;
          manager_user_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      commercial_team_territory_assignments: {
        Row: {
          user_id: string;
          territory_id: string;
          assigned_at: string;
          assigned_by: string | null;
        };
        Insert: {
          user_id: string;
          territory_id: string;
          assigned_at?: string;
          assigned_by?: string | null;
        };
        Update: {
          user_id?: string;
          territory_id?: string;
          assigned_at?: string;
          assigned_by?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_commercial_team_member: {
        Args: {
          target_user_id: string;
          target_member_type: CommercialMemberType;
          target_display_name: string;
          target_manager_user_id: string | null;
          target_territory_ids: string[];
          assigned_by_user_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: AppRole;
      commercial_member_type: CommercialMemberType;
    };
    CompositeTypes: Record<string, never>;
  };
};
