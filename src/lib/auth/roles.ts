/**
 * 角色与权限常量定义
 */
export const ROLES = {
  STUDENT: 'student',
  USER: 'student',
  TEACHER: 'teacher',
  ADMIN: 'admin',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABEL: Record<Role, string> = {
  student: '学生',
  teacher: '老师',
  admin: '管理员',
};

export const COURSE_STATUS = {
  DRAFT: 'draft', // 草稿（仅老师可见）
  PENDING: 'pending', // 待审核
  APPROVED: 'approved', // 已上架
  REJECTED: 'rejected', // 已驳回
  OFFLINE: 'offline', // 已下架
} as const;

export type CourseStatus = (typeof COURSE_STATUS)[keyof typeof COURSE_STATUS];

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  draft: '草稿',
  pending: '待审核',
  approved: '已上架',
  rejected: '已驳回',
  offline: '已下架',
};

export const COURSE_STATUS_COLOR: Record<CourseStatus, string> = {
  draft: '#909399',
  pending: '#2386FF',
  approved: '#25D366',
  rejected: '#FF4D4F',
  offline: '#909399',
};

export const COURSE_CATEGORIES = [
  { value: 'ai_basics', label: 'AI 基础' },
  { value: 'robotics', label: '机器人学' },
  { value: 'programming', label: '编程开发' },
  { value: 'machine_learning', label: '机器学习' },
  { value: 'computer_vision', label: '计算机视觉' },
  { value: 'embedded', label: '嵌入式开发' },
] as const;

export const COURSE_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  COURSE_CATEGORIES.map((c) => [c.value, c.label])
);

export const MATERIAL_TYPES = ['video', 'document', 'image'] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  video: '视频',
  document: '文档',
  image: '图文',
};

export function isTeacherOrAdmin(role?: string | null): boolean {
  return role === ROLES.TEACHER || role === ROLES.ADMIN;
}

export function isAdmin(role?: string | null): boolean {
  return role === ROLES.ADMIN;
}

export function isTeacher(role?: string | null): boolean {
  return role === ROLES.TEACHER;
}

export function isStudent(role?: string | null): boolean {
  return role === ROLES.STUDENT;
}
