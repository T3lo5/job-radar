# 12 — Upload e parsing de CV

## Question

- `POST /api/resumes` (multipart, PDF ou DOCX)
- Armazenar arquivo (S3-compatible, MinIO local, ou filesystem dentro de volume Docker)
- Extrair texto: `pdf-parse` para PDF, `mammoth` para DOCX
- Salvar texto extraído em `resumes.text`
- Endpoint para download/listar/excluir CVs

Decidir armazenamento no ticket.

## Type

grilling

## Status

done

## Resolution

**Upload e parsing de CV** (`apps/api/src/routes/resumes.ts`):

**Armazenamento:** filesystem local (`apps/api/uploads/`)

**Parsing:**
- PDF: `pdf-parse`
- DOCX: `mammoth.extractRawText`

**Endpoints:**
- `POST /api/resumes` — upload (multipart), extrai texto, salva arquivo + rawText
- `GET /api/resumes` — lista CVs do usuário
- `GET /api/resumes/:id` — download do arquivo
- `GET /api/resumes/:id/text` — texto extraído
- `DELETE /api/resumes/:id` — remove arquivo + registro

**Validações:**
- Tipos permitidos: PDF, DOCX, DOC
- Tamanho máximo: 10MB
- Extração de texto antes de persistir

**Dependências:** `@fastify/multipart`, `pdf-parse`, `mammoth`

**Validação:**
- `pnpm typecheck` ✓
