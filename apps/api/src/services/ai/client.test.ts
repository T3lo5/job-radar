import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { HttpAiClient } from './client.js'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

let server: ReturnType<typeof createServer>
let baseUrl: string
let lastRequestBody: any

beforeAll(() => {
  lastRequestBody = null

  server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      lastRequestBody = JSON.parse(body)

      if (req.headers.authorization !== 'Bearer test-key') {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Unauthorized' }))
        return
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          choices: [{ message: { content: 'Hello from AI' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      )
    })
  })

  server.listen(0, '127.0.0.1', () => {
    const port = (server.address() as AddressInfo).port
    baseUrl = `http://127.0.0.1:${port}/v1/chat/completions`
  })
})

afterAll(() => {
  server.close()
})

describe('HttpAiClient', () => {
  function waitForServer(): Promise<string> {
    return new Promise((resolve) => {
      const check = () => {
        if (baseUrl) resolve(baseUrl)
        else setTimeout(check, 50)
      }
      check()
    })
  }

  it('sends a valid chat request and returns parsed response', async () => {
    const url = await waitForServer()

    const client = new HttpAiClient({
      baseUrl: url,
      apiKey: 'test-key',
      model: 'gpt-4o-mini',
    })

    const response = await client.chat([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello' },
    ])

    expect(response.content).toBe('Hello from AI')
    expect(response.latencyMs).toBeGreaterThanOrEqual(0)
    expect(response.usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    })

    expect(lastRequestBody.model).toBe('gpt-4o-mini')
    expect(lastRequestBody.messages).toHaveLength(2)
    expect(lastRequestBody.temperature).toBe(0.3)
    expect(lastRequestBody.max_tokens).toBe(2000)
  })

  it('throws on API error (401)', async () => {
    const url = await waitForServer()

    const client = new HttpAiClient({
      baseUrl: url,
      apiKey: 'wrong-key',
      model: 'gpt-4o-mini',
    })

    await expect(
      client.chat([{ role: 'user', content: 'Hi' }]),
    ).rejects.toThrow('AI API error')
  })

  it('uses custom temperature and maxTokens options', async () => {
    const url = await waitForServer()

    const client = new HttpAiClient({
      baseUrl: url,
      apiKey: 'test-key',
      model: 'gpt-4o-mini',
    })

    await client.chat(
      [{ role: 'user', content: 'Hi' }],
      { temperature: 0.1, maxTokens: 500 },
    )

    expect(lastRequestBody.temperature).toBe(0.1)
    expect(lastRequestBody.max_tokens).toBe(500)
  })

  it('returns empty usage when not provided by API', async () => {
    const url = await waitForServer()

    server.removeAllListeners('request')
    server.on('request', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ choices: [{ message: { content: 'no usage' } }] }))
    })

    const client = new HttpAiClient({
      baseUrl: url,
      apiKey: 'test-key',
      model: 'gpt-4o-mini',
    })

    const response = await client.chat([{ role: 'user', content: 'Hi' }])
    expect(response.content).toBe('no usage')
    expect(response.usage).toBeUndefined()
  })
})
