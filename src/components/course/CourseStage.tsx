"use client";

import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import type { CourseLesson, CourseProgress } from "@/lib/course/types";
import {
  canGoNext,
  canGoPrevious,
  getSceneProgressLabel,
} from "@/lib/course/course-runtime";
import SceneRenderer from "./SceneRenderer";
import { FormalCourseMaterials } from "./FormalCourseMaterials";

interface CourseStageProps {
  lesson: CourseLesson;
  progress: CourseProgress;
  onPrevious: () => void;
  onNext: () => void;
  onAnswerQuiz: (sceneId: string, optionId: string) => void;
  onComplete: () => void;
  saving?: boolean;
  preview?: boolean;
  formal?: boolean;
}

export default function CourseStage({
  lesson,
  progress,
  onPrevious,
  onNext,
  onAnswerQuiz,
  onComplete,
  saving = false,
  preview = false,
  formal = false,
}: CourseStageProps) {
  const currentScene = lesson.scenes[progress.currentSceneIndex];
  const isLastScene = !canGoNext(lesson, progress);

  return (
    <section className="flex min-h-[480px] min-w-0 flex-1 flex-col rounded-lg border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-medium text-blue-600">
            第 {getSceneProgressLabel(lesson, progress)} 页
          </div>
          <h2 className="mt-1 text-xl font-semibold text-gray-950 [overflow-wrap:anywhere]">{currentScene.title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          <button
            type="button"
            onClick={onPrevious}
            disabled={saving || !canGoPrevious(progress)}
            className="inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            上一章
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={saving || isLastScene}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#2386FF] px-3 text-sm text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            下一章
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-5 sm:p-8">
        <SceneRenderer
          scene={currentScene}
          selectedAnswer={progress.quizAnswers[currentScene.id]}
          onAnswerQuiz={onAnswerQuiz}
        />
      </div>
      {!preview && <div className="border-t p-4">
        <button type="button" onClick={onComplete} disabled={saving || progress.completedSceneIds.includes(currentScene.id)} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white disabled:bg-gray-400">
          <CheckCircle2 className="h-4 w-4" />{saving ? "保存中..." : progress.completedSceneIds.includes(currentScene.id) ? "本章已完成" : "标记本章完成"}
        </button>
      </div>}
      {formal && <div className="p-4"><FormalCourseMaterials key={lesson.info.id} courseId={lesson.info.id} /></div>}
    </section>
  );
}
