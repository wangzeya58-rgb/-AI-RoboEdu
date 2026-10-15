ALTER TABLE "class_members" ADD COLUMN "joined_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "teacher_id" uuid;--> statement-breakpoint
UPDATE "classes" SET "teacher_id" = "created_by" WHERE "teacher_id" IS NULL;--> statement-breakpoint
ALTER TABLE "classes" ALTER COLUMN "teacher_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "classes_teacher_id_idx" ON "classes" USING btree ("teacher_id" uuid_ops);
