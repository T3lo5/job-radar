-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "encrypted_value" TEXT,
ADD COLUMN     "iv" TEXT,
ADD COLUMN     "tag" TEXT;

-- CreateTable
CREATE TABLE "setting_meta" (
    "id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "setting_meta_pkey" PRIMARY KEY ("id")
);
