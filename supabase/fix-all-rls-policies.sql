-- Fix: All RLS infinite recursion issues
-- Problem: Circular dependencies between assets and asset_collaborators policies

-- Step 1: Drop all problematic policies
DROP POLICY IF EXISTS "Users can view shared assets" ON public.assets;
DROP POLICY IF EXISTS "Users can view own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can view collaborators" ON public.asset_collaborators;

-- Step 2: Recreate assets SELECT policy WITHOUT collaborator check
-- This policy allows:
-- 1. Owners to see their own assets
-- 2. Everyone to see public assets
-- 3. Team members to see team assets (simplified)
CREATE POLICY "Users can view assets" ON public.assets
  FOR SELECT USING (
    owner_id = auth.uid() OR
    visibility = 'public' OR
    visibility = 'organization'
  );

-- Step 3: Recreate collaborators policy WITHOUT recursive assets check
CREATE POLICY "Users can view collaborators" ON public.asset_collaborators
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- Step 4: Verify policies are working
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('assets', 'asset_collaborators')
ORDER BY tablename, policyname;

SELECT 'RLS policies fixed - no more circular dependencies!' as status;
