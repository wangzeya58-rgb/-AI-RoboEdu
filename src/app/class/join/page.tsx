"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import { AlertCircle, CheckCircle2, Clock3, Users, XCircle } from "lucide-react";
import { getSession, type SessionInfo } from "@/lib/auth/client";
import { ROLES } from "@/lib/auth/roles";
import {
  FormalClassApiError,
  isDemoSessionId,
  listFormalStudentMemberships,
  requestFormalJoinClass,
  type FormalStudentMembership,
} from "@/lib/classes/formal-class-api";
import {
  requestJoinClass,
  listMembershipsForStudent as listDemoMembershipsForStudent,
  subscribeClassStore,
  type DemoClass,
  type DemoClassMember,
} from "@/lib/classes/demo-class-store";

type MembershipStatus = DemoClassMember["status"];

type StudentMembershipView =
  | { mode: "demo"; member: DemoClassMember; classInfo: DemoClass | null }
  | { mode: "formal"; member: FormalStudentMembership; classInfo: FormalStudentMembership["class"] };

const statusText = {
  pending: "待教师审核",
  approved: "已加入",
  rejected: "已拒绝",
};

const statusClass = {
  pending: "border-[#FFE2B8] bg-[#FFF8ED] text-[#A56316]",
  approved: "border-[#B7E8C9] bg-[#F0FFF5] text-[#167A3E]",
  rejected: "border-[#FFD0D0] bg-[#FFF5F5] text-[#B42318]",
};

function StatusIcon({ status }: { status: MembershipStatus }) {
  if (status === "approved") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "rejected") return <XCircle className="h-4 w-4" />;
  return <Clock3 className="h-4 w-4" />;
}

