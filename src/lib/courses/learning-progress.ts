export interface CourseLearningProgress {
  courseId: string;
  completedLessonIds: string[];
  lastLessonId: string | null;
  lastStudiedAt: string | null;
  totalLessons: number;
  completedLessons: number;
  percent: number;
  status: "not_started" | "learning" | "completed";
}

export interface ClassCourseLearningProgress {
  classId: string;
  courseId: string;
  courseTitle: string;
  totalLessons: number;
  students: Array<CourseLearningProgress & { userId: string; name: string; username: string }>;
}

export const LEARNING_STATUS_LABELS = { not_started: "未开始", learning: "学习中", completed: "已完成" } as const;

export function summarizeLearningProgress(
  courseId: string,
  lessonIds: string[],
  completedIds: string[],
  lastLessonId: string | null = null,
  lastStudiedAt: string | null = null,
): CourseLearningProgress {
  const currentLessons = new Set(lessonIds);
  const completedLessonIds = [...new Set(completedIds)].filter((id) => currentLessons.has(id));
  const totalLessons = currentLessons.size;
  const completedLessons = completedLessonIds.length;
  return {
    courseId, totalLessons, completedLessons, completedLessonIds,
    lastLessonId: lastLessonId && currentLessons.has(lastLessonId) ? lastLessonId : null,
    lastStudiedAt,
    percent: totalLessons ? Math.floor(completedLessons * 100 / totalLessons) : 0,
    status: totalLessons > 0 && completedLessons === totalLessons ? "completed" : lastStudiedAt || completedLessons ? "learning" : "not_started",
  };
}
