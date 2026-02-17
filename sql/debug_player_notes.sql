-- Debug Script for Player Notes System
-- Run this to diagnose RLS policy issues

-- 1. Check if new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'notes' 
AND column_name IN ('created_by', 'character_name');

-- 2. Check current RLS policies on notes table
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'notes'
ORDER BY policyname;

-- 3. Check sample notes data
SELECT 
    id,
    title,
    type,
    is_public,
    created_by,
    character_name
FROM notes
LIMIT 10;

-- 4. Test query: What notes can current user see?
-- (This shows what the RLS policy is allowing)
SELECT 
    id,
    title,
    is_public,
    created_by,
    CASE 
        WHEN created_by = auth.uid() THEN 'MY NOTE'
        WHEN created_by IS NULL THEN 'GM LORE'
        ELSE 'OTHER PLAYER'
    END as note_type,
    CASE
        WHEN created_by = auth.uid() THEN '✅ Owner'
        WHEN is_public = true THEN '✅ Public'
        WHEN created_by IS NULL AND is_public = true THEN '✅ Public GM Lore'
        WHEN created_by IS NULL AND is_public = false THEN '❓ Private GM Lore (need unlock)'
        ELSE '❌ Should not see this'
    END as access_reason
FROM notes
ORDER BY created_by NULLS FIRST, is_public DESC;
