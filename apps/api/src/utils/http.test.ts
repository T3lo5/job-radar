import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import { fetchWithTimeout, describeNetworkError } from './http.js';

// Regressão: nenhuma das 11 chamadas de fetch tinha timeout. Uma fonte que
// aceita a conexão e nunca responde segurava o Promise.all das fontes e o
// worker de coleta inteiro não concluía nunca.

describe('fetchWithTimeout', () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
  });

  it('aborta quando o servidor não responde', async () => {
    // Socket aceito, resposta nunca chega.
    const srv = http.createServer(() => {});
    servers.push(srv);
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));

    const started = Date.now();
    await expect(
      fetchWithTimeout(`http://127.0.0.1:${(srv.address() as { port: number }).port}/x`, {
        timeoutMs: 300,
      }),
    ).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('devolve a resposta quando o servidor responde a tempo', async () => {
    const srv = http.createServer((_req, res) => res.end('ok'));
    servers.push(srv);
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));

    const res = await fetchWithTimeout(
      `http://127.0.0.1:${(srv.address() as { port: number }).port}/`,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('preserva o corpo enviado', async () => {
    let recebido = '';
    const srv = http.createServer((req, res) => {
      let data = '';
      req.on('data', (c) => (data += c));
      req.on('end', () => {
        recebido = data;
        res.end('ok');
      });
    });
    servers.push(srv);
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));

    await fetchWithTimeout(`http://127.0.0.1:${(srv.address() as { port: number }).port}/`, {
      method: 'POST',
      body: 'payload',
    });
    expect(recebido).toBe('payload');
  });
});

describe('describeNetworkError', () => {
  it('traduz os erros mais comuns de rede', () => {
    expect(describeNetworkError({ cause: { code: 'ENOTFOUND' } }, 'Fonte')).toMatch(
      /host não encontrado/,
    );
    expect(describeNetworkError({ cause: { code: 'ECONNREFUSED' } }, 'Fonte')).toMatch(
      /conexão recusada/,
    );
    expect(
      describeNetworkError(Object.assign(new Error('x'), { name: 'TimeoutError' }), 'Fonte'),
    ).toMatch(/tempo limite excedido/);
    expect(describeNetworkError(new Error('qualquer'), 'Fonte')).toBe('Fonte: qualquer');
  });
});
