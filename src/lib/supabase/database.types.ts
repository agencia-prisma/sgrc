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
export type CrmRecordType = "company" | "person";
export type CrmRecordStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "converted"
  | "lost";
export type CrmInteractionType =
  | "note"
  | "call"
  | "email"
  | "meeting"
  | "whatsapp"
  | "other";

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
      crm_records: {
        Row: {
          id: string;
          record_type: CrmRecordType;
          name: string;
          trade_name: string | null;
          document: string | null;
          email: string | null;
          phone: string | null;
          status: CrmRecordStatus;
          territory_id: string | null;
          owner_user_id: string;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          record_type: CrmRecordType;
          name: string;
          trade_name?: string | null;
          document?: string | null;
          email?: string | null;
          phone?: string | null;
          status?: CrmRecordStatus;
          territory_id?: string | null;
          owner_user_id: string;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          record_type?: CrmRecordType;
          name?: string;
          trade_name?: string | null;
          document?: string | null;
          email?: string | null;
          phone?: string | null;
          status?: CrmRecordStatus;
          territory_id?: string | null;
          owner_user_id?: string;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      crm_interactions: {
        Row: {
          id: string;
          record_id: string;
          interaction_type: CrmInteractionType;
          summary: string;
          details: string | null;
          occurred_at: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          record_id: string;
          interaction_type: CrmInteractionType;
          summary: string;
          details?: string | null;
          occurred_at?: string;
          created_by?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          record_id?: string;
          interaction_type?: CrmInteractionType;
          summary?: string;
          details?: string | null;
          occurred_at?: string;
          created_by?: string;
          created_at?: string;
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
      can_access_crm: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      can_manage_crm_record: {
        Args: {
          target_owner_user_id: string;
          target_territory_id: string | null;
        };
        Returns: boolean;
      };
      can_view_crm_record: {
        Args: {
          target_owner_user_id: string;
          target_territory_id: string | null;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: AppRole;
      commercial_member_type: CommercialMemberType;
      crm_record_type: CrmRecordType;
      crm_record_status: CrmRecordStatus;
      crm_interaction_type: CrmInteractionType;
    };
    CompositeTypes: Record<string, never>;
  };
};
