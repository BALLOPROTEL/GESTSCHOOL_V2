DO $$
BEGIN
  IF to_regclass('public.teacher_class_assignments') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM teacher_class_assignments LIMIT 1) THEN
      RAISE EXCEPTION
        'teacher_class_assignments still contains rows. Run the legacy audit and migrate records to teacher_assignments before applying this cutover.';
    END IF;

    DROP TABLE teacher_class_assignments;
  END IF;
END $$;
