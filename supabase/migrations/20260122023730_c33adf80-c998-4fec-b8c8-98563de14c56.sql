-- ============================================================
-- Stage 3.5: RLS Policy Hardening - Add WITH CHECK clauses
-- ============================================================

-- Drop existing UPDATE policies to recreate with WITH CHECK
DROP POLICY IF EXISTS "Users can update symbols in their scans" ON public.scan_symbols;
DROP POLICY IF EXISTS "Users can update their deep analyses" ON public.deep_analyses;

-- Recreate scan_symbols UPDATE policy with WITH CHECK
CREATE POLICY "Users can update symbols in their scans"
ON public.scan_symbols
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM scans
    WHERE scans.id = scan_symbols.scan_id
    AND scans.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM scans
    WHERE scans.id = scan_symbols.scan_id
    AND scans.user_id = auth.uid()
  )
);

-- Recreate deep_analyses UPDATE policy with WITH CHECK
CREATE POLICY "Users can update their deep analyses"
ON public.deep_analyses
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM scans
    WHERE scans.id = deep_analyses.scan_id
    AND scans.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM scans
    WHERE scans.id = deep_analyses.scan_id
    AND scans.user_id = auth.uid()
  )
);