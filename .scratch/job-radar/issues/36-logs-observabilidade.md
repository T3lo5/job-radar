# 36 — Logs estruturados e observabilidade básica

## Question

- Logger estruturado (pino) em JSON
- Request ID em cada request (propagado para jobs filhos)
- Endpoint `GET /api/admin/jobs/status` mostrando contadores por queue BullMQ
- Endpoint `GET /api/admin/ai-runs` listando chamadas IA com custo estimado
- Alerta em log se chamada IA custar > threshold

## Type

task

## Status

done

## Blocked by

21

## Implementation

- Fastify's built-in pino logger (JSON format in production)
- Request ID: `genReqId` generates unique ID per request
- `GET /api/admin/jobs/status` — returns BullMQ queue counters (waiting, active, completed, failed, delayed) for both collection and processing queues
- `GET /api/admin/ai-runs` — paginated list of AI operations with estimated cost calculation
- Cost alert: logs warning when AI call exceeds $0.05 threshold
- Cost estimation: $0.01/1K prompt tokens + $0.03/1K completion tokens
