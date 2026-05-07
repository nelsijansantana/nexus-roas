/**
 * firstDefined — Utility to pick the first non-empty value.
 */
export function firstDefined(...values: (string | number | undefined | null)[]): string {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return '';
}

export function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length; i++) {
    if (current == null) return undefined;
    current = current[keys[i]];
  }
  return current;
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.substring(0, idx).trim();
    const value = pair.substring(idx + 1).trim();
    cookies[key] = value;
  }
  return cookies;
}

export function generateId(): string {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

export function splitFirstName(fullname: string | undefined): string {
  if (!fullname) return '';
  return fullname.trim().split(/\s+/)[0];
}

export function splitLastName(fullname: string | undefined): string {
  if (!fullname) return '';
  const parts = fullname.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : '';
}
