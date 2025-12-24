-- Nexus Integrity Check (Audit Phase 3)

SELECT '---------------------------------------------------' as log;
SELECT 'NEXUS INTEGRITY REPORT' as log;
SELECT '---------------------------------------------------' as log;

-- 1. Check System Events Partitioning
SELECT 
    relname AS table_name,
    CASE relkind
        WHEN 'p' THEN 'PASS: Partitioned'
        WHEN 'r' THEN 'FAIL: Regular Table'
        ELSE 'FAIL: Unknown Type ' || relkind
    END AS partitioning_status
FROM pg_class
WHERE relname IN ('system_events', 'customers');

-- 2. Verify Partitions Count
SELECT 
    parent.relname AS parent_table,
    COUNT(child.oid) AS partition_count
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname IN ('system_events', 'customers')
GROUP BY parent.relname;

-- 3. Check for Detached or Invalid Partitions (Ghosts)
SELECT 
    relname AS potential_ghost_table
FROM pg_class
WHERE relname LIKE 'system_events_%'
  AND relispartition = false 
  AND relname != 'system_events_legacy_v3' -- Exclude backup
  AND relname NOT LIKE 'system_events_20%'; -- Exclude valid logic if naming is strict, but relispartition check is better.
  
-- Note: 'relispartition' must be true for actual partitions.

SELECT '---------------------------------------------------' as log;
SELECT 'END OF REPORT' as log;
