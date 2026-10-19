export const COURSE_MATERIAL_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.mp4,.webm,.ppt,.pptx,.doc,.docx";

export const MATERIAL_FORMATS: Record<string, { mime: string; preview: "pdf" | "image" | "video" | null }> = {
  pdf: { mime: "application/pdf", preview: "pdf" },
  png: { mime: "image/png", preview: "image" },
  jpg: { mime: "image/jpeg", preview: "image" },
  jpeg: { mime: "image/jpeg", preview: "image" },
  webp: { mime: "image/webp", preview: "image" },
  mp4: { mime: "video/mp4", preview: "video" },
  webm: { mime: "video/webm", preview: "video" },
  ppt: { mime: "application/vnd.ms-powerpoint", preview: null },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", preview: null },
  doc: { mime: "application/msword", preview: null },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", preview: null },
};

export interface FormalCourseMaterial {
  id: string;
  courseId: string;
  name: string;
  size: number;
  type: string;
  mimeType: string;
  preview: "pdf" | "image" | "video" | null;
  available: boolean;
  createdAt: string;
  contentUrl: string;
  downloadUrl: string;
}
