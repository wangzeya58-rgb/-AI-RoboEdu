"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Lightbulb, Loader2, Pause, Play, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CourseInfo, CourseScene } from "@/lib/course/types";
import { MAX_TEACHING_MESSAGES, MAX_TEACHING_MESSAGE_LENGTH, QUICK_TEACHING_QUESTIONS, getLocalTeachingAnswer, getTeachingContentNotice, type TeachingMessage } from "@/lib/ai-classroom/conversation";
import { askFormalAiLessonTeacher } from "@/lib/courses/formal-course-api";

interface AITeacherPanelProps {
  scene: CourseScene;
  course: CourseInfo;
  formal?: boolean;
}

function getSceneContent(scene: CourseScene): string {
  if (scene.type === "resource") return "";
  if (scene.type === "intro") return [...scene.content.paragraphs, ...scene.content.keyPoints].join("\n");
  if (scene.type === "concept") return [scene.content.explanation, ...scene.content.steps].join("\n");
  return [scene.content.prompt, ...scene.content.options.map((option) => option.text)].join("\n");
}

function getSceneFaqAnswer(course: CourseInfo, scene: CourseScene, question: string, history: TeachingMessage[]): string {
  if (scene.type === "resource") return "本节为附件课件，当前尚未提取正文，不能声称已读取视频或PDF。请引用你想讨论的文字。";
  const content = getSceneContent(scene);
  if (!content.trim()) return getTeachingContentNotice(content) ?? "";
  return getLocalTeachingAnswer(course.title, scene.title, `${content}\n学习目标：${course.objectives.join("；")}\n老师提示：${scene.teacher.hint ?? ""}`, question, history);
}

export default function AITeacherPanel({ scene, course, formal = false }: AITeacherPanelProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<TeachingMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerName, setProviderName] = useState(formal ? "课程 AI 小老师" : "Demo 小老师");
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const contentNotice = scene.type === "resource" ? "附件正文尚未提取；请引用相关文字提问。" : getTeachingContentNotice(getSceneContent(scene));
  const requestRef = useRef<AbortController | null>(null);

  const statusText = useMemo(() => (isPlaying ? "讲解中" : "已暂停"), [isPlaying]);

  useEffect(() => {
    setIsPlaying(false);
    setQuestion("");
    setMessages([]);
    setLoading(false);
    setError(null);
    setFailedQuestion(null);
    setProviderName(formal ? "课程 AI 小老师" : "Demo 小老师");
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [course.id, scene.id, formal]);

  const submitQuestion = async (input: string) => {
    const text = input.trim();
    if (!text || requestRef.current) return;
    if (text.length > 1000) { setError("问题不能超过 1000 个字符。"); return; }
    const controller = new AbortController();
    requestRef.current = controller;
    const isCurrent = () => requestRef.current === controller && !controller.signal.aborted;
    setQuestion(text);
    setLoading(true);
    setError(null);
    setFailedQuestion(null);
    try {
      let answer: string;
      if (formal) {
        const response = await askFormalAiLessonTeacher(course.id, scene.id, text, messages.slice(-MAX_TEACHING_MESSAGES), controller.signal);
        if (!isCurrent()) return;
        if (response.course.id !== course.id || response.lesson.id !== scene.id) throw new Error("返回的章节与当前章节不一致，请重新提问。");
        answer = response.answer;
        setProviderName(response.provider.mode === "llm" ? "课程 AI 小老师" : "课程本地答疑（非大模型）");
      } else {
        answer = getSceneFaqAnswer(course, scene, text, messages);
      }
      if (!isCurrent()) return;
      // Commit a complete exchange only after success; retries cannot duplicate a user message.
      setMessages((current) => [...current, { role: "user" as const, content: text }, { role: "assistant" as const, content: answer.slice(0, MAX_TEACHING_MESSAGE_LENGTH) }].slice(-MAX_TEACHING_MESSAGES));
      setQuestion("");
    } catch (askError) {
      if (isCurrent()) {
        setError(askError instanceof Error ? askError.message : "课程 AI 暂不可用，请稍后重试。");
        setFailedQuestion(text);
      }
    } finally {
      if (isCurrent()) setLoading(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  };

  const handleQuestionSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitQuestion(question);
  };

  return (
    <aside className="w-full shrink-0 rounded-lg border border-blue-100 bg-white shadow-sm xl:w-80">
      <div className="border-b border-blue-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100 ring-4 ring-blue-50">
            <Bot className="h-7 w-7 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-gray-950">{scene.teacher.name}</h3>
                <p className="truncate text-xs text-gray-500">{scene.teacher.role}</p>
              </div>
              <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
                {statusText}
              </span>
            </div>
            <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-blue-700">
                <Sparkles className="h-3.5 w-3.5" />
                当前讲解
              </div>
              <p className="text-sm font-medium leading-5 text-gray-950">{scene.title}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="space-y-3 rounded-lg bg-blue-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-blue-700">AI老师讲解稿</p>
            <Button
              type="button"
              size="sm"
              variant={isPlaying ? "secondary" : "default"}
              className="h-8"
              onClick={() => setIsPlaying((current) => !current)}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? "暂停" : "播放"}
            </Button>
          </div>
          <p className="text-sm leading-7 text-gray-700">{scene.teacher.script}</p>
        </div>

        {scene.teacher.hint && (
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-700">
              <Lightbulb className="h-4 w-4" />
              老师提示
            </div>
            <p className="text-xs leading-6 text-amber-800">{scene.teacher.hint}</p>
          </div>
        )}

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-gray-950">向 AI 老师提问</h4>
            <p className="mt-1 text-xs leading-5 text-gray-500">{providerName} · {course.title}</p>
          </div>
          {contentNotice && <p role="note" className="mb-3 text-xs leading-5 text-amber-800">{contentNotice}</p>}
          <div className="mb-3 flex flex-col items-start gap-2">
            {QUICK_TEACHING_QUESTIONS.map((prompt) => (
              <Button key={prompt} type="button" variant="ghost" size="sm" className="h-auto max-w-full whitespace-normal text-left text-xs text-blue-700" disabled={loading} onClick={() => void submitQuestion(prompt)}>
                <Lightbulb className="h-3.5 w-3.5 shrink-0" />{prompt}
              </Button>
            ))}
          </div>
          <div className="mb-3 max-h-80 space-y-3 overflow-y-auto" aria-live="polite" role="log">
            {messages.map((message, index) => (
              <div key={index} className="break-words whitespace-pre-wrap rounded-md bg-white p-3 text-xs leading-6 text-gray-700">
                <p className="font-semibold text-blue-700">{message.role === "user" ? "我的提问" : "小老师"}</p>
                {message.content}
              </div>
            ))}
          </div>
          {error && (
            <div role="alert" className="mb-3 text-xs text-red-700">
              <p>{error}</p>
              {failedQuestion && <Button type="button" variant="outline" size="sm" className="mt-2" disabled={loading} onClick={() => void submitQuestion(failedQuestion)}>重试上次问题</Button>}
            </div>
          )}
          {loading && <p role="status" className="mb-2 text-xs text-gray-500">小老师正在思考...</p>}
          <form className="flex gap-2" onSubmit={handleQuestionSubmit}>
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="例如：为什么需要雷达？"
              className="bg-white text-sm"
              maxLength={1000}
              aria-label="向 AI 小老师提问"
              disabled={loading}
            />
            <Button type="submit" size="icon" aria-label="提问" disabled={loading || !question.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>

        </div>
      </div>
    </aside>
  );
}
