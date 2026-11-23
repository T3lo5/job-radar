# Registro de exceções ao `pnpm audit`

Este documento registra exceções aprovadas a vulnerabilidades detectadas pelo `pnpm audit --audit-level high`. Conforme o ticket 37, qualquer exceção deve conter justificativa e prazo de revisão.

## Formato

Cada entrada segue o modelo:

- **Pacote:** nome@versão
- **Vulnerabilidade:** ID do advisory (ex: CVE-XXXX-XXXX ou GHSA-xxxx)
- **Severidade:** high / critical
- **Justificativa:** por que não pode ser corrigida agora
- **Prazo:** data prevista para correção ou revisão
- **Aprovado por:** autor da exceção
- **Revisado em:** data da última revisão

## Entradas

| Pacote | Vulnerabilidade | Severidade | Justificativa                     | Prazo | Aprovado por | Revisado em |
| ------ | --------------- | ---------- | --------------------------------- | ----- | ------------ | ----------- |
| —      | —               | —          | Nenhuma exceção registrada ainda. | —     | —            | —           |

## Como adicionar uma exceção

1. Abra um PR adicionando uma linha à tabela acima.
2. O CI continua passando porque o gate de audit começa informativo (primeira semana).
3. Após o período informativo, exceções sem justificativa documentada farão o build falhar.
