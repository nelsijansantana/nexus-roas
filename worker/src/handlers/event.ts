import { Env } from '../types'
import { hasIdentityData } from '../store/user-store'
import { parseCookies } from '../shared/helpers'

export interface NexusEvent {
  pixel_id:    string
  nx_user?:    string
  event:       string
  event_id?:   string
  session_id?: string
  page_url?:   string
  referrer?:   string
  shopify_cart_token?: string
  browser_data?: {
    fbp?: string; fbc?: string
    fbclid?: string; gclid?: string; gbraid?: string; wbraid?: string
    ttclid?: string; ttp?: string; msclkid?: string; twclid?: string
    ga_client_id?: string; ga_session_id?: string
    ga_session_count?: string; ga_timestamp?: string
    cart_token?: string
  }
  utm_data?: {
    utm_source?: string; utm_medium?: string; utm_campaign?: string
    utm_content?: string; utm_term?: string; utm_id?: string
    utm_platform?: string; utm_network?: string
    ad_id?: string; adset_id?: string; campaign_id?: string
    placement?: string; creative_format?: string; conversion_type?: string
  }
  user_data?: {
    email?: string; phone?: string
    first_name?: string; last_name?: string
    city?: string; state?: string; country?: string; zip?: string
  }
  custom_data?: {
    value?: number; currency?: string; order_id?: string
    items?: unknown[]
  }
}

type BD   = NonNullable<NexusEvent['browser_data']>
type UTMs = NonNullable<NexusEvent['utm_data']>

function deriveChannel(bd: BD, utms: UTMs): string {
  if (bd.fbclid) return 'paid_social_meta'
  if (bd.gclid || bd.gbraid || bd.wbraid) {
    return (utms.utm_medium || '').toLowerCase().includes('search')
      ? 'paid_search_google'
      : 'paid_display_google'
  }
  if (bd.ttclid) return 'paid_social_tiktok'
  if (bd.msclkid) return 'paid_search_bing'
  if (utms.utm_source) {
    const src = utms.utm_source.toLowerCase()
    const med = (utms.utm_medium || '').toLowerCase()
    if (med === 'organic' || med === 'seo') return `organic_${src}`
    if (med === 'email') return 'email'
    if (med === 'referral') return 'referral'
    return `other_${src}`
  }
  return 'direct'
}

