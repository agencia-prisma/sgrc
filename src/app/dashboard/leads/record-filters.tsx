"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CRM_STATUS_LABELS, CRM_TYPE_LABELS } from "@/lib/crm";
import type {
  CrmRecordStatus,
  CrmRecordType,
} from "@/lib/supabase/database.types";

export default function RecordFilters({
  search,
  status,
  recordType,
}: {
  search: string;
  status: string;
  recordType: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}${params.size ? `?${params}` : ""}`);
  }

  return (
    <form
      className="crm-filter-bar"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const params = new URLSearchParams();
        const query = String(form.get("search") ?? "").trim();
        const selectedStatus = String(form.get("status") ?? "");
        const selectedType = String(form.get("type") ?? "");
        if (query) params.set("q", query);
        if (selectedStatus) params.set("status", selectedStatus);
        if (selectedType) params.set("type", selectedType);
        router.push(`${pathname}${params.size ? `?${params}` : ""}`);
      }}
    >
      <label className="crm-search">
        <span className="sr-only">Buscar pelo nome</span>
        <input
          className="input"
          defaultValue={search}
          maxLength={100}
          name="search"
          placeholder="Buscar pelo nome"
        />
      </label>
      <label>
        <span className="sr-only">Filtrar por etapa</span>
        <select
          className="input"
          defaultValue={status}
          name="status"
          onChange={(event) => updateFilter("status", event.target.value)}
        >
          <option value="">Todas as etapas</option>
          {Object.entries(CRM_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Filtrar por tipo de cadastro</span>
        <select
          className="input"
          defaultValue={recordType}
          name="type"
          onChange={(event) => updateFilter("type", event.target.value)}
        >
          <option value="">Empresas e pessoas</option>
          {Object.entries(CRM_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button className="secondary-button" type="submit">
        Buscar
      </button>
    </form>
  );
}

export function isCrmStatusFilter(value: string): value is CrmRecordStatus {
  return Object.hasOwn(CRM_STATUS_LABELS, value);
}

export function isCrmTypeFilter(value: string): value is CrmRecordType {
  return Object.hasOwn(CRM_TYPE_LABELS, value);
}
