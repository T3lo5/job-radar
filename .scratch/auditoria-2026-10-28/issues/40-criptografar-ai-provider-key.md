# 40 — Criptografar `AiProvider.apiKey`

Status: ready-for-agent
Sprint: 3
Prioridade: P2
Área: api
Esforço: baixo
Origem: [auditoria §5.13](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

`AiProvider.apiKey` é gravada em texto plano no Postgres, contrariando o ADR-0005 (settings sensíveis criptografados com AES-256-GCM). Um dump do banco expõe as chaves de IA, mesmo com todo o resto protegido.

## Evidência

- `apps/api/prisma/schema.prisma:453` — `apiKey String`.
- `apps/api/src/services/settings-service.ts` — criptografia já existe para settings.
- `docs/adr/0005-*.md` — decisão de criptografar segredos.

## Correção

1. Migrar `AiProvider.apiKey` para o `SettingsService` (chave por provider) **ou** criptografar a coluna com AES-256-GCM.
2. Migration de dados: criptografar valores existentes e limpar a coluna antiga.
3. Nunca retornar a chave em respostas de API; retornar apenas `hasApiKey: true`.
4. Registrar rotação de chave e invalidar cache.

## Critérios de aceite

- [ ] `SELECT * FROM ai_providers` não revela nenhuma chave.
- [ ] API de leitura retorna apenas indicador de existência.
- [ ] Providers existentes continuam funcionando após a migração.
- [ ] Rotação de chave funciona sem restart.
- [ ] Teste inspeciona o banco após salvar e não encontra o valor original.

## Testes

- Teste de integração: salvar chave, ler linha crua, verificar ciphertext.
- Teste de chamada de IA usando a chave criptografada.

## Comments
