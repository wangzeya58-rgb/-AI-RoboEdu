"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Smartphone,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Clock,
  GraduationCap,
  Users,
  ShieldCheck,
} from "lucide-react";

type RegisterRole = "student" | "teacher" | "admin";

interface RoleConfig {
  key: RegisterRole;
  label: string;
  title: string;
  guide: string;
  submitText: string;
  submittingText: string;
  successHint: string;
  footer: string;
  gradient: string; // tailwind gradient class
  iconBg: string;
  iconColor: string;
  notice: string;
  redirect: string; // 注册成功后跳转到哪里
  successMessage: string;
}

const ROLE_CONFIGS: RoleConfig[] = [
  {
    key: "student",
    label: "学员",
    title: "学员注册",
    guide: "请输入手机号，获取短信验证码完成学员注册",
    submitText: "完成学员注册",
    submittingText: "注册中...",
    successHint: "注册成功，请使用账号登录学习平台",
    footer: "学员注册后可访问课程学习、程序管理、AI 训练等模块",
    gradient: "from-[#2386FF] to-[#1677ff]",
    iconBg: "from-[#2386FF] to-[#1677ff]",
    iconColor: "text-[#2386FF]",
    notice: "学员注册后默认「我的班级」为锁定状态，收到邀请后即可解锁",
    redirect: "/login?role=student",
    successMessage: "学员注册成功！正在跳转到登录页...",
  },
  {
    key: "teacher",
    label: "老师",
    title: "老师注册",
    guide: "请输入手机号，获取短信验证码完成老师注册",
    submitText: "完成老师注册",
    submittingText: "注册中...",
    successHint: "注册成功，请使用老师账号登录教师工作台",
    footer: "老师注册后可登录教师工作台，上传课程、管理班级、布置作业",
    gradient: "from-[#25D366] to-[#1da851]",
    iconBg: "from-[#25D366] to-[#1da851]",
    iconColor: "text-[#25D366]",
    notice: "老师账号注册后默认即可登录，无需审批，登录后请尽快完善个人信息",
    redirect: "/login?role=teacher",
    successMessage: "老师注册成功！正在跳转到登录页...",
  },
  {
    key: "admin",
    label: "管理员",
    title: "管理员注册",
    guide: "请输入手机号，获取短信验证码完成管理员注册",
    submitText: "完成管理员注册",
    submittingText: "注册中...",
    successHint: "注册成功，请使用管理员账号登录后台",
    footer: "管理员拥有最高权限，可审核老师提交的课程，管理全部平台内容",
    gradient: "from-[#7C3AED] to-[#5b21b6]",
    iconBg: "from-[#7C3AED] to-[#5b21b6]",
    iconColor: "text-[#7C3AED]",
    notice: "管理员注册开放中，注册后即拥有审核课程、上下架、删除等全部权限",
    redirect: "/login?role=admin",
    successMessage: "管理员注册成功！正在跳转到登录页...",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [activeRole, setActiveRole] = useState<RegisterRole>("student");
  const config = useMemo(
    () => ROLE_CONFIGS.find((r) => r.key === activeRole) ?? ROLE_CONFIGS[0],
    [activeRole]
  );

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 切换身份时重置提示
  useEffect(() => {
    setError("");
    setSuccess("");
  }, [activeRole]);

  // 验证手机号
  const isValidPhone = (p: string) => /^1[3-9]\d{9}$/.test(p);

  // 发送验证码
  const handleSendCode = async () => {
    setError("");
    setSuccess("");

    if (!isValidPhone(phone)) {
      setError("请输入正确的手机号码");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/v1/auth/sms/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "发送失败，请稍后重试");
        return;
      }

      setSuccess("验证码已发送");
      setCountdown(60);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setSending(false);
    }
  };

  // 完成注册
  const handleRegister = async () => {
    setError("");
    setSuccess("");

    if (!isValidPhone(phone)) {
      setError("请输入正确的手机号码");
      return;
    }
    if (code.length !== 6) {
      setError("请输入6位验证码");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/sms/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, role: activeRole }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "注册失败，请稍后重试");
        return;
      }

      setSuccess(config.successMessage);
      setTimeout(() => {
        router.push(config.redirect);
      }, 1500);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F7F9] via-[#E8ECF1] to-[#F5F7F9] flex items-center justify-center p-4">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-[#2386FF]/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#25D366]/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* 返回按钮 */}
        <button
          onClick={() => router.push("/")}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">返回首页</span>
        </button>

        {/* 注册卡片 */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* 顶部Logo */}
          <div className="flex items-center justify-center mb-4">
            <div
              className={`w-14 h-14 bg-gradient-to-br ${config.iconBg} rounded-xl flex items-center justify-center shadow-lg`}
            >
              {activeRole === "student" && <GraduationCap className="w-7 h-7 text-white" />}
              {activeRole === "teacher" && <Users className="w-7 h-7 text-white" />}
              {activeRole === "admin" && <ShieldCheck className="w-7 h-7 text-white" />}
            </div>
          </div>

          {/* 身份切换 Tabs */}
          <div className="flex items-center justify-center mb-6 bg-gray-50 rounded-lg p-1">
            {ROLE_CONFIGS.map((r) => (
              <button
                key={r.key}
                onClick={() => setActiveRole(r.key)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  activeRole === r.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* 标题 */}
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
            {config.title}
          </h1>
          <p className="text-sm text-center text-gray-500 mb-6">{config.guide}</p>

          {/* 身份说明 */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs text-blue-700">{config.footer}</p>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* 成功提示 */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {success}
            </div>
          )}

          {/* 手机号输入 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">手机号</label>
            <div className="relative">
              <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))
                }
                placeholder="请填写手机号码"
                maxLength={11}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#2386FF] focus:ring-2 focus:ring-[#2386FF]/20 transition-all"
              />
            </div>
          </div>

          {/* 验证码输入 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">验证码</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="请输入短信验证码"
                maxLength={6}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#2386FF] focus:ring-2 focus:ring-[#2386FF]/20 transition-all"
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={sending || countdown > 0 || !isValidPhone(phone)}
                className="px-4 py-3 bg-[#2386FF] text-white text-sm font-medium rounded-lg hover:bg-[#1677ff] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap min-w-[110px] flex items-center justify-center"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : countdown > 0 ? (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {countdown}s
                  </span>
                ) : (
                  "获取验证码"
                )}
              </button>
            </div>
          </div>

          {/* 注册按钮 */}
          <button
            type="button"
            onClick={handleRegister}
            disabled={loading}
            className={`w-full py-3 bg-gradient-to-r ${config.gradient} text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-6`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {config.submittingText}
              </>
            ) : (
              config.submitText
            )}
          </button>

          {/* 温馨提示 */}
          <div className="mt-6 p-3 bg-amber-50 border border-amber-100 rounded-lg">
            <p className="text-xs text-amber-700 flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{config.notice}</span>
            </p>
          </div>

          {/* 协议 */}
          <p className="mt-6 text-xs text-center text-gray-400">
            注册即表示同意
            <span className="text-[#2386FF] cursor-pointer hover:underline">
              《用户协议》
            </span>
            和
            <span className="text-[#2386FF] cursor-pointer hover:underline">
              《隐私政策》
            </span>
          </p>
        </div>

        {/* 底部信息 */}
        <p className="mt-6 text-xs text-center text-gray-400">
          已有账号？
          <span
            className="text-[#2386FF] cursor-pointer hover:underline ml-1"
            onClick={() => router.push("/login")}
          >
            立即登录
          </span>
        </p>
      </div>
    </div>
  );
}
