-- Create company_settings table
CREATE TABLE IF NOT EXISTS company_settings (
    id UUID PRIMARY KEY DEFAULT crypto.randomUUID(),
    office_lat NUMERIC NOT NULL,
    office_lng NUMERIC NOT NULL,
    office_radius_meters INTEGER NOT NULL DEFAULT 200,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default office location (KLCC, Kuala Lumpur)
INSERT INTO company_settings (office_lat, office_lng, office_radius_meters)
VALUES (3.1578, 101.7119, 200)
ON CONFLICT DO NOTHING;

-- Create remote_work_requests table
CREATE TABLE IF NOT EXISTS remote_work_requests (
    id UUID PRIMARY KEY DEFAULT crypto.randomUUID(),
    employee_id TEXT NOT NULL REFERENCES employees(id),
    date DATE NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    resolved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(employee_id, date)
);

-- RLS Policies
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE remote_work_requests ENABLE ROW LEVEL SECURITY;

-- company_settings: Anyone authenticated can read, only Admins can update
CREATE POLICY "Authenticated users can read settings" ON company_settings
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can update settings" ON company_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND (raw_app_meta_data->>'role')::text IN ('Admin', 'HR Admin')
        )
    );

-- remote_work_requests: Employees can read/write their own, Admins can read/write all
CREATE POLICY "Users can read their own requests" ON remote_work_requests
    FOR SELECT USING (
        auth.uid()::text = (SELECT employee_id FROM remote_work_requests WHERE id = remote_work_requests.id) 
        OR (raw_app_meta_data->>'role')::text IN ('Admin', 'HR Admin')
    );
-- Actually simpler to check employeeId against the user's employeeId
-- However, we don't have a direct link from auth.uid() to employeeId in this table easily without a join
-- Let's use the fact that raw_user_meta_data might have employeeId (as seen in previous conversations)

CREATE POLICY "Users can manage their own requests" ON remote_work_requests
    FOR ALL USING (
        (auth.jwt() -> 'user_metadata' ->> 'employeeId') = employee_id
        OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('Admin', 'HR Admin')
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_settings_updated_at
    BEFORE UPDATE ON company_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
