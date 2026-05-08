// Central TypeScript types for Nexus ROAS tracking system

export type EventName =
  | 'PageView'
  | 'ViewContent'
  | 'ViewCategory'
  | 'ViewCart'
  | 'AddToCart'
  | 'RemoveFromCart'
  | 'AddToWishlist'
  | 'InitiateCheckout'
  | 'AddContactInfo'
  | 'AddShippingInfo'
  | 'AddPaymentInfo'
  | 'Purchase'
  | 'Lead'
  | 'CompleteRegistration'
  | 'Subscribe'
  | 'Search'

export interface ContentItem {
  id: string
  name?: string
  category?: string
  price?: number
  quantity?: number
}

export interface CustomData {
  value?: number
  currency?: string
  order_id?: string
  contents?: ContentItem[]
  content_type?: string
  search_string?: string
  num_items?: number
}

export interface UserData {
  email?: string
  phone?: string
  first_name?: string
  last_name?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

export interface GeoData {
  ip?: string
  city?: string
  region?: string
  country?: string
  postal?: string
  currency?: string
  timezone?: string
}

export interface BrowserData {
  user_agent?: string
  language?: string
  screen_width?: number
  screen_height?: number
  viewport_width?: number
  viewport_height?: number
  pixel_ratio?: number
  // Cart
  cart_token?: string
  // Marketing signals forwarded to worker for CAPI
  fbp?: string
  fbc?: string
  fbclid?: string
  gclid?: string
  gbraid?: string
  wbraid?: string
  ttclid?: string
  ttp?: string
  msclkid?: string
  twclid?: string
  ga_client_id?: string
  ga_session_id?: string
}

export interface UtmData {
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term?: string
  utm_content?: string
}

export interface SignalMap {
  // Meta
  fbclid?: string
  fbc?: string
  fbp?: string
  // Google
  gclid?: string
  gbraid?: string
  wbraid?: string
  // TikTok
  ttclid?: string
  ttp?: string
  // Bing
  msclkid?: string
  // Twitter / X
  twclid?: string
  // GA4
  ga_client_id?: string
  ga_session_id?: string
  ga_session_count?: string
}

export interface NexusEvent {
  event: EventName
  event_id: string
  nx_user: string
  page_url: string
  page_title?: string
  page_referrer?: string
  session_id?: string
  browser_data: BrowserData
  utm_data?: Partial<UtmData>
  user_data?: UserData
  custom_data?: CustomData
  test_event_code?: string
  tiktok_test_event_code?: string
}

export type EventTriggerType = 'pageload' | 'click' | 'scroll' | 'time_on_page' | 'form_submit'

export interface EventTrigger {
  type: EventTriggerType
  event: EventName
  selector?: string
  depth?: number
  seconds?: number
  custom_data?: CustomData
}

export interface PixelConfig {
  collect_url: string
  pixel_id?: string
  meta_pixel_id?: string
  meta_pixel_ids_mirror?: string[]
  tiktok_pixel_id?: string
  ga4_measurement_id?: string
  google_ads_conversion_id?: string
  google_ads_events?: Record<string, string>
  meta_test_event_code?: string
  tiktok_test_event_code?: string
  debug?: boolean
  geo?: GeoData
  triggers?: EventTrigger[]
}
