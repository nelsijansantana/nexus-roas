export async function sha256(value: string | undefined): Promise<string> {
  if (!value) return '';
  const normalized = value.toLowerCase().trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Normalization (mirrors backend meta.service.ts) ─────────────────────────

/**
 * Remove non-digits; prepend 55 (Brazil) only when:
 *  - no country code is present yet (≤ 11 digits), AND
 *  - the number starts with a digit that is valid for Brazilian numbers (1-9).
 * International numbers that already start with a country code (e.g. "1..." US,
 * "44..." UK) are left as-is. Numbers already carrying the 55 prefix are also
 * left unchanged.
 */
export function normalizePhone(raw: string | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  // Already has country code: 12 digits starting with known 2-digit codes,
  // or 13 digits (55 + 11-digit BR), or 14+ digits
  if (digits.length >= 12) return digits;
  // 10–11 digits with no country code: assume Brazil
  if (digits.length >= 10) return '55' + digits;
  // Shorter numbers are likely incomplete — return as-is to avoid wrong prefix
  return digits;
}

/**
 * Normalize state to 2 lowercase chars as Meta expects (ISO 3166-2 sub-code).
 * Strips diacritics and truncates: "São Paulo" → "sa", "SP" → "sp".
 */
export function normalizeState(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .substring(0, 2);
}

/** First 2 lowercase chars — ISO 3166-1 alpha-2 country code. */
export function normalizeCountry(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim().toLowerCase().substring(0, 2);
}

export interface PIIData {
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  external_id?: string;
}

export async function hashPII(data: PIIData): Promise<Record<string, string>> {
  const [email, phone, first_name, last_name, city, state, country, zip, external_id] =
    await Promise.all([
      sha256(data.email),
      sha256(normalizePhone(data.phone)),
      sha256(data.first_name),
      sha256(data.last_name),
      sha256(data.city),
      sha256(normalizeState(data.state)),
      sha256(normalizeCountry(data.country)),
      sha256(data.zip?.replace(/[\s-]/g, '')),
      sha256(data.external_id)
    ]);

  return { email, phone, first_name, last_name, city, state, country, zip, external_id };
}
