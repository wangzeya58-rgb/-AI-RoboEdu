import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { uuid } from "@/lib/api/validation";
import { assertMaterialManager, listCourseMaterials, saveCourseMaterial } from "@/lib/courses/server-material-service";
import { readMaterialUpload } from "@/lib/courses/material-http";

export const runtime = "nodejs";

export const GET = withApi(async (request, context) => {
  const user = requireSession(request);
  return { items: await listCourseMaterials(user, uuid((await context.params).id, "params.id")) };
}, { methods: ["GET"] });

export const POST = withApi(async (request, context) => {
  const user = requireSession(request);
  const courseId = uuid((await context.params).id, "params.id");
  await assertMaterialManager(user, courseId);
  const file = await readMaterialUpload(request);
  return saveCourseMaterial(user, courseId, file.name, file.mime, file.bytes);
}, { methods: ["POST"] });