export default function JoinClassPage() {
  const [session, setSessionState] = useState<SessionInfo | null>(null);
  const [classId, setClassId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "warning" | "error">("success");
  const [memberships, setMemberships] = useState<StudentMembershipView[]>([]);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestSeq = useRef(0);

  const loadMemberships = useCallback(async (current: SessionInfo | null) => {
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;

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

    setIsLoadingMemberships(true);
    try {
      const items = await listFormalStudentMemberships();
      if (requestSeq.current !== seq) return;
      setMemberships(items.map((member) => ({
        mode: "formal",
        member,
        classInfo: member.class,
      })));
    } catch (error) {
      if (requestSeq.current !== seq) return;
      setMemberships([]);
      setMessageType("error");
      setMessage(formatApiError(error, "无法读取班级申请状态，请稍后重试。"));
    } finally {
      if (requestSeq.current === seq) setIsLoadingMemberships(false);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      setMessageType("warning");
      setMessage("请先登录学生账号，再提交加入班级申请。");
      return;
    }
    if (session.role !== ROLES.STUDENT) {
      setMessageType("error");
      setMessage("仅学生账号可以提交加入班级申请。");
      return;
    }

    const value = classId.trim().toUpperCase();
    if (!value) {
      setMessageType("warning");
      setMessage("请输入班级 ID。");
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    if (!isDemoSessionId(session.id)) {
      try {
        await requestFormalJoinClass(value);
        setClassId(value);
        setMessageType("success");
        setMessage("已提交加入申请，等待教师审核。");
        await loadMemberships(session);
      } catch (error) {
        setMessageType(error instanceof FormalClassApiError && error.status === 409 ? "warning" : "error");
        setMessage(formatApiError(error, "提交申请失败，请稍后重试。"));
        await loadMemberships(session);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const result = requestJoinClass(value, session);
    setClassId(value);
    await loadMemberships(session);

    if (result.status === "created") {
      setMessageType("success");
      setMessage(`已提交 ${result.classInfo.name} 的加入申请，等待教师审核。`);
    } else if (result.status === "not_found") {
      setMessageType("error");
      setMessage(`未找到班级 ${value}，请确认教师提供的班级 ID。`);
    } else if (result.status === "already_pending") {
      setMessageType("warning");
      setMessage(`${result.classInfo.name} 的申请已在审核中，请勿重复提交。`);
    } else if (result.status === "already_approved") {
      setMessageType("success");
      setMessage(`你已经加入 ${result.classInfo.name}。`);
    } else {
      setMessageType("error");
      setMessage(`${result.classInfo.name} 的申请已被拒绝，Demo 阶段不重复提交。`);
    }
    setIsSubmitting(false);
  }

  const canSubmit = session?.role === ROLES.STUDENT;
  const isFormalMode = Boolean(session && !isDemoSessionId(session.id));

  return (
    <Layout activeMenu="/class/join">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#151E2B]">加入班级</h1>
          <p className="mt-1 text-sm text-[#7B8794]">
            {isFormalMode
              ? "正式模式：入班申请提交到服务端，教师审核通过后生效。"
              : "Demo 模式仅保存到当前浏览器 localStorage。"}
          </p>
        </div>

        <div className="max-w-xl rounded-xl border border-[#E5EAF0] bg-white p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#EAF3FF] text-[#2386FF]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#151E2B]">
                {session ? session.name : "学生体验用户"}
              </div>
              <div className="text-xs text-[#7B8794]">
                {session
                  ? session.role === ROLES.STUDENT
                    ? isDemoSessionId(session.id)
                      ? "学生申请会保存到当前浏览器 Demo 数据。"
                      : "学生申请会提交到正式班级服务。"
                    : "当前角色不能提交学生入班申请。"
                  : "请先登录学生 Demo 账号。"}
              </div>
            </div>
          </div>

          {!session && (
            <div className="mb-4 rounded-lg border border-[#FFE2B8] bg-[#FFF8ED] px-3 py-2 text-xs text-[#A56316]">
              未登录用户需要先进入登录页，使用 student / 123456 后再申请加入班级。
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#5B6B7B]">
                班级码
              </label>
              <input
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
                placeholder="例如 CLS-TEACHER-001"
                disabled={!canSubmit || isSubmitting}
                className="w-full rounded-lg border border-[#E5EAF0] bg-[#F5F7F9] px-3 py-2.5 text-sm text-[#151E2B] outline-none focus:border-[#2386FF]"
              />
            </div>

            {message && (
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                  messageType === "success"
                    ? "border-[#B7E8C9] bg-[#F0FFF5] text-[#167A3E]"
                    : messageType === "warning"
                      ? "border-[#FFE2B8] bg-[#FFF8ED] text-[#A56316]"
                      : "border-[#FFD0D0] bg-[#FFF5F5] text-[#B42318]"
                }`}
              >
                {messageType === "error" ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {message}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                className="rounded-lg bg-[#2386FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E76E6] disabled:cursor-not-allowed disabled:bg-[#9CCBFF]"
              >
                {isSubmitting ? "提交中" : "提交申请"}
              </button>
              {!session && (
                <Link
                  href="/login"
                  className="rounded-lg border border-[#2386FF] px-4 py-2 text-sm font-medium text-[#2386FF] hover:bg-[#F0F7FF]"
                >
                  去登录
                </Link>
              )}
              <Link
                href="/"
                className="rounded-lg border border-[#E5EAF0] px-4 py-2 text-sm font-medium text-[#151E2B] hover:bg-[#F5F7F9]"
              >
                返回首页
              </Link>
            </div>
          </form>
        </div>

        {session?.role === ROLES.STUDENT && (
          <div className="mt-5 max-w-xl rounded-xl border border-[#E5EAF0] bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-[#151E2B]">我的申请状态</h2>
            {isLoadingMemberships ? (
              <div className="rounded-lg bg-[#F5F7F9] px-4 py-3 text-sm text-[#7B8794]">
                正在读取申请状态...
              </div>
            ) : memberships.length === 0 ? (
              <div className="rounded-lg bg-[#F5F7F9] px-4 py-3 text-sm text-[#7B8794]">
                暂无班级申请记录。
              </div>
            ) : (
              <div className="space-y-3">
                {memberships.map((item) => (
                  <div
                    key={item.member.id}
                    className="rounded-lg border border-[#E5EAF0] bg-[#F8FAFC] px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-[#151E2B]">
                          {item.classInfo?.name ?? "已删除班级"}
                        </div>
                        <div className="mt-1 text-xs text-[#7B8794]">
                          {item.mode === "formal" ? "班级码" : "班级 ID"}：
                          {item.mode === "formal" ? item.classInfo.classCode : item.member.classId}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${statusClass[item.member.status]}`}
                      >
                        <StatusIcon status={item.member.status} />
                        {statusText[item.member.status]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function formatApiError(error: unknown, fallback: string): string {
  if (error instanceof FormalClassApiError) {
    if (error.status === 401) return "登录已过期，请重新登录后再试。";
    if (error.status === 403) return "当前账号无权提交学生入班申请。";
    if (error.status === 400) return error.message || "班级码格式不正确。";
    if (error.status === 404) return "未找到该班级码对应的班级。";
    if (error.status === 409) return error.message || "已申请或已加入该班级。";
    return error.message || fallback;
  }
  return fallback;
}
