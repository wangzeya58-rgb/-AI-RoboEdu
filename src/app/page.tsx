"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import {
  BookOpen,
  ChevronRight,
  FlaskConical,
  Gamepad2,
  Lightbulb,
  LogIn,
  Rocket,
  Users,
} from "lucide-react";
import { getSession, type SessionInfo } from "@/lib/auth/client";
import { ROLES } from "@/lib/auth/roles";
import {
  isDemoSessionId,
  listFormalStudentMemberships,
  type FormalStudentMembership,
} from "@/lib/classes/formal-class-api";
import {
  listMembershipsForStudent as listDemoMembershipsForStudent,
  subscribeClassStore,
  type DemoClass,
  type DemoClassMember,
} from "@/lib/classes/demo-class-store";

type StudentMembershipView =
  | { mode: "demo"; member: DemoClassMember; classInfo: DemoClass | null }
  | { mode: "formal"; member: FormalStudentMembership; classInfo: FormalStudentMembership["class"] };

const studentCourses = [
  {
    title: "AI 小车视觉识别入门",
    desc: "认识摄像头、目标检测和课堂示例。",
    href: "/course/player",
  },
  {
    title: "巡线与传感器实践",
    desc: "学习传感器采集、路径判断和任务闭环。",
    href: "/teaching-resources",
  },
];

