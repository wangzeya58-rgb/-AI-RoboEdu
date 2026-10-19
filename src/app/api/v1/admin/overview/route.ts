import { count, eq } from "drizzle-orm";
import { requireRole, requireSession } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { withApi } from "@/lib/api/handler";
import { isFormalUserId } from "@/lib/classes/server-class-service";
import { getDatabase } from "@/storage/database/db";
import { classes, courses, users } from "@/storage/database/shared/schema";

export const runtime = "nodejs";

export const GET = withApi(async (request) => {
  const user = requireSession(request);
  requireRole(user, "admin");
  if (!isFormalUserId(user.id)) throw ApiError.forbidden("Demo 身份不能访问正式统计");
  const db = getDatabase();
  const [userCount, classCount, courseCount, classItems] = await Promise.all([
    db.select({ value: count() }).from(users),
    db.select({ value: count() }).from(classes),
    db.select({ value: count() }).from(courses),
    db.select({ id: classes.id, name: classes.name, teacherName: users.name })
      .from(classes).innerJoin(users, eq(classes.teacherId, users.id)),
  ]);
  return {
    users: userCount[0].value, classes: classCount[0].value,
    courses: courseCount[0].value, resources: null,
    classItems,
  };
}, { methods: ["GET"] });
