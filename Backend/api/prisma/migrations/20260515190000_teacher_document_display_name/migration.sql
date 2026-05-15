ALTER TABLE teacher_documents
  ADD COLUMN IF NOT EXISTS document_name VARCHAR(180);

UPDATE teacher_documents
SET document_name = original_name
WHERE document_name IS NULL;
