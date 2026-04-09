-- Add face_descriptor column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS face_descriptor TEXT;

-- Add a comment to explain what this stores
COMMENT ON COLUMN employees.face_descriptor IS 'Stored JSON string of the 128-float face descriptor for facial recognition.';
