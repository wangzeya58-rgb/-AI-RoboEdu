import { constants } from "node:fs";
import { link, mkdir, open, realpath, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { ApiError } from "@/lib/api/errors";
import { MATERIAL_FORMATS } from "./material-types";

export function materialSizeLimit(): number {
  const value = Number(process.env.COURSE_UPLOAD_MAX_BYTES ?? 52428800);
  if (!Number.isSafeInteger(value) || value < 1 || value > 268435456) throw ApiError.internal("课程上传大小配置无效。");
  return value;
}

export async function courseStorageDirectory(): Promise<string> {
  const configured = process.env.COURSE_FILE_STORAGE_DIR;
  if (!configured && process.env.NODE_ENV === "production") throw ApiError.internal("未配置正式课件持久化目录。");
  const directory = configured || path.join(homedir(), ".local/share/ai-roboedu/course-files");
  if (!path.isAbsolute(directory)) throw ApiError.internal("课件存储目录必须为绝对路径。");
  const outsideProject = (value: string) => {
    const relative = path.relative(process.cwd(), value);
    if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
      throw ApiError.internal("课件目录必须独立于源码及构建目录。");
    }
  };
  outsideProject(path.resolve(directory));
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const canonical = await realpath(directory);
  outsideProject(canonical);
  return canonical;
}

export function localMaterialKey(id: string, extension: string): string {
  return `local:v1:${id}.${extension}`;
}

function fileName(key: string): string {
  const match = /^local:v1:([0-9a-f-]{36})\.([a-z0-9]+)$/.exec(key);
  if (!match || !MATERIAL_FORMATS[match[2]]) throw ApiError.notFound("旧附件未接入本地持久存储，请联系管理员核对，未自动迁移。");
  return `${match[1]}.${match[2]}`;
}

export function isLocalMaterial(key: string): boolean {
  try { fileName(key); return true; } catch { return false; }
}

export async function persistCourseFile(key: string, bytes: Uint8Array): Promise<void> {
  const directory = await courseStorageDirectory();
  const target = path.join(directory, fileName(key));
  const temporary = `${target}.upload`;
  const file = await open(temporary, "wx", 0o600);
  try {
    await file.writeFile(bytes);
    await file.sync();
    await file.close();
    await link(temporary, target);
    await unlink(temporary);
  } catch (error) {
    await file.close().catch(() => {});
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

export async function removeCourseFile(key: string): Promise<void> {
  await unlink(path.join(await courseStorageDirectory(), fileName(key))).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

export async function openCourseFile(key: string) {
  try {
    return await open(path.join(await courseStorageDirectory(), fileName(key)), constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw ApiError.notFound("附件文件不存在，请联系管理员恢复文件备份。");
    throw ApiError.internal("课件文件暂时无法读取，请联系管理员检查存储权限。");
  }
}

export function validateMaterialFile(name: string, mime: string, bytes: Uint8Array): string {
  if (!name || name.length > 240 || /[/\\\x00-\x1f\x7f]/.test(name) || name === "." || name === "..") throw ApiError.badRequest("文件名无效，不能包含路径或控制字符。");
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  const format = MATERIAL_FORMATS[extension];
  if (!format) throw ApiError.badRequest("不支持该课件格式。支持 PDF、PNG/JPG/WebP、MP4/WebM、PPT/PPTX、DOC/DOCX。");
  if (mime && mime !== "application/octet-stream" && mime !== format.mime && mime !== "application/zip") throw ApiError.badRequest("文件 MIME 类型与扩展名不匹配。");
  if (mime === "application/zip" && !["docx", "pptx"].includes(extension)) throw ApiError.badRequest("文件 MIME 类型与扩展名不匹配。");
  if (!bytes.length || bytes.length > materialSizeLimit()) throw new ApiError(10001, "文件为空或超过上传大小限制。", { httpStatus: 413 });
  const head = Buffer.from(bytes.subarray(0, 32));
  const starts = (hex: string) => head.subarray(0, hex.length / 2).equals(Buffer.from(hex, "hex"));
  const valid = extension === "pdf" ? head.subarray(0, 5).toString() === "%PDF-"
    : extension === "png" ? starts("89504e470d0a1a0a")
    : ["jpg", "jpeg"].includes(extension) ? starts("ffd8ff")
    : extension === "webp" ? head.subarray(0, 4).toString() === "RIFF" && head.subarray(8, 12).toString() === "WEBP"
    : extension === "mp4" ? head.subarray(4, 8).toString() === "ftyp"
    : extension === "webm" ? starts("1a45dfa3")
    : ["doc", "ppt"].includes(extension) ? starts("d0cf11e0a1b11ae1")
    : starts("504b0304");
  if (!valid) throw ApiError.badRequest("文件内容特征与格式不符，未保存附件。");
  return extension;
}
