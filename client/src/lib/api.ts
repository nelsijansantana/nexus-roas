// Auto-detect: frontend and backend share the same origin (Traefik routes /api, /tracking,
// /webhooks to the backend). Using window.location.origin means this works in every
// environment (prod, test, local) without any build-time configuration.
const BASE_URL = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

function getToken(): string | null {
  return localStorage.getItem("nexus_token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, message: body.message || res.statusText, ...body };
  }
  return res.json();
}

// Auth
export async function login(email: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<{ token: string; user: { id: string; email: string; name: string; role: string } }>(res);
}

export async function register(email: string, password: string, name: string) {
  const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  return handleResponse<{ token: string; user: { id: string; email: string; name: string; role: string } }>(res);
}

export async function getMe() {
  const res = await fetch(`${BASE_URL}/api/v1/auth/me`, { headers: authHeaders() });
  return handleResponse<{
    id: string;
    email: string;
    name: string;
    role: string;
    timezone: string;
    ownerId: string | null;
    memberRole: string | null;
  }>(res);
}

export async function updateTimezone(timezone: string) {
  const res = await fetch(`${BASE_URL}/api/v1/auth/timezone`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ timezone }),
  });
  return handleResponse<{ timezone: string }>(res);
}

// Projects
export type CheckoutType =
  | 'shopify' | 'cartpanda' | 'shopify_yampi' | 'shopify_cartpanda' | 'woocommerce'
  | 'ticto' | 'hotmart' | 'kirvano' | 'kiwify'
  | 'greenn' | 'lastlink' | 'pagtrust' | 'hubla' | 'eduzz' | 'perfectpay' | 'payt';
export type ProjectType = 'ecommerce' | 'direct';

