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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_role: AppRole;
    };
    CompositeTypes: Record<string, never>;
  };
};
