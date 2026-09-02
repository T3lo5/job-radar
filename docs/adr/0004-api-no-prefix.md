# ADR 0004: API expõe rotas sem prefixo /api; proxy strip

## Status

Aceito (2026-08-31, durante resolução do #03)

## Contexto

Durante a configuração do nginx no #03, defini como o path `/api/*` no frontend mapeia para as rotas da API.

## Decisão

A **API expõe rotas sem prefixo** (`/health`, `/profile`, etc.). O proxy (nginx em prod, vite em dev) **strip o `/api`** antes de encaminhar.

```text
Cliente:  GET /api/profile
Nginx:    → GET http://api:3001/profile
Vite:     → GET http://localhost:3001/profile
```

## Razões

- Backend fica "limpo": URL canônica é `/resource`, sem repetir `/api` em todo `app.get()`
- Mais simples para testes diretos (`curl http://localhost:3001/health`)
- Frontend (Vite/nginx) já precisa de proxy para resolver CORS, então strip é trivial
- Mantém consistência se a API for acessada diretamente (ex: tools, scripts) sem o prefixo

## Consequências

- Toda URL no frontend deve começar com `/api/` (constante única)
- Cliente HTTP do frontend tem `baseURL: '/api'` (configurar no #10)
- Em testes E2E diretos (sem proxy), usar URL completa sem `/api`

## Alternativas consideradas

- **API com prefixo `/api`**: requer registrar prefixo global no Fastify; duplica a string `/api` em todo route handler
- **API em porta/subdomínio separado**: complica deploy, DNS, TLS
