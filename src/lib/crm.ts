import type {
  CrmInteractionType,
  CrmRecordStatus,
  CrmRecordType,
} from "@/lib/supabase/database.types";

export const CRM_ROLES = [
  "super_admin",
  "director",
  "sales_manager",
  "representative",
  "promoter",
] as const;

const crmRoleSet = new Set<string>(CRM_ROLES);

export function hasCrmRole(role: string) {
  return crmRoleSet.has(role);
}

export const CRM_STATUS_LABELS: Record<CrmRecordStatus, string> = {
  new: "Novo",
  contacted: "Em contato",
  qualified: "Qualificado",
  converted: "Convertido",
  lost: "Perdido",
};

export const CRM_TYPE_LABELS: Record<CrmRecordType, string> = {
  company: "Empresa / loja",
  person: "Pessoa física",
};

export const CRM_INTERACTION_LABELS: Record<CrmInteractionType, string> = {
  note: "Anotação",
  call: "Ligação",
  email: "E-mail",
  meeting: "Reunião",
  whatsapp: "WhatsApp",
  other: "Outro",
};

export function isCrmRecordStatus(value: unknown): value is CrmRecordStatus {
  return (
    typeof value === "string" &&
    Object.hasOwn(CRM_STATUS_LABELS, value)
  );
}

export function isCrmRecordType(value: unknown): value is CrmRecordType {
  return typeof value === "string" && Object.hasOwn(CRM_TYPE_LABELS, value);
}

export function isCrmInteractionType(
  value: unknown,
): value is CrmInteractionType {
  return (
    typeof value === "string" &&
    Object.hasOwn(CRM_INTERACTION_LABELS, value)
  );
}

export function isValidBrazilianDocument(
  document: string,
  type: CrmRecordType,
) {
  if (type === "person") {
    if (!/^\d{11}$/.test(document) || /^(\d)\1{10}$/.test(document)) {
      return false;
    }
    const digits = [...document].map(Number);
    const firstDigit =
      (digits
        .slice(0, 9)
        .reduce((sum, digit, index) => sum + digit * (10 - index), 0) *
        10) %
      11;
    const expectedFirst = firstDigit === 10 ? 0 : firstDigit;
    const secondDigit =
      (digits
        .slice(0, 10)
        .reduce((sum, digit, index) => sum + digit * (11 - index), 0) *
        10) %
      11;
    const expectedSecond = secondDigit === 10 ? 0 : secondDigit;
    return digits[9] === expectedFirst && digits[10] === expectedSecond;
  }

  if (
    !/^[0-9A-Z]{12}[0-9]{2}$/.test(document) ||
    /^([0-9A-Z])\1{13}$/.test(document)
  ) {
    return false;
  }
  const digits = [...document].map((character) =>
    /^[0-9]$/.test(character)
      ? Number(character)
      : character.charCodeAt(0) - 48,
  );
  const calculateDigit = (values: number[], weights: number[]) => {
    const remainder =
      values.reduce((sum, digit, index) => sum + digit * weights[index], 0) %
      11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const firstDigit = calculateDigit(
    digits.slice(0, 12),
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  const secondDigit = calculateDigit(
    digits.slice(0, 12).concat(firstDigit),
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return (
    Number(document[12]) === firstDigit &&
    Number(document[13]) === secondDigit
  );
}

export function normalizeBrazilianDocument(document: string) {
  return document.trim().replace(/[.\/\s-]/g, "").toUpperCase();
}
