"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Layout from "@/components/Layout";
import CoursePlayer from "@/components/course/CoursePlayer";
import { findLessonById, getLessonById } from "@/lib/course/lessons";
import type { CourseLesson, ResourceKind, ResourceScene } from "@/lib/course/types";
import {
  getCourseAssetBlob,
  listTeacherCourses,
  type CourseAsset,
  type TeacherCourse,
} from "@/lib/course/teacher-course-store";

function removeExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

function getFileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.[^.]+$/);
  return match?.[0] ?? "";
}

function getResourceKind(asset: CourseAsset): ResourceKind {
  const extension = getFileExtension(asset.name);

  if (extension === ".pdf" || asset.mimeType === "application/pdf") return "pdf";
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(extension)) return "image";
  if ([".mp4", ".webm"].includes(extension)) return "video";
  if ([".ppt", ".pptx"].includes(extension)) return "presentation";
  if ([".doc", ".docx"].includes(extension)) return "document";
  return "unsupported";
}

function getUnsupportedMessage(kind: ResourceKind): string {
  if (kind === "presentation") {
    return "PPT / PPTX 需要专门的幻灯片解析或转换能力。当前项目没有可用的前端 PPT 渲染依赖，也没有服务端转换流程，所以暂不能在课堂中可靠浏览 PPT 页面。";
  }

  if (kind === "document") {
    return "Word / DOCX 需要文档解析能力。当前项目没有 mammoth、docx-preview 等前端解析依赖，也没有服务端转换流程，所以暂不能在课堂中可靠展示正文。";
  }

  return "当前浏览器端暂不能可靠预览该格式。";
}

async function buildUploadedCourseLesson(course: TeacherCourse): Promise<{
  lesson: CourseLesson;
  objectUrls: string[];
}> {
  const objectUrls: string[] = [];
  const resources = [...course.resources].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const scenes: ResourceScene[] = await Promise.all(
    resources.map(async (resource, index) => {
      const kind = getResourceKind(resource);
      const blob = await getCourseAssetBlob(resource.id);
      const canUseObjectUrl = blob && ["pdf", "image", "video"].includes(kind);
      const objectUrl = canUseObjectUrl ? URL.createObjectURL(blob) : undefined;

      if (objectUrl) objectUrls.push(objectUrl);

      return {
        id: `resource-${resource.id}`,
        type: "resource",
        title: removeExtension(resource.name),
        summary: `${String(index + 1).padStart(2, "0")} ${resource.name}`,
        content: {
          resourceKind: kind,
          fileName: resource.name,
          mimeType: resource.mimeType,
          size: resource.size,
          objectUrl,
          message: getUnsupportedMessage(kind),
        },
        teacher: {
          name: "AI老师",
          role: "课程资源引导",
          script: `当前正在学习：${removeExtension(resource.name)}`,
          hint:
            kind === "presentation" || kind === "document"
              ? "该格式当前还不能直接预览，后续可接入解析或转换能力。"
              : "可以使用左侧目录或上一页 / 下一页切换课程资源。",
        },
      };
    })
  );

  return {
    lesson: {
      info: {
        id: course.id,
        title: course.title,
        subtitle: course.description || "教师上传课程资源",
        level: "自建课程",
        durationMinutes: 0,
        objectives: [
          "播放教师上传的课程资源",
          "通过左侧目录切换 PDF、图片、视频等资源",
          "保持资源在当前课堂页面内展示",
        ],
      },
      scenes:
        scenes.length > 0
          ? scenes
          : [
              {
                id: "uploaded-course-empty",
                type: "intro",
                title: "暂无课程资源",
                summary: "该课程还没有上传资源。",
                content: {
                  heading: course.title,
                  paragraphs: ["该课程已创建，但尚未上传可播放的课程资源。"],
                  keyPoints: ["请返回教学资源模块上传课件。"],
                },
                teacher: {
                  name: "AI老师",
                  role: "课程资源引导",
                  script: `当前正在学习：${course.title}`,
                  hint: "上传 PDF、图片或视频后，可在课堂中直接播放。",
                },
              },
            ],
    },
    objectUrls,
  };
}

function CoursePlayerPageContent() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get("courseId") ?? undefined;
  const builtInLesson = courseId ? findLessonById(courseId) : getLessonById(undefined);
  const [uploadedLesson, setUploadedLesson] = useState<CourseLesson | null>(null);
  const [loadingUploadedCourse, setLoadingUploadedCourse] = useState(Boolean(courseId && !builtInLesson));

  useEffect(() => {
    let cancelled = false;
    let objectUrls: string[] = [];

    if (!courseId || builtInLesson) {
      setUploadedLesson(null);
      setLoadingUploadedCourse(false);
      return;
    }

    setLoadingUploadedCourse(true);
    listTeacherCourses()
      .then((courses) => {
        if (cancelled) return;
        const uploadedCourse = courses.find((course) => course.id === courseId);
        if (!uploadedCourse) {
          setUploadedLesson(null);
          return;
        }

        return buildUploadedCourseLesson(uploadedCourse).then((result) => {
          if (cancelled) {
            result.objectUrls.forEach((url) => URL.revokeObjectURL(url));
            return;
          }
          objectUrls = result.objectUrls;
          setUploadedLesson(result.lesson);
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingUploadedCourse(false);
      });

    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [builtInLesson, courseId]);

  if (loadingUploadedCourse) {
    return <div className="p-6 text-sm text-gray-500">正在加载自建课程...</div>;
  }

  const lesson = builtInLesson ?? uploadedLesson;

  if (!lesson) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-100 bg-amber-50 p-5 text-sm text-amber-800">
          没有找到该课程。请返回教学资源库重新选择课程。
        </div>
      </div>
    );
  }

  return <CoursePlayer lesson={lesson} />;
}

export default function CoursePlayerPage() {
  return (
    <Layout activeMenu="/course" className="max-md:[&>aside]:hidden [&>main]:min-w-0">
      <Suspense
        fallback={
          <div className="p-6 text-sm text-gray-500">
            正在加载课程...
          </div>
        }
      >
        <CoursePlayerPageContent />
      </Suspense>
    </Layout>
  );
}
