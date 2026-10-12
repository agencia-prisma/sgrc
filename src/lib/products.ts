export function normalizeProductSku(value: string) {
  return value.trim().toUpperCase();
}

export function parseProductPrice(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const price = Number(normalized);
  return Number.isFinite(price) ? Math.round(price * 100) / 100 : null;
}
