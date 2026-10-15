"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  BookOpen,
  LogOut,
  ChevronRight,
  GraduationCap,
  ShieldCheck,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Archive,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { ROLES, type Role } from "@/lib/auth/roles";
import {
  getSession,
  clearSession,
  logoutFormalUser,
  type SessionInfo,
} from "@/lib/auth/client";

export interface PortalMenuItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

export interface PortalSection {
  title: string;
  items: PortalMenuItem[];
}

interface PortalShellProps {
  role: Role;
  menu: PortalSection[];
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function PortalShell({
  role,
  menu,
  children,
  title,
  subtitle,
}: PortalShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSessionState] = useState<SessionInfo | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    if (s.role !== role) {
      // 越权访问：跳到对应的工作台
      if (s.role === ROLES.ADMIN) router.replace("/admin");
      else if (s.role === ROLES.TEACHER)
        router.replace("/teacher");
      else router.replace("/");
      return;
    }
    setSessionState(s);
  }, [role, router]);

  async function handleLogout() {
    await logoutFormalUser();
    clearSession();
    router.replace("/login");
  }

  if (!hydrated || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7F9] text-sm text-[#7B8794]">
        正在校验身份...
      </div>
    );
  }

  const isAdmin = session.role === ROLES.ADMIN;

  return (
    <div className="min-h-screen bg-[#F5F7F9] flex">
      {/* 侧边栏 */}
      <aside className="w-60 shrink-0 bg-[#151E2B] text-white flex flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-[#2386FF] flex items-center justify-center text-white font-bold text-base">
              A
            </div>
            <div>
              <div className="text-base font-bold leading-tight">
                AI RoboEdu
              </div>
              <div className="text-[11px] text-white/60 leading-tight mt-0.5">
                {isAdmin ? "管理员后台" : "老师工作台"}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {menu.map((section) => (
            <div key={section.title} className="mb-4">
              <div className="px-5 mb-1.5 text-[11px] text-white/40 uppercase tracking-wider">
                {section.title}
              </div>
              <ul>
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2.5 px-5 py-2 text-sm transition-colors ${
                          active
                            ? "bg-[#2386FF] text-white"
                            : "text-white/80 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="flex-1">{item.label}</span>
                        {item.badge != null && item.badge > 0 && (
                          <span className="text-[10px] bg-[#FF4D4F] text-white px-1.5 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center ${
                isAdmin ? "bg-[#25D366]" : "bg-[#2386FF]"
              }`}
            >
              {isAdmin ? (
                <ShieldCheck className="w-4 h-4 text-white" />
              ) : (
                <GraduationCap className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{session.name}</div>
              <div className="text-[11px] text-white/50 truncate">
                {session.phone}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-white/70 hover:text-white border border-white/15 rounded-md hover:border-white/30 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            退出登录
          </button>
        </div>
      </aside>

      {/* 主区域 */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-[#E5EAF0] px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-[#151E2B]">{title}</h1>
              {subtitle && (
                <p className="text-xs text-[#7B8794] mt-0.5">{subtitle}</p>
              )}
            </div>
            <div className="text-xs text-[#7B8794] flex items-center gap-1">
              {isAdmin ? "管理员端" : "老师端"}
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-[#151E2B] font-medium">{title}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

// 老师端菜单生成器
export function buildTeacherMenu(
  counts: Partial<Record<"draft" | "pending" | "approved" | "rejected", number>>
): PortalSection[] {
  return [
    {
      title: "工作台",
      items: [
        {
          key: "dashboard",
          label: "概览",
          href: "/teacher",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: "课程管理",
      items: [
        {
          key: "all",
          label: "全部课程",
          href: "/course/manage",
          icon: BookOpen,
        },
        {
          key: "draft",
          label: "草稿箱",
          href: "/course/manage",
          icon: FileText,
          badge: counts.draft,
        },
        {
          key: "pending",
          label: "待审核",
          href: "/course/manage",
          icon: Clock,
          badge: counts.pending,
        },
        {
          key: "rejected",
          label: "已驳回",
          href: "/course/manage",
          icon: XCircle,
          badge: counts.rejected,
        },
        {
          key: "approved",
          label: "已上架",
          href: "/course/manage",
          icon: CheckCircle2,
          badge: counts.approved,
        },
        {
          key: "new",
          label: "上传新课程",
          href: "/course/manage/new",
          icon: Plus,
        },
      ],
    },
  ];
}

// 管理员端菜单生成器
export function buildAdminMenu(
  counts: Partial<Record<"pending" | "approved" | "rejected" | "offline", number>>
): PortalSection[] {
  return [
    {
      title: "工作台",
      items: [
        {
          key: "dashboard",
          label: "概览",
          href: "/admin",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: "课程管理",
      items: [
        {
          key: "all",
          label: "全部课程",
          href: "/admin/courses",
          icon: BookOpen,
        },
        {
          key: "pending",
          label: "待审核",
          href: "/admin/courses?status=pending",
          icon: Clock,
          badge: counts.pending,
        },
        {
          key: "approved",
          label: "已上架",
          href: "/admin/courses?status=approved",
          icon: CheckCircle2,
          badge: counts.approved,
        },
        {
          key: "rejected",
          label: "已驳回",
          href: "/admin/courses?status=rejected",
          icon: XCircle,
          badge: counts.rejected,
        },
        {
          key: "offline",
          label: "已下架",
          href: "/admin/courses?status=offline",
          icon: Archive,
          badge: counts.offline,
        },
        {
          key: "new",
          label: "上传新课程",
          href: "/admin/courses/new",
          icon: Plus,
        },
      ],
    },
  ];
}
