const DEFAULT_TIMEOUT_MS = 15000

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseRetryAfterMs(response: Response): number | null {
  const retryAfter = response.headers.get('retry-after')
  if (!retryAfter) return null

  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000
  }

  const dateMs = Date.parse(retryAfter)
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now())
  }

  return null
}

interface FetchJsonOptions {
  url: string
  context: string
  maxRetries?: number
  timeoutMs?: number
  headers?: Record<string, string>
}

export async function fetchJsonWithRetry<T>({
  url,
  context,
  maxRetries = 3,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  headers
}: FetchJsonOptions): Promise<T> {
  let attempt = 0

  while (true) {
    attempt += 1
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal
      })

      if (response.ok) {
        return response.json()
      }

      const retryable = response.status === 429 || (response.status >= 500 && response.status <= 599)
      if (retryable && attempt <= maxRetries) {
        const retryAfterMs = parseRetryAfterMs(response)
        const exponentialMs = 800 * Math.pow(2, attempt - 1)
        const jitterMs = Math.floor(Math.random() * 400)
        const delayMs = Math.max(retryAfterMs ?? 0, exponentialMs + jitterMs)

        console.warn(`  ⚠️ ${context}: HTTP ${response.status}, retrying in ${Math.round(delayMs / 1000)}s (attempt ${attempt}/${maxRetries + 1})`)
        await wait(delayMs)
        continue
      }

      const body = await response.text()
      throw new Error(`${context} failed: ${response.status} ${response.statusText}${body ? ` | ${body.slice(0, 200)}` : ''}`)
    } catch (error: any) {
      const isAbort = error?.name === 'AbortError'
      const isNetwork = error instanceof TypeError

      if ((isAbort || isNetwork) && attempt <= maxRetries) {
        const delayMs = 800 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 400)
        console.warn(`  ⚠️ ${context}: ${isAbort ? 'timeout' : 'network error'}, retrying in ${Math.round(delayMs / 1000)}s (attempt ${attempt}/${maxRetries + 1})`)
        await wait(delayMs)
        continue
      }

      throw error
    } finally {
      clearTimeout(timeout)
    }
  }
}
