/**
 * 角色定义与权限矩阵
 */

export const ROLES = ['student', 'teacher', 'admin', 'user'] as const;
export type UserRole = (typeof ROLES)[number];

/** 角色显示名 */
export const ROLE_LABEL: Record<UserRole, string> = {
  student: '学员',
  teacher: '老师',
  admin: '管理员',
  user: '普通用户',
};

/** 角色-功能权限矩阵（仅作为客户端兜底参考，服务端以 route 内校验为准） */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'],
  teacher: [
    'course:create',
    'course:update:own',
    'course:submit',
    'program:read:public',
    'training:enroll',
    'teaching-resource:read:public',
    'feedback:create',
  ],
  student: [
    'program:read:public',
    'training:enroll',
    'teaching-resource:read:public',
    'feedback:create',
  ],
  user: ['feedback:create'],
};
