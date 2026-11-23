-- CreateTable
CREATE TABLE "application_attachments" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "application_attachments_application_id_idx" ON "application_attachments"("application_id");

-- AddForeignKey
ALTER TABLE "application_attachments" ADD CONSTRAINT "application_attachments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
