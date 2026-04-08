-- Update payroll table
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending';
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS "isOverride" BOOLEAN DEFAULT false;

-- Create payroll_audit_logs table
CREATE TABLE IF NOT EXISTS payroll_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "payrollId" TEXT REFERENCES payroll(id) ON DELETE CASCADE,
  "employeeId" TEXT REFERENCES employees(id) ON DELETE CASCADE,
  "changeType" TEXT NOT NULL, -- e.g., 'Statutory Override'
  "fieldName" TEXT, -- e.g., 'pcb', 'epfEmployee'
  "oldValue" NUMERIC,
  "newValue" NUMERIC,
  reason TEXT,
  "changedBy" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for audit logs
ALTER TABLE payroll_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read payroll_audit_logs" ON payroll_audit_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated insert payroll_audit_logs" ON payroll_audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- No update/delete policies to ensure immutability

-- Create myinvois_logs table
CREATE TABLE IF NOT EXISTS myinvois_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "payrollId" TEXT REFERENCES payroll(id) ON DELETE CASCADE,
  "employeeId" TEXT REFERENCES employees(id) ON DELETE CASCADE,
  "internalId" TEXT NOT NULL, -- LHDN's internal ID
  uuid TEXT, -- LHDN's submission UUID
  status TEXT, -- 'Valid', 'Invalid', 'Cancelled'
  "longId" TEXT,
  "submissionDate" TIMESTAMPTZ DEFAULT NOW(),
  "validationDate" TIMESTAMPTZ,
  "errorMessage" TEXT,
  "payload" JSONB,
  "response" JSONB
);

-- Enable RLS for MyInvois logs
ALTER TABLE myinvois_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read myinvois_logs" ON myinvois_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated insert myinvois_logs" ON myinvois_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE payroll_audit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE myinvois_logs;
