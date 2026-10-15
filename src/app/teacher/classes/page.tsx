"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import ClassLearningProgress from "@/components/course/ClassLearningProgress";
import {
  CheckCircle2,
  Clock3,
  Plus,
  Trash2,
  UserMinus,
  Users,
  XCircle,
} from "lucide-react";
import { getSession, type SessionInfo } from "@/lib/auth/client";
import { ROLES } from "@/lib/auth/roles";
import {
  createFormalClass,
  FormalClassApiError,
  getFormalClassDetail,
  isDemoSessionId,
  listFormalClassMembers,
  listFormalClasses,
  removeFormalClassMember,
  reviewFormalClassMember,
  type FormalClassDetail,
  type FormalClassMemberWithUser,
  type FormalClassSummary,
} from "@/lib/classes/formal-class-api";
import {
  createDemoClass,
  listClassesForTeacher,
  listMembersForClass,
  removeClassMember,
  reviewClassMember,
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
  pending: "border-[#FFE2B8] bg-[#FFF8ED] text-[#A56316]",
  approved: "border-[#B7E8C9] bg-[#F0FFF5] text-[#167A3E]",
  rejected: "border-[#FFD0D0] bg-[#FFF5F5] text-[#B42318]",
};

function StatusBadge({ status }: { status: DemoClassMember["status"] }) {
  const Icon = status === "approved" ? CheckCircle2 : status === "rejected" ? XCircle : Clock3;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${statusClass[status]}`}>
      <Icon className="h-4 w-4" />
      {statusText[status]}
    </span>
  );
}

type ClassDataMode = "formal" | "demo";

interface TeacherClassView {
  mode: ClassDataMode;
  id: string;
  name: string;
  description: string;
  createdAt: string;
  stats: {
    approved: number;
    pending: number;
    rejected: number;
    total: number;
  };
}

function mapDemoClass(item: ClassSummary): TeacherClassView {
  return {
    mode: "demo",
    id: item.classInfo.id,
    name: item.classInfo.name,
    description: item.classInfo.description,
    createdAt: item.classInfo.createdAt,
    stats: item.stats,
  };
}

function mapFormalClass(item: FormalClassSummary): TeacherClassView {
  return {
    mode: "formal",
    id: item.id,
    name: item.name,
    description: "",
    createdAt: item.createdAt,
    stats: {
      approved: item.memberCount,
      pending: 0,
      rejected: 0,
      total: item.memberCount,
    },
  };
}

function formatApiError(error: unknown): string {
  if (error instanceof FormalClassApiError) {
    if (error.status === 401) return "登录已过期，请重新登录后再试。";
    if (error.status === 403) return "当前账号无权操作该班级。";
    if (error.status === 400) return error.message || "班级名称不合法。";
    if (error.status === 404) return "班级不存在或已被删除。";
    return error.message || "班级服务暂不可用。";
  }
  return "网络异常，请检查连接后重试。";
}

export default function TeacherClassesPage() {
  const [session, setSessionState] = useState<SessionInfo | null>(null);
  const [classes, setClasses] = useState<TeacherClassView[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [className, setClassName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [dataMode, setDataMode] = useState<ClassDataMode>("demo");
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [classError, setClassError] = useState<string | null>(null);
  const [formalDetail, setFormalDetail] = useState<FormalClassDetail | null>(null);
  const [formalMembers, setFormalMembers] = useState<FormalClassMemberWithUser[]>([]);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [actionMemberId, setActionMemberId] = useState<string | null>(null);

  const loadClasses = useCallback(async (current: SessionInfo | null) => {
    setMessage(null);
    setClassError(null);
    setFormalDetail(null);
    setFormalMembers([]);

    if (current?.role !== ROLES.TEACHER) {
      setClasses([]);
      setSelectedClassId(null);
      setDataMode("demo");
      return;
    }

    if (isDemoSessionId(current.id)) {
      const nextClasses = listClassesForTeacher(current.id).map(mapDemoClass);
      setDataMode("demo");
      setClasses(nextClasses);
      setSelectedClassId((currentSelected) => {
        if (currentSelected && nextClasses.some((item) => item.id === currentSelected)) {
          return currentSelected;
        }
        return nextClasses[0]?.id ?? null;
      });
      return;
    }

    setDataMode("formal");
    setIsLoadingClasses(true);
    try {
      const nextClasses = (await listFormalClasses()).map(mapFormalClass);
      setClasses(nextClasses);
      setSelectedClassId((currentSelected) => {
        if (currentSelected && nextClasses.some((item) => item.id === currentSelected)) {
          return currentSelected;
        }
        return nextClasses[0]?.id ?? null;
      });
    } catch (error) {
      setClasses([]);
      setSelectedClassId(null);
      setClassError(formatApiError(error));
    } finally {
      setIsLoadingClasses(false);
    }
  }, []);

  useEffect(() => {
    const refresh = () => {
      const current = getSession();
      setSessionState(current);
      void loadClasses(current);
    };

    refresh();
    window.addEventListener("al-session-change", refresh);
    const unsubscribeClassStore = subscribeClassStore(refresh);
    return () => {
      window.removeEventListener("al-session-change", refresh);
      unsubscribeClassStore();
    };
  }, [loadClasses]);

  useEffect(() => {
    if (dataMode !== "formal" || !selectedClassId) {
      setFormalDetail(null);
      setFormalMembers([]);
      setDetailError(null);
      setMemberError(null);
      setIsLoadingDetail(false);
      setIsLoadingMembers(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setIsLoadingDetail(true);
    setIsLoadingMembers(true);
    setDetailError(null);
    setMemberError(null);
    getFormalClassDetail(selectedClassId)
      .then((detail) => {
        if (!cancelled) setFormalDetail(detail);
      })
      .catch((error) => {
        if (!cancelled) {
          setFormalDetail(null);
          setDetailError(formatApiError(error));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetail(false);
      });
    listFormalClassMembers(selectedClassId, controller.signal)
      .then((members) => {
        if (cancelled) return;
        setFormalMembers(members);
        updateFormalStats(selectedClassId, members);
      })
      .catch((error) => {
        if (!cancelled && !controller.signal.aborted) {
          setFormalMembers([]);
          setMemberError(formatApiError(error));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMembers(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [dataMode, selectedClassId]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );
  const selectedMembers =
    dataMode === "demo" && selectedClassId ? listMembersForClass(selectedClassId) : [];
  const pendingMembers = selectedMembers.filter((item) => item.status === "pending");
  const approvedMembers = selectedMembers.filter((item) => item.status === "approved");
  const rejectedMembers = selectedMembers.filter((item) => item.status === "rejected");
  const formalPendingMembers = formalMembers.filter((item) => item.status === "pending");
  const formalApprovedMembers = formalMembers.filter((item) => item.status === "approved");
  const formalRejectedMembers = formalMembers.filter((item) => item.status === "rejected");

  function refreshForTeacher(current: SessionInfo) {
    void loadClasses(current);
  }

  async function handleCreateClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || session.role !== ROLES.TEACHER) {
      setMessage("请使用教师账号创建班级。");
      return;
    }

    const name = className.trim();
    if (!name) {
      setMessage("请输入班级名称。");
      return;
    }

    if (isCreatingClass) return;
    setIsCreatingClass(true);
    setMessage(null);

    if (!isDemoSessionId(session.id)) {
      try {
        const created = await createFormalClass(name);
        setClassName("");
        setDescription("");
        setSelectedClassId(created.id);
        await loadClasses(session);
        setSelectedClassId(created.id);
        setMessage(
          description.trim()
            ? "已创建正式班级。班级描述将在后续正式字段接入后保存。"
            : `已创建正式班级 ${created.name}。`
        );
      } catch (error) {
        setMessage(formatApiError(error));
      } finally {
        setIsCreatingClass(false);
      }
      return;
    }

    const created = createDemoClass({
      name,
      description,
      teacher: session,
    });

    setClassName("");
    setDescription("");
    setSelectedClassId(created.id);
    setMessage(`已创建班级 ${created.name}，班级 ID：${created.id}`);
    refreshForTeacher(session);
    setIsCreatingClass(false);
  }

  function updateFormalStats(classId: string, members: FormalClassMemberWithUser[]) {
    const stats = {
      approved: members.filter((item) => item.status === "approved").length,
      pending: members.filter((item) => item.status === "pending").length,
      rejected: members.filter((item) => item.status === "rejected").length,
      total: members.length,
    };
    setClasses((items) => items.map((item) => (
      item.id === classId ? { ...item, stats } : item
    )));
  }

  async function refreshFormalMembers(classId: string) {
    setIsLoadingMembers(true);
    setMemberError(null);
    try {
      const members = await listFormalClassMembers(classId);
      setFormalMembers(members);
      updateFormalStats(classId, members);
    } catch (error) {
      setFormalMembers([]);
      setMemberError(formatApiError(error));
    } finally {
      setIsLoadingMembers(false);
    }
  }

  async function handleReview(memberId: string, status: "approved" | "rejected") {
    if (dataMode === "formal") {
      if (!selectedClassId || actionMemberId) return;
      setActionMemberId(`${memberId}:${status}`);
      setMessage(null);
      try {
        await reviewFormalClassMember(selectedClassId, memberId, status);
        await refreshFormalMembers(selectedClassId);
        setMessage(status === "approved" ? "已通过学生申请。" : "已拒绝学生申请。");
      } catch (error) {
        setMessage(formatApiError(error));
      } finally {
        setActionMemberId(null);
      }
      return;
    }
    if (!session) return;
    const result = reviewClassMember(memberId, session, status);
    setMessage(
      result.status === "updated"
        ? status === "approved"
          ? "已通过学生申请。"
          : "已拒绝学生申请。"
        : result.status === "forbidden"
          ? "当前教师无权操作该班级。"
          : "未找到申请记录。"
    );
    refreshForTeacher(session);
  }

  async function handleRemove(memberId: string) {
    if (!window.confirm("确认移除该学生或记录吗？")) return;
    if (dataMode === "formal") {
      if (!selectedClassId || actionMemberId) return;
      setActionMemberId(`${memberId}:remove`);
      setMessage(null);
      try {
        await removeFormalClassMember(selectedClassId, memberId);
        await refreshFormalMembers(selectedClassId);
        setMessage("已移除学生。");
      } catch (error) {
        setMessage(formatApiError(error));
      } finally {
        setActionMemberId(null);
      }
      return;
    }
    if (!session) return;
    const result = removeClassMember(memberId, session);
    setMessage(
      result.status === "updated"
        ? "已移除学生。"
        : result.status === "forbidden"
          ? "当前教师无权操作该班级。"
          : "未找到学生记录。"
    );
    refreshForTeacher(session);
  }

  const isTeacher = session?.role === ROLES.TEACHER;

  return (
    <Layout activeMenu="/teacher/classes" className="max-md:[&>aside]:hidden [&>main]:min-w-0">
      <div className="p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#151E2B]">我的班级</h1>
            <p className="mt-1 text-sm text-[#7B8794]">
              {dataMode === "formal"
                ? "正式模式：班级数据来自 PostgreSQL，权限由服务端 Session 校验。"
                : "Demo 模式：班级、申请和成员状态仅保存到当前浏览器 localStorage。"}
            </p>
          </div>
          <Link
            href="/teacher"
            className="rounded-lg border border-[#E5EAF0] bg-white px-4 py-2 text-sm font-medium text-[#151E2B] hover:bg-[#F5F7F9]"
          >
            返回教师工作台
          </Link>
        </div>

        {!session && (
          <div className="mb-5 rounded-xl border border-[#FFE2B8] bg-[#FFF8ED] p-4 text-sm text-[#A56316]">
            请先登录 teacher / 123456 后管理班级。
          </div>
        )}

        {session && !isTeacher && (
          <div className="mb-5 rounded-xl border border-[#FFD0D0] bg-[#FFF5F5] p-4 text-sm text-[#B42318]">
            当前账号不是教师，不能创建或审核班级。
          </div>
        )}

        {isTeacher && (
          <form
            onSubmit={handleCreateClass}
            className="mb-5 rounded-xl border border-[#E5EAF0] bg-white p-5"
          >
            <div className="mb-4 flex items-center gap-2 text-base font-semibold text-[#151E2B]">
              <Plus className="h-5 w-5 text-[#2386FF]" />
              创建班级
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_1.2fr_auto]">
              <input
                value={className}
                onChange={(event) => setClassName(event.target.value)}
                placeholder="班级名称"
                className="rounded-lg border border-[#E5EAF0] bg-[#F5F7F9] px-3 py-2.5 text-sm text-[#151E2B] outline-none focus:border-[#2386FF]"
              />
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="班级描述（可选）"
                className="rounded-lg border border-[#E5EAF0] bg-[#F5F7F9] px-3 py-2.5 text-sm text-[#151E2B] outline-none focus:border-[#2386FF]"
              />
              <button
                type="submit"
                disabled={isCreatingClass}
                className="rounded-lg bg-[#2386FF] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1E76E6] disabled:cursor-not-allowed disabled:bg-[#9CCBFF]"
              >
                {isCreatingClass ? "创建中" : "创建"}
              </button>
            </div>
            {message && (
              <div className="mt-3 rounded-lg bg-[#F5F7F9] px-3 py-2 text-xs text-[#5B6B7B]">
                {message}
              </div>
            )}
          </form>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-xl border border-[#E5EAF0] bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#151E2B]">班级列表</h2>
              <div className="flex items-center gap-3">
                {isTeacher && dataMode === "formal" && (
                  <button
                    type="button"
                    onClick={() => void loadClasses(session)}
                    className="rounded-lg border border-[#E5EAF0] px-3 py-1.5 text-xs font-medium text-[#151E2B] hover:bg-[#F5F7F9]"
                  >
                    重试
                  </button>
                )}
                <Users className="h-4 w-4 text-[#2386FF]" />
              </div>
            </div>

            {isLoadingClasses ? (
              <div className="rounded-lg bg-[#F5F7F9] px-4 py-6 text-center text-sm text-[#7B8794]">
                正在加载班级...
              </div>
            ) : classError ? (
              <div className="rounded-lg border border-[#FFD0D0] bg-[#FFF5F5] px-4 py-4 text-sm text-[#B42318]">
                {classError}
              </div>
            ) : classes.length === 0 ? (
              <div className="rounded-lg bg-[#F5F7F9] px-4 py-6 text-center text-sm text-[#7B8794]">
                暂无班级，先创建一个班级。
              </div>
            ) : (
              <div className="space-y-3">
                {classes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedClassId(item.id)}
                    className={`w-full rounded-lg border p-4 text-left transition ${
                      selectedClassId === item.id
                        ? "border-[#2386FF] bg-[#F0F7FF]"
                        : "border-[#E5EAF0] bg-[#F8FAFC] hover:border-[#2386FF]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-[#151E2B]">
                          {item.name}
                        </div>
                        <div className="mt-1 text-xs text-[#7B8794]">
                          班级 ID：{item.id}
                        </div>
                      </div>
                      <div className="text-right text-xs text-[#7B8794]">
                        <div>学生 {item.stats.approved}</div>
                        <div>待审核 {item.stats.pending}</div>
                      </div>
                    </div>
                    {item.description && (
                      <p className="mt-3 text-xs leading-5 text-[#5B6B7B]">
                        {item.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[#E5EAF0] bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#151E2B]">班级详情</h2>
                <p className="mt-1 text-xs text-[#7B8794]">
                  {selectedClass
                    ? `${selectedClass.name} · ${selectedClass.id}`
                    : "请选择一个班级"}
                </p>
              </div>
              {selectedClass && (
                <div className="flex gap-2 text-xs text-[#5B6B7B]">
                  <span className="rounded-lg bg-[#F5F7F9] px-2.5 py-1">
                    已加入 {selectedClass.stats.approved}
                  </span>
                  <span className="rounded-lg bg-[#FFF8ED] px-2.5 py-1">
                    待审核 {selectedClass.stats.pending}
                  </span>
                </div>
              )}
            </div>

            {!selectedClass ? (
              <div className="rounded-lg bg-[#F5F7F9] px-4 py-6 text-center text-sm text-[#7B8794]">
                暂无可查看的班级详情。
              </div>
            ) : dataMode === "formal" ? (
              <div className="space-y-5">
                {(isLoadingDetail || isLoadingMembers) && (
                  <div className="rounded-lg bg-[#F5F7F9] px-4 py-3 text-sm text-[#7B8794]">
                    正在加载班级详情...
                  </div>
                )}
                {(detailError || memberError) && (
                  <div className="rounded-lg border border-[#FFD0D0] bg-[#FFF5F5] px-4 py-3 text-sm text-[#B42318]">
                    {detailError ?? memberError}
                  </div>
                )}
                <div className="rounded-lg border border-[#E5EAF0] bg-[#F8FAFC] p-4">
                  <div className="text-sm font-semibold text-[#151E2B]">
                    {formalDetail?.name ?? selectedClass.name}
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-[#5B6B7B] sm:grid-cols-2">
                    <div>班级码：{formalDetail?.classCode ?? selectedClass.id}</div>
                    <div>学生数：{selectedClass.stats.approved}</div>
                    <div>
                      创建时间：
                      {new Date(formalDetail?.createdAt ?? selectedClass.createdAt).toLocaleString()}
                    </div>
                    <div>数据来源：PostgreSQL</div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold text-[#151E2B]">待审核申请</h3>
                  {formalPendingMembers.length === 0 ? (
                    <div className="rounded-lg bg-[#F5F7F9] px-4 py-3 text-sm text-[#7B8794]">
                      暂无待审核申请。
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {formalPendingMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E5EAF0] px-4 py-3"
                        >
                          <div>
                            <div className="text-sm font-medium text-[#151E2B]">
                              {member.user.name}
                            </div>
                            <div className="mt-1 text-xs text-[#7B8794]">
                              申请时间：{new Date(member.createdAt).toLocaleString()} · 账号：{member.user.username}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleReview(member.id, "approved")}
                              disabled={Boolean(actionMemberId)}
                              className="rounded-lg bg-[#25D366] px-3 py-2 text-xs font-medium text-white hover:bg-[#20BE5B] disabled:cursor-not-allowed disabled:bg-[#9DDDB2]"
                            >
                              {actionMemberId === `${member.id}:approved` ? "处理中" : "通过"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleReview(member.id, "rejected")}
                              disabled={Boolean(actionMemberId)}
                              className="rounded-lg border border-[#FFD0D0] px-3 py-2 text-xs font-medium text-[#B42318] hover:bg-[#FFF5F5] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {actionMemberId === `${member.id}:rejected` ? "处理中" : "拒绝"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold text-[#151E2B]">学生列表</h3>
                  {formalApprovedMembers.length === 0 ? (
                    <div className="rounded-lg bg-[#F5F7F9] px-4 py-3 text-sm text-[#7B8794]">
                      暂无已加入学生。
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {formalApprovedMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E5EAF0] px-4 py-3"
                        >
                          <div>
                            <div className="text-sm font-medium text-[#151E2B]">
                              {member.user.name}
                            </div>
                            <div className="mt-1 text-xs text-[#7B8794]">
                              学生账号：{member.user.username}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleRemove(member.id)}
                            disabled={Boolean(actionMemberId)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E5EAF0] px-3 py-2 text-xs font-medium text-[#B42318] hover:bg-[#FFF5F5] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <UserMinus className="h-4 w-4" />
                            {actionMemberId === `${member.id}:remove` ? "移除中" : "移除"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {formalRejectedMembers.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-[#151E2B]">已拒绝记录</h3>
                    <div className="space-y-2">
                      {formalRejectedMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E5EAF0] px-4 py-3"
                        >
                          <div>
                            <div className="text-sm font-medium text-[#151E2B]">
                              {member.user.name}
                            </div>
                            <div className="mt-1 text-xs text-[#7B8794]">
                              学生账号：{member.user.username}
                            </div>
                          </div>
                          <StatusBadge status={member.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <ClassLearningProgress key={selectedClass.id} classId={selectedClass.id} />
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-[#151E2B]">待审核申请</h3>
                  {pendingMembers.length === 0 ? (
                    <div className="rounded-lg bg-[#F5F7F9] px-4 py-3 text-sm text-[#7B8794]">
                      暂无待审核申请。
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pendingMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E5EAF0] px-4 py-3"
                        >
                          <div>
                            <div className="text-sm font-medium text-[#151E2B]">
                              {member.studentName}
                            </div>
                            <div className="mt-1 text-xs text-[#7B8794]">
                              申请时间：{new Date(member.requestedAt).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleReview(member.id, "approved")}
                              className="rounded-lg bg-[#25D366] px-3 py-2 text-xs font-medium text-white hover:bg-[#20BE5B]"
                            >
                              通过
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleReview(member.id, "rejected")}
                              className="rounded-lg border border-[#FFD0D0] px-3 py-2 text-xs font-medium text-[#B42318] hover:bg-[#FFF5F5]"
                            >
                              拒绝
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold text-[#151E2B]">学生列表</h3>
                  {approvedMembers.length === 0 ? (
                    <div className="rounded-lg bg-[#F5F7F9] px-4 py-3 text-sm text-[#7B8794]">
                      暂无已加入学生。
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {approvedMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E5EAF0] px-4 py-3"
                        >
                          <div>
                            <div className="text-sm font-medium text-[#151E2B]">
                              {member.studentName}
                            </div>
                            <div className="mt-1 text-xs text-[#7B8794]">
                              学生 ID：{member.studentId}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleRemove(member.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E5EAF0] px-3 py-2 text-xs font-medium text-[#B42318] hover:bg-[#FFF5F5]"
                          >
                            <UserMinus className="h-4 w-4" />
                            移除
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {rejectedMembers.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-[#151E2B]">已拒绝记录</h3>
                    <div className="space-y-2">
                      {rejectedMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E5EAF0] px-4 py-3"
                        >
                          <div>
                            <div className="text-sm font-medium text-[#151E2B]">
                              {member.studentName}
                            </div>
                            <div className="mt-1 text-xs text-[#7B8794]">
                              审核时间：
                              {member.reviewedAt
                                ? new Date(member.reviewedAt).toLocaleString()
                                : "未记录"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={member.status} />
                            <button
                              type="button"
                              onClick={() => void handleRemove(member.id)}
                              className="rounded-lg p-2 text-[#B42318] hover:bg-[#FFF5F5]"
                              title="删除记录"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
}
