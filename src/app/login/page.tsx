"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  KeyRound,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  DEMO_USERS,
  getRoleHome,
  loginDemoUserWithServerSession,
  loginFormalUserWithStatus,
} from "@/lib/auth/client";
import { ROLES, type Role } from "@/lib/auth/roles";

const roleOptions: Array<{
  role: Role;
  label: string;
  icon: typeof UserRound;
  hint: string;
}> = [
  {
    role: ROLES.STUDENT,
    label: "学生",
    icon: UserRound,
    hint: "进入首页、班级和课程体验",
  },
  {
    role: ROLES.TEACHER,
    label: "老师",
    icon: GraduationCap,
    hint: "管理班级、课程和学生",
  },
  {
    role: ROLES.ADMIN,
    label: "管理员",
    icon: ShieldCheck,
    hint: "查看平台运营概览",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("student");
  const [password, setPassword] = useState("123456");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function quickFill(nextUsername: string) {
    setUsername(nextUsername);
    setPassword("123456");
    setErrorMsg(null);
  }

  function canFallbackToDemo(formalStatus: "invalid" | "unavailable"): boolean {
    if (formalStatus === "unavailable") return true;
    if (process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH === "true") return true;
    return process.env.NODE_ENV !== "production";
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    const formalResult = await loginFormalUserWithStatus(username, password);
    if (formalResult.status === "success") {
      router.replace(getRoleHome(formalResult.session.role));
      return;
    }

    const session = canFallbackToDemo(formalResult.status)
      ? await loginDemoUserWithServerSession(username, password)
      : null;
    if (!session) {
      setSubmitting(false);
      setErrorMsg(
        formalResult.status === "unavailable"
          ? "正式认证服务暂不可用；可使用 Demo 用户继续体验。"
          : formalResult.message
      );
      return;
    }

    router.replace(getRoleHome(session.role));
  }

  const selectedUser = DEMO_USERS.find((user) => user.username === username);

  return (
    <div className="min-h-screen bg-[#F5F7F9] px-4 py-10">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-8">
        <section className="hidden flex-1 lg:block">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#2386FF] text-lg font-bold text-white">
              A
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#151E2B]">AI RoboEdu</h1>
              <p className="text-sm text-[#5B6B7B]">统一入口 · Demo 角色体验</p>
            </div>
          </div>
          <div className="rounded-xl border border-[#E5EAF0] bg-white p-6">
            <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-[#151E2B]">
              <BookOpen className="h-4 w-4 text-[#2386FF]" />
              角色进入逻辑
            </div>
            <div className="space-y-3">
              {roleOptions.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.role}
                    className="flex items-center gap-3 rounded-lg border border-[#E5EAF0] bg-[#F8FAFC] p-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#2386FF]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[#151E2B]">{item.label}</div>
                      <div className="mt-0.5 text-xs text-[#7B8794]">{item.hint}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-xl border border-[#E5EAF0] bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[#151E2B]">统一登录</h2>
            <p className="mt-1 text-xs text-[#7B8794]">
              优先使用正式账号登录；数据库未配置时仍兼容 Demo 用户。
            </p>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2">
            {DEMO_USERS.map((user) => {
              const active = username === user.username;
              return (
                <button
                  key={user.username}
                  type="button"
                  onClick={() => quickFill(user.username)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "border-[#2386FF] bg-[#EAF3FF] text-[#2386FF]"
                      : "border-[#E5EAF0] text-[#5B6B7B] hover:border-[#BFD7F5]"
                  }`}
                >
                  {user.username}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#5B6B7B]">
                用户名
              </label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8794]" />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value.trim())}
                  className="w-full rounded-lg border border-[#E5EAF0] bg-[#F5F7F9] py-2.5 pl-9 pr-3 text-sm text-[#151E2B] outline-none focus:border-[#2386FF]"
                  placeholder="student / teacher / admin"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#5B6B7B]">
                密码
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8794]" />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  className="w-full rounded-lg border border-[#E5EAF0] bg-[#F5F7F9] py-2.5 pl-9 pr-3 text-sm text-[#151E2B] outline-none focus:border-[#2386FF]"
                  placeholder="123456"
                />
              </div>
            </div>

            {selectedUser && (
              <div className="rounded-lg border border-[#D9E8FF] bg-[#F0F7FF] px-3 py-2 text-xs text-[#1E62B8]">
                当前将以「{selectedUser.session.name}」登录。
              </div>
            )}

            {errorMsg && (
              <div className="rounded-lg border border-[#FFD7D4] bg-[#FFF1F0] px-3 py-2 text-xs text-[#D93026]">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2386FF] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1E76E6] disabled:bg-[#9BC4F8]"
            >
              {submitting ? "登录中..." : "登录"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-5 border-t border-[#E5EAF0] pt-4 text-[11px] leading-5 text-[#7B8794]">
            <p>Demo 用户：</p>
            <p>student / 123456</p>
            <p>teacher / 123456</p>
            <p>admin / 123456</p>
          </div>

          <div className="mt-4 text-center text-xs text-[#7B8794]">
            不登录也可以返回{" "}
            <Link href="/" className="text-[#2386FF] hover:underline">
              学生体验首页
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
