import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeLearningProgress } from "../src/lib/courses/learning-progress";
import { createInitialProgress, goNext, goToScene, answerQuiz, markCurrentSceneComplete } from "../src/lib/course/course-runtime";
import { mockLessons } from "../src/lib/course/lessons";

test("打开、切换、答题均不直接完成章节", () => {
  const lesson = mockLessons[0];
  const initial = createInitialProgress();
  assert.deepEqual(goToScene(lesson, initial, 1).completedSceneIds, []);
  assert.deepEqual(goNext(lesson, initial).completedSceneIds, []);
  assert.deepEqual(answerQuiz(lesson, initial, lesson.scenes[0].id, "a").completedSceneIds, []);
  const completed = markCurrentSceneComplete(lesson, initial);
  assert.deepEqual(completed.completedSceneIds, [lesson.scenes[0].id]);
  assert.deepEqual(markCurrentSceneComplete(lesson, completed).completedSceneIds, completed.completedSceneIds);
});

test("进度按当前章节去重计算，新增/删除章节不会留下虚假百分比", () => {
  const value = summarizeLearningProgress("course", ["a", "b"], ["a", "a", "deleted"], "deleted", "2026-10-15");
  assert.equal(value.percent, 50);
  assert.equal(value.completedLessons, 1);
  assert.equal(value.lastLessonId, null);
  assert.equal(summarizeLearningProgress("course", ["a", "b", "c"], ["a"]).percent, 33);
  assert.equal(summarizeLearningProgress("course", ["a"], ["a"]).status, "completed");
});

test("未开始、只访问、空课程状态明确", () => {
  assert.equal(summarizeLearningProgress("course", ["a"], []).status, "not_started");
  const visit = summarizeLearningProgress("course", ["a"], [], "a", "2026-10-15");
  assert.equal(visit.status, "learning");
  assert.equal(visit.percent, 0);
  const empty = summarizeLearningProgress("course", [], []);
  assert.equal(empty.percent, 0);
  assert.notEqual(empty.status, "completed");
});
