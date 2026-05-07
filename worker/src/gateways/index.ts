import { WebhookData } from '../types';
import { parseCartPanda }  from './cartpanda';
import { parseShopify }    from './shopify';
import { parseHotmart }    from './hotmart';
import { parseKiwify }     from './kiwify';
import { parseKirvano }    from './kirvano';
import { parseLastlink }   from './lastlink';
import { parsePagTrust }   from './pagtrust';
import { parseTicto }      from './ticto';
import { parseHubla }      from './hubla';
import { parseEduzz }      from './eduzz';
import { parsePerfectPay } from './perfectpay';
import { parsePayt }       from './payt';
import { parseGreenn }     from './greenn';
import { parseYampi }      from './yampi';

export type GatewayParser = (body: any) => WebhookData | null;

export const GATEWAY_PARSERS: Record<string, GatewayParser> = {
  cartpanda:  parseCartPanda,
  shopify:    parseShopify,
  hotmart:    parseHotmart,
  kiwify:     parseKiwify,
  kirvano:    parseKirvano,
  lastlink:   parseLastlink,
  pagtrust:   parsePagTrust,
  ticto:      parseTicto,
  hubla:      parseHubla,
  eduzz:      parseEduzz,
  perfectpay: parsePerfectPay,
  payt:       parsePayt,
  greenn:     parseGreenn,
  yampi:      parseYampi,
};

export const APPROVAL_EVENTS: Record<string, { field: string; value: any } | null> = {
  cartpanda:  null,
  shopify:    null,
  hotmart:    { field: 'event',              value: 'PURCHASE_APPROVED'         },
  kiwify:     { field: 'webhook_event_type', value: 'order_approved'            },
  kirvano:    { field: 'event',              value: 'SALE_APPROVED'             },
  lastlink:   { field: 'Event',              value: 'Purchase_Order_Confirmed'  },
  pagtrust:   { field: 'event',              value: 'PURCHASE_APPROVED'         },
  hubla:      { field: 'type',               value: 'invoice.payment_succeeded' },
  ticto:      null,
  eduzz:      null,
  perfectpay: null,
  payt:       null,
  greenn:     { field: 'currentStatus',      value: 'paid'                      },
  yampi:      null, // parser checks body.event === 'order.paid'
};
