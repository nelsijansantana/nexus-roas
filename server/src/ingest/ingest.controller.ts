import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import type { IngestEventDto } from './ingest.service';
import { IngestService } from './ingest.service';

@Controller('api/ingest')
export class IngestController {
  constructor(private readonly ingest: IngestService) {}

  /**
   * Receives a tracking event from a Cloudflare Worker (nexus-worker).
   *
   * Auth: X-Ingest-Key header must match the project's ingest_api_key.
   * The pixel_id in the body identifies which project the event belongs to.
   *
   * Returns 200 immediately — writes to ClickHouse are fire-and-forget.
   */
  @Post('event')
  @HttpCode(200)
  async ingestEvent(
    @Headers('x-ingest-key') ingestKey: string,
    @Body() dto: IngestEventDto,
  ): Promise<{ ok: boolean }> {
    if (!ingestKey || !dto.pixel_id) {
      throw new UnauthorizedException('Missing x-ingest-key or pixel_id');
    }

    const valid = await this.ingest.validateKey(dto.pixel_id, ingestKey);
    if (!valid) {
      throw new UnauthorizedException('Invalid ingest key');
    }

    await this.ingest.ingestEvent(dto);
    return { ok: true };
  }

  /** Health-check used by the Worker after deploy to confirm connectivity. */
  @Post('ping')
  @HttpCode(200)
  async ping(
    @Headers('x-ingest-key') ingestKey: string,
    @Body('pixel_id') pixelId: string,
  ): Promise<{ ok: boolean; pixel_id: string }> {
    if (!ingestKey || !pixelId) {
      throw new UnauthorizedException('Missing x-ingest-key or pixel_id');
    }
    const valid = await this.ingest.validateKey(pixelId, ingestKey);
    if (!valid) throw new UnauthorizedException('Invalid ingest key');
    return { ok: true, pixel_id: pixelId };
  }
}
