export interface LogData {
  site_id: string;
  event_name: string;
  event_id?: string;
  platform: string;
  channel: string;
  source: string;
  status_code?: number | null;
  request_ms?: number | null;
  sent_payload?: string;
  error_message?: string;
  response_payload?: string;
  nx_user?: string;
  source_ip?: string;
  user_agent?: string;
}

// Only write to D1 on errors — success events (2xx) generate no D1 writes.
// This keeps the events table useful for diagnostics without flooding D1.
const isSuccess = (code: number | null | undefined) =>
  code != null && code >= 200 && code < 300;

export async function logEvent(db: D1Database, data: LogData): Promise<void> {
  // Skip successful dispatches — only persist errors and missing-config cases
  if (isSuccess(data.status_code) && !data.error_message) return;

  try {
    await db.prepare(`
      INSERT INTO events (site_id, event_name, event_id, platform, channel, source,
        status_code, request_ms, sent_payload, error_message, response_payload,
        nx_user, source_ip, user_agent)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
    `).bind(
      data.site_id || '',
      data.event_name || '',
      data.event_id || '',
      data.platform || '',
      data.channel || '',
      data.source || '',
      data.status_code ?? null,
      data.request_ms ?? null,
      (data.sent_payload || '').substring(0, 2000),
      data.error_message || '',
      data.response_payload || '',
      data.nx_user || '',
      data.source_ip || '',
      data.user_agent || ''
    ).run();
  } catch (e) {
    console.error('[logger] Error writing event log:', e);
  }
}
