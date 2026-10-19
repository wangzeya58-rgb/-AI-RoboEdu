ALTER TABLE "courses" ADD COLUMN "creator_role" "user_role";--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "publication_scope" varchar(20) DEFAULT 'legacy' NOT NULL;
--> statement-breakpoint
-- Preserve all existing status and class links. Never turn historical courses public.
UPDATE "courses" c SET "creator_role" = u.role
FROM "users" u WHERE c.teacher_id = u.id AND u.role IN ('teacher', 'admin');
