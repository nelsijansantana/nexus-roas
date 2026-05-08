import { IsString, IsIn } from 'class-validator';

export class CreateCheckoutDto {
  @IsString()
  planId: string;

  @IsIn(['monthly', 'annual'])
  interval: 'monthly' | 'annual';
}

export class SaveBillingConfigDto {
  // We accept any JSON object — validated at service level
  [key: string]: unknown;
}

// ─── Types for the billing config object stored in DB ───────────────────────

export interface StripePlanConfig {
  monthly?: string; // Stripe Price ID
  annual?: string; // Stripe Price ID
}

export interface StripeConfig {
  publishableKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  mode?: 'hosted' | 'embedded'; // hosted = Stripe checkout page, embedded = Payment Elements
  plans?: Record<string, StripePlanConfig>;
}

export interface ExternalPlanConfig {
  monthly?: string; // checkout URL
  annual?: string; // checkout URL
}

export interface HotmartConfig {
  hottokSecret?: string;
  plans?: Record<string, ExternalPlanConfig>;
}

export interface ExternalPlatformConfig {
  platformName?: string; // ex: 'CartPanda', 'Kirvano', 'Eduzz', 'Perfectpay', 'Monetizze'
  plans?: Record<string, ExternalPlanConfig>;
}

export interface OwnCheckoutConfig {
  gateway?: 'stripe' | 'pagarme';
  pagarmeApiKey?: string;
  plans?: Record<string, { monthlyPrice?: number; annualPrice?: number }>;
}

export interface BillingConfig {
  active: 'none' | 'stripe' | 'hotmart' | 'external' | 'own';
  trialDays?: number;
  stripe?: StripeConfig;
  hotmart?: HotmartConfig;
  external?: ExternalPlatformConfig;
  own?: OwnCheckoutConfig;
}
