import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { randomUUID } from 'crypto';

// ─── DTO ─────────────────────────────────────────────────────────────────────

export interface IngestEventDto {
  pixel_id: string;
  event_type?: string; // alias legado
  event_name?: string; // preferido
  event_id?: string;
  event_time?: number;
  nx_user?: string;
  lead_id?: string; // alias legado para nx_user
  session_id?: string;
  // Valor
  value?: number;
  currency?: string;
  order_id?: string;
  payment_gateway?: string; // alias legado para gateway
  gateway?: string;
  items?: string;
  // UTMs
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  utm_id?: string;
  utm_platform?: string;
  utm_network?: string;
  // IDs de campanha
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  placement?: string;
  creative_format?: string;
  conversion_type?: string;
  // Canal (pode vir do Worker ou é derivado aqui)
  channel?: string;
  // Click IDs
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  ttclid?: string;
  ttp?: string;
  msclkid?: string;
  twclid?: string;
  // GA4
  ga_session_id?: string;
  ga_session_number?: string;
  // Identidade
  match_type?: string;
  // Geo + Device
  ip?: string;
  country?: string;
  region?: string;
  city?: string;
  state?: string; // alias legado para region
  user_agent?: string;
  // CAPI (-1=não configurado, 0=falhou, 1=ok)
  capi_meta?: number;
  capi_tiktok?: number;
  capi_ga4?: number;
  capi_gads?: number;
  // Contexto de página
  page_url?: string;
  referrer?: string;
}

// ─── Derivações ───────────────────────────────────────────────────────────────

function deriveChannel(dto: IngestEventDto): string {
  if (dto.channel) return dto.channel;

  const src = (dto.utm_source || '').toLowerCase();
  const med = (dto.utm_medium || '').toLowerCase();

  if (
    dto.fbclid ||
    src.includes('facebook') ||
    src.includes('instagram') ||
    src === 'fb'
  ) {
    return 'paid_social_meta';
  }
  if (dto.ttclid || src.includes('tiktok') || src === 'tt') {
    return 'paid_social_tiktok';
  }
  if (
    dto.gclid ||
    (src.includes('google') && (med === 'cpc' || med === 'ppc'))
  ) {
    return 'paid_search_google';
  }
  if (dto.msclkid || src === 'bing' || src === 'microsoftads') {
    return 'paid_search_bing';
  }
  if (med === 'email' || med === 'newsletter') return 'email';
  if (med === 'organic' || (src.includes('google') && !med))
    return 'organic_search';
  if (med === 'social' || med === 'social-media') return 'social';
  if (med === 'referral') return 'referral';
  if (med === 'cpc' || med === 'ppc') return 'paid_search_other';
  if (!src && !med) return 'direct';
  return 'other';
}

function parseDeviceType(ua: string): string {
  if (!ua) return '';
  const u = ua.toLowerCase();
  if (/mobile|android.*mobile|iphone|ipod|iemobile|opera mini/.test(u))
    return 'mobile';
  if (/ipad|android(?!.*mobile)|tablet/.test(u)) return 'tablet';
  return 'desktop';
}

function parseOS(ua: string): string {
  if (!ua) return '';
  const u = ua.toLowerCase();
  if (u.includes('android')) return 'android';
  if (u.includes('iphone') || u.includes('ipad') || u.includes('ipod'))
    return 'ios';
  if (u.includes('windows')) return 'windows';
  if (u.includes('mac os') || u.includes('macintosh')) return 'macos';
  if (u.includes('linux')) return 'linux';
  return 'other';
}

