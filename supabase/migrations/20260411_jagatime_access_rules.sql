-- =============================================================================
-- JagaTime — Workforce access rules, leave entitlement model & GPS attendance
-- =============================================================================
-- RUN ORDER:  schema.sql  ->  rbac_setup.sql  ->  this file
--
-- Covers the three pillars:
--   1. Workforce directory  -> employees.role mirror (profile carries the role)
--   2. Leave tracker        -> entitled vs remaining view (default 14 / 14)
--   3. GPS clock-in         -> server-authoritative "Late" status (9:00 AM shift)
--   + Row-Level Security    -> staff see their own logs, Admin/Manager see all
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. ROLE ON THE EMPLOYEE PROFILE
-- -----------------------------------------------------------------------------
-- users.role remains the source of truth (it drives the JWT permissions in
-- rbac_setup.sql). employees.role is a denormalised mirror so that an employee
-- profile is self-contained as required by the spec.
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'Employee';

CREATE OR REPLACE FUNCTION public.sync_employee_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW."employeeId" IS NOT NULL THEN
    UPDATE public.employees SET role = NEW.role WHERE id = NEW."employeeId";
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_employee_role ON public.users;
CREATE TRIGGER trg_sync_employee_role
  AFTER INSERT OR UPDATE OF role, "employeeId"
  ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_employee_role();

-- Backfill for links that already exist.
UPDATE public.employees e
SET role = u.role
FROM public.users u
WHERE u."employeeId" = e.id;


-- -----------------------------------------------------------------------------
-- 2. ACCESS HELPERS
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER so they can read public.users without recursing into its RLS.
-- auth.uid() still resolves to the *calling* user's id inside a definer function.

CREATE OR REPLACE FUNCTION public.auth_employee_id()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT "employeeId" FROM public.users WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.users WHERE id = auth.uid(); $$;

-- Admin / Manager / HR Admin see the whole workforce.
CREATE OR REPLACE FUNCTION public.is_privileged()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE(public.auth_role() IN ('Admin', 'Manager', 'HR Admin'), FALSE); $$;


-- -----------------------------------------------------------------------------
-- 3. GPS ATTENDANCE — server-authoritative status (default 9:00 AM shift)
-- -----------------------------------------------------------------------------
-- The client already derives this, but the database is the authority so the
-- value cannot be spoofed by a modified client.
CREATE OR REPLACE FUNCTION public.set_attendance_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_shift_start TIME := '09:00';
BEGIN
  -- Only derive status for an actual punch; leave states such as
  -- 'On Leave' / 'Absent' exactly as supplied.
  IF NEW."checkIn" IS NOT NULL
     AND NEW."checkIn" ~ '^\d{1,2}:\d{2}'
     AND NEW.status NOT IN ('On Leave', 'Absent') THEN
    NEW.status := CASE
      WHEN NEW."checkIn"::time > v_shift_start THEN 'Late'
      ELSE 'Present'
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_attendance_status ON public.attendance;
CREATE TRIGGER trg_set_attendance_status
  BEFORE INSERT OR UPDATE OF "checkIn"
  ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.set_attendance_status();


-- -----------------------------------------------------------------------------
-- 4. ENTITLED vs REMAINING LEAVE
-- -----------------------------------------------------------------------------
-- entitlements stores the ENTITLED pool (the client seeds 14 annual / 14 medical
-- when an employee is created). Remaining is derived as entitled - approved days,
-- so approving a leave reduces "remaining" without a destructive decrement that
-- would double-count against the client's own calculation.
CREATE OR REPLACE VIEW public.leave_balances AS
SELECT
  e."employeeId",
  e.annual                                             AS entitled_annual,
  e.medical                                            AS entitled_medical,
  COALESCE(a.used_annual, 0)                           AS used_annual,
  COALESCE(a.used_medical, 0)                          AS used_medical,
  GREATEST(0, e.annual  - COALESCE(a.used_annual, 0))  AS remaining_annual,
  GREATEST(0, e.medical - COALESCE(a.used_medical, 0)) AS remaining_medical
FROM public.entitlements e
LEFT JOIN (
  SELECT
    "employeeId",
    SUM(CASE WHEN type = 'Annual'
             THEN ("endDate"::date - "startDate"::date) + 1 ELSE 0 END) AS used_annual,
    SUM(CASE WHEN type = 'Medical'
             THEN ("endDate"::date - "startDate"::date) + 1 ELSE 0 END) AS used_medical
  FROM public.leaves
  WHERE status = 'Approved'
  GROUP BY "employeeId"
) a ON a."employeeId" = e."employeeId";

