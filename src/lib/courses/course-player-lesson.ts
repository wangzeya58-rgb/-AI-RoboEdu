import type { CourseLesson } from "@/lib/course/types";
import type { FormalCourseSummary, FormalLessonSummary } from "./formal-course-api";

export function toPlayerLesson(course: FormalCourseSummary, lessons: FormalLessonSummary[]): CourseLesson {
  return {
    info: { id: course.id, title: course.title, subtitle: course.description ?? "", level: "正式课程", durationMinutes: 0, objectives: lessons.map((lesson) => lesson.title) },
    scenes: [...lessons].sort((a, b) => a.order - b.order).map((lesson) => ({
      id: lesson.id, type: "intro", title: lesson.title, summary: lesson.content.slice(0, 120),
      content: { heading: lesson.title, paragraphs: [lesson.content], keyPoints: [] },
      teacher: { name: "AI 小老师", role: "课程学习助手", script: lesson.content },
    })),
  };
}
