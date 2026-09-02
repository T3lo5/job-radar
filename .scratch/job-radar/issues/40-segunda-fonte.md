# 40 — Segunda fonte de vagas (validação da arquitetura)

## Question

Após primeira fonte funcionar, adicionar segunda fonte (ex: Adzuna se escolheu RemoteOK, ou vice-versa) para validar que a interface `JobSource` realmente generalizar. Confirmar que:

- Adicionar nova fonte é trivial (1 arquivo + 1 registro no banco)
- Deduplicação funciona entre fontes
- Métricas de coleta por fonte são registradas

## Type

task

## Status

done

## Blocked by

16

## Implementation

- Added `Remotive` as second job source
- New file `remotive.ts` with API integration
- Registered in `sources/index.ts` alongside RemoteOK
- Architecture validated: adding new source = 1 file + 1 line in registry