function parseBrowser(ua: string): string {
  if (!ua) return '';
  const u = ua.toLowerCase();
  if (u.includes('edg/') || u.includes('edge/')) return 'edge';
  if (u.includes('chrome') && !u.includes('chromium')) return 'chrome';
  if (u.includes('safari') && !u.includes('chrome')) return 'safari';
  if (u.includes('firefox')) return 'firefox';
  if (u.includes('opera') || u.includes('opr/')) return 'opera';
  return 'other';
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clickhouse: ClickHouseService,
  ) {}

  async validateKey(pixelId: string, ingestKey: string): Promise<boolean> {
    const project = await this.prisma.projects.findUnique({
      where: { pixelId },
    });
    if (!project || !project.isActive) return false;
    return (project as any).ingestApiKey === ingestKey;
  }

  ingestEvent(dto: IngestEventDto): void {
    const now = Math.floor(Date.now() / 1000);
    const eventTime = dto.event_time ?? now;
    const eventId = dto.event_id ?? randomUUID();
    const eventName = dto.event_name ?? dto.event_type ?? 'PageView';
    // nx_user é o identificador canônico; lead_id é o alias legado do Worker
    const nxUser =
      dto.nx_user && dto.nx_user.trim()
        ? dto.nx_user
        : dto.lead_id && dto.lead_id.trim()
          ? dto.lead_id
          : randomUUID();
    const currency = dto.currency ?? 'BRL';
    const value = dto.value ?? 0;
    const gateway = dto.gateway ?? dto.payment_gateway ?? '';
    const region = dto.region ?? dto.state ?? '';
    const ua = dto.user_agent ?? '';

    const channel = deriveChannel(dto);
    const deviceType = parseDeviceType(ua);
    const os = parseOS(ua);
    const browser = parseBrowser(ua);

    // ── Escreve em nx_events (tabela principal, sem JOIN) ─────────────────────
    const nxRow = {
      pixel_id: dto.pixel_id,
      event_id: eventId,
      nx_user: nxUser,
      session_id: dto.session_id ?? '',
      event_name: eventName,
      event_time: eventTime,
      page_url: dto.page_url ?? '',
      referrer: dto.referrer ?? '',
      utm_source: dto.utm_source ?? '',
      utm_medium: dto.utm_medium ?? '',
      utm_campaign: dto.utm_campaign ?? '',
      utm_content: dto.utm_content ?? '',
      utm_term: dto.utm_term ?? '',
      utm_id: dto.utm_id ?? '',
      utm_platform: dto.utm_platform ?? '',
      utm_network: dto.utm_network ?? '',
      ad_id: dto.ad_id ?? '',
      adset_id: dto.adset_id ?? '',
      campaign_id: dto.campaign_id ?? '',
      placement: dto.placement ?? '',
      creative_format: dto.creative_format ?? '',
      conversion_type: dto.conversion_type ?? '',
      channel,
      fbclid: dto.fbclid ?? '',
      fbc: dto.fbc ?? '',
      fbp: dto.fbp ?? '',
      gclid: dto.gclid ?? '',
      gbraid: dto.gbraid ?? '',
      wbraid: dto.wbraid ?? '',
      ttclid: dto.ttclid ?? '',
      ttp: dto.ttp ?? '',
      msclkid: dto.msclkid ?? '',
      twclid: dto.twclid ?? '',
      ga_session_id: dto.ga_session_id ?? '',
      ga_session_number: dto.ga_session_number ?? '',
      order_id: dto.order_id ?? '',
      revenue: value,
      currency,
      gateway,
      items: dto.items ?? '[]',
      match_type: dto.match_type ?? '',
      country: dto.country ?? '',
      region,
      city: dto.city ?? '',
      ip: dto.ip ?? '',
      user_agent: ua,
      device_type: deviceType,
      os,
      browser,
      capi_meta: dto.capi_meta ?? -1,
      capi_tiktok: dto.capi_tiktok ?? -1,
      capi_ga4: dto.capi_ga4 ?? -1,
      capi_gads: dto.capi_gads ?? -1,
    };

    // ── Escreve em events + leads (retrocompatibilidade — analytics legado) ───
    const customData =
      gateway || dto.order_id
        ? JSON.stringify({
            payment_gateway: gateway,
            order_id: dto.order_id ?? '',
          })
        : '';

    const eventRow = {
      id: eventId,
      lead_id: nxUser,
      pixel_id: dto.pixel_id,
      event_type: eventName,
      source_url: dto.page_url ?? '',
      page_title: '',
      referrer: dto.referrer ?? '',
      ip: dto.ip ?? '',
      user_agent: ua,
      fbc: dto.fbc ?? '',
      fbp: dto.fbp ?? '',
      value,
      currency,
      content_type: 'product',
      custom_data: customData,
      event_time: eventTime,
    };

    const leadRow = {
      id: nxUser,
      pixel_id: dto.pixel_id,
      email: '',
      phone: '',
      first_name: '',
      last_name: '',
      ip: dto.ip ?? '',
      ipv6: '',
      user_agent: ua,
      fbc: dto.fbc ?? '',
      fbp: dto.fbp ?? '',
      gclid: dto.gclid ?? '',
      gbraid: dto.gbraid ?? '',
      wbraid: dto.wbraid ?? '',
      ttclid: dto.ttclid ?? '',
      ttp: dto.ttp ?? '',
      country: dto.country ?? '',
      state: region,
      city: dto.city ?? '',
      zipcode: '',
      parameters: '',
      meta_pixel_ids: [] as string[],
      tiktok_pixel_ids: [] as string[],
      external_id: nxUser,
      gender: '',
      date_of_birth: '',
      cart_token: '',
      utm_source: dto.utm_source ?? '',
      utm_medium: dto.utm_medium ?? '',
      utm_campaign: dto.utm_campaign ?? '',
      utm_content: dto.utm_content ?? '',
      utm_term: dto.utm_term ?? '',
      utm_id: dto.utm_id ?? '',
      utm_platform: dto.utm_platform ?? '',
      utm_network: dto.utm_network ?? '',
      placement: dto.placement ?? '',
      creative_format: dto.creative_format ?? '',
      ad_id: dto.ad_id ?? '',
      adset_id: dto.adset_id ?? '',
      campaign_id: dto.campaign_id ?? '',
      conversion_type: dto.conversion_type ?? '',
      updated_at: eventTime,
    };

    // Fire-and-forget — Worker já respondeu ao cliente
    void Promise.all([
      this.clickhouse.insert('nx_events', [nxRow]),
      this.clickhouse.insert('events', [eventRow]),
      this.clickhouse.insert('leads', [leadRow]),
    ]).catch((err) =>
      this.logger.error(`[Ingest] ClickHouse write failed: ${err?.message}`),
    );

    this.logger.debug(
      `[Ingest] ${eventName} pixel=${dto.pixel_id} user=${nxUser} channel=${channel} value=${value}`,
    );
  }
}
