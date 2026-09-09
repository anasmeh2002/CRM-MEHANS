/*
# Add organization currency and close automation tenant isolation gaps

1. New Columns
- `agencies.currency` stores the organization-wide display currency.
- `automations.agency_id` stores the owning organization for each automation.
- Currency supports MAD, EUR, USD, AED, and GBP; current organizations default to MAD.

2. Modified Tables
- `agencies`: adds the persisted organization currency setting.
- `automations`: adds an organization relationship and tenant-scoped policies.
- `automation_executions`: policies scope execution rows through their parent automation.

3. Security
- Existing agency-scoped RLS remains in place.
- Automation rows are no longer shared between authenticated agencies.
- Anonymous access is not granted.

4. Data Safety
- This migration only adds columns, a validation constraint, a foreign key, and replaces policies.
- No tables, columns, or user data are deleted or renamed.
*/

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'MAD';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agencies_currency_check'
      AND conrelid = 'public.agencies'::regclass
  ) THEN
    ALTER TABLE public.agencies
      ADD CONSTRAINT agencies_currency_check CHECK (currency IN ('MAD', 'EUR', 'USD', 'AED', 'GBP'));
  END IF;
END $$;

ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE;

ALTER TABLE public.automations
  ALTER COLUMN agency_id SET DEFAULT public.current_agency_id();

UPDATE public.automations
SET agency_id = public.current_agency_id()
WHERE agency_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_automations_agency_id ON public.automations(agency_id);

DROP POLICY IF EXISTS "select_automations" ON public.automations;
DROP POLICY IF EXISTS "insert_automations" ON public.automations;
DROP POLICY IF EXISTS "update_automations" ON public.automations;
DROP POLICY IF EXISTS "delete_automations" ON public.automations;
CREATE POLICY "select_automations" ON public.automations FOR SELECT TO authenticated
  USING (agency_id = public.current_agency_id());
CREATE POLICY "insert_automations" ON public.automations FOR INSERT TO authenticated
  WITH CHECK (agency_id = public.current_agency_id());
CREATE POLICY "update_automations" ON public.automations FOR UPDATE TO authenticated
  USING (agency_id = public.current_agency_id())
  WITH CHECK (agency_id = public.current_agency_id());
CREATE POLICY "delete_automations" ON public.automations FOR DELETE TO authenticated
  USING (agency_id = public.current_agency_id());

DROP POLICY IF EXISTS "select_executions" ON public.automation_executions;
DROP POLICY IF EXISTS "insert_executions" ON public.automation_executions;
DROP POLICY IF EXISTS "update_executions" ON public.automation_executions;
DROP POLICY IF EXISTS "delete_executions" ON public.automation_executions;
CREATE POLICY "select_executions" ON public.automation_executions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.automations a
    WHERE a.id = automation_executions.automation_id
      AND a.agency_id = public.current_agency_id()
  ));
CREATE POLICY "insert_executions" ON public.automation_executions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.automations a
    WHERE a.id = automation_executions.automation_id
      AND a.agency_id = public.current_agency_id()
  ));
CREATE POLICY "update_executions" ON public.automation_executions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.automations a
    WHERE a.id = automation_executions.automation_id
      AND a.agency_id = public.current_agency_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.automations a
    WHERE a.id = automation_executions.automation_id
      AND a.agency_id = public.current_agency_id()
  ));
CREATE POLICY "delete_executions" ON public.automation_executions FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.automations a
    WHERE a.id = automation_executions.automation_id
      AND a.agency_id = public.current_agency_id()
  ));