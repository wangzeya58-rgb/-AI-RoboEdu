export type CourseSceneType = "intro" | "concept" | "quiz" | "resource";

export interface CourseInfo {
  id: string;
  title: string;
  subtitle: string;
  level: string;
  durationMinutes: number;
  objectives: string[];
}

export interface AITeacherScript {
  name: string;
  role: string;
  script: string;
  hint?: string;
}

export interface IntroScene {
  id: string;
  type: "intro";
  title: string;
  summary: string;
  content: {
    heading: string;
    paragraphs: string[];
    keyPoints: string[];
  };
  teacher: AITeacherScript;
}

export interface ConceptScene {
  id: string;
  type: "concept";
  title: string;
  summary: string;
  content: {
    heading: string;
    explanation: string;
    steps: string[];
  };
  teacher: AITeacherScript;
}

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizScene {
  id: string;
  type: "quiz";
  title: string;
  summary: string;
  content: {
    prompt: string;
    options: QuizOption[];
    answer: string;
    explanation: string;
  };
  teacher: AITeacherScript;
}

export type ResourceKind = "pdf" | "image" | "video" | "presentation" | "document" | "unsupported";

export interface ResourceScene {
  id: string;
  type: "resource";
  title: string;
  summary: string;
  content: {
    resourceKind: ResourceKind;
    fileName: string;
    mimeType: string;
    size: number;
    objectUrl?: string;
    message?: string;
  };
  teacher: AITeacherScript;
}

export type CourseScene = IntroScene | ConceptScene | QuizScene | ResourceScene;

export interface CourseLesson {
  info: CourseInfo;
  scenes: CourseScene[];
}

export interface CourseProgress {
  currentSceneIndex: number;
  completedSceneIds: string[];
  quizAnswers: Record<string, string>;
}
