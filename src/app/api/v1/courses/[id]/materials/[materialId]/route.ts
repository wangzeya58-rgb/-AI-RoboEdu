import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { uuid } from "@/lib/api/validation";
import { deleteCourseMaterial } from "@/lib/courses/server-material-service";

export const runtime = "nodejs";
export const DELETE = withApi(async (request, context) => {
  const user = requireSession(request);
  const { id, materialId } = await context.params;
  return deleteCourseMaterial(user, uuid(id, "params.id"), uuid(materialId, "params.materialId"));
}, { methods: ["DELETE"] });
