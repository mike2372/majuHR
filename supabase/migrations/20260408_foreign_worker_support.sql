-- Update employees table for Foreign Worker support
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "isForeignWorker" BOOLEAN DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "passportNo" TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "permitExpiry" TEXT;
