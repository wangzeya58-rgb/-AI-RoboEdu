"use client";

import { CheckCircle2, CircleAlert, FileText, ImageIcon, ListChecks, Radio, Video } from "lucide-react";
import type { CourseScene } from "@/lib/course/types";

interface SceneRendererProps {
  scene: CourseScene;
  selectedAnswer?: string;
  onAnswerQuiz: (sceneId: string, optionId: string) => void;
}

export default function SceneRenderer({
  scene,
  selectedAnswer,
  onAnswerQuiz,
}: SceneRendererProps) {
  if (scene.type === "resource") {
    const fileSize =
      scene.content.size < 1024 * 1024
        ? `${(scene.content.size / 1024).toFixed(1)} KB`
        : `${(scene.content.size / 1024 / 1024).toFixed(1)} MB`;

    if (scene.content.resourceKind === "pdf" && scene.content.objectUrl) {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-slate-50 px-4 py-3">
            <div>
              <h3 className="text-base font-semibold text-gray-950">{scene.content.fileName}</h3>
              <p className="mt-1 text-xs text-gray-500">PDF 课件 · {fileSize}</p>
            </div>
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <iframe
            src={scene.content.objectUrl}
            title={scene.content.fileName}
            className="h-[720px] w-full rounded-lg border bg-white"
          />
        </div>
      );
    }

    if (scene.content.resourceKind === "image" && scene.content.objectUrl) {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-slate-50 px-4 py-3">
            <div>
              <h3 className="text-base font-semibold text-gray-950">{scene.content.fileName}</h3>
              <p className="mt-1 text-xs text-gray-500">图片资源 · {fileSize}</p>
            </div>
            <ImageIcon className="h-5 w-5 text-emerald-600" />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={scene.content.objectUrl}
            alt={scene.content.fileName}
            className="mx-auto max-h-[720px] w-full rounded-lg border bg-white object-contain"
          />
        </div>
      );
    }

    if (scene.content.resourceKind === "video" && scene.content.objectUrl) {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-slate-50 px-4 py-3">
            <div>
              <h3 className="text-base font-semibold text-gray-950">{scene.content.fileName}</h3>
              <p className="mt-1 text-xs text-gray-500">视频资源 · {fileSize}</p>
            </div>
            <Video className="h-5 w-5 text-orange-600" />
          </div>
          <video
            src={scene.content.objectUrl}
            controls
            className="mx-auto max-h-[720px] w-full rounded-lg border bg-black object-contain"
          />
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-amber-100 bg-amber-50 p-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700">
          <FileText className="h-5 w-5" />
          当前资源暂不能直接预览
        </div>
        <h3 className="text-xl font-semibold text-gray-950">{scene.content.fileName}</h3>
        <p className="mt-3 text-sm leading-7 text-amber-800">
          {scene.content.message ?? "当前浏览器端暂不能可靠预览该格式。"}
        </p>
        <p className="mt-3 text-xs text-amber-700">
          文件类型：{scene.content.mimeType || "未知"} · 文件大小：{fileSize}
        </p>
      </div>
    );
  }

  if (scene.type === "intro") {
    return (
      <div className="space-y-6">
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-slate-50 p-6">
          <h3 className="text-2xl font-semibold text-gray-950">{scene.content.heading}</h3>
          <div className="mt-4 space-y-3 text-sm leading-7 text-gray-600">
            {scene.content.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {scene.content.keyPoints.map((point) => (
            <div key={point} className="rounded-lg border bg-white p-4">
              <CheckCircle2 className="mb-3 h-5 w-5 text-[#25D366]" />
              <p className="text-sm font-medium text-gray-800">{point}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (scene.type === "concept") {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-semibold text-gray-950">{scene.content.heading}</h3>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-600">
            {scene.content.explanation}
          </p>
        </div>

        <div className="rounded-xl border bg-slate-50 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <ListChecks className="h-5 w-5 text-blue-600" />
            学习流程
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {scene.content.steps.map((step, index) => (
              <div key={step} className="flex items-center gap-3 rounded-lg bg-white p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                  {index + 1}
                </div>
                <span className="text-sm text-gray-700">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const answered = Boolean(selectedAnswer);
  const correct = selectedAnswer === scene.content.answer;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-xl border bg-slate-50 p-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-600">
          <Radio className="h-5 w-5" />
          互动问题
        </div>
        <h3 className="text-xl font-semibold text-gray-950">{scene.content.prompt}</h3>
      </div>

      <div className="space-y-3">
        {scene.content.options.map((option) => {
          const selected = selectedAnswer === option.id;
          const isAnswer = scene.content.answer === option.id;
          const showCorrect = answered && isAnswer;
          const showWrong = answered && selected && !isAnswer;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onAnswerQuiz(scene.id, option.id)}
              className={`w-full rounded-lg border p-4 text-left transition-colors ${
                showCorrect
                  ? "border-emerald-200 bg-emerald-50"
                  : showWrong
                    ? "border-red-200 bg-red-50"
                    : selected
                      ? "border-blue-200 bg-blue-50"
                      : "hover:border-blue-200 hover:bg-blue-50/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border bg-white text-sm font-semibold text-gray-600">
                  {option.id.toUpperCase()}
                </span>
                <span className="text-sm font-medium text-gray-800">{option.text}</span>
              </div>
            </button>
          );
        })}
      </div>

      {answered && (
        <div
          className={`rounded-lg border p-4 ${
            correct ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            {correct ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <CircleAlert className="h-5 w-5 text-amber-600" />
            )}
            {correct ? "回答正确" : "再想一想"}
          </div>
          <p className="text-sm leading-6 text-gray-700">{scene.content.explanation}</p>
        </div>
      )}
    </div>
  );
}
