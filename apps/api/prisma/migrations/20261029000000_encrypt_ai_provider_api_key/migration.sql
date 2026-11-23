-- Encrypt AiProvider.apiKey (ticket 40)
-- Adiciona colunas criptografadas e mantém a coluna antiga para migração lazy de dados.
-- Os valores existentes são criptografados no primeiro acesso (lazy) via AiProviderService.

ALTER TABLE "ai_providers"
  ADD COLUMN "encrypted_api_key" TEXT,
  ADD COLUMN "api_key_iv" TEXT,
  ADD COLUMN "api_key_tag" TEXT;
