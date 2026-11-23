-- Ticket 13 (auditoria 2026-10-28): níveis de idioma passam a usar CEFR.
--
-- Postgres não altera valores de enum no lugar. O caminho seguro é criar o
-- tipo novo, converter os dados e só então trocar os nomes — sem janela em que
-- a coluna fique sem tipo.
--
-- Mapeamento documentado (o enum antigo não tinha equivalente exato de CEFR):
--   BASIC        -> A2   (básico)
--   INTERMEDIATE -> B1   (intermediário)
--   ADVANCED     -> C1   (avançado)
--   FLUENT       -> C1   (fluente não é nível CEFR; C1 é o mais próximo)
--   NATIVE       -> NATIVE
CREATE TYPE "LanguageLevel_new" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE');

ALTER TABLE "profile_languages" ALTER COLUMN "level" DROP DEFAULT;

ALTER TABLE "profile_languages"
  ALTER COLUMN "level" TYPE "LanguageLevel_new"
  USING (
    CASE "level"::text
      WHEN 'BASIC' THEN 'A2'
      WHEN 'INTERMEDIATE' THEN 'B1'
      WHEN 'ADVANCED' THEN 'C1'
      WHEN 'FLUENT' THEN 'C1'
      WHEN 'NATIVE' THEN 'NATIVE'
      ELSE 'B1'
    END
  )::"LanguageLevel_new";

DROP TYPE "LanguageLevel";

ALTER TYPE "LanguageLevel_new" RENAME TO "LanguageLevel";

ALTER TABLE "profile_languages" ALTER COLUMN "level" SET DEFAULT 'B1';
