-- =============================================================================
-- MajuHR RBAC Setup: Custom JWT Claims via app_metadata
-- =============================================================================
-- PURPOSE:
--   This script sets up the backend for Role-Based Access Control (RBAC).
--   It creates a Postgres function and trigger that automatically inject a
--   user's 'permissions' array into their Supabase JWT (via app_metadata)
--   whenever their profile in the 'users' table is created or updated.
--
-- HOW TO RUN:
--   1. Open your Supabase project dashboard.
--   2. Go to "SQL Editor" and create a "New Query".
--   3. Paste this entire file into the editor and click "Run".
-- =============================================================================

-- Step 1: Define a function that maps a role name to its granted permissions.
-- This is the Deny-by-Default source of truth on the database side.
-- Only permissions explicitly listed here will ever be granted.
CREATE OR REPLACE FUNCTION public.get_permissions_for_role(p_role TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  CASE p_role
    WHEN 'Admin', 'HR Admin' THEN
      RETURN ARRAY['View_Salary', 'Edit_Tax_Info', 'Manage_Users', 'Approve_Leave']::TEXT[];
    WHEN 'Manager' THEN
      RETURN ARRAY['View_Salary', 'Approve_Leave']::TEXT[];
    WHEN 'Finance' THEN
      RETURN ARRAY['View_Salary', 'Edit_Tax_Info']::TEXT[];
    WHEN 'Employee' THEN
      RETURN ARRAY[]::TEXT[];
    ELSE
      -- Deny-by-Default: Unknown roles get NO permissions
      RETURN ARRAY[]::TEXT[];
  END CASE;
END;
$$;


-- Step 2: Create a function that syncs the user's JWT app_metadata.
-- This runs as a trigger, reading the role from the 'users' table and
-- writing the corresponding permissions into auth.users.raw_app_meta_data.
-- The permissions will then appear inside the user's JWT claims on next login/refresh.
CREATE OR REPLACE FUNCTION public.sync_rbac_claims_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permissions TEXT[];
BEGIN
  -- Get the permissions array for the user's role
  v_permissions := public.get_permissions_for_role(NEW.role);

  -- Inject permissions AND role into the JWT app_metadata
  -- app_metadata is trusted (cannot be altered by the user themselves)
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
    'role',        NEW.role,
    'permissions', to_jsonb(v_permissions)
  )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;


-- Step 3: Attach the trigger to the 'users' table.
-- It fires after any INSERT or UPDATE of the 'role' column,
-- ensuring claims are always kept in sync with the database.
DROP TRIGGER IF EXISTS on_user_role_change_sync_jwt ON public.users;
CREATE TRIGGER on_user_role_change_sync_jwt
  AFTER INSERT OR UPDATE OF role
  ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_rbac_claims_to_jwt();


-- =============================================================================
-- IMPORTANT POST-SETUP STEPS:
-- =============================================================================
-- Migration: Convert legacy role names to the new standard.
UPDATE public.users SET role = 'Admin' WHERE role = 'HR Admin';

-- After running this SQL, you must backfill existing users so they get their
-- JWT claims populated. Run this UPDATE to trigger the trigger for all users:

UPDATE public.users SET role = role;

-- This is a no-op UPDATE but it fires the trigger for every existing row,
-- populating app_metadata.permissions for all current users.
-- =============================================================================
