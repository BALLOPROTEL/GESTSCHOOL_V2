BEGIN;

-- LOT 1C migrates only tenant_id columns. Historical audit/outbox payloads and
-- file URLs are intentionally immutable and remain outside this migration.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

SELECT pg_advisory_xact_lock(
  hashtextextended('gestschool:canonical-default-tenant-id', 0)
);

CREATE TEMP TABLE lot1c_expected_tenant_tables (
  table_name text PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO lot1c_expected_tenant_tables (table_name)
VALUES
  ('academic_periods'),
  ('attendance'),
  ('attendance_attachments'),
  ('classes'),
  ('cycles'),
  ('enrollments'),
  ('fee_plans'),
  ('grades'),
  ('iam_audit_logs'),
  ('invoices'),
  ('levels'),
  ('mosque_activities'),
  ('mosque_donations'),
  ('mosque_members'),
  ('notification_delivery_attempts'),
  ('notification_provider_callbacks'),
  ('notifications'),
  ('outbox_events'),
  ('parent_student_links'),
  ('parents'),
  ('payment_provider_attempts'),
  ('payments'),
  ('pedagogical_rules'),
  ('refresh_tokens'),
  ('report_cards'),
  ('role_permissions'),
  ('room_assignments'),
  ('room_availabilities'),
  ('room_types'),
  ('rooms'),
  ('school_years'),
  ('student_track_placements'),
  ('students'),
  ('subject_level_scopes'),
  ('subjects'),
  ('teacher_assignments'),
  ('teacher_documents'),
  ('teacher_skills'),
  ('teachers'),
  ('timetable_slots'),
  ('user_security_tokens'),
  ('users');

DO $lot1c$
DECLARE
  legacy_tenant constant uuid := '00000000-0000-0000-0000-000000000001';
  canonical_tenant constant uuid := '00000000-0000-4000-8000-000000000001';
  expected_table_count constant integer := 42;
  actual_table_count integer;
  invalid_type_count integer;
  missing_tables text[];
  unexpected_tables text[];
  invalid_constraints text[];
  table_record record;
  relation_record record;
  table_null_count bigint;
  table_legacy_count bigint;
  table_canonical_count bigint;
  table_unexpected_count bigint;
  null_count bigint := 0;
  legacy_count bigint := 0;
  canonical_count bigint := 0;
  unexpected_count bigint := 0;
  expected_migrated_count bigint;
  migrated_count bigint := 0;
  affected_count bigint;
  relation_mismatch_count bigint;
BEGIN
  SELECT count(*)
  INTO actual_table_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'tenant_id';

  SELECT array_agg(expected.table_name ORDER BY expected.table_name)
  INTO missing_tables
  FROM lot1c_expected_tenant_tables expected
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns actual
    WHERE actual.table_schema = 'public'
      AND actual.table_name = expected.table_name
      AND actual.column_name = 'tenant_id'
  );

  SELECT array_agg(actual.table_name ORDER BY actual.table_name)
  INTO unexpected_tables
  FROM information_schema.columns actual
  WHERE actual.table_schema = 'public'
    AND actual.column_name = 'tenant_id'
    AND NOT EXISTS (
      SELECT 1
      FROM lot1c_expected_tenant_tables expected
      WHERE expected.table_name = actual.table_name
    );

  IF actual_table_count <> expected_table_count
    OR missing_tables IS NOT NULL
    OR unexpected_tables IS NOT NULL
  THEN
    RAISE EXCEPTION
      'LOT1C_TENANT_TABLE_INVENTORY_MISMATCH expected=% actual=% missing=% unexpected=%',
      expected_table_count,
      actual_table_count,
      coalesce(missing_tables, ARRAY[]::text[]),
      coalesce(unexpected_tables, ARRAY[]::text[]);
  END IF;

  SELECT count(*)
  INTO invalid_type_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'tenant_id'
    AND data_type <> 'uuid';

  IF invalid_type_count > 0 THEN
    RAISE EXCEPTION 'LOT1C_TENANT_COLUMN_TYPE_MISMATCH count=%', invalid_type_count;
  END IF;

  SELECT array_agg(conname ORDER BY conname)
  INTO invalid_constraints
  FROM pg_constraint
  WHERE connamespace = 'public'::regnamespace
    AND NOT convalidated;

  IF invalid_constraints IS NOT NULL THEN
    RAISE EXCEPTION
      'LOT1C_UNVALIDATED_CONSTRAINTS constraints=%',
      invalid_constraints;
  END IF;

  -- No current FK includes tenant_id. Abort if the schema changes because a
  -- composite tenant FK would require a separately reviewed update order.
  IF EXISTS (
    SELECT 1
    FROM pg_constraint constraint_row
    JOIN pg_attribute child_attribute
      ON child_attribute.attrelid = constraint_row.conrelid
     AND child_attribute.attnum = ANY (constraint_row.conkey)
    WHERE constraint_row.contype = 'f'
      AND constraint_row.connamespace = 'public'::regnamespace
      AND child_attribute.attname = 'tenant_id'
  ) THEN
    RAISE EXCEPTION 'LOT1C_TENANT_ID_FOREIGN_KEY_REQUIRES_REVIEW';
  END IF;

  FOR table_record IN
    SELECT table_name
    FROM lot1c_expected_tenant_tables
    ORDER BY table_name
  LOOP
    EXECUTE format(
      'SELECT
         count(*) FILTER (WHERE tenant_id IS NULL),
         count(*) FILTER (WHERE tenant_id = $1),
         count(*) FILTER (WHERE tenant_id = $2),
         count(*) FILTER (
           WHERE tenant_id IS NOT NULL
             AND tenant_id <> $1
             AND tenant_id <> $2
         )
       FROM public.%I',
      table_record.table_name
    )
    INTO
      table_null_count,
      table_legacy_count,
      table_canonical_count,
      table_unexpected_count
    USING legacy_tenant, canonical_tenant;

    null_count := null_count + table_null_count;
    legacy_count := legacy_count + table_legacy_count;
    canonical_count := canonical_count + table_canonical_count;
    unexpected_count := unexpected_count + table_unexpected_count;
  END LOOP;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'LOT1C_NULL_TENANT_IDS count=%', null_count;
  END IF;

  IF unexpected_count > 0 THEN
    RAISE EXCEPTION 'LOT1C_UNEXPECTED_TENANT_IDS count=%', unexpected_count;
  END IF;

  IF legacy_count > 0 AND canonical_count > 0 THEN
    RAISE EXCEPTION
      'LOT1C_CANONICAL_TENANT_COLLISION legacy=% canonical=%',
      legacy_count,
      canonical_count;
  END IF;

  -- Check every FK whose child and parent both carry tenant_id. The FK itself
  -- identifies the related rows; tenant equality is an additional invariant.
  FOR relation_record IN
    SELECT
      constraint_row.conname,
      format('%I.%I', child_namespace.nspname, child_class.relname) AS child_table,
      format('%I.%I', parent_namespace.nspname, parent_class.relname) AS parent_table,
      (
        SELECT string_agg(
          format(
            'child.%I IS NOT DISTINCT FROM parent.%I',
            child_column.attname,
            parent_column.attname
          ),
          ' AND '
          ORDER BY key_pair.position
        )
        FROM unnest(constraint_row.conkey, constraint_row.confkey)
          WITH ORDINALITY AS key_pair(child_attnum, parent_attnum, position)
        JOIN pg_attribute child_column
          ON child_column.attrelid = constraint_row.conrelid
         AND child_column.attnum = key_pair.child_attnum
        JOIN pg_attribute parent_column
          ON parent_column.attrelid = constraint_row.confrelid
         AND parent_column.attnum = key_pair.parent_attnum
      ) AS join_condition
    FROM pg_constraint constraint_row
    JOIN pg_class child_class
      ON child_class.oid = constraint_row.conrelid
    JOIN pg_namespace child_namespace
      ON child_namespace.oid = child_class.relnamespace
    JOIN pg_class parent_class
      ON parent_class.oid = constraint_row.confrelid
    JOIN pg_namespace parent_namespace
      ON parent_namespace.oid = parent_class.relnamespace
    WHERE constraint_row.contype = 'f'
      AND child_namespace.nspname = 'public'
      AND parent_namespace.nspname = 'public'
      AND EXISTS (
        SELECT 1
        FROM pg_attribute child_tenant
        WHERE child_tenant.attrelid = constraint_row.conrelid
          AND child_tenant.attname = 'tenant_id'
          AND NOT child_tenant.attisdropped
      )
      AND EXISTS (
        SELECT 1
        FROM pg_attribute parent_tenant
        WHERE parent_tenant.attrelid = constraint_row.confrelid
          AND parent_tenant.attname = 'tenant_id'
          AND NOT parent_tenant.attisdropped
      )
    ORDER BY constraint_row.conname
  LOOP
    EXECUTE format(
      'SELECT count(*)
       FROM %s child
       JOIN %s parent ON %s
       WHERE child.tenant_id IS DISTINCT FROM parent.tenant_id',
      relation_record.child_table,
      relation_record.parent_table,
      relation_record.join_condition
    )
    INTO relation_mismatch_count;

    IF relation_mismatch_count > 0 THEN
      RAISE EXCEPTION
        'LOT1C_CROSS_TENANT_RELATION constraint=% count=%',
        relation_record.conname,
        relation_mismatch_count;
    END IF;
  END LOOP;

  IF legacy_count = 0 THEN
    IF canonical_count = 0 THEN
      RAISE NOTICE 'LOT1C_EMPTY_DATABASE_NO_TENANT_ROWS';
    ELSE
      RAISE NOTICE 'LOT1C_ALREADY_MIGRATED canonical_rows=%', canonical_count;
    END IF;
    RETURN;
  END IF;

  expected_migrated_count := legacy_count;

  FOR table_record IN
    SELECT table_name
    FROM lot1c_expected_tenant_tables
    ORDER BY table_name
  LOOP
    EXECUTE format(
      'UPDATE public.%I
       SET tenant_id = $1
       WHERE tenant_id = $2',
      table_record.table_name
    )
    USING canonical_tenant, legacy_tenant;

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    migrated_count := migrated_count + affected_count;
  END LOOP;

  IF migrated_count <> expected_migrated_count THEN
    RAISE EXCEPTION
      'LOT1C_MIGRATED_ROW_COUNT_MISMATCH expected=% actual=%',
      expected_migrated_count,
      migrated_count;
  END IF;

  null_count := 0;
  legacy_count := 0;
  canonical_count := 0;
  unexpected_count := 0;

  FOR table_record IN
    SELECT table_name
    FROM lot1c_expected_tenant_tables
    ORDER BY table_name
  LOOP
    EXECUTE format(
      'SELECT
         count(*) FILTER (WHERE tenant_id IS NULL),
         count(*) FILTER (WHERE tenant_id = $1),
         count(*) FILTER (WHERE tenant_id = $2),
         count(*) FILTER (
           WHERE tenant_id IS NOT NULL
             AND tenant_id <> $1
             AND tenant_id <> $2
         )
       FROM public.%I',
      table_record.table_name
    )
    INTO
      table_null_count,
      table_legacy_count,
      table_canonical_count,
      table_unexpected_count
    USING legacy_tenant, canonical_tenant;

    null_count := null_count + table_null_count;
    legacy_count := legacy_count + table_legacy_count;
    canonical_count := canonical_count + table_canonical_count;
    unexpected_count := unexpected_count + table_unexpected_count;
  END LOOP;

  IF null_count <> 0
    OR legacy_count <> 0
    OR unexpected_count <> 0
    OR canonical_count <> expected_migrated_count
  THEN
    RAISE EXCEPTION
      'LOT1C_POSTCHECK_FAILED null=% legacy=% canonical=% unexpected=% expected=%',
      null_count,
      legacy_count,
      canonical_count,
      unexpected_count,
      expected_migrated_count;
  END IF;

  FOR relation_record IN
    SELECT
      constraint_row.conname,
      format('%I.%I', child_namespace.nspname, child_class.relname) AS child_table,
      format('%I.%I', parent_namespace.nspname, parent_class.relname) AS parent_table,
      (
        SELECT string_agg(
          format(
            'child.%I IS NOT DISTINCT FROM parent.%I',
            child_column.attname,
            parent_column.attname
          ),
          ' AND '
          ORDER BY key_pair.position
        )
        FROM unnest(constraint_row.conkey, constraint_row.confkey)
          WITH ORDINALITY AS key_pair(child_attnum, parent_attnum, position)
        JOIN pg_attribute child_column
          ON child_column.attrelid = constraint_row.conrelid
         AND child_column.attnum = key_pair.child_attnum
        JOIN pg_attribute parent_column
          ON parent_column.attrelid = constraint_row.confrelid
         AND parent_column.attnum = key_pair.parent_attnum
      ) AS join_condition
    FROM pg_constraint constraint_row
    JOIN pg_class child_class
      ON child_class.oid = constraint_row.conrelid
    JOIN pg_namespace child_namespace
      ON child_namespace.oid = child_class.relnamespace
    JOIN pg_class parent_class
      ON parent_class.oid = constraint_row.confrelid
    JOIN pg_namespace parent_namespace
      ON parent_namespace.oid = parent_class.relnamespace
    WHERE constraint_row.contype = 'f'
      AND child_namespace.nspname = 'public'
      AND parent_namespace.nspname = 'public'
      AND EXISTS (
        SELECT 1
        FROM pg_attribute child_tenant
        WHERE child_tenant.attrelid = constraint_row.conrelid
          AND child_tenant.attname = 'tenant_id'
          AND NOT child_tenant.attisdropped
      )
      AND EXISTS (
        SELECT 1
        FROM pg_attribute parent_tenant
        WHERE parent_tenant.attrelid = constraint_row.confrelid
          AND parent_tenant.attname = 'tenant_id'
          AND NOT parent_tenant.attisdropped
      )
    ORDER BY constraint_row.conname
  LOOP
    EXECUTE format(
      'SELECT count(*)
       FROM %s child
       JOIN %s parent ON %s
       WHERE child.tenant_id IS DISTINCT FROM parent.tenant_id',
      relation_record.child_table,
      relation_record.parent_table,
      relation_record.join_condition
    )
    INTO relation_mismatch_count;

    IF relation_mismatch_count > 0 THEN
      RAISE EXCEPTION
        'LOT1C_POSTCHECK_CROSS_TENANT_RELATION constraint=% count=%',
        relation_record.conname,
        relation_mismatch_count;
    END IF;
  END LOOP;

  RAISE NOTICE
    'LOT1C_CANONICAL_TENANT_MIGRATED rows=% tables=%',
    migrated_count,
    expected_table_count;
END
$lot1c$;

COMMIT;
