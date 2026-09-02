import type { AIClientConfig } from './types.js'

export async function testConnection(config: AIClientConfig): Promise<{
  ok: boolean
  error?: string
  latencyMs?: number
}> {
  try {
    const startTime = Date.now()

    const response = await fetch(`${config.baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      }),
    })

    if (!response.ok) {
      return {
        ok: false,
        error: `API returned ${response.status}: ${await response.text()}`,
      }
    }

    await response.json()
    return { ok: true, latencyMs: Date.now() - startTime }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
