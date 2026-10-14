-- AlterEnum
ALTER TYPE "Seniority" ADD VALUE 'UNKNOWN';

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "follow_up_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "search_vector" tsvector,
ADD COLUMN     "seniority" "Seniority";

-- CreateTable
CREATE TABLE "work_experiences" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "current" BOOLEAN NOT NULL DEFAULT false,
    "skills" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobs_seniority_idx" ON "jobs"("seniority");

-- CreateIndex
CREATE INDEX "jobs_search_vector_idx" ON "jobs" USING GIN ("search_vector");

-- AddForeignKey
ALTER TABLE "work_experiences" ADD CONSTRAINT "work_experiences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Full-text search: sem trigger, "search_vector" ficaria sempre NULL e a busca
-- nunca encontraria nada. Mantém o vetor atualizado a partir dos campos que o
-- job-service consulta, e faz o backfill das linhas já existentes.
CREATE OR REPLACE FUNCTION "jobs_search_vector_update"() RETURNS trigger AS $$
BEGIN
    NEW."search_vector" := to_tsvector(
        'portuguese',
        concat_ws(' ', NEW."title", NEW."company", NEW."description")
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "jobs_search_vector_trigger" ON "jobs";
CREATE TRIGGER "jobs_search_vector_trigger"
    BEFORE INSERT OR UPDATE OF "title", "company", "description" ON "jobs"
    FOR EACH ROW
    EXECUTE FUNCTION "jobs_search_vector_update"();

UPDATE "jobs" SET "search_vector" = to_tsvector(
    'portuguese',
    concat_ws(' ', "title", "company", "description")
);