function QuickCard({
  href,
  icon: Icon,
  title,
  desc,
  colorClass,
}: {
  href: string;
  icon: typeof Rocket;
  title: string;
  desc: string;
  colorClass: string;
}) {
  return (
    <Link
      href={href}
      className="cursor-pointer rounded-lg bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
          <p className="mb-4 text-sm text-gray-500">{desc}</p>
          <span className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
            进入 <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const [session, setSessionState] = useState<SessionInfo | null>(null);
  const [memberships, setMemberships] = useState<StudentMembershipView[]>([]);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const loadMemberships = useCallback(async (current: SessionInfo | null) => {
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setMembershipError(null);

    if (current?.role !== ROLES.STUDENT) {
      setMemberships([]);
      return;
    }

    if (isDemoSessionId(current.id)) {
      setMemberships(
        listDemoMembershipsForStudent(current.id).map((item) => ({
          mode: "demo",
          ...item,
        })),
      );
      return;
    }

    try {
      const items = await listFormalStudentMemberships();
      if (requestSeq.current !== seq) return;
      setMemberships(items.map((member) => ({
        mode: "formal",
        member,
        classInfo: member.class,
      })));
    } catch {
      if (requestSeq.current !== seq) return;
      setMemberships([]);
      setMembershipError("无法读取班级状态，请稍后重试。");
    }
  }, []);

  useEffect(() => {
    const refresh = () => {
      const current = getSession();
      setSessionState(current);
      void loadMemberships(current);
    };
    refresh();
    window.addEventListener("al-session-change", refresh);
    const unsubscribeClassStore = subscribeClassStore(refresh);
    return () => {
      window.removeEventListener("al-session-change", refresh);
      unsubscribeClassStore();
    };
  }, [loadMemberships]);

  const isStudent = session?.role === ROLES.STUDENT;
  const approvedClasses = memberships.filter((item) => item.member.status === "approved");
  const pendingClasses = memberships.filter((item) => item.member.status === "pending");
  const rejectedClasses = memberships.filter((item) => item.member.status === "rejected");

  return (
    <Layout activeMenu="/">
      <div className="p-6">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-4 text-3xl font-bold text-gray-900">
              欢迎来到 AI RoboEdu 智能机器人教育平台
            </h1>
            <p className="text-gray-600">
              默认进入学生体验，登录后可按身份进入对应工作台。
            </p>
          </div>
          {!session && (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-[#2386FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E76E6]"
            >
              <LogIn className="h-4 w-4" />
              登录
            </Link>
          )}
        </div>

        {isStudent && (
          <section className="mb-8 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-xl border border-[#E5EAF0] bg-white p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#FFF4E8] text-[#FF8C42]">
                  {session.name.slice(0, 1)}
                </div>
                <div>
                  <div className="text-base font-semibold text-[#151E2B]">{session.name}</div>
                  <div className="text-xs text-[#7B8794]">角色：学生 · 账号：{session.username}</div>
                </div>
              </div>
              <Link
                href="/class/join"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2386FF] px-3 py-2 text-sm font-medium text-[#2386FF] hover:bg-[#F0F7FF]"
              >
                <Users className="h-4 w-4" />
                加入班级
              </Link>
            </div>

            <div className="rounded-xl border border-[#E5EAF0] bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#151E2B]">我的班级</h2>
                <Users className="h-4 w-4 text-[#2386FF]" />
              </div>
              {approvedClasses.length === 0 ? (
                <div className="rounded-lg bg-[#F5F7F9] px-4 py-3 text-sm text-[#151E2B]">
                  {membershipError ?? "尚未加入班级"}
                </div>
              ) : (
                <div className="space-y-2">
                  {approvedClasses.map((item) => (
                    <div
                      key={item.member.id}
                      className="rounded-lg bg-[#F5F7F9] px-4 py-3 text-sm text-[#151E2B]"
                    >
                      <div className="font-medium">{item.classInfo?.name ?? "已删除班级"}</div>
                      <div className="mt-1 text-xs text-[#7B8794]">
                        {item.mode === "formal" ? "班级码" : "班级 ID"}：
                        {item.mode === "formal" ? item.classInfo.classCode : item.member.classId}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {(pendingClasses.length > 0 || rejectedClasses.length > 0) && (
                <div className="mt-3 space-y-2">
                  {pendingClasses.map((item) => (
                    <div
                      key={item.member.id}
                      className="rounded-lg border border-[#FFE2B8] bg-[#FFF8ED] px-4 py-2 text-xs text-[#A56316]"
                    >
                      {item.classInfo?.name ?? item.member.classId}：待教师审核
                    </div>
                  ))}
                  {rejectedClasses.map((item) => (
                    <div
                      key={item.member.id}
                      className="rounded-lg border border-[#FFD0D0] bg-[#FFF5F5] px-4 py-2 text-xs text-[#B42318]"
                    >
                      {item.classInfo?.name ?? item.member.classId}：申请已拒绝
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#E5EAF0] bg-white p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#151E2B]">我的课程</h2>
                <BookOpen className="h-4 w-4 text-[#2386FF]" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {studentCourses.map((course) => (
                  <Link
                    key={course.title}
                    href={course.href}
                    className="rounded-lg border border-[#E5EAF0] p-4 hover:border-[#2386FF] hover:bg-[#F8FAFC]"
                  >
                    <div className="text-sm font-semibold text-[#151E2B]">{course.title}</div>
                    <div className="mt-1 text-xs leading-5 text-[#7B8794]">{course.desc}</div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">快速入门</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <QuickCard
              href="/programming/source-code"
              icon={Rocket}
              title="我的程序"
              desc="管理小车源码库、Python 例程、固件程序等"
              colorClass="bg-blue-100 text-blue-600"
            />
            <QuickCard
              href="/car-control"
              icon={Gamepad2}
              title="控制平台"
              desc="连接实车控制主机，进行手动控制、视频监看与雷达观察"
              colorClass="bg-indigo-100 text-indigo-600"
            />
            <QuickCard
              href="/teaching-resources"
              icon={Lightbulb}
              title="教学资源"
              desc="查看视频课件、PDF 教案、实训手册等"
              colorClass="bg-yellow-100 text-yellow-600"
            />
            <QuickCard
              href="/training"
              icon={FlaskConical}
              title="AI 训练平台"
              desc="开始 AI 模型训练、管理数据集与模型"
              colorClass="bg-green-100 text-green-600"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-gray-900">平台功能</h2>
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="p-4 text-center">
                <div className="mb-2 text-2xl font-bold text-blue-600">100+</div>
                <div className="text-sm text-gray-500">教学课程</div>
              </div>
              <div className="p-4 text-center">
                <div className="mb-2 text-2xl font-bold text-green-600">50+</div>
                <div className="text-sm text-gray-500">AI 模型</div>
              </div>
              <div className="p-4 text-center">
                <div className="mb-2 text-2xl font-bold text-purple-600">1000+</div>
                <div className="text-sm text-gray-500">训练任务</div>
              </div>
              <div className="p-4 text-center">
                <div className="mb-2 text-2xl font-bold text-orange-600">500+</div>
                <div className="text-sm text-gray-500">活跃用户</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
