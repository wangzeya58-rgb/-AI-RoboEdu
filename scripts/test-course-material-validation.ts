import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { ApiError } from "../src/lib/api/errors";
import { courseStorageDirectory, localMaterialKey, openCourseFile, persistCourseFile, removeCourseFile, validateMaterialFile } from "../src/lib/courses/course-file-storage";
import { MATERIAL_FORMATS } from "../src/lib/courses/material-types";
import { readMaterialUpload } from "../src/lib/courses/material-http";

test("all supported format headers, MIME, filename and size restrictions", () => {
  const heads: Record<string, string> = { pdf: "255044462d", png: "89504e470d0a1a0a", jpg: "ffd8ff", jpeg: "ffd8ff", webp: "524946460000000057454250", mp4: "0000001866747970", webm: "1a45dfa3", ppt: "d0cf11e0a1b11ae1", doc: "d0cf11e0a1b11ae1", pptx: "504b0304", docx: "504b0304" };
  for (const [extension, format] of Object.entries(MATERIAL_FORMATS)) {
    const bytes = Buffer.from(heads[extension], "hex");
    assert.equal(validateMaterialFile(`中文.${extension}`, format.mime, bytes), extension);
    assert.throws(() => validateMaterialFile(`bad.${extension}`, format.mime, Buffer.from("invalid")));
    assert.throws(() => validateMaterialFile(`bad.${extension}`, "text/html", bytes));
  }
  for (const name of ["../file.pdf", "a\\file.pdf", "a\n.pdf", "a.svg", "a.html", "a.exe"]) assert.throws(() => validateMaterialFile(name, "", Buffer.from("%PDF-")));
  assert.throws(() => validateMaterialFile("a.pdf", "application/pdf", new Uint8Array()));
  const previous = process.env.COURSE_UPLOAD_MAX_BYTES;
  try { process.env.COURSE_UPLOAD_MAX_BYTES = "4"; assert.throws(() => validateMaterialFile("a.pdf", "application/pdf", Buffer.from("%PDF-")), (e: unknown) => e instanceof ApiError && e.httpStatus === 413); }
  finally { if (previous === undefined) delete process.env.COURSE_UPLOAD_MAX_BYTES; else process.env.COURSE_UPLOAD_MAX_BYTES = previous; }
});

test("persistent atomic file storage does not overwrite, escape root or follow file symlinks", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "roboedu-storage-unit-"));
  const previous = process.env.COURSE_FILE_STORAGE_DIR;
  try {
    process.env.COURSE_FILE_STORAGE_DIR = directory;
    const id = randomUUID(); const key = localMaterialKey(id, "pdf");
    await persistCourseFile(key, Buffer.from("%PDF-original"));
    await assert.rejects(persistCourseFile(key, Buffer.from("%PDF-overwrite")));
    assert.equal(await readFile(path.join(directory, `${id}.pdf`), "utf8"), "%PDF-original");
    const opened = await openCourseFile(key); await opened.close();
    const symlinkId = randomUUID();
    await symlink(path.join(directory, `${id}.pdf`), path.join(directory, `${symlinkId}.pdf`));
    await assert.rejects(openCourseFile(localMaterialKey(symlinkId, "pdf")));
    await assert.rejects(openCourseFile("https://external.invalid/private.pdf"));
    await removeCourseFile(key);
    await assert.rejects(openCourseFile(key));
    process.env.COURSE_FILE_STORAGE_DIR = process.cwd();
    await assert.rejects(courseStorageDirectory());
  } finally {
    if (previous === undefined) delete process.env.COURSE_FILE_STORAGE_DIR; else process.env.COURSE_FILE_STORAGE_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
});

test("upload parser rejects cross-site requests, malformed forms and identity fields", async () => {
  const origin = process.env.APP_ORIGIN ?? "http://127.0.0.1:5000";
  const url = `${origin}/api/v1/courses/example/materials`;
  const form = () => { const body = new FormData(); body.set("file", new File(["%PDF-test"], "test.pdf", { type: "application/pdf" })); return body; };
  const valid = await readMaterialUpload(new Request(url, { method: "POST", headers: { origin }, body: form() }));
  assert.equal(valid.name, "test.pdf");
  await assert.rejects(readMaterialUpload(new Request(url, { method: "POST", headers: { origin: "https://attacker.invalid" }, body: form() })), (e: unknown) => e instanceof ApiError && e.httpStatus === 403);
  const identity = form(); identity.set("userId", randomUUID());
  await assert.rejects(readMaterialUpload(new Request(url, { method: "POST", headers: { origin }, body: identity })));
  const double = form(); double.append("file", new File(["more"], "another.pdf"));
  await assert.rejects(readMaterialUpload(new Request(url, { method: "POST", headers: { origin }, body: double })));
  await assert.rejects(readMaterialUpload(new Request(url, { method: "POST", headers: { origin, "content-type": "multipart/form-data; boundary=missing" }, body: "not a form" })));
});
