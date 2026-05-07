import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Stripe = require('stripe');
import { PrismaService } from '../prisma/prisma.service';
import { BillingConfig } from './dto/billing.dto';
import { PLANS } from '../common/plans.config';

const CONFIG_KEY = 'main';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ─── Config CRUD ──────────────────────────────────────────────────────────

  async getConfig(): Promise<BillingConfig> {
    const row = await (this.prisma.billing_config as any).findUnique({
      where: { key: CONFIG_KEY },
    });
    if (!row) return { active: 'none', trialDays: 14 };
    try { return JSON.parse(row.value) as BillingConfig; } catch { return { active: 'none', trialDays: 14 }; }
  }

  /** Returns sanitized config (no secret keys) for public/user consumption */
  async getPublicConfig() {
    const cfg = await this.getConfig();
    return {
      active: cfg.active,
      trialDays: cfg.trialDays ?? 14,
      stripePublishableKey: cfg.stripe?.publishableKey,
      stripeMode: cfg.stripe?.mode ?? 'hosted',
      externalPlatformName: cfg.external?.platformName,
    };
  }

  async saveConfig(data: Partial<BillingConfig>): Promise<BillingConfig> {
    const current = await this.getConfig();
    const merged = deepMerge(current, data) as BillingConfig;
    await (this.prisma.billing_config as any).upsert({
      where: { key: CONFIG_KEY },
      create: { id: randomUUID(), key: CONFIG_KEY, value: JSON.stringify(merged) },
      update: { value: JSON.stringify(merged) },
    });
    return merged;
  }

  // ─── Create Checkout ──────────────────────────────────────────────────────

  async createCheckout(
    userId: string,
    userEmail: string,
    planId: string,
    interval: 'monthly' | 'annual',
  ): Promise<{ type: string; url?: string; clientSecret?: string; publishableKey?: string }> {
    if (!PLANS[planId]) throw new BadRequestException('Plano inválido');
    if (planId === 'free') throw new BadRequestException('Plano free não requer checkout');

    const cfg = await this.getConfig();

    switch (cfg.active) {
      case 'stripe':
        return this.createStripeCheckout(userId, userEmail, planId, interval, cfg);
      case 'hotmart':
        return this.getHotmartUrl(userEmail, planId, interval, cfg);
      case 'external':
        return this.getExternalUrl(userEmail, planId, interval, cfg);
      case 'own':
        return this.createOwnCheckout(userId, userEmail, planId, interval, cfg);
      default:
        throw new BadRequestException('Nenhuma plataforma de pagamento configurada. Contate o suporte.');
    }
  }

  // ─── Stripe ───────────────────────────────────────────────────────────────

  private async createStripeCheckout(
    userId: string,
    userEmail: string,
    planId: string,
    interval: 'monthly' | 'annual',
    cfg: BillingConfig,
  ) {
    if (!cfg.stripe?.secretKey) throw new BadRequestException('Stripe não configurado');

    const priceId = interval === 'annual'
      ? cfg.stripe.plans?.[planId]?.annual
      : cfg.stripe.plans?.[planId]?.monthly;

    if (!priceId) throw new BadRequestException(`Price ID para plano "${planId}" (${interval}) não configurado`);

    const stripe = new Stripe(cfg.stripe.secretKey);
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:5173');

    // Reuse or create Stripe customer
    const user = await (this.prisma.users as any).findUnique({ where: { id: userId } });
    let customerId: string | undefined = user?.stripeCustomerId ?? undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId },
      });
      customerId = customer.id;
      await (this.prisma.users as any).update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const mode = cfg.stripe.mode ?? 'hosted';

    if (mode === 'embedded') {
      // Stripe Payment Element (embedded checkout)
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        ui_mode: 'embedded' as any,
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          trial_period_days: cfg.trialDays ?? 14,
          metadata: { userId, planId },
        },
        return_url: `${appUrl}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
        metadata: { userId, planId },
      });
      return {
        type: 'stripe_embedded',
        clientSecret: session.client_secret!,
        publishableKey: cfg.stripe.publishableKey,
      };
    }

    // Hosted checkout (default)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      subscription_data: {
        trial_period_days: cfg.trialDays ?? 14,
        metadata: { userId, planId },
      },
      success_url: `${appUrl}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/upgrade`,
      metadata: { userId, planId },
    });

    return { type: 'redirect', url: session.url! };
  }

  // ─── Stripe Webhook ───────────────────────────────────────────────────────

  async handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const cfg = await this.getConfig();
    if (!cfg.stripe?.secretKey || !cfg.stripe?.webhookSecret) return;

    const stripe = new Stripe(cfg.stripe.secretKey);
    let event: any;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, cfg.stripe.webhookSecret);
    } catch {
      throw new BadRequestException('Stripe webhook signature inválida');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = (session.metadata?.userId ?? session.client_reference_id) as string;
        const planId = (session.metadata?.planId ?? 'starter') as string;
        if (userId) await this.activatePlan(userId, planId);
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        const userId = sub.metadata?.userId as string;
        const planId = sub.metadata?.planId as string;
        if (userId && planId) {
          if (sub.status === 'active' || sub.status === 'trialing') {
            await this.activatePlan(userId, planId);
          } else if (sub.status === 'canceled' || sub.status === 'unpaid') {
            await this.activatePlan(userId, 'free');
          }
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        const userId = sub.metadata?.userId as string;
        if (userId) await this.activatePlan(userId, 'free');
        break;
      }
    }
  }

  // ─── Hotmart ──────────────────────────────────────────────────────────────

  private getHotmartUrl(
    userEmail: string,
    planId: string,
    interval: 'monthly' | 'annual',
    cfg: BillingConfig,
  ) {
    const url = interval === 'annual'
      ? cfg.hotmart?.plans?.[planId]?.annual
      : cfg.hotmart?.plans?.[planId]?.monthly;

    if (!url) throw new BadRequestException(`URL Hotmart para plano "${planId}" não configurado`);

    // Pre-fill buyer email in Hotmart checkout
    const finalUrl = `${url}${url.includes('?') ? '&' : '?'}checkoutinfo[email]=${encodeURIComponent(userEmail)}`;
    return { type: 'redirect', url: finalUrl };
  }

  async handleHotmartWebhook(body: any, hottok: string): Promise<void> {
    const cfg = await this.getConfig();
    if (!cfg.hotmart?.hottokSecret) return;
    if (hottok !== cfg.hotmart.hottokSecret) throw new BadRequestException('HOTTOK inválido');

    // Hotmart sends event in body.event (PURCHASE_APPROVED, PURCHASE_CANCELED, etc.)
    const event = body?.event;
    const buyerEmail = body?.data?.buyer?.email as string;

    if (!buyerEmail) return;

    if (event === 'PURCHASE_APPROVED' || event === 'PURCHASE_COMPLETE') {
      // Try to determine plan from product/offer name or price
      const planId = this.inferHotmartPlan(body, cfg);
      const user = await (this.prisma.users as any).findUnique({
        where: { email: buyerEmail.toLowerCase() },
      });
      if (user) await this.activatePlan(user.id, planId);
    } else if (event === 'PURCHASE_CANCELED' || event === 'PURCHASE_REFUNDED') {
      const user = await (this.prisma.users as any).findUnique({
        where: { email: buyerEmail.toLowerCase() },
      });
      if (user) await this.activatePlan(user.id, 'free');
    }
  }

  private inferHotmartPlan(body: any, cfg: BillingConfig): string {
    // Try to match by product name in the webhook payload
    const productName = (body?.data?.product?.name as string ?? '').toLowerCase();
    const planIds = Object.keys(PLANS).filter(p => p !== 'free');
    for (const planId of planIds) {
      if (productName.includes(planId)) return planId;
    }
    return 'starter'; // fallback
  }

  // ─── External platforms ───────────────────────────────────────────────────

  private getExternalUrl(
    userEmail: string,
    planId: string,
    interval: 'monthly' | 'annual',
    cfg: BillingConfig,
  ) {
    const url = interval === 'annual'
      ? cfg.external?.plans?.[planId]?.annual
      : cfg.external?.plans?.[planId]?.monthly;

    if (!url) throw new BadRequestException(`URL para plano "${planId}" não configurado`);

    const finalUrl = `${url}${url.includes('?') ? '&' : '?'}email=${encodeURIComponent(userEmail)}`;
    return { type: 'redirect', url: finalUrl };
  }

  // ─── Own checkout ─────────────────────────────────────────────────────────

  private async createOwnCheckout(
    userId: string,
    userEmail: string,
    planId: string,
    interval: 'monthly' | 'annual',
    cfg: BillingConfig,
  ) {
    // Own checkout uses Stripe Payment Elements with own UX
    if (cfg.own?.gateway === 'stripe') {
      const stripeKey = cfg.stripe?.secretKey ?? cfg.own?.pagarmeApiKey;
      if (!stripeKey) throw new BadRequestException('Gateway não configurado para checkout próprio');

      // Use Stripe config for the payment processing
      return this.createStripeCheckout(userId, userEmail, planId, interval, {
        ...cfg,
        stripe: { ...cfg.stripe, mode: 'embedded' },
      });
    }
    throw new BadRequestException('Gateway do checkout próprio não suportado ainda');
  }

  // ─── Shared helpers ───────────────────────────────────────────────────────

  private async activatePlan(userId: string, planId: string): Promise<void> {
    await (this.prisma.users as any).update({
      where: { id: userId },
      data: {
        plan: planId,
        planStartDate: planId !== 'free' ? new Date() : undefined,
        updatedAt: new Date(),
      },
    });
  }
}

// Simple deep merge (objects only, arrays are replaced)
function deepMerge(target: any, source: any): any {
  const output = { ...target };
  for (const key of Object.keys(source ?? {})) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}
