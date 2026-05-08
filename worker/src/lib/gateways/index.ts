import { GatewayParser, ParsedGatewayEvent } from './types'
import { shopifyParser }    from './shopify.parser'
import { cartpandaParser }  from './cartpanda.parser'
import { yampiParser }      from './yampi.parser'
import { hotmartParser, pagtrustParser } from './hotmart.parser'
import { kiwifyParser }     from './kiwify.parser'
import { eduzzParser }      from './eduzz.parser'
import { hublaParser }      from './hubla.parser'
import { greennParser }     from './greenn.parser'
import { kirvanoParser }    from './kirvano.parser'
import { lastlinkParser }   from './lastlink.parser'
import { paytParser }       from './payt.parser'
import { perfectpayParser } from './perfectpay.parser'
import { tictoParser }      from './ticto.parser'

export type { GatewayParser, ParsedGatewayEvent }
export * from './types'

const PARSERS: Record<string, GatewayParser> = {
  shopify:     shopifyParser,
  cartpanda:   cartpandaParser,
  yampi:       yampiParser,
  hotmart:     hotmartParser,
  pagtrust:    pagtrustParser,
  kiwify:      kiwifyParser,
  eduzz:       eduzzParser,
  hubla:       hublaParser,
  greenn:      greennParser,
  kirvano:     kirvanoParser,
  lastlink:    lastlinkParser,
  payt:        paytParser,
  perfectpay:  perfectpayParser,
  ticto:       tictoParser,
}

export function getParser(gateway: string): GatewayParser {
  const parser = PARSERS[gateway.toLowerCase()]
  if (!parser) throw new Error(`Unknown gateway: ${gateway}`)
  return parser
}

export function hasParser(gateway: string): boolean {
  return gateway.toLowerCase() in PARSERS
}
