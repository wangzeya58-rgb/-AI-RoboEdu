import type { CourseLesson, CourseProgress } from "./types";

export function createInitialProgress(): CourseProgress {
  return {
    currentSceneIndex: 0,
    completedSceneIds: [],
    quizAnswers: {},
  };
}

export function getCurrentScene(lesson: CourseLesson, progress: CourseProgress) {
  return lesson.scenes[progress.currentSceneIndex] ?? lesson.scenes[0];
}

export function getSceneProgressLabel(lesson: CourseLesson, progress: CourseProgress): string {
  return `${progress.currentSceneIndex + 1} / ${lesson.scenes.length}`;
}

export function canGoPrevious(progress: CourseProgress): boolean {
  return progress.currentSceneIndex > 0;
}

export function canGoNext(lesson: CourseLesson, progress: CourseProgress): boolean {
  return progress.currentSceneIndex < lesson.scenes.length - 1;
}

export function goToScene(lesson: CourseLesson, progress: CourseProgress, index: number): CourseProgress {
  const safeIndex = Math.min(Math.max(index, 0), lesson.scenes.length - 1);
  return {
    ...progress,
    currentSceneIndex: safeIndex,
  };
}

export function goPrevious(progress: CourseProgress): CourseProgress {
  return {
    ...progress,
    currentSceneIndex: Math.max(progress.currentSceneIndex - 1, 0),
  };
}

export function goNext(lesson: CourseLesson, progress: CourseProgress): CourseProgress {
  return {
    ...progress,
    currentSceneIndex: Math.min(progress.currentSceneIndex + 1, lesson.scenes.length - 1),
  };
}

export function answerQuiz(
  lesson: CourseLesson,
  progress: CourseProgress,
  sceneId: string,
  optionId: string,
): CourseProgress {
  if (!lesson.scenes.some((scene) => scene.id === sceneId)) return progress;
  return {
    ...progress,
    quizAnswers: {
      ...progress.quizAnswers,
      [sceneId]: optionId,
    },
  };
}

export function isSceneCompleted(progress: CourseProgress, sceneId: string): boolean {
  return progress.completedSceneIds.includes(sceneId);
}

export function markCurrentSceneComplete(lesson: CourseLesson, progress: CourseProgress): CourseProgress {
  const scene = lesson.scenes[progress.currentSceneIndex];
  if (!scene || progress.completedSceneIds.includes(scene.id)) return progress;
  return {
    ...progress,
    completedSceneIds: [...progress.completedSceneIds, scene.id],
  };
}
