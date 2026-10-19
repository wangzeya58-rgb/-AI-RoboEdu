"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import { BookOpen, GraduationCap, Users, UserRoundCheck } from "lucide-react";
import type { SessionInfo } from "@/lib/auth/client";
import { useCurrentSession } from "@/lib/auth/use-current-session";
import { listFormalCourses } from "@/lib/courses/formal-course-api";
import { listTeacherCourses } from "@/lib/course/teacher-course-store";
import { ROLES } from "@/lib/auth/roles";
import {
  isDemoSessionId,
  listFormalClassMembers,
  listFormalClasses,
  type FormalClassSummary,
} from "@/lib/classes/formal-class-api";
import {
  listClassesForTeacher,
  subscribeClassStore,
} from "@/lib/classes/demo-class-store";

const teacherCards = [
  {
    title: "我的班级",
    desc: "查看当前授课班级和班级口令。",
    href: "/teacher/classes",
    icon: Users,
    color: "#2386FF",
  },
  {
    title: "课程管理",
    desc: "建设课程、编辑章节、发布到班级。",
    href: "/teacher/courses",
    icon: BookOpen,
    color: "#25D366",
  },
  {
    title: "学生管理",
    desc: "查看班级学生和处理入班申请。",
    href: "/teacher/classes",
    icon: UserRoundCheck,
    color: "#FF8C42",
  },
];

export default function TeacherWorkspacePage() {
  const { session } = useCurrentSession();
  const [classCount, setClassCount] = useState<number | null>(null);
  const [courseCount, setCourseCount] = useState<number | null>(null);
  const [approvedStudents, setApprovedStudents] = useState<number | null>(null);
  const [pendingApplications, setPendingApplications] = useState<number | null>(null);

  const loadOverview = useCallback(async (current: SessionInfo | null, active: () => boolean) => {
    setClassCount(null);
    setCourseCount(null);
    setApprovedStudents(null);
    setPendingApplications(null);
    if (current?.role !== ROLES.TEACHER) {
      return;
    }

    if (isDemoSessionId(current.id)) {
      const classes = listClassesForTeacher(current.id);
      setClassCount(classes.length);
      setApprovedStudents(classes.reduce((sum, item) => sum + item.stats.approved, 0));
      setPendingApplications(classes.reduce((sum, item) => sum + item.stats.pending, 0));
      try {
        const courses = await listTeacherCourses(current);
        if (active()) setCourseCount(courses.length);
      } catch { /* Keep unavailable local storage statistics unknown. */ }
      return;
    }

    try {
      const [classes, courses]: [FormalClassSummary[], Awaited<ReturnType<typeof listFormalCourses>>] = await Promise.all([listFormalClasses(), listFormalCourses()]);
      const memberGroups = await Promise.all(
        classes.map((item) => listFormalClassMembers(item.id)),
      );
      if (!active()) return;
      setClassCount(classes.length);
      setCourseCount(courses.length);
      setApprovedStudents(memberGroups.reduce(
        (sum, members) => sum + members.filter((member) => member.status === "approved").length,
        0,
      ));
      setPendingApplications(memberGroups.reduce(
        (sum, members) => sum + members.filter((member) => member.status === "pending").length,
        0,
      ));
    } catch { /* Failed requests must not be presented as zero real records. */ }
  }, []);

  useEffect(() => {
    let generation = 0;
    const refresh = () => {
      const request = ++generation;
      void loadOverview(session, () => request === generation);
    };
    refresh();
    const unsubscribeClassStore = session && isDemoSessionId(session.id) ? subscribeClassStore(refresh) : () => {};
    return () => {
      generation++;
      unsubscribeClassStore();
    };
  }, [loadOverview, session]);

  return (
    <Layout activeMenu="/teacher">
      <div className="p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#151E2B]">教师工作台</h1>
            <p className="mt-1 text-sm text-[#7B8794]">
              我的班级、课程管理和学生管理统一入口。
            </p>
          </div>
          <div className="rounded-lg border border-[#E5EAF0] bg-white px-4 py-3 text-sm text-[#151E2B]">
            {session?.name ?? "正在读取登录状态..."}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {teacherCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                href={card.href}
                className="rounded-xl border border-[#E5EAF0] bg-white p-5 hover:border-[#2386FF] hover:shadow-sm"
              >
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg"
                  style={{ background: `${card.color}1A`, color: card.color }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="text-base font-semibold text-[#151E2B]">{card.title}</div>
                <p className="mt-2 text-sm leading-6 text-[#7B8794]">{card.desc}</p>
              </Link>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border border-[#E5EAF0] bg-white p-5">
          <div className="mb-4 flex items-center gap-2 text-base font-semibold text-[#151E2B]">
            <GraduationCap className="h-5 w-5 text-[#2386FF]" />
            今日概览
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["班级", classCount === null ? "未接入" : String(classCount)],
              ["课程", courseCount === null ? "未接入" : String(courseCount)],
              ["学生", approvedStudents === null ? "未接入" : String(approvedStudents)],
              ["待处理", pendingApplications === null ? "未接入" : String(pendingApplications)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-[#F5F7F9] p-4">
                <div className="text-2xl font-bold text-[#151E2B]">{value}</div>
                <div className="mt-1 text-xs text-[#7B8794]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
