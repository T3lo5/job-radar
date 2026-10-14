import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.ts'],
    /**
     * Arquivos de teste rodam em SEQUÊNCIA, não em paralelo.
     *
     * Não é desconfiança de teste: os testes de integração dividem um único
     * banco (jobradar_test) e o sistema é mono-usuário por desenho — o
     * MatchingStep e o analytics usam `profile.findFirst()`, sem filtro por
     * usuário. Rodando em paralelo, o perfil que um arquivo cria aparece no
     * `findFirst()` do outro e as contagens se misturam.
     *
     * Foi exatamente o que aconteceu: a suíte do analytics e a da cadeia
     * falhavam juntas e passavam separadas, cada uma com a contagem da outra
     * somada.
     *
     * A alternativa seria um banco por arquivo, que custa um `CREATE DATABASE`
     * e um `migrate deploy` por suíte para um ganho de poucos segundos.
     */
    fileParallelism: false,
  },
});
