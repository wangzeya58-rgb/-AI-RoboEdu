-- Older class publication inserted links without updating draft status.
-- Correct the label without changing a single class association or making anything public.
UPDATE "courses" c SET "status" = 'published'
WHERE c.publication_scope = 'legacy' AND c.status = 'draft'
  AND EXISTS (SELECT 1 FROM "class_courses" cc WHERE cc.course_id = c.id);
