/** SHA-256 hex digest via crypto.subtle — lowercase + trim before encoding. */
export async function sha256(value: string): Promise<string> {
  if (!value) return ''
  const normalized = value.toLowerCase().trim()
  const data       = new TextEncoder().encode(normalized)
  const hash       = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