export interface Project {
  id: string;
  pixelId: string;
  name: string;
  domain: string | null;
  customDomain: string | null;
  checkoutType: CheckoutType;
  projectType: ProjectType;
  isActive: boolean;
  cartpandaStoreId: string | null;
  sendPurchaseFromWeb: boolean;
  // Meta
  pixelFacebookId: string | null;
  testEventCode: string | null;
  hasFacebookToken: boolean;
  // TikTok
  tikTokPixelId: string | null;
  testEventCodeTikTok: string | null;
  hasTikTokToken: boolean;
  // GA4
  ga4MeasurementId: string | null;
  hasGa4Secret: boolean;
  // Google Ads
  googleAdsConversionId: string | null;
  googleAdsLabelContact: string | null;
  googleAdsLabelLead: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ProjectDetail {
  project: Project;
  // Install snippet — ready to paste in <head>
  installScript: string;
  // Shopify Customer Events — paste as Remote pixel URL
  shopifyCheckoutPixelUrl: string;
  // CartPanda checkout script tag — paste in CartPanda Admin → Scripts Adicionais
  cartpandaCheckoutScriptTag: string;
  // Yampi checkout script tag — paste in Yampi Admin → Scripts Adicionais
  yampiCheckoutScriptTag: string;
  // Webhook URLs for payment gateways
  webhookUrl: string;
  tictoWebhookUrl: string;
  // Connection details
  workerBaseUrl: string | null;
  ingestApiKey: string;
  ingestUrl: string;
  customDomain: string | null;
}

// ─── Pixel Events (direct-response rule engine) ──────────────────────────────

export type TriggerType =
  | 'click'
  | 'form_submit'
  | 'scroll'
  | 'time_on_page'
  | 'pageload';

export interface PixelEvent {
  id: string;
  projectId: string;
  eventName: string;
  triggerType: TriggerType;
  selector: string | null;
  buttonText: string | null;
  scrollDepth: number | null;
  timeSeconds: number | null;
  customData: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreatePixelEventPayload = {
  eventName: string;
  triggerType: TriggerType;
  selector?: string;
  buttonText?: string;
  scrollDepth?: number;
  timeSeconds?: number;
  customData?: Record<string, unknown>;
};

export type UpdatePixelEventPayload = Partial<CreatePixelEventPayload & { isActive: boolean }>;

export async function getPixelEvents(projectId: string) {
  const res = await fetch(`${BASE_URL}/api/v1/projects/${projectId}/pixel-events`, {
    headers: authHeaders(),
  });
  return handleResponse<PixelEvent[]>(res);
}

export async function createPixelEvent(projectId: string, data: CreatePixelEventPayload) {
  const res = await fetch(`${BASE_URL}/api/v1/projects/${projectId}/pixel-events`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<PixelEvent>(res);
}

export async function updatePixelEvent(
  projectId: string,
  id: string,
  data: UpdatePixelEventPayload,
) {
  const res = await fetch(`${BASE_URL}/api/v1/projects/${projectId}/pixel-events/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<PixelEvent>(res);
}

export async function deletePixelEvent(projectId: string, id: string) {
  const res = await fetch(`${BASE_URL}/api/v1/projects/${projectId}/pixel-events/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse<{ deleted: boolean }>(res);
}

export async function getProjects() {
  const res = await fetch(`${BASE_URL}/api/v1/projects`, { headers: authHeaders() });
  return handleResponse<Project[]>(res);
}

export async function getProject(id: string) {
  const res = await fetch(`${BASE_URL}/api/v1/projects/${id}`, { headers: authHeaders() });
  return handleResponse<ProjectDetail>(res);
}

export async function createProject(data: Record<string, string | boolean>) {
  const res = await fetch(`${BASE_URL}/api/v1/projects`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<ProjectDetail>(res);
}

export async function updateProject(id: string, data: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/api/v1/projects/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<ProjectDetail>(res);
}

export async function deleteProject(id: string) {
  const res = await fetch(`${BASE_URL}/api/v1/projects/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse<{ deleted: boolean; id: string }>(res);
}

export async function downloadWorker(id: string) {
  const res = await fetch(`${BASE_URL}/api/v1/projects/${id}/worker/download`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });
  if (!res.ok) throw new Error("Download failed");
  return res.blob();
}

// Analytics
export interface DashboardMetrics {
  grossRevenue: number;
  purchaseCount: number;
  paymentMethods: { method: string; totalRevenue: number; count: number }[];
  utmSources: { source: string; totalRevenue: number; count: number }[];
  utmCampaigns: { campaign: string; totalRevenue: number; count: number }[];
}

export interface RevenueOverTimePoint {
  date: string;
  revenue: number;
  sales: number;
}

export async function getRevenueOverTime(params?: {
  projectId?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
}) {
  const query = new URLSearchParams();
  if (params?.projectId) query.set("projectId", params.projectId);
  if (params?.startDate) query.set("startDate", params.startDate);
  if (params?.endDate) query.set("endDate", params.endDate);
  if (params?.timezone) query.set("timezone", params.timezone);
  const qs = query.toString() ? `?${query.toString()}` : "";
  const res = await fetch(`${BASE_URL}/api/v1/analytics/revenue-over-time${qs}`, { headers: authHeaders() });
  return handleResponse<RevenueOverTimePoint[]>(res);
}

export async function getDashboardMetrics(params?: {
  projectId?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
}) {
  const query = new URLSearchParams();
  if (params?.projectId) query.set("projectId", params.projectId);
  if (params?.startDate) query.set("startDate", params.startDate);
  if (params?.endDate) query.set("endDate", params.endDate);
  if (params?.timezone) query.set("timezone", params.timezone);
  const qs = query.toString() ? `?${query.toString()}` : "";
  const res = await fetch(`${BASE_URL}/api/v1/analytics/dashboard${qs}`, { headers: authHeaders() });
  return handleResponse<DashboardMetrics>(res);
}

// Admin
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  plan: string;
  planStartDate: string | null;
  createdAt: string;
  projectsCount: number;
}

export interface AdminMetrics {
  customers: {
    total: number;
    newThisMonth: number;
    newLastMonth: number;
    activeUsers: number;
    byPlan: Record<string, number>;
  };
  revenue: {
    mrr: number;
    arr: number;
    mrrLastMonth: number;
    mrrGrowth: number;
  };
  salesProcessed: {
    allTime: number;
    thisMonth: number;
    revenueAllTime: number;
    revenueThisMonth: number;
    currency: string;
  };
  planDistribution: {
    plan: string;
    name: string;
    count: number;
    monthlyRevenue: number;
  }[];
}

export interface UserConsumption {
  user: {
    id: string;
    email: string;
    name: string;
    plan: string;
    planName: string;
    planStartDate: string | null;
  };
  usage: {
    projectsUsed: number;
    projectsLimit: number;
    salesThisMonth: number;
    salesLimit: number;
    percentUsed: number;
    isOverLimit: boolean;
    overageCount: number;
    overageAmount: number;
  };
  billingCycle: {
    start: string;
    end: string;
  };
}

export async function adminListUsers() {
  const res = await fetch(`${BASE_URL}/api/v1/admin/users`, { headers: authHeaders() });
  return handleResponse<AdminUser[]>(res);
}

export async function adminCreateUser(data: any) {
  const res = await fetch(`${BASE_URL}/api/v1/admin/users`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<AdminUser>(res);
}

export async function adminUpdateUser(id: string, data: any) {
  const res = await fetch(`${BASE_URL}/api/v1/admin/users/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<AdminUser>(res);
}

export async function adminDeleteUser(id: string) {
  const res = await fetch(`${BASE_URL}/api/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function adminGetMetrics() {
  const res = await fetch(`${BASE_URL}/api/v1/admin/metrics`, { headers: authHeaders() });
  return handleResponse<AdminMetrics>(res);
}

export async function adminGetUserConsumption(id: string) {
  const res = await fetch(`${BASE_URL}/api/v1/admin/users/${id}/consumption`, { headers: authHeaders() });
  return handleResponse<UserConsumption>(res);
}

// Teams
export type MemberRole = 'admin' | 'analyst' | 'viewer';

export interface TeamMember {
  membershipId: string;
  userId: string;
  email: string;
  name: string;
  role: MemberRole;
  createdAt: string;
}

export interface MemberProject {
  id: string;
  name: string;
  domain: string | null;
  pixelId: string;
  hasAccess: boolean;
  accessId: string | null;
}

export const MEMBER_ROLE_LABELS: Record<MemberRole, { label: string; description: string }> = {
  admin:   { label: 'Admin',    description: 'Todos os projetos, não gerencia time/billing' },
  analyst: { label: 'Analista', description: 'Leitura de analytics nos projetos liberados' },
  viewer:  { label: 'Viewer',   description: 'Acesso apenas a scripts e webhooks' },
};

export async function teamListMembers() {
  const res = await fetch(`${BASE_URL}/api/v1/team/members`, { headers: authHeaders() });
  return handleResponse<TeamMember[]>(res);
}

export async function teamCreateMember(data: {
  email: string; name: string; password: string; role: MemberRole;
}) {
  const res = await fetch(`${BASE_URL}/api/v1/team/members`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  return handleResponse<TeamMember>(res);
}

export async function teamUpdateMember(membershipId: string, data: {
  role?: MemberRole; name?: string; password?: string;
}) {
  const res = await fetch(`${BASE_URL}/api/v1/team/members/${membershipId}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(data),
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function teamRemoveMember(membershipId: string) {
  const res = await fetch(`${BASE_URL}/api/v1/team/members/${membershipId}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function teamGetMemberProjects(membershipId: string) {
  const res = await fetch(`${BASE_URL}/api/v1/team/members/${membershipId}/projects`, {
    headers: authHeaders(),
  });
  return handleResponse<MemberProject[]>(res);
}

export async function teamGrantProject(membershipId: string, projectId: string) {
  const res = await fetch(`${BASE_URL}/api/v1/team/members/${membershipId}/projects/${projectId}`, {
    method: 'POST', headers: authHeaders(),
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const res = await fetch(`${BASE_URL}/api/v1/auth/password`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function teamRevokeProject(membershipId: string, projectId: string) {
  const res = await fetch(`${BASE_URL}/api/v1/team/members/${membershipId}/projects/${projectId}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  return handleResponse<{ success: boolean }>(res);
}

// Billing
export interface PublicBillingConfig {
  active: 'none' | 'stripe' | 'hotmart' | 'external' | 'own';
  trialDays: number;
  stripePublishableKey?: string;
  stripeMode?: 'hosted' | 'embedded';
  externalPlatformName?: string;
}

export interface BillingConfig {
  active: 'none' | 'stripe' | 'hotmart' | 'external' | 'own';
  trialDays?: number;
  stripe?: {
    publishableKey?: string;
    secretKey?: string;
    webhookSecret?: string;
    mode?: 'hosted' | 'embedded';
    plans?: Record<string, { monthly?: string; annual?: string }>;
  };
  hotmart?: {
    hottokSecret?: string;
    plans?: Record<string, { monthly?: string; annual?: string }>;
  };
  external?: {
    platformName?: string;
    plans?: Record<string, { monthly?: string; annual?: string }>;
  };
  own?: {
    gateway?: 'stripe' | 'pagarme';
    pagarmeApiKey?: string;
  };
}

export interface CheckoutResult {
  type: 'redirect' | 'stripe_embedded';
  url?: string;
  clientSecret?: string;
  publishableKey?: string;
}

export async function getBillingConfig() {
  const res = await fetch(`${BASE_URL}/api/v1/billing/config`);
  return handleResponse<PublicBillingConfig>(res);
}

export async function getAdminBillingConfig() {
  const res = await fetch(`${BASE_URL}/api/v1/admin/billing/config`, { headers: authHeaders() });
  return handleResponse<BillingConfig>(res);
}

export async function saveAdminBillingConfig(data: BillingConfig) {
  const res = await fetch(`${BASE_URL}/api/v1/admin/billing/config`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<BillingConfig>(res);
}

// ─── Account Webhooks ─────────────────────────────────────────────────────────

export interface AccountWebhook {
  id:         string;
  gateway:    string;
  name:       string;
  projectIds: string[];
  isActive:   boolean;
  createdAt:  string;
  updatedAt:  string;
  webhookUrl: string;
}

export async function listAccountWebhooks(): Promise<AccountWebhook[]> {
  const res = await fetch(`${BASE_URL}/api/v1/account-webhooks`, { headers: authHeaders() });
  return handleResponse<AccountWebhook[]>(res);
}

export async function createAccountWebhook(data: {
  name: string;
  gateway: string;
  projectIds: string[];
}): Promise<AccountWebhook> {
  const res = await fetch(`${BASE_URL}/api/v1/account-webhooks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<AccountWebhook>(res);
}

export async function updateAccountWebhook(
  id: string,
  data: Partial<{ name: string; gateway: string; projectIds: string[]; isActive: boolean }>
): Promise<AccountWebhook> {
  const res = await fetch(`${BASE_URL}/api/v1/account-webhooks/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<AccountWebhook>(res);
}

// ─── Google Ads OAuth ──────────────────────────────────────────────────────────

export interface GoogleAdsAccount {
  customerId: string;
  name: string;
  resourceName: string;
}

export interface GoogleAdsConversionAction {
  id: string;
  name: string;
  resourceName: string;
  label: string;
}

export interface GoogleAdsIntegration {
  connected: boolean;
  customerId?: string;
  conversionId?: string;
  events?: Record<string, { label?: string; action_resource?: string }>;
}

export async function googleAdsGetAuthUrl(projectId: string): Promise<{ authUrl: string }> {
  const res = await fetch(`${BASE_URL}/api/v1/integrations/google-ads/auth?projectId=${projectId}`, {
    headers: authHeaders(),
  });
  return handleResponse<{ authUrl: string }>(res);
}

export async function googleAdsListAccounts(sessionId: string): Promise<{ accounts: GoogleAdsAccount[] }> {
  const res = await fetch(`${BASE_URL}/api/v1/integrations/google-ads/accounts?session=${sessionId}`, {
    headers: authHeaders(),
  });
  return handleResponse<{ accounts: GoogleAdsAccount[] }>(res);
}

export async function googleAdsListConversionActions(
  sessionId: string,
  customerId: string
): Promise<{ conversionActions: GoogleAdsConversionAction[] }> {
  const res = await fetch(
    `${BASE_URL}/api/v1/integrations/google-ads/conversion-actions?session=${sessionId}&customerId=${customerId}`,
    { headers: authHeaders() }
  );
  return handleResponse<{ conversionActions: GoogleAdsConversionAction[] }>(res);
}

export async function googleAdsGetIntegration(projectId: string): Promise<GoogleAdsIntegration> {
  const res = await fetch(
    `${BASE_URL}/api/v1/integrations/google-ads/integration?projectId=${projectId}`,
    { headers: authHeaders() }
  );
  return handleResponse<GoogleAdsIntegration>(res);
}

export async function googleAdsConnect(data: {
  sessionId: string;
  projectId: string;
  customerId: string;
  conversionId: string;
  events: Record<string, { label?: string; actionResource?: string }>;
}): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE_URL}/api/v1/integrations/google-ads/connect`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function googleAdsDisconnect(projectId: string): Promise<{ success: boolean }> {
  const res = await fetch(
    `${BASE_URL}/api/v1/integrations/google-ads/disconnect?projectId=${projectId}`,
    { method: "DELETE", headers: authHeaders() }
  );
  return handleResponse<{ success: boolean }>(res);
}

export async function deleteAccountWebhook(id: string): Promise<{ deleted: boolean; id: string }> {
  const res = await fetch(`${BASE_URL}/api/v1/account-webhooks/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse<{ deleted: boolean; id: string }>(res);
}

// ─────────────────────────────────────────────────────────────────────────────

export async function createCheckout(planId: string, interval: 'monthly' | 'annual') {
  const res = await fetch(`${BASE_URL}/api/v1/billing/create-checkout`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ planId, interval }),
  });
  return handleResponse<CheckoutResult>(res);
}
