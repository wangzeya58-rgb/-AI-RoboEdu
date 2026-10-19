"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import { BookOpen, Database, Layers, ShieldCheck, Users } from "lucide-react";
import { DEMO_USERS } from "@/lib/auth/client";
import { useCurrentSession } from "@/lib/auth/use-current-session";
import { isDemoSessionId } from "@/lib/classes/formal-class-api";
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
  const { session, ready, error, retry } = useCurrentSession();
  const [classes, setClasses] = useState<ClassSummary[]>([]);

  useEffect(() => {
    if (!session || !isDemoSessionId(session.id)) return;
    const refresh = () => {
      setClasses(listAllClassSummaries());
    };
    refresh();
    window.addEventListener("al-session-change", refresh);
    const unsubscribeClassStore = subscribeClassStore(refresh);
    return () => {
      window.removeEventListener("al-session-change", refresh);
      unsubscribeClassStore();
    };
  }, [session]);

  if (!ready) return <Layout activeMenu="/admin"><p className="p-6" role="status">正在读取登录状态...</p></Layout>;
  if (error) return <Layout activeMenu="/admin"><p className="p-6" role="alert">{error} <button onClick={retry}>重试</button></p></Layout>;
  if (!session) return <Layout activeMenu="/admin"><Link href="/login?next=/admin">请重新登录</Link></Layout>;
  if (session.role !== "admin") return <Layout activeMenu="/admin"><p role="alert">无权访问管理员后台。</p></Layout>;
  if (!isDemoSessionId(session.id)) return <FormalAdminOverview name={session.name} />;

  const allMembers = classes.flatMap((item) => listMembersForClass(item.classInfo.id));
  const uniqueUsers = new Set([
    ...DEMO_USERS.map((item) => item.session.id),
    ...classes.map((item) => item.classInfo.teacherId),
    ...allMembers.map((item) => item.studentId),
  ]);
  const stats = [
    { label: "用户数量", value: uniqueUsers.size, icon: Users, color: "#2386FF" },
    { label: "班级数量", value: classes.length, icon: Layers, color: "#25D366" },
    { label: "课程数量", value: "未接入", icon: BookOpen, color: "#FF8C42" },
    { label: "资源数量", value: "未接入", icon: Database, color: "#7C5CFF" },
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
              管理概览
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

interface AdminOverview {
  users: number; classes: number; courses: number; resources: null;
  classItems: Array<{ id: string; name: string; teacherName: string }>;
}

function FormalAdminOverview({ name }: { name: string }) {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setError(null);
    setData(null);
    const timeout = setTimeout(() => controller.abort(), 15000);
    fetch("/api/v1/admin/overview", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) { window.location.assign("/login?next=/admin"); return; }
        const body = await response.json() as { success: boolean; data?: AdminOverview; message?: string };
        if (!response.ok || !body.success || !body.data) throw new Error(body.message ?? "统计读取失败");
        if (active) setData(body.data);
      })
      .catch((cause: unknown) => { if (active) setError(controller.signal.aborted ? "统计读取超时，请重试。" : cause instanceof Error ? cause.message : "统计读取失败"); })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [revision]);
  return <Layout activeMenu="/admin"><div className="space-y-6 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">管理员 Dashboard</h1><span>{name}</span></div>
    <p className="text-sm text-gray-500">正式数据概览。资源统计尚未接入。</p>
    {error ? <p role="alert">{error} <button onClick={() => setRevision((value) => value + 1)} className="text-blue-600">重试</button></p> : !data ? <p role="status">正在加载统计...</p> : <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
        ["用户数量", data.users], ["班级数量", data.classes], ["课程数量", data.courses], ["资源数量", "未接入"],
      ].map(([label, value]) => <div key={label} className="rounded-lg border bg-white p-5"><div className="text-2xl font-semibold">{value}</div><div className="mt-2 text-sm text-gray-500">{label}</div></div>)}</div>
      <section className="space-y-3"><h2 className="font-semibold">班级概览</h2>{data.classItems.length === 0 ? <p>暂无正式班级。</p> : data.classItems.map((item) => <div key={item.id} className="border-b py-3"><span>{item.name}</span><span className="ml-4 text-sm text-gray-500">教师：{item.teacherName}</span></div>)}</section>
    </>}
    <Link href="/admin/courses" className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white">课程管理</Link>
  </div></Layout>;
}
