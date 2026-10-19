import { Readable } from "node:stream";
import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { uuid } from "@/lib/api/validation";
import { getCourseMaterial, materialSummary } from "@/lib/courses/server-material-service";
import { openCourseFile } from "@/lib/courses/course-file-storage";
import { ApiError } from "@/lib/api/errors";

export const runtime = "nodejs";
export const GET = withApi(async (request, context) => {
  const user = requireSession(request);
  const { id, materialId } = await context.params;
  const row = await getCourseMaterial(user, uuid(id, "params.id"), uuid(materialId, "params.materialId"));
  const metadata = materialSummary(row);
  const file = await openCourseFile(row.url);
  const stat = await file.stat().catch(async (error: unknown) => { await file.close(); throw error; });
  if (!stat.isFile() || stat.size < 1) { await file.close(); throw ApiError.notFound("附件文件无效，请联系管理员恢复备份。"); }
  const attachment = request.nextUrl.searchParams.get("download") === "1" || !metadata.preview;
  const disposition = `${attachment ? "attachment" : "inline"}; filename="course-material.${row.type.replace(/[^a-z0-9]/g, "")}"; filename*=UTF-8''${encodeURIComponent(row.name).replace(/['()*]/g, (value) => `%${value.charCodeAt(0).toString(16)}`)}`;
  const headers = new Headers({ "Content-Type": metadata.mimeType, "Content-Disposition": disposition,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes", "Referrer-Policy": "same-origin" });
  let start = 0;
  let end = stat.size - 1;
  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match && (match[1] || match[2])) {
      if (match[1]) { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end; }
      else start = Math.max(0, stat.size - Number(match[2]));
    } else start = -1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= stat.size) {
      await file.close(); headers.set("Content-Range", `bytes */${stat.size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
  }
  headers.set("Content-Length", String(end - start + 1));
  const stream = file.createReadStream({ start, end, autoClose: true });
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status: range ? 206 : 200, headers });
}, { methods: ["GET"] });
