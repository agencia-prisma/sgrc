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
export type SalesOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected";
export type SalesOrderFinancialEventType = "invoice" | "payment_received";
export type SalesOrderFinancialEventSource = "manual" | "erp";
export type CrmTransferStatus =
  | "pending_manager"
  | "pending_director"
  | "approved"
  | "rejected";
export type CrmProtectionEventType = "purchase" | "transfer";

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
      products: {
        Row: {
          id: string;
          sku: string;
          name: string;
          price: number;
          is_active: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku: string;
          name: string;
          price: number;
          is_active?: boolean;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sku?: string;
          name?: string;
          price?: number;
          is_active?: boolean;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sales_orders: {
        Row: {
          id: string;
          customer_id: string;
          customer_name_snapshot: string;
          customer_document_snapshot: string | null;
          territory_id: string | null;
          owner_user_id: string;
          status: SalesOrderStatus;
          total: number;
          notes: string | null;
          submitted_at: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          rejection_reason: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          customer_name_snapshot: string;
          customer_document_snapshot?: string | null;
          territory_id?: string | null;
          owner_user_id?: string;
          status?: SalesOrderStatus;
          total?: number;
          notes?: string | null;
          submitted_at?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          rejection_reason?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          customer_name_snapshot?: string;
          customer_document_snapshot?: string | null;
          territory_id?: string | null;
          owner_user_id?: string;
          status?: SalesOrderStatus;
          total?: number;
          notes?: string | null;
          submitted_at?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          rejection_reason?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sales_order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          sku_snapshot: string;
          name_snapshot: string;
          quantity: number;
          unit_price: number;
          line_total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          sku_snapshot: string;
          name_snapshot: string;
          quantity: number;
          unit_price: number;
          line_total: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          sku_snapshot?: string;
          name_snapshot?: string;
          quantity?: number;
          unit_price?: number;
          line_total?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      sales_order_notifications: {
        Row: {
          id: string;
          user_id: string;
          order_id: string;
          notification_type: "approved" | "rejected";
          title: string;
          message: string;
          email_status: "pending" | "sent" | "failed";
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          order_id: string;
          notification_type: "approved" | "rejected";
          title: string;
          message: string;
          email_status?: "pending" | "sent" | "failed";
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          order_id?: string;
          notification_type?: "approved" | "rejected";
          title?: string;
          message?: string;
          email_status?: "pending" | "sent" | "failed";
          created_at?: string;
          read_at?: string | null;
        };
        Relationships: [];
      };
      sales_order_financial_events: {
        Row: {
          id: string;
          sales_order_id: string;
          event_type: SalesOrderFinancialEventType;
          source: SalesOrderFinancialEventSource;
          external_event_id: string | null;
          invoice_number: string | null;
          amount: number | null;
          occurred_on: string;
          recorded_by: string | null;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          sales_order_id: string;
          event_type: SalesOrderFinancialEventType;
          source: SalesOrderFinancialEventSource;
          external_event_id?: string | null;
          invoice_number?: string | null;
          amount?: number | null;
          occurred_on: string;
          recorded_by?: string | null;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          sales_order_id?: string;
          event_type?: SalesOrderFinancialEventType;
          source?: SalesOrderFinancialEventSource;
          external_event_id?: string | null;
          invoice_number?: string | null;
          amount?: number | null;
          occurred_on?: string;
          recorded_by?: string | null;
          recorded_at?: string;
        };
        Relationships: [];
      };
      crm_customer_protections: {
        Row: {
          customer_id: string;
          protected_owner_user_id: string;
          protected_since: string;
          protected_until: string;
          source_order_id: string;
          updated_at: string;
        };
        Insert: {
          customer_id: string;
          protected_owner_user_id: string;
          protected_since: string;
          protected_until: string;
          source_order_id: string;
          updated_at?: string;
        };
        Update: {
          customer_id?: string;
          protected_owner_user_id?: string;
          protected_since?: string;
          protected_until?: string;
          source_order_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      crm_customer_protection_events: {
        Row: {
          id: string;
          customer_id: string;
          event_type: CrmProtectionEventType;
          from_owner_user_id: string | null;
          to_owner_user_id: string;
          source_order_id: string | null;
          protected_since: string;
          protected_until: string;
          recorded_by: string | null;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          event_type: CrmProtectionEventType;
          from_owner_user_id?: string | null;
          to_owner_user_id: string;
          source_order_id?: string | null;
          protected_since: string;
          protected_until: string;
          recorded_by?: string | null;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          event_type?: CrmProtectionEventType;
          from_owner_user_id?: string | null;
          to_owner_user_id?: string;
          source_order_id?: string | null;
          protected_since?: string;
          protected_until?: string;
          recorded_by?: string | null;
          recorded_at?: string;
        };
        Relationships: [];
      };
      crm_customer_transfer_requests: {
        Row: {
          id: string;
          customer_id: string;
          requested_by: string;
          source_owner_user_id: string;
          target_owner_user_id: string;
          required_manager_user_id: string;
          status: CrmTransferStatus;
          reason: string;
          manager_decision: string | null;
          manager_decided_by: string | null;
          manager_decided_at: string | null;
          manager_decision_reason: string | null;
          director_decision: string | null;
          director_decided_by: string | null;
          director_decided_at: string | null;
          director_decision_reason: string | null;
          transferred_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          requested_by: string;
          source_owner_user_id: string;
          target_owner_user_id: string;
          required_manager_user_id: string;
          status?: CrmTransferStatus;
          reason: string;
          manager_decision?: string | null;
          manager_decided_by?: string | null;
          manager_decided_at?: string | null;
          manager_decision_reason?: string | null;
          director_decision?: string | null;
          director_decided_by?: string | null;
          director_decided_at?: string | null;
          director_decision_reason?: string | null;
          transferred_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          requested_by?: string;
          source_owner_user_id?: string;
          target_owner_user_id?: string;
          required_manager_user_id?: string;
          status?: CrmTransferStatus;
          reason?: string;
          manager_decision?: string | null;
          manager_decided_by?: string | null;
          manager_decided_at?: string | null;
          manager_decision_reason?: string | null;
          director_decision?: string | null;
          director_decided_by?: string | null;
          director_decided_at?: string | null;
          director_decision_reason?: string | null;
          transferred_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      has_required_mfa_assurance: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
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
      can_view_sales_order: {
        Args: { target_owner_user_id: string };
        Returns: boolean;
      };
      can_review_sales_order: {
        Args: { target_owner_user_id: string };
        Returns: boolean;
      };
      create_sales_order: {
        Args: {
          target_customer_id: string;
          target_items: Json;
          target_notes?: string | null;
        };
        Returns: string;
      };
      update_sales_order_draft: {
        Args: {
          target_order_id: string;
          target_customer_id: string;
          target_items: Json;
          target_notes?: string | null;
        };
        Returns: undefined;
      };
      submit_sales_order: {
        Args: { target_order_id: string };
        Returns: undefined;
      };
      review_sales_order: {
        Args: {
          target_order_id: string;
          approve: boolean;
          reason?: string | null;
        };
        Returns: undefined;
      };
      record_sales_order_invoice: {
        Args: {
          target_order_id: string;
          target_invoice_number: string;
          target_invoice_date: string;
          target_source: SalesOrderFinancialEventSource;
          target_external_event_id: string | null;
        };
        Returns: string;
      };
      record_sales_order_payment: {
        Args: {
          target_order_id: string;
          target_amount: number;
          target_payment_date: string;
          target_source: SalesOrderFinancialEventSource;
          target_external_event_id: string | null;
        };
        Returns: string;
      };
      list_crm_transfer_owners: {
        Args: { target_customer_id: string };
        Returns: {
          user_id: string;
          display_name: string | null;
        }[];
      };
      create_crm_customer_transfer_request: {
        Args: {
          target_customer_id: string;
          target_owner_user_id: string;
          transfer_reason: string;
        };
        Returns: string;
      };
      review_crm_customer_transfer_request: {
        Args: {
          target_request_id: string;
          approve: boolean;
          decision_reason?: string | null;
        };
        Returns: CrmTransferStatus;
      };
      admin_assign_user_role: {
        Args: {
          target_user_id: string;
          target_role: AppRole;
          target_display_name: string | null;
          assigned_by_user_id: string;
        };
        Returns: undefined;
      };
      admin_remove_user_role: {
        Args: {
          target_user_id: string;
          target_role: AppRole;
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
      sales_order_status: SalesOrderStatus;
      sales_order_financial_event_type: SalesOrderFinancialEventType;
      sales_order_financial_event_source: SalesOrderFinancialEventSource;
      crm_transfer_status: CrmTransferStatus;
      crm_protection_event_type: CrmProtectionEventType;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
