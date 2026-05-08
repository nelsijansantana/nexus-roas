import type { SignalMap } from './types'
import { collectUtms } from './signals'

export const CHECKOUT_DOMAINS = [
  'cartpanda.com',
  'hotmart.com',
  'ticto.com.br', 'ticto.io',
  'kiwify.com.br', 'kiwify.com',
  'kirvano.com',
  'greenn.com.br',
  'yampi.com.br',
  'pagtrust.com',
  'payt.com.br',
  'perfectpay.com.br',
  'hubla.com.br',
  'eduzz.com',
  'lastlink.com',
] as const

const TRANSFER_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'fbclid', 'gclid', 'gbraid', 'wbraid', 'ttclid', 'msclkid',
] as const

export function isCheckoutDomain(hostname: string): boolean {
  return CHECKOUT_DOMAINS.some(d => hostname.includes(d))
}

function decorateLink(
  anchor: HTMLAnchorElement,
  nxUser: string,
  utms: Record<string, string>,
  signals: SignalMap,
): void {
  try {
    if (!anchor.href || anchor.href.startsWith('#') || anchor.href.startsWith('javascript:')) return
    const url = new URL(anchor.href)
    if (!isCheckoutDomain(url.hostname)) return

    let modified = false

    for (const param of TRANSFER_PARAMS) {
      const val = utms[param] ?? (signals as Record<string, string | undefined>)[param]
      if (val && !url.searchParams.has(param)) {
        url.searchParams.set(param, val)
        modified = true
      }
    }

    if (!url.searchParams.has('src')) {
      url.searchParams.set('src', nxUser)
      modified = true
    }
    if (!url.searchParams.has('sck')) {
      url.searchParams.set('sck', nxUser)
      modified = true
    }

    if (modified) anchor.href = url.toString()
  } catch {
    // Malformed URL — skip silently
  }
}

function decorateForm(form: HTMLFormElement, nxUser: string): void {
  try {
    if (!form.action) return
    const url = new URL(form.action)
    if (!isCheckoutDomain(url.hostname)) return

    const setHidden = (name: string, value: string) => {
      if (form.querySelector(`input[name="${name}"]`)) return
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }

    setHidden('src', nxUser)
    setHidden('sck', nxUser)
  } catch {
    // Malformed action URL — skip silently
  }
}

function decorateAll(nxUser: string, utms: Record<string, string>, signals: SignalMap): void {
  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(a => {
    decorateLink(a, nxUser, utms, signals)
  })
  document.querySelectorAll<HTMLFormElement>('form[action]').forEach(form => {
    decorateForm(form, nxUser)
  })
}

export function initLinkDecorator(nxUser: string, signals: SignalMap): void {
  const decorate = () => decorateAll(nxUser, collectUtms(), signals)

  // Initial pass
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', decorate)
  } else {
    decorate()
  }

  // Watch for dynamically added nodes
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(mutations => {
      if (mutations.some(m => m.addedNodes.length > 0)) decorate()
    })
    const startObserving = () => {
      observer.observe(document.body, { childList: true, subtree: true })
    }
    document.body ? startObserving() : document.addEventListener('DOMContentLoaded', startObserving)
  }

  // Click fallback for SPAs that swap href at click time
  document.addEventListener('click', e => {
    const target = (e.target as Element).closest('a')
    if (target) decorateLink(target as HTMLAnchorElement, nxUser, collectUtms(), signals)
  })
}
