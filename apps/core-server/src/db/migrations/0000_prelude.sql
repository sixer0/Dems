-- Custom SQL migration file, put your code below! --
-- 0000_prelude (hand-written; database contract 8.2 order 1, text of 8.3).
--
-- The function that CHECK constraints of 0001_tables call (rule FLAT of contract 2.4): true
-- when the document is a JSON object whose values are strings, numbers, booleans or null.
-- It must exist before the tables, so this file comes first. Applied as the owner role.
CREATE FUNCTION public.dems_jsonb_is_flat(doc jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN jsonb_typeof(doc) <> 'object' THEN false
    ELSE NOT EXISTS (
      SELECT 1
        FROM jsonb_each(doc) AS e
       WHERE jsonb_typeof(e.value) IN ('object', 'array')
    )
  END
$$;
