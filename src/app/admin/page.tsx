"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import { BookOpen, Database, Layers, ShieldCheck, Users } from "lucide-react";
import { DEMO_USERS, getSession, type SessionInfo } from "@/lib/auth/client";
import {
  listAllClassSummaries,
  listMembersForClass,
  subscribeClassStore,
  type ClassSummary,
  type DemoClassMember,
} from "@/lib/classes/demo-class-store";

const statusText = {
  pending: "待审核",
  approved: "已加入",
  rejected: "已拒绝",
};

const statusClass = {
  pending: "bg-[#FFF8ED] text-[#A56316]",
  approved: "bg-[#F0FFF5] text-[#167A3E]",
  rejected: "bg-[#FFF5F5] text-[#B42318]",
};

export default function AdminPage() {
  const [session, setSessionState] = useState<SessionInfo | null>(null);
  const [classes, setClasses] = useState<ClassSummary[]>([]);

  useEffect(() => {
    const refresh = () => {
      setSessionState(getSession());
      setClasses(listAllClassSummaries());
    };
    refresh();
    window.addEventListener("al-session-change", refresh);
    const unsubscribeClassStore = subscribeClassStore(refresh);
    return () => {
      window.removeEventListener("al-session-change", refresh);
      unsubscribeClassStore();
    };
  }, []);

  const allMembers = classes.flatMap((item) => listMembersForClass(item.classInfo.id));
  const uniqueUsers = new Set([
    ...DEMO_USERS.map((item) => item.session.id),
    ...classes.map((item) => item.classInfo.teacherId),
    ...allMembers.map((item) => item.studentId),
  ]);
  const stats = [
    { label: "用户数量", value: uniqueUsers.size, icon: Users, color: "#2386FF" },
    { label: "班级数量", value: classes.length, icon: Layers, color: "#25D366" },
    { label: "课程数量", value: 36, icon: BookOpen, color: "#FF8C42" },
    { label: "资源数量", value: 214, icon: Database, color: "#7C5CFF" },
  ];

  return (
    <Layout activeMenu="/admin">
      <div className="p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#151E2B]">管理员 Dashboard</h1>
            <p className="mt-1 text-sm text-[#7B8794]">
              Demo 数据概览，不连接真实后端；班级与申请来自当前浏览器 localStorage。
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#E5EAF0] bg-white px-4 py-3 text-sm text-[#151E2B]">
            <ShieldCheck className="h-4 w-4 text-[#2386FF]" />
            {session?.name ?? "管理员 Demo"}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {stats.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-xl border border-[#E5EAF0] bg-white p-5">
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg"
                  style={{ background: `${item.color}1A`, color: item.color }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="text-2xl font-bold text-[#151E2B]">{item.value}</div>
                <div className="mt-1 text-xs text-[#7B8794]">{item.label}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border border-[#E5EAF0] bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-[#151E2B]">管理入口</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/courses"
              className="rounded-lg bg-[#2386FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E76E6]"
            >
              课程管理
            </Link>
            <Link
              href="/admin/dashboard"
              className="rounded-lg border border-[#E5EAF0] px-4 py-2 text-sm font-medium text-[#151E2B] hover:bg-[#F5F7F9]"
            >
              旧版审核工作台
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[#E5EAF0] bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#151E2B]">班级概览</h2>
              <p className="mt-1 text-xs text-[#7B8794]">
                查看全部 Demo 班级、教师和成员申请状态。
              </p>
            </div>
            <div className="text-xs text-[#7B8794]">成员记录 {allMembers.length}</div>
          </div>

          {classes.length === 0 ? (
            <div className="rounded-lg bg-[#F5F7F9] px-4 py-6 text-center text-sm text-[#7B8794]">
              暂无 Demo 班级。
            </div>
          ) : (
            <div className="space-y-4">
              {classes.map((item) => {
                const members = listMembersForClass(item.classInfo.id);
                return (
                  <section
                    key={item.classInfo.id}
                    className="rounded-lg border border-[#E5EAF0] bg-[#F8FAFC] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#151E2B]">
                          {item.classInfo.name}
                        </div>
                        <div className="mt-1 text-xs text-[#7B8794]">
                          ID：{item.classInfo.id} · 教师：{item.classInfo.teacherName}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-[#5B6B7B]">
                        <span className="rounded-md bg-white px-2.5 py-1">
                          已加入 {item.stats.approved}
                        </span>
                        <span className="rounded-md bg-white px-2.5 py-1">
                          待审核 {item.stats.pending}
                        </span>
                        <span className="rounded-md bg-white px-2.5 py-1">
                          已拒绝 {item.stats.rejected}
                        </span>
                      </div>
                    </div>

                    {members.length === 0 ? (
                      <div className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-[#7B8794]">
                        暂无成员申请。
                      </div>
                    ) : (
                      <div className="mt-3 overflow-hidden rounded-lg border border-[#E5EAF0] bg-white">
                        {members.map((member: DemoClassMember) => (
                          <div
                            key={member.id}
                            className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5EAF0] px-3 py-2 last:border-b-0"
                          >
                            <div>
                              <div className="text-sm text-[#151E2B]">{member.studentName}</div>
                              <div className="mt-0.5 text-xs text-[#7B8794]">
                                学生 ID：{member.studentId}
                              </div>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs ${statusClass[member.status]}`}
                            >
                              {statusText[member.status]}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
