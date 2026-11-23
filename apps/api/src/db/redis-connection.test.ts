import { describe, expect, it, vi } from 'vitest';

/**
 * Ticket 26: `redisConnectionOptions()` instanciava um `Redis` por chamada.
 *
 * Filas chamam no boot e workers a cada job — cada chamada abria um cliente
 * ioredis e ninguém fechava. O contador abaixo falha se qualquer cliente for
 * construído; o resto dos testes cobre o parse que a versão anterior (host/port
 * na mão) fazia errado.
 */
const conexoes = vi.hoisted(() => ({ criadas: 0 }));

vi.mock('ioredis', () => ({
  Redis: class RedisFake {
    constructor() {
      conexoes.criadas++;
    }
  },
}));

const { parseRedisUrlOptions, redisConnectionOptions } = await import('./redis-connection.js');

describe('redisConnectionOptions', () => {
  it('não instancia cliente Redis nenhum', () => {
    redisConnectionOptions('redis://localhost:6379');
    redisConnectionOptions('redis://localhost:6379');
    redisConnectionOptions('rediss://usuario:senha@redis.exemplo.com:6380/2');

    expect(conexoes.criadas).toBe(0);
  });

  it('preserva senha, usuário, porta e database da URL', () => {
    const options = parseRedisUrlOptions('redis://usuario:s3nh%40@redis.exemplo.com:6380/4');

    expect(options).toMatchObject({
      host: 'redis.exemplo.com',
      port: 6380,
      username: 'usuario',
      password: 's3nh@',
      db: 4,
    });
  });

  it('liga TLS para rediss://', () => {
    expect(parseRedisUrlOptions('rediss://redis.exemplo.com:6380').tls).toEqual({});
    expect(parseRedisUrlOptions('redis://redis.exemplo.com:6380').tls).toBeUndefined();
  });

  it('aplica os defaults do BullMQ', () => {
    const options = redisConnectionOptions('redis://localhost');

    expect(options.port).toBe(6379);
    expect(options.maxRetriesPerRequest).toBeNull();
    expect(options.enableReadyCheck).toBe(false);
  });

  it('URL inválida ou com protocolo errado falha com mensagem clara', () => {
    expect(() => parseRedisUrlOptions('nao-e-url')).toThrow(/REDIS_URL inválida/);
    expect(() => parseRedisUrlOptions('http://localhost:6379')).toThrow(/protocolo inesperado/);
    expect(() => parseRedisUrlOptions('redis://localhost/abc')).toThrow(/database inválido/);
  });
});
