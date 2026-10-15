"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getFormalCourseProgress, saveFormalCourseProgress } from "@/lib/courses/formal-course-api";
import type { CourseLearningProgress } from "@/lib/courses/learning-progress";
import type { CourseLesson } from "@/lib/course/types";
import {
  answerQuiz,
  createInitialProgress,
  getCurrentScene,
  goToScene,
  markCurrentSceneComplete,
} from "@/lib/course/course-runtime";
import AITeacherPanel from "./AITeacherPanel";
import CourseSidebar from "./CourseSidebar";
import CourseStage from "./CourseStage";

interface CoursePlayerProps {
  lesson: CourseLesson;
  formal?: boolean;
  onProgressChange?: (value: CourseLearningProgress) => void;
}

export default function CoursePlayer({ lesson, formal = false, onProgressChange }: CoursePlayerProps) {
  const [progress, setProgress] = useState(createInitialProgress);
  const [ready, setReady] = useState(!formal);
  const [loading, setLoading] = useState(formal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState<{ index: number; complete: boolean } | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const currentScene = useMemo(() => getCurrentScene(lesson, progress), [lesson, progress]);

  useEffect(() => {
    if (!formal) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setReady(false);
    setLoading(true);
    setError(null);
    async function load() {
      try {
        let value = await getFormalCourseProgress(lesson.info.id, controller.signal);
        const resumeId = value.lastLessonId ?? lesson.scenes.find((scene) => !value.completedLessonIds.includes(scene.id))?.id ?? lesson.scenes[0]?.id;
        if (resumeId) value = await saveFormalCourseProgress(lesson.info.id, resumeId, false, controller.signal);
        if (controller.signal.aborted) return;
        setProgress({ currentSceneIndex: Math.max(0, lesson.scenes.findIndex((scene) => scene.id === value.lastLessonId)), completedSceneIds: value.completedLessonIds, quizAnswers: {} });
        setReady(true);
        onProgressChange?.(value);
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "学习进度加载失败，请重试。");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
        if (requestRef.current === controller) requestRef.current = null;
      }
    }
    void load();
    return () => { controller.abort(); requestRef.current?.abort(); requestRef.current = null; };
  }, [formal, lesson.info.id, lesson.scenes, retry, onProgressChange]);

  async function persist(index: number, complete = false) {
    if (requestRef.current || !ready || !lesson.scenes[index]) return;
    if (!formal) {
      setProgress((current) => {
        const next = goToScene(lesson, current, index);
        return complete ? markCurrentSceneComplete(lesson, next) : next;
      });
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setPending({ index, complete });
    setSaving(true);
    setError(null);
    try {
      const value = await saveFormalCourseProgress(lesson.info.id, lesson.scenes[index].id, complete, controller.signal);
      if (controller.signal.aborted) return;
      setProgress((current) => ({ ...current, currentSceneIndex: index, completedSceneIds: value.completedLessonIds }));
      setPending(null);
      onProgressChange?.(value);
    } catch (saveError) {
      if (!controller.signal.aborted) setError(saveError instanceof Error ? saveError.message : "学习进度保存失败，请重试。");
    } finally {
      if (!controller.signal.aborted) setSaving(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  if (loading) return <p role="status" className="p-5 text-sm text-gray-500">正在恢复学习进度...</p>;
  if (!ready) return <div role="alert" className="p-5 text-sm text-red-700">{error}<button type="button" onClick={() => setRetry((value) => value + 1)} className="ml-3 underline">重试加载</button></div>;
  if (!currentScene) return <p className="p-5 text-sm text-gray-500">本课程暂无章节。</p>;

  return (
    <div>
      {error && <div role="alert" className="px-5 py-3 text-sm text-red-700">{error}{pending && <button type="button" disabled={saving} onClick={() => void persist(pending.index, pending.complete)} className="ml-3 underline">重试保存</button>}</div>}
      <p role="status" className="px-5 pt-3 text-xs text-gray-600">{formal ? "学习进度自动保存到当前正式账号；章节需手动标记完成。" : "Demo 演示进度仅保存在本页，不写入正式账号。"} {saving ? "正在保存..." : ""}</p>
    <div className="flex flex-col gap-5 p-4 sm:p-6 xl:flex-row">
      <CourseSidebar
        lesson={lesson}
        progress={progress}
        disabled={saving}
        onSceneSelect={(index) => void persist(index)}
      />

      <CourseStage
        lesson={lesson}
        progress={progress}
        saving={saving}
        onPrevious={() => void persist(progress.currentSceneIndex - 1)}
        onNext={() => void persist(progress.currentSceneIndex + 1)}
        onComplete={() => void persist(progress.currentSceneIndex, true)}
        onAnswerQuiz={(sceneId, optionId) =>
          setProgress((current) => answerQuiz(lesson, current, sceneId, optionId))
        }
      />

      <AITeacherPanel key={`${lesson.info.id}:${currentScene.id}`} scene={currentScene} course={lesson.info} formal={formal} />
    </div>
    </div>
  );
}
