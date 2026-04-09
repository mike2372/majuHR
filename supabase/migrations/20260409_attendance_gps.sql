-- Add GPS capturing columns to attendance table
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS "checkInLat" NUMERIC;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS "checkInLng" NUMERIC;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS "checkOutLat" NUMERIC;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS "checkOutLng" NUMERIC;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS "checkInAddress" TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS "checkOutAddress" TEXT;

-- Update RLS logic if needed (it seems authenticated users can already insert)
-- Authenticated users can update their own records? 
-- The current policy is: CREATE POLICY "Authenticated write attendance" ON attendance FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- We need an update policy too for check-out.

CREATE POLICY "Authenticated update attendance" ON attendance 
FOR UPDATE USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
