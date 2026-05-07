import { parseHotmart } from './hotmart';
import { WebhookData } from '../types';

// PagTrust uses the same webhook format as Hotmart
export function parsePagTrust(body: any): WebhookData {
  return { ...parseHotmart(body), gateway: 'pagtrust' };
}
