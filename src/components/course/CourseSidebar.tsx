"use client";

import { CheckCircle2, Circle, GraduationCap } from "lucide-react";
import type { CourseLesson, CourseProgress } from "@/lib/course/types";
import { isSceneCompleted } from "@/lib/course/course-runtime";

interface CourseSidebarProps {
  lesson: CourseLesson;
  progress: CourseProgress;
  onSceneSelect: (index: number) => void;
  disabled?: boolean;
}

const sceneTypeLabels = {
  intro: "导入",
  concept: "讲解",
  quiz: "互动",
  resource: "资源",
} as const;

export default function CourseSidebar({
  lesson,
  progress,
  onSceneSelect,
  disabled = false,
}: CourseSidebarProps) {
  return (
    <aside className="w-full xl:w-72 shrink-0 rounded-lg border bg-white shadow-sm">
      <div className="border-b p-4">
        <div className="mb-3 flex items-center gap-2 text-blue-600">
          <GraduationCap className="h-5 w-5" />
          <span className="text-sm font-semibold">课堂目录</span>
        </div>
        <h2 className="text-base font-semibold text-gray-950 [overflow-wrap:anywhere]">{lesson.info.title}</h2>
        <p className="mt-1 text-xs leading-5 text-gray-500 [overflow-wrap:anywhere]">{lesson.info.subtitle}</p>
        <p className="mt-3 text-xs text-gray-600">已完成 {progress.completedSceneIds.length} / {lesson.scenes.length} 章</p>
        <progress aria-label="课程完成进度" className="mt-2 h-2 w-full accent-blue-600" max={lesson.scenes.length || 1} value={progress.completedSceneIds.length} />
      </div>

      <div className="space-y-2 p-3">
        {lesson.scenes.map((scene, index) => {
          const active = progress.currentSceneIndex === index;
          const completed = isSceneCompleted(progress, scene.id);
          const StatusIcon = completed ? CheckCircle2 : Circle;

          return (
            <button
              key={scene.id}
              type="button"
              disabled={disabled}
              onClick={() => onSceneSelect(index)}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                active
                  ? "border-blue-200 bg-blue-50 text-blue-900"
                  : "border-transparent hover:border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <StatusIcon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    completed ? "text-[#25D366]" : "text-gray-300"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                      {sceneTypeLabels[scene.type]}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{scene.title}</div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">
                    {scene.summary}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
