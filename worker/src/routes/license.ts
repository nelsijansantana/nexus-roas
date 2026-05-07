import { Env } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function requireAdminSecret(request: Request, env: Env): boolean {
  const secret = request.headers.get('X-Admin-Secret');
  return !!(env.NEXUS_ADMIN_SECRET && secret === env.NEXUS_ADMIN_SECRET);
}

function generateLicenseKey(): string {
  const hex = () => Math.random().toString(16).slice(2, 6).toUpperCase();
  return `NXS-${hex()}-${hex()}-${hex()}`;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // "2026-05"
}

// ── Tier limits ───────────────────────────────────────────────────────────────

const TIER_LIMITS: Record<string, {
  max_projects: number;
  max_sales_month: number;
  max_seats: number;
  data_retention_days: number;
}> = {
  starter:  { max_projects: 1,  max_sales_month: 500,   max_seats: 1,  data_retention_days: 60  },
  pro:      { max_projects: 3,  max_sales_month: 2000,  max_seats: 1,  data_retention_days: 90  },
  business: { max_projects: 10, max_sales_month: 6000,  max_seats: 3,  data_retention_days: 180 },
  agency:   { max_projects: -1, max_sales_month: 20000, max_seats: -1, data_retention_days: 365 },
};

// ── Route handlers ────────────────────────────────────────────────────────────

export async function handleLicenseValidate(request: Request, env: Env): Promise<Response> {
  let body: { key?: string; domain?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { key, domain } = body;
  if (!key) return json({ error: 'key_required' }, 400);

  const row = await env.DB.prepare('SELECT * FROM licenses WHERE key = ?')
    .bind(key)
    .first<Record<string, unknown>>();

  if (!row) return json({ valid: false, reason: 'not_found' });

  if (row.status === 'revoked') return json({ valid: false, reason: 'revoked' });

  if (row.expires_at) {
    const expiresAt = new Date(row.expires_at as string);
    if (expiresAt < new Date()) return json({ valid: false, reason: 'expired' });
  }

  if (domain) {
    await env.DB.prepare(
      "UPDATE licenses SET domain = ?, updated_at = datetime('now') WHERE key = ?"
    ).bind(domain, key).run();
  }

  return json({
    valid: true,
    tier: row.tier,
    status: row.status,
    expires_at: row.expires_at ?? null,
    limits: {
      max_projects:        row.max_projects,
      max_sales_month:     row.max_sales_month,
      max_seats:           row.max_seats,
      data_retention_days: row.data_retention_days,
    },
  });
}

export async function handleLicensePing(request: Request, env: Env): Promise<Response> {
  let body: { key?: string; domain?: string; sales_this_month?: number };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { key, domain = '', sales_this_month = 0 } = body;
  if (!key) return json({ error: 'key_required' }, 400);

  const row = await env.DB.prepare(
    "SELECT status FROM licenses WHERE key = ?"
  ).bind(key).first<{ status: string }>();

  if (!row || row.status !== 'active') {
    return json({ ok: false, reason: row ? row.status : 'not_found' }, 400);
  }

  await env.DB.prepare(`
    INSERT INTO license_usage (license_key, month, domain, sales_count, last_ping)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(license_key, month) DO UPDATE SET
      sales_count = MAX(excluded.sales_count, license_usage.sales_count),
      last_ping   = excluded.last_ping,
      domain      = CASE WHEN excluded.domain != '' THEN excluded.domain ELSE license_usage.domain END
  `).bind(key, currentMonth(), domain, sales_this_month).run();

  return json({ ok: true });
}

export async function handleAdminLicenseCreate(request: Request, env: Env): Promise<Response> {
  if (!requireAdminSecret(request, env)) return json({ error: 'forbidden' }, 403);

  let body: { email?: string; name?: string; tier?: string; expires_at?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { email, name = '', tier = 'starter', expires_at } = body;
  if (!email) return json({ error: 'email_required' }, 400);

  const limits = TIER_LIMITS[tier];
  if (!limits) {
    return json({ error: 'invalid_tier', valid_tiers: Object.keys(TIER_LIMITS) }, 400);
  }

  const id  = crypto.randomUUID();
  const key = generateLicenseKey();

  await env.DB.prepare(`
    INSERT INTO licenses (id, key, email, name, tier, status, max_projects, max_sales_month, max_seats, data_retention_days, expires_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
  `).bind(
    id, key, email, name, tier,
    limits.max_projects, limits.max_sales_month, limits.max_seats, limits.data_retention_days,
    expires_at ?? null,
  ).run();

  return json({
    id, key, email, name, tier, status: 'active',
    ...limits,
    expires_at: expires_at ?? null,
  }, 201);
}

export async function handleAdminLicenseList(request: Request, env: Env): Promise<Response> {
  if (!requireAdminSecret(request, env)) return json({ error: 'forbidden' }, 403);

  const month = currentMonth();
  const result = await env.DB.prepare(`
    SELECT l.*,
           (SELECT sales_count FROM license_usage WHERE license_key = l.key AND month = ?) AS sales_this_month
    FROM licenses l
    ORDER BY l.created_at DESC
    LIMIT 100
  `).bind(month).all<Record<string, unknown>>();

  const licenses = result.results ?? [];
  return json({ licenses, total: licenses.length });
}

export async function handleAdminLicenseRevoke(request: Request, env: Env): Promise<Response> {
  if (!requireAdminSecret(request, env)) return json({ error: 'forbidden' }, 403);

  let body: { key?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { key } = body;
  if (!key) return json({ error: 'key_required' }, 400);

  await env.DB.prepare(
    "UPDATE licenses SET status = 'revoked', updated_at = datetime('now') WHERE key = ?"
  ).bind(key).run();

  return json({ ok: true });
}

export async function handleWebhookTicto(request: Request, env: Env): Promise<Response> {
  let payload: Record<string, any>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  console.log('[webhook/ticto] received payload:', JSON.stringify(payload));

  const email: string = payload?.subscriber?.email ?? payload?.email ?? '';
  const name: string  = payload?.subscriber?.name  ?? payload?.name  ?? '';

  if (!email) {
    console.warn('[webhook/ticto] missing email in payload');
    return json({ ok: true, warning: 'no_email_found' });
  }

  // Determine tier from product name
  const productName: string = (payload?.product?.name ?? '').toLowerCase();
  let tier = 'starter';
  if (productName.includes('agency'))        tier = 'agency';
  else if (productName.includes('business')) tier = 'business';
  else if (productName.includes('pro'))      tier = 'pro';

  const limits = TIER_LIMITS[tier];
  const id  = crypto.randomUUID();
  const key = generateLicenseKey();

  // expires_at = 1 year from now
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  const expires_at = expiresAt.toISOString().slice(0, 10); // "YYYY-MM-DD"

  await env.DB.prepare(`
    INSERT INTO licenses (id, key, email, name, tier, status, max_projects, max_sales_month, max_seats, data_retention_days, expires_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
  `).bind(
    id, key, email, name, tier,
    limits.max_projects, limits.max_sales_month, limits.max_seats, limits.data_retention_days,
    expires_at,
  ).run();

  console.log(`[webhook/ticto] created license ${key} for ${email} (${tier})`);

  return json({ ok: true });
}