async function upsertCheckoutSession(
  db: D1Database,
  p: {
    token: string; pixel_id: string; nx_user: string
    status: 'cart' | 'checkout'
    bd: BD; utms: UTMs; channel: string
    ud: NonNullable<NexusEvent['user_data']>
    cd: NonNullable<NexusEvent['custom_data']>
    ip: string; user_agent: string
  }
): Promise<void> {
  const now       = Date.now()
  const expiresAt = Math.floor(now / 1000) + 604800 // 7 days

  await db.prepare(`
    INSERT INTO checkout_sessions
      (token, pixel_id, nx_user, status,
       fbp, fbc, fbclid, gclid, ttclid, ttp,
       utm_source, utm_medium, utm_campaign, utm_content, utm_term, channel,
       ip, user_agent, email, phone, firstname, lastname, city, country, zip,
       value, currency, items, created_at, updated_at, expires_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(token, pixel_id) DO UPDATE SET
      updated_at   = excluded.updated_at,
      status       = CASE WHEN checkout_sessions.status = 'completed'
                          THEN checkout_sessions.status ELSE excluded.status END,
      nx_user      = COALESCE(NULLIF(checkout_sessions.nx_user, ''),      excluded.nx_user),
      fbp          = COALESCE(NULLIF(checkout_sessions.fbp, ''),          excluded.fbp),
      fbc          = COALESCE(NULLIF(checkout_sessions.fbc, ''),          excluded.fbc),
      fbclid       = COALESCE(NULLIF(checkout_sessions.fbclid, ''),       excluded.fbclid),
      gclid        = COALESCE(NULLIF(checkout_sessions.gclid, ''),        excluded.gclid),
      ttclid       = COALESCE(NULLIF(checkout_sessions.ttclid, ''),       excluded.ttclid),
      ttp          = COALESCE(NULLIF(checkout_sessions.ttp, ''),          excluded.ttp),
      utm_source   = COALESCE(NULLIF(checkout_sessions.utm_source, ''),   excluded.utm_source),
      utm_medium   = COALESCE(NULLIF(checkout_sessions.utm_medium, ''),   excluded.utm_medium),
      utm_campaign = COALESCE(NULLIF(checkout_sessions.utm_campaign, ''), excluded.utm_campaign),
      utm_content  = COALESCE(NULLIF(checkout_sessions.utm_content, ''),  excluded.utm_content),
      utm_term     = COALESCE(NULLIF(checkout_sessions.utm_term, ''),     excluded.utm_term),
      channel      = COALESCE(NULLIF(checkout_sessions.channel, ''),      excluded.channel),
      email        = COALESCE(NULLIF(checkout_sessions.email, ''),        excluded.email),
      phone        = COALESCE(NULLIF(checkout_sessions.phone, ''),        excluded.phone),
      firstname    = COALESCE(NULLIF(checkout_sessions.firstname, ''),    excluded.firstname),
      lastname     = COALESCE(NULLIF(checkout_sessions.lastname, ''),     excluded.lastname),
      city         = COALESCE(NULLIF(checkout_sessions.city, ''),         excluded.city),
      country      = COALESCE(NULLIF(checkout_sessions.country, ''),      excluded.country),
      zip          = COALESCE(NULLIF(checkout_sessions.zip, ''),          excluded.zip)
  `).bind(
    p.token, p.pixel_id, p.nx_user, p.status,
    p.bd.fbp || '', p.bd.fbc || '',
    p.bd.fbclid || '', p.bd.gclid || '',
    p.bd.ttclid || '', p.bd.ttp || '',
    p.utms.utm_source || '', p.utms.utm_medium || '',
    p.utms.utm_campaign || '', p.utms.utm_content || '',
    p.utms.utm_term || '', p.channel,
    p.ip, p.user_agent,
    p.ud.email || '', p.ud.phone || '',
    p.ud.first_name || '', p.ud.last_name || '',
    p.ud.city || '', p.ud.country || '', p.ud.zip || '',
    p.cd.value || 0, p.cd.currency || 'BRL',
    JSON.stringify(p.cd.items || []),
    now, now, expiresAt,
  ).run()
}

