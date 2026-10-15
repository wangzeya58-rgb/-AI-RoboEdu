"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  Lock,
  LogIn,
  BookOpen,
  Users,
  GraduationCap,
  Cpu,
  Gamepad2,
  AppWindow,
  HelpCircle,
  MessageSquare,
  FileCode,
  LayoutDashboard,
  ShieldCheck,
  LogOut,
  Monitor,
  Settings2,
} from "lucide-react";
import { ROLES, type Role } from "@/lib/auth/roles";
import { clearSession, getSession, logoutFormalUser } from "@/lib/auth/client";

interface MenuItem {
  name: string;
  icon: typeof FileCode;
  href: string;
  locked?: boolean;
  lockReason?: string;
  isPortal?: boolean;
  portalRole?: Role;
}

const baseMenuItems: MenuItem[] = [
  {
    name: "我的程序",
    icon: FileCode,
    href: "/programming/source-code",
  },
  { name: "控制平台", icon: Gamepad2, href: "/car-control" },
  { name: "仿真器", icon: Monitor, href: "/simulator" },
  { name: "教学资源", icon: BookOpen, href: "/teaching-resources" },
  { name: "课程管理", icon: Settings2, href: "/course/manage" },
  { name: "我的培训", icon: GraduationCap, href: "/class-management" },
  { name: "AI训练平台", icon: Cpu, href: "/training" },
  { name: "应用中心", icon: AppWindow, href: "/application-center" },
  { name: "帮助中心", icon: HelpCircle, href: "/help-center" },
  { name: "问题反馈", icon: MessageSquare, href: "/feedback" },
];

interface SidebarProps {
  activeMenu?: string;
}

export default function Sidebar({ activeMenu }: SidebarProps) {
  const pathname = usePathname();
  const currentMenu = activeMenu || pathname;
  const [tooltipVisible, setTooltipVisible] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    setRole(session?.role ?? null);
    setUserName(session?.name ?? null);
    const handler = () => {
      const s = getSession();
      setRole(s?.role ?? null);
      setUserName(s?.name ?? null);
    };
    window.addEventListener("al-session-change", handler);
    return () => window.removeEventListener("al-session-change", handler);
  }, []);

  const portalItems: MenuItem[] = [];
  if (role === ROLES.STUDENT) {
    portalItems.push(
      {
        name: "学生首页",
        icon: LayoutDashboard,
        href: "/",
        isPortal: true,
        portalRole: ROLES.STUDENT,
      },
      {
        name: "我的班级",
        icon: Users,
        href: "/class/join",
        isPortal: true,
        portalRole: ROLES.STUDENT,
      }
    );
  } else if (role === ROLES.TEACHER) {
    portalItems.push({
      name: "教师工作台",
      icon: LayoutDashboard,
      href: "/teacher",
      isPortal: true,
      portalRole: ROLES.TEACHER,
    });
  } else if (role === ROLES.ADMIN) {
    portalItems.push({
      name: "管理员后台",
      icon: ShieldCheck,
      href: "/admin",
      isPortal: true,
      portalRole: ROLES.ADMIN,
    });
  }

  const menuItems = [...portalItems, ...baseMenuItems];

  async function handleLogout() {
    if (!confirm("确认退出登录？")) return;
    await logoutFormalUser();
    clearSession();
    setRole(null);
    setUserName(null);
    window.location.href = "/";
  }

  return (
    <aside
      className="w-60 flex flex-col"
      style={{ backgroundColor: "#151E2B" }}
    >
      <div className="p-5 border-b" style={{ borderColor: "#1E2A3A" }}>
        <Link href="/" className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "#2386FF" }}
          >
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg">AI RoboEdu</h1>
            <p className="text-xs" style={{ color: "#8892A0" }}>
              智能机器人教育平台
            </p>
          </div>
        </Link>
      </div>

      {role && userName ? (
        <div
          className="px-5 py-3 border-b flex items-center gap-3"
          style={{ borderColor: "#1E2A3A" }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium"
            style={{
              backgroundColor:
                role === ROLES.ADMIN
                  ? "#2386FF"
                  : role === ROLES.TEACHER
                    ? "#25D366"
                    : "#FF8C42",
            }}
          >
            {userName.slice(0, 1)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm truncate">{userName}</div>
            <div className="text-[11px]" style={{ color: "#8892A0" }}>
              {role === ROLES.ADMIN
                ? "管理员"
                : role === ROLES.TEACHER
                  ? "老师"
                  : "学生"}
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="退出登录"
            className="p-1.5 rounded hover:bg-[#1E2A3A]"
            style={{ color: "#8892A0" }}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="border-b px-5 py-3" style={{ borderColor: "#1E2A3A" }}>
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 rounded-md border border-white/15 py-2 text-xs text-white/80 hover:border-white/30 hover:text-white"
          >
            <LogIn className="h-3.5 w-3.5" />
            登录
          </Link>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            currentMenu === item.href || currentMenu === item.name;
          const activeColor = item.isPortal ? "#25D366" : "#2386FF";
          if (item.locked) {
            return (
              <div
                key={item.name}
                className="relative w-full flex items-center gap-3 px-5 py-3 cursor-not-allowed opacity-60"
                style={{ color: "#8892A0" }}
                onMouseEnter={() => setTooltipVisible(item.name)}
                onMouseLeave={() => setTooltipVisible(null)}
              >
                <Icon className="w-5 h-5" />
                <span className="flex-1 text-left text-sm">{item.name}</span>
                <Lock className="w-4 h-4 opacity-50" />
                {tooltipVisible === item.name && (
                  <div
                    className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-lg text-xs whitespace-nowrap z-50"
                    style={{
                      backgroundColor: "#2D3748",
                      color: "white",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                    }}
                  >
                    {item.lockReason}
                    <div
                      className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent"
                      style={{ borderRightColor: "#2D3748" }}
                    />
                  </div>
                )}
              </div>
            );
          }
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`w-full flex items-center gap-3 px-5 py-3 transition-all duration-200 ${
                isActive ? "" : "hover:bg-opacity-10"
              }`}
              style={{
                backgroundColor: isActive ? activeColor : "transparent",
                color: isActive ? "#fff" : "#8892A0",
              }}
            >
              <Icon className="w-5 h-5" />
              <span className="flex-1 text-left text-sm">{item.name}</span>
              {isActive && <ChevronRight className="w-4 h-4" />}
            </Link>
          );
        })}
      </nav>

      <div
        className="border-t p-4 text-xs leading-5"
        style={{ borderColor: "#1E2A3A", color: "#8892A0" }}
      >
        公司内部学校展示版
      </div>
    </aside>
  );
}
