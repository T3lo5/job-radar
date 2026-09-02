# 19 — Matching engine (cálculo de score)

## Question

Implementar função `computeMatchScore(job, profile): MatchResult`:

Pesos iniciais (do roadmap):
- Tecnologias: 35%
- Experiência: 20%
- Senioridade: 15%
- Localização: 10%
- Cloud/DevOps: 10%
- Idiomas: 5%
- Outros: 5%

Tecnologias:
- Match exato: 1.0
- Sinonímia (React = React.js): 1.0
- Relacionada (Node.js vs NestJS): 0.5
- Ausente: 0.0

**Regra crítica**: nunca marcar skill como "possui" se não estiver no perfil. Match é apenas "atende / atende parcialmente / não atende".

Saída: `{ score: 0-100, breakdown: {...}, matched_skills: [...], missing_skills: [...], partial_skills: [...] }`.

## Type

task

## Status

done

## Resolution

**Matching Engine** (`apps/api/src/services/matching/engine.ts`):

**Pesos implementados:**
- Tecnologias: 35% (skill matching com sinonímia e relatedness)
- Experiência: 20% (anos médios + bônus por skills matched)
- Seniority: 15% (comparação perfil vs título da vaga)
- Localização: 10% (remote = match, cidade, país)
- Cloud/DevOps: 10% (subset de skills de infra)
- Idiomas: 5% (inglês para vagas internacionais)
- Outros: 5%

**Regra crítica:** Nunca marcar skill como "possui" sem evidência no perfil.

**Algoritmo de skills:**
- Match exato (normalizado): 1.0
- Sinonímia (aliases no catálogo): 1.0
- Relacionada (grupos de tecnologias): 0.5
- Ausente: 0.0

**Integração com worker pipeline:**
- `workers/processing.ts` — pipeline de processamento
- Extraction → Matching → Analysis chain
- Triggered automatically after job collection

**Endpoints:**
- `POST /api/match/evaluate` — avalia job vs perfil, armazena resultado
- `GET /api/match/results` — lista matches ordenados por score

**Saída:**
```ts
{ score, breakdown, matchedSkills, partialSkills, missingSkills, recommendation }
```

**Validação:**
- `pnpm typecheck` ✓
