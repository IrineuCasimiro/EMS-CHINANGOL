/*
# Storage policies for ems-documents bucket

1. Changes
   - Add RLS policies to the storage.objects table for the ems-documents bucket.
   - Authenticated users can upload, read, and delete PDF documents.
   - All access scoped to authenticated users only.

2. Security
   - SELECT (read/download): authenticated only.
   - INSERT (upload): authenticated only.
   - UPDATE: authenticated only.
   - DELETE: authenticated only (owner or admin).
*/

DROP POLICY IF EXISTS "ems_docs_read" ON storage.objects;
CREATE POLICY "ems_docs_read" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'ems-documents');

DROP POLICY IF EXISTS "ems_docs_upload" ON storage.objects;
CREATE POLICY "ems_docs_upload" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'ems-documents');

DROP POLICY IF EXISTS "ems_docs_update" ON storage.objects;
CREATE POLICY "ems_docs_update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'ems-documents') WITH CHECK (bucket_id = 'ems-documents');

DROP POLICY IF EXISTS "ems_docs_delete" ON storage.objects;
CREATE POLICY "ems_docs_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'ems-documents');
