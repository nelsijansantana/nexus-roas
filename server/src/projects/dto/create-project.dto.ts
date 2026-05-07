import { IsNotEmpty, IsOptional, IsString, IsUUID, IsBoolean } from 'class-validator';

export class CreateProjectDto {
  @IsUUID(4, { message: 'Must be a valid user UUID' })
  @IsOptional()
  userId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Domínio é obrigatório' })
  domain: string;

  @IsString()
  @IsOptional()
  checkoutType?: string;

  @IsString()
  @IsOptional()
  projectType?: string;

  // Optional custom tracker subdomain (client CNAMEs it to the shared worker)
  @IsString()
  @IsOptional()
  customDomain?: string;

  // ── Meta ────────────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  pixelFacebookId?: string;

  @IsString()
  @IsOptional()
  tokenFacebookApi?: string;

  @IsString()
  @IsOptional()
  testEventCode?: string | null;

  // ── TikTok ───────────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  tikTokPixelId?: string;

  @IsString()
  @IsOptional()
  tokenTikTokApi?: string;

  @IsString()
  @IsOptional()
  testEventCodeTikTok?: string | null;

  // ── Google Analytics 4 ───────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  ga4MeasurementId?: string;

  @IsString()
  @IsOptional()
  ga4ApiSecret?: string;

  // ── Google Ads ───────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  googleAdsConversionId?: string;

  @IsString()
  @IsOptional()
  googleAdsLabelContact?: string;

  @IsString()
  @IsOptional()
  googleAdsLabelLead?: string;

  // ── Checkout ─────────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  cartpandaStoreId?: string;

  @IsBoolean()
  @IsOptional()
  sendPurchaseFromWeb?: boolean;
}

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  domain?: string;

  @IsString()
  @IsOptional()
  checkoutType?: string;

  @IsString()
  @IsOptional()
  projectType?: string;

  @IsString()
  @IsOptional()
  customDomain?: string;

  // ── Meta ────────────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  pixelFacebookId?: string;

  @IsString()
  @IsOptional()
  tokenFacebookApi?: string;

  @IsString()
  @IsOptional()
  testEventCode?: string | null;

  // ── TikTok ───────────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  tikTokPixelId?: string;

  @IsString()
  @IsOptional()
  tokenTikTokApi?: string;

  @IsString()
  @IsOptional()
  testEventCodeTikTok?: string | null;

  // ── Google Analytics 4 ───────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  ga4MeasurementId?: string;

  @IsString()
  @IsOptional()
  ga4ApiSecret?: string;

  // ── Google Ads ───────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  googleAdsConversionId?: string;

  @IsString()
  @IsOptional()
  googleAdsLabelContact?: string;

  @IsString()
  @IsOptional()
  googleAdsLabelLead?: string;

  // ── Checkout ─────────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  cartpandaStoreId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  sendPurchaseFromWeb?: boolean;
}
