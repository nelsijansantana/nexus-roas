import { Env } from '../types';
import { detectSiteId } from '../shared/config';

/**
 * GET /logs?site_id=<id>&limit=50&platform=meta_ads&token=<debug_token>
 *
 * Returns recent event logs from D1 for a given site.
 * Protected by the same DEBUG_TOKEN used by /debug.
 */
export async function handleLogs(request: Request, env: Env): Promise<Response> {
  const url   = new URL(request.url);
  const token = url.searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '');

  const debugToken = (env as any).DEBUG_TOKEN;
  if (debugToken && token !== debugToken) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const siteId   = detectSiteId(request, env);
  const limit    = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const platform = url.searchParams.get('platform') || null;
  const channel  = url.searchParams.get('channel')  || null;
  const since    = url.searchParams.get('since')    || null; // ISO datetime

  let query  = 'SELECT * FROM events WHERE site_id = ?1';
  const args: any[] = [siteId];
  let argIdx = 2;

  if (platform) { query += ` AND platform = ?${argIdx++}`; args.push(platform); }
  if (channel)  { query += ` AND channel  = ?${argIdx++}`; args.push(channel); }
  if (since)    { query += ` AND timestamp >= ?${argIdx++}`; args.push(since); }

  query += ` ORDER BY timestamp DESC LIMIT ?${argIdx}`;
  args.push(limit);

  try {
    const stmt   = env.DB.prepare(query);
    const result = await stmt.bind(...args).all();

    return new Response(JSON.stringify({
      site_id: siteId,
      count:   result.results?.length ?? 0,
      rows:    result.results ?? []
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
