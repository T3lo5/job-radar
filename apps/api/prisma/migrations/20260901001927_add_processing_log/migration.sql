-- CreateTable
CREATE TABLE "job_processing_log" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_processing_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_processing_log_job_id_idx" ON "job_processing_log"("job_id");

-- CreateIndex
CREATE INDEX "job_processing_log_to_status_idx" ON "job_processing_log"("to_status");

-- AddForeignKey
ALTER TABLE "job_processing_log" ADD CONSTRAINT "job_processing_log_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
