-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "discard_terms" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "focus_stacks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "job_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "seniority_list" TEXT[] DEFAULT ARRAY[]::TEXT[];
