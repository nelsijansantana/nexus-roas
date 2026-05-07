import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { IngestService } from './ingest.service';

/**
 * Compatibility controller to handle legacy and browser-based tracking routes.
 * 
 * Routes:
 * - POST /tracking/v1/events (Legacy browser endpoint)
 * - GET  /tracking/v1/pixel.js (Alias for the pixel script)
 */
@Controller('tracking/v1')
export class TrackingController {
  constructor(private readonly ingestService: IngestService) {}

  /**
   * Receives events from the browser pixel.
   * Maps legacy fields (event, nx_user) to the current IngestEventDto.
   */
  @Post('events')
  @HttpCode(200)
  async handleBrowserEvent(
    @Body() body: any,
    @Query('pid') queryPid: string,
    @Headers('user-agent') ua: string,
    @Headers('x-forwarded-for') forwardedFor: string,
  ) {
    // 1. Resolve Pixel ID (from query ?pid= or body.pixel_id)
    const pixelId = queryPid || body.pixel_id || body.site_id;
    if (!pixelId) {
      return { ok: false, error: 'missing_pixel_id' };
    }

    // 2. Map browser payload to IngestEventDto
    // The browser script sends: { event, event_id, nx_user, user_data, browser_data, utm_data, custom_data }
    const dto: any = {
      pixel_id:   pixelId,
      event_type: body.event || 'PageView',
      event_id:   body.event_id,
      lead_id:    body.nx_user,
      ip:         forwardedFor?.split(',')[0].trim(),
      user_agent: ua,
      
      // Values
      value:      body.custom_data?.value || body.value,
      currency:   body.custom_data?.currency || body.currency || 'BRL',
      
      // Geography / Identity from browser (if available)
      city:       body.user_data?.city,
      state:      body.user_data?.state,
      country:    body.user_data?.country,
      
      // UTMs
      utm_source:   body.utm_data?.utm_source   || body.utm_source,
      utm_medium:   body.utm_data?.utm_medium   || body.utm_medium,
      utm_campaign: body.utm_data?.utm_campaign || body.utm_campaign,
      utm_content:  body.utm_data?.utm_content  || body.utm_content,
      utm_term:     body.utm_data?.utm_term     || body.utm_term,
      utm_id:       body.utm_data?.utm_id       || body.utm_id,
      utm_platform: body.utm_data?.utm_platform || body.utm_platform,
      utm_network:  body.utm_data?.utm_network  || body.utm_network,
      placement:    body.utm_data?.placement    || body.placement,
      creative_format: body.utm_data?.creative_format || body.creative_format,
      ad_id:        body.utm_data?.ad_id        || body.ad_id,
      adset_id:     body.utm_data?.adset_id     || body.adset_id,
      campaign_id:  body.utm_data?.campaign_id  || body.campaign_id,
      conversion_type: body.utm_data?.conversion_type || body.conversion_type,
    };

    // 3. Ingest (bypass secret key check for browser paths, strictly valid for analytics)
    // Note: In a production environment with high security requirements, 
    // we would check a 'Public Key' or 'Allowed Domain' list here.
    await this.ingestService.ingestEvent(dto);

    return { ok: true };
  }

  /**
   * Optional: Serve a redirect or an alias for the pixel script if needed.
   * For now, we point users to the Cloudflare Worker URL or serve a 404
   * if not configured, but at least we prevent a completely dead route.
   */
  @Get('pixel.js')
  async getPixel(@Res() res: Response) {
    // This route is often handled by the Cloudflare Worker directly.
    // If it reaches the backend, we can redirect or return a placeholder.
    res.status(404).json({ error: 'Please use the Cloudflare Worker URL for pixel.js' });
  }
}