-- Respect the caller's RLS instead of the view owner's.
ALTER VIEW public.leave_balances SET (security_invoker = true);
GRANT SELECT ON public.leave_balances TO authenticated;
REVOKE ALL ON public.leave_balances FROM anon;


-- -----------------------------------------------------------------------------
-- 5. ROW-LEVEL SECURITY
-- -----------------------------------------------------------------------------
-- Staff read/write only their own rows. Admin/Manager/HR Admin read everyone's.
-- The old permissive "Authenticated ..." policies are dropped first — Postgres
-- ORs permissive policies together, so leaving them would defeat the scoping.
-- NOTE: employees / payroll policies are intentionally left untouched here so
-- that onboarding (self-linking userId) and payroll flows keep working.
-- -----------------------------------------------------------------------------

-- attendance ----------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated read attendance"   ON public.attendance;
DROP POLICY IF EXISTS "Authenticated write attendance"  ON public.attendance;
DROP POLICY IF EXISTS "Authenticated update attendance" ON public.attendance;

CREATE POLICY "attendance_select_own_or_privileged" ON public.attendance
  FOR SELECT USING ("employeeId" = public.auth_employee_id() OR public.is_privileged());

CREATE POLICY "attendance_insert_own" ON public.attendance
  FOR INSERT WITH CHECK ("employeeId" = public.auth_employee_id());

CREATE POLICY "attendance_update_own_or_privileged" ON public.attendance
  FOR UPDATE
  USING ("employeeId" = public.auth_employee_id() OR public.is_privileged())
  WITH CHECK ("employeeId" = public.auth_employee_id() OR public.is_privileged());

-- leaves --------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated read leaves"   ON public.leaves;
DROP POLICY IF EXISTS "Authenticated write leaves"  ON public.leaves;
DROP POLICY IF EXISTS "Authenticated update leaves" ON public.leaves;

CREATE POLICY "leaves_select_own_or_privileged" ON public.leaves
  FOR SELECT USING ("employeeId" = public.auth_employee_id() OR public.is_privileged());

CREATE POLICY "leaves_insert_own" ON public.leaves
  FOR INSERT WITH CHECK ("employeeId" = public.auth_employee_id());

-- Approvals are privileged-only. A staff member may still amend their own
-- request while it is Pending: the WITH CHECK rejects any other status, so a
-- user cannot approve their own leave.
CREATE POLICY "leaves_update_privileged_or_pending_own" ON public.leaves
  FOR UPDATE
  USING (public.is_privileged() OR "employeeId" = public.auth_employee_id())
  WITH CHECK (
    public.is_privileged()
    OR ("employeeId" = public.auth_employee_id() AND status = 'Pending')
  );

-- entitlements --------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated read entitlements"   ON public.entitlements;
DROP POLICY IF EXISTS "Authenticated write entitlements"  ON public.entitlements;
DROP POLICY IF EXISTS "Authenticated update entitlements" ON public.entitlements;
DROP POLICY IF EXISTS "Authenticated delete entitlements" ON public.entitlements;

CREATE POLICY "entitlements_select_own_or_privileged" ON public.entitlements
  FOR SELECT USING ("employeeId" = public.auth_employee_id() OR public.is_privileged());

CREATE POLICY "entitlements_insert_privileged" ON public.entitlements
  FOR INSERT WITH CHECK (public.is_privileged());

CREATE POLICY "entitlements_update_privileged" ON public.entitlements
  FOR UPDATE USING (public.is_privileged()) WITH CHECK (public.is_privileged());

CREATE POLICY "entitlements_delete_privileged" ON public.entitlements
  FOR DELETE USING (public.is_privileged());

-- remote_work_requests ------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated read remote_work"     ON public.remote_work_requests;
DROP POLICY IF EXISTS "Authenticated write remote_work"    ON public.remote_work_requests;
DROP POLICY IF EXISTS "Authenticated update remote_work"   ON public.remote_work_requests;
DROP POLICY IF EXISTS "Users can read their own requests"  ON public.remote_work_requests;
DROP POLICY IF EXISTS "Users can manage their own requests" ON public.remote_work_requests;

CREATE POLICY "remote_work_select_own_or_privileged" ON public.remote_work_requests
  FOR SELECT USING (employee_id = public.auth_employee_id() OR public.is_privileged());

-- Staff request for themselves; Admin/Manager may also assign on an employee's
-- behalf (the "Assign authorization" flow).
CREATE POLICY "remote_work_insert_own_or_privileged" ON public.remote_work_requests
  FOR INSERT WITH CHECK (employee_id = public.auth_employee_id() OR public.is_privileged());

CREATE POLICY "remote_work_update_privileged" ON public.remote_work_requests
  FOR UPDATE USING (public.is_privileged()) WITH CHECK (public.is_privileged());
