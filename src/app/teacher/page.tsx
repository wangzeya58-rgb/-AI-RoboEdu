"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import { BookOpen, GraduationCap, Users, UserRoundCheck } from "lucide-react";
import { getSession, type SessionInfo } from "@/lib/auth/client";
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
    desc: "建设课程、上传资源、进入课堂播放。",
    href: "/course/manage",
    icon: BookOpen,
    color: "#25D366",
  },
  {
    title: "学生管理",
    desc: "Demo 阶段展示班级学生概览。",
    href: "/teacher/classes",
    icon: UserRoundCheck,
    color: "#FF8C42",
  },
];

export default function TeacherWorkspacePage() {
  const [session, setSessionState] = useState<SessionInfo | null>(null);
  const [classCount, setClassCount] = useState(0);
  const [approvedStudents, setApprovedStudents] = useState(0);
  const [pendingApplications, setPendingApplications] = useState(0);

  const loadOverview = useCallback(async (current: SessionInfo | null) => {
    if (current?.role !== ROLES.TEACHER) {
      setClassCount(0);
      setApprovedStudents(0);
      setPendingApplications(0);
      return;
    }

    if (isDemoSessionId(current.id)) {
      const classes = listClassesForTeacher(current.id);
      setClassCount(classes.length);
      setApprovedStudents(classes.reduce((sum, item) => sum + item.stats.approved, 0));
      setPendingApplications(classes.reduce((sum, item) => sum + item.stats.pending, 0));
      return;
    }

    try {
      const classes: FormalClassSummary[] = await listFormalClasses();
      const memberGroups = await Promise.all(
        classes.map((item) => listFormalClassMembers(item.id).catch(() => [])),
      );
      setClassCount(classes.length);
      setApprovedStudents(memberGroups.reduce(
        (sum, members) => sum + members.filter((member) => member.status === "approved").length,
        0,
      ));
      setPendingApplications(memberGroups.reduce(
        (sum, members) => sum + members.filter((member) => member.status === "pending").length,
        0,
      ));
    } catch {
      setClassCount(0);
      setApprovedStudents(0);
      setPendingApplications(0);
    }
  }, []);

  useEffect(() => {
    const refresh = () => {
      const current = getSession();
      setSessionState(current);
      void loadOverview(current);
    };
    refresh();
    window.addEventListener("al-session-change", refresh);
    const unsubscribeClassStore = subscribeClassStore(refresh);
    return () => {
      window.removeEventListener("al-session-change", refresh);
      unsubscribeClassStore();
    };
  }, [loadOverview]);

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
            {session?.name ?? "教师 Demo"}
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
              ["班级", String(classCount)],
              ["课程", "6"],
              ["学生", String(approvedStudents)],
              ["待处理", String(pendingApplications)],
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
