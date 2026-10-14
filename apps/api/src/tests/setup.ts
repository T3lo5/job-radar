// Test setup file
//
// Os testes rodam contra um banco separado do de desenvolvimento: um teste que
// apaga `jobs` nao pode levar junto a coleta real.
//
// Nao ha fallback para DATABASE_URL de proposito. Se caísse nele, um teste
// destrutivo apontaria para a coleta de quem esta rodando localmente — e o
// sintoma (vagas sumindo) apareceria horas depois, sem relacao com o teste.
//
// O banco e obrigatorio, nao opcional: teste que pula sozinho quando nao acha
// o Postgres aparece verde sem verificar nada, o que e pior que nao ter teste.
//
// Para preparar:
//   docker compose exec -T postgres psql -U jobradar -d postgres -c 'CREATE DATABASE jobradar_test'
//   DATABASE_URL=...jobradar_test pnpm exec prisma migrate deploy
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://jobradar:jobradar@localhost:5432/jobradar_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1';