export async function handleEvent(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  let body: NexusEvent
  try {
    body = await request.json() as NexusEvent
  } catch {
    return json400('invalid_json')
  }

  // AC2: validate pixel_id
  const pixelId = body.pixel_id
  if (!pixelId || typeof pixelId !== 'string') return json400('missing_pixel_id')

  const eventName = body.event
  if (!eventName) return json400('missing_event')

  const eventId = body.event_id || crypto.randomUUID()

  // AC7: deduplication via KV — early exit before any writes
  const dedupKey = `dedup:${pixelId}:${eventId}`
  const isDup    = await env.KV_DEDUP.get(dedupKey)
  if (isDup) {
    return new Response(JSON.stringify({ ok: true, event_id: eventId, duplicate: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  ctx.waitUntil(env.KV_DEDUP.put(dedupKey, '1', { expirationTtl: 86400 }))

  // AC3: geo from Cloudflare headers
  const geo = {
    country: request.headers.get('CF-IPCountry')    || undefined,
    city:    request.headers.get('CF-IPCity')        || undefined,
    region:  request.headers.get('CF-IPRegion')      || undefined,
    zip:     request.headers.get('CF-IPPostalCode')  || undefined,
    ip:      request.headers.get('CF-Connecting-IP') || undefined,
  }
  const userAgent = request.headers.get('User-Agent') || ''
  const cookies   = parseCookies(request.headers.get('Cookie'))

  const nxUser = body.nx_user || cookies['nx_user'] || crypto.randomUUID()
  const bd     = body.browser_data || {}
  const utms   = body.utm_data     || {}
  const ud     = body.user_data    || {}
  const cd     = body.custom_data  || {}

  // AC10: derive channel before writes so it's stored with attribution
  const channel = deriveChannel(bd, utms)

  // AC4: user_store upsert (via PERSISTENCE_QUEUE — non-blocking)
  const storeRecord = {
    nx_user:          nxUser,
    ip:               geo.ip            || '',
    user_agent:       userAgent,
    fbp:              bd.fbp            || '',
    fbc:              bd.fbc            || '',
    ttp:              bd.ttp            || '',
    ttclid:           bd.ttclid         || '',
    ga_client_id:     bd.ga_client_id   || '',
    ga_session_id:    bd.ga_session_id  || '',
    ga_session_count: bd.ga_session_count || '',
    ga_timestamp:     bd.ga_timestamp   || '',
    page_url:         body.page_url     || '',
    cart_token:       bd.cart_token     || '',
    email:            ud.email          || '',
    phone:            ud.phone          || '',
    fullname:         [ud.first_name, ud.last_name].filter(Boolean).join(' '),
    city:    ud.city    || geo.city    || '',
    state:   ud.state   || geo.region  || '',
    country: ud.country || geo.country || '',
    zip:     ud.zip     || geo.zip     || '',
    utm_source:      utms.utm_source      || '',
    utm_medium:      utms.utm_medium      || '',
    utm_campaign:    utms.utm_campaign    || '',
    utm_content:     utms.utm_content     || '',
    utm_term:        utms.utm_term        || '',
    utm_id:          utms.utm_id          || '',
    utm_platform:    utms.utm_platform    || '',
    utm_network:     utms.utm_network     || '',
    ad_id:           utms.ad_id           || '',
    adset_id:        utms.adset_id        || '',
    campaign_id:     utms.campaign_id     || '',
    placement:       utms.placement       || '',
    creative_format: utms.creative_format || '',
    conversion_type: utms.conversion_type || '',
  }

  if (hasIdentityData(storeRecord)) {
    ctx.waitUntil(env.PERSISTENCE_QUEUE.send({
      type:     'user_store',
      pixel_id: pixelId,
      nx_user:  nxUser,
      user:     storeRecord,
    }))
  }

  // AC5: user_attribution with session_id, click IDs and channel
  if (bd.fbclid || bd.gclid || bd.gbraid || bd.wbraid || bd.ttclid || bd.msclkid || bd.twclid || bd.fbc) {
    ctx.waitUntil(env.PERSISTENCE_QUEUE.send({
      type:     'user_attribution',
      pixel_id: pixelId,
      nx_user:  nxUser,
      attribution: {
        nx_user:    nxUser,
        pixel_id:   pixelId,
        session_id: body.session_id || '',
        channel,
        fbclid:     bd.fbclid  || '',
        fbc:        bd.fbc     || '',
        gclid:      bd.gclid   || '',
        gbraid:     bd.gbraid  || '',
        wbraid:     bd.wbraid  || '',
        ttclid:     bd.ttclid  || '',
        msclkid:    bd.msclkid || '',
        twclid:     bd.twclid  || '',
        updated_at: Date.now(),
      },
    }))
  }

  // AC6: checkout_session for InitiateCheckout and AddToCart
  const cartToken = bd.cart_token
  if (cartToken && (eventName === 'InitiateCheckout' || eventName === 'AddToCart')) {
    ctx.waitUntil(upsertCheckoutSession(env.DB, {
      token:    cartToken,
      pixel_id: pixelId,
      nx_user:  nxUser,
      status:   eventName === 'AddToCart' ? 'cart' : 'checkout',
      bd, utms, channel, ud, cd,
      ip:         geo.ip    || '',
      user_agent: userAgent,
    }))
  }

  // AC8: enqueue for async CAPI dispatch (story 8.5 consumes this queue)
  if (env.CAPI_QUEUE) {
    ctx.waitUntil(env.CAPI_QUEUE.send({
      pixel_id:    pixelId,
      nx_user:     nxUser,
      event_id:    eventId,
      event_name:  eventName,
      event_time:  Math.floor(Date.now() / 1000),
      session_id:  body.session_id,
      channel,
      geo,
      user_agent:  userAgent,
      browser_data: bd,
      utm_data:     utms,
      user_data:    ud,
      custom_data:  cd,
      page_url:    body.page_url,
      referrer:    body.referrer,
    }))
  }

  // AC1: respond immediately — do not await CAPI or D1
  return new Response(JSON.stringify({ ok: true, event_id: eventId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function json400(error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}
