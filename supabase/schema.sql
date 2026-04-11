CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Employee',
  "employeeId" TEXT,
  "createdAt" TEXT
);

CREATE TABLE IF NOT EXISTS system_config (
  id TEXT PRIMARY KEY DEFAULT 'config',
  "isInitialized" BOOLEAN DEFAULT false,
  "initializedAt" TEXT
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  department TEXT NOT NULL,
  email TEXT NOT NULL,
  "joinDate" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  salary NUMERIC NOT NULL DEFAULT 0,
  "epfNo" TEXT DEFAULT '-',
  "socsoNo" TEXT DEFAULT '-',
  "taxNo" TEXT DEFAULT '-',
  "profilePicture" TEXT,
  "userId" TEXT,
  "updatedAt" TEXT
);

CREATE TABLE IF NOT EXISTS payroll (
  id TEXT PRIMARY KEY,
  "employeeId" TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  "basicSalary" NUMERIC NOT NULL DEFAULT 0,
  allowances NUMERIC NOT NULL DEFAULT 0,
  deductions NUMERIC NOT NULL DEFAULT 0,
  "epfEmployee" NUMERIC NOT NULL DEFAULT 0,
  "epfEmployer" NUMERIC NOT NULL DEFAULT 0,
  "socsoEmployee" NUMERIC NOT NULL DEFAULT 0,
  "socsoEmployer" NUMERIC NOT NULL DEFAULT 0,
  "eisEmployee" NUMERIC NOT NULL DEFAULT 0,
  "eisEmployer" NUMERIC NOT NULL DEFAULT 0,
  pcb NUMERIC NOT NULL DEFAULT 0,
  "netSalary" NUMERIC NOT NULL DEFAULT 0,
  "createdAt" TEXT
);

CREATE TABLE IF NOT EXISTS leaves (
  id TEXT PRIMARY KEY,
  "employeeId" TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  "appliedDate" TEXT,
  "createdAt" TEXT
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  "employeeId" TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  "checkIn" TEXT,
  "checkOut" TEXT,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entitlements (
  "employeeId" TEXT PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  annual INTEGER NOT NULL DEFAULT 14,
  medical INTEGER NOT NULL DEFAULT 14,
  unpaid INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TEXT
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read config" ON system_config FOR SELECT USING (true);
CREATE POLICY "Authenticated can write config" ON system_config FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update config" ON system_config FOR UPDATE USING (auth.role() = 'authenticated');

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read employees" ON employees FOR SELECT USING (true);
CREATE POLICY "Authenticated full access employees" ON employees FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update employees" ON employees FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated delete employees" ON employees FOR DELETE USING (auth.role() = 'authenticated');

ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read payroll" ON payroll FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write payroll" ON payroll FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update payroll" ON payroll FOR UPDATE USING (auth.role() = 'authenticated');

ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read leaves" ON leaves FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write leaves" ON leaves FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update leaves" ON leaves FOR UPDATE USING (auth.role() = 'authenticated');

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read attendance" ON attendance FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write attendance" ON attendance FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS remote_work_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "employee_id" TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  "resolved_by" TEXT,
  "created_at" TEXT DEFAULT now()::text
);

ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read entitlements" ON entitlements FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write entitlements" ON entitlements FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update entitlements" ON entitlements FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated delete entitlements" ON entitlements FOR DELETE USING (auth.role() = 'authenticated');

ALTER TABLE remote_work_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read remote_work" ON remote_work_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write remote_work" ON remote_work_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update remote_work" ON remote_work_requests FOR UPDATE USING (auth.role() = 'authenticated');

ALTER PUBLICATION supabase_realtime ADD TABLE employees;
ALTER PUBLICATION supabase_realtime ADD TABLE remote_work_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE payroll;
ALTER PUBLICATION supabase_realtime ADD TABLE leaves;
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE entitlements;
