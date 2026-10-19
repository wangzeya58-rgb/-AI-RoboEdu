import { ApiError } from "@/lib/api/errors";
import { materialSizeLimit } from "./course-file-storage";

let activeUploads = 0;

export async function readMaterialUpload(request: Request): Promise<{ name: string; mime: string; bytes: Uint8Array }> {
  const origin = request.headers.get("origin");
  const allowedOrigin = process.env.APP_ORIGIN || new URL(request.url).origin;
  if ((origin && origin !== allowedOrigin) || request.headers.get("sec-fetch-site") === "cross-site") throw ApiError.forbidden("拒绝跨站上传请求。");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) throw ApiError.badRequest("请使用 multipart/form-data 上传文件。");
  const limit = materialSizeLimit() + 65536;
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw new ApiError(10001, "上传请求超过大小限制。", { httpStatus: 413 });
  if (activeUploads >= 2) throw new ApiError(10006, "上传繁忙，请稍后重试。", { httpStatus: 429 });
  if (!request.body) throw ApiError.badRequest("缺少上传文件。");
  activeUploads++;
  const reader = request.body.getReader();
  try {
    let length = 0;
    const parts: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new ApiError(10001, "上传请求超过大小限制。", { httpStatus: 413 }); }
      parts.push(value);
    }
    let data: FormData;
    try { data = await new Response(Buffer.concat(parts), { headers: { "content-type": request.headers.get("content-type")! } }).formData(); }
    catch { throw ApiError.badRequest("上传文件表单无效。"); }
    const files = data.getAll("file");
    if (files.length !== 1 || !(files[0] instanceof File) || [...data.keys()].some((key) => key !== "file")) throw ApiError.badRequest("每次只能上传一个 file，不接受创建者或身份字段。");
    const file = files[0];
    return { name: file.name, mime: file.type, bytes: new Uint8Array(await file.arrayBuffer()) };
  } finally { reader.releaseLock(); activeUploads--; }
}
