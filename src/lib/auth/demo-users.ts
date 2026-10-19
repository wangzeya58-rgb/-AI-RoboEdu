import { ROLES, type Role } from "./roles";

export interface DemoSessionInfo {
  id: string;
  username: string;
  name: string;
  phone: string;
  role: Role;
  class_menu_locked?: boolean;
  classId?: string;
  courseIds?: string[];
  createdAt: string;
}

export interface DemoUser {
  username: string;
  password: string;
  session: DemoSessionInfo;
}

export const DEMO_USERS: DemoUser[] = [
  {
    username: "student",
    password: "123456",
    session: {
      id: "demo-student",
      username: "student",
      name: "学生 Demo",
      phone: "student",
      role: ROLES.STUDENT,
      courseIds: ["ai-car-vision-basics", "line-following-lab"],
      createdAt: "2026-10-01T00:00:00.000Z",
    },
  },
  {
    username: "teacher",
    password: "123456",
    session: {
      id: "demo-teacher",
      username: "teacher",
      name: "教师 Demo",
      phone: "teacher",
      role: ROLES.TEACHER,
      createdAt: "2026-10-01T00:00:00.000Z",
    },
  },
  {
    username: "admin",
    password: "123456",
    session: {
      id: "demo-admin",
      username: "admin",
      name: "管理员 Demo",
      phone: "admin",
      role: ROLES.ADMIN,
      createdAt: "2026-10-01T00:00:00.000Z",
    },
  },
];

export function isDemoAuthAllowed(): boolean {
  if (process.env.ENABLE_DEMO_AUTH !== undefined) return process.env.ENABLE_DEMO_AUTH === "true";
  return process.env.NODE_ENV !== "production";
}

export function findDemoUser(username: string, password: string): DemoUser | null {
  return (
    DEMO_USERS.find(
      (user) => user.username === username.trim() && user.password === password
    ) ?? null
  );
}

