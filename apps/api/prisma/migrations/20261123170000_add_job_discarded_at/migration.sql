-- Descarte suave de vagas: data em que a vaga foi descartada (null = ativa).
ALTER TABLE "jobs" ADD COLUMN "discarded_at" TIMESTAMP(3);

CREATE INDEX "jobs_discarded_at_idx" ON "jobs"("discarded_at");
