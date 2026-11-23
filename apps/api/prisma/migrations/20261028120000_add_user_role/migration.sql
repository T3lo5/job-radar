-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

-- Contas que já existiam foram criadas pelo dono da instalação (o produto é
-- single-user). Promovê-las evita que a guarda nova tranque o usuário fora de
-- /api/setup e /api/admin depois do deploy.
UPDATE "users" SET "role" = 'ADMIN';
