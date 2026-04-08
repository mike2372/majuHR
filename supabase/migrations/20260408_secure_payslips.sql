-- Update employees table for Secure Payslips
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "icNo" TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "dob" TEXT; -- Birth Year part extracted from here
