# 34 — PII fora da IA + export/delete

Status: ready-for-agent
Sprint: 3
Prioridade: P1
Área: api + web
Esforço: médio
Origem: [auditoria §4.11, §5.11, §7.7](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

O detector de dados sensíveis roda **depois** do upload e só devolve o resultado no JSON: não persiste nem redige. Em seguida, o otimizador e a carta enviam `resume.rawText` e o perfil completo para o provedor de IA configurado. O produto promete cuidado com CPF e faz o oposto. Não há export/delete de todos os dados.

## Evidência

- `apps/api/src/routes/resumes.ts:24` — detecção sem persistência/redação.
- `apps/api/src/services/ai/client.ts:17` — envio do texto bruto.
- `apps/api/src/routes/cv-optimizer.ts` — prompt com perfil completo.
- `apps/api/src/services/sensitive-data.ts:28` — confunde celular de 11 dígitos com CPF.

## Correção

1. Redigir CPF/RG/telefone/e-mail pessoal/endereço **antes** de qualquer chamada de IA, com placeholders estáveis.
2. Validar dígitos verificadores de CPF antes de classificar; reduzir falso positivo de celular.
3. Persistir os achados no `Resume` para o usuário revisar e corrigir.
4. Tela "o que sai da sua máquina" por provedor, com lista de campos enviados.
5. Export completo (JSON) e delete total (conta + dados + arquivos) em um clique, com confirmação.
6. Log de auditoria de IA visível ao usuário (quais runs, quando, o quê).

## Critérios de aceite

- [ ] Nenhum CPF/RG/telefone chega ao provedor de IA (teste com interceptor).
- [ ] Celular de 11 dígitos não é marcado como CPF válido.
- [ ] Achados ficam salvos e visíveis no CV.
- [ ] Export gera arquivo com todos os dados do usuário.
- [ ] Delete remove banco, arquivos e cache; sessões são revogadas.
- [ ] Tela lista exatamente quais campos saem para a IA.

## Testes

- Teste de redação antes do client de IA (mock que falha se receber PII).
- Teste de CPF válido/inválido e celular.
- Teste de export→delete→login falha.

## Comments
