"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import Layout from "@/components/Layout";
import { useCurrentSession } from "@/lib/auth/use-current-session";
import { isDemoSessionId } from "@/lib/classes/formal-class-api";
import { CourseResourceManager } from "./CourseResourceManager";
import { FormalCourseManager } from "./FormalCourseManager";

function Workspace() {
  const { session, ready, error, retry } = useCurrentSession();
  const params = useSearchParams();
  const pathname = usePathname();
  if (!ready) return <p role="status">正在读取登录状态...</p>;
  if (error) return <div role="alert">{error} <button onClick={retry}>重试</button></div>;
  if (!session) return <Link href="/login?next=/course/manage">登录后管理课程</Link>;
  if (session.role !== "teacher" && session.role !== "admin") return <p role="alert">当前账号无权管理课程。</p>;
  if (isDemoSessionId(session.id)) return <>
    <p className="text-sm text-[#7B8794]">Demo 演示：课程和文件仅保存在当前浏览器，不会上传到正式数据库。</p>
    <CourseResourceManager session={session} />
  </>;
  return <FormalCourseManager isAdmin={session.role === "admin"} initialCourseId={params.get("id")} newCourse={pathname.endsWith("/new") || params.get("new") === "1"} />;
}

export function CourseManagementWorkspace() {
  return <Layout activeMenu="/course/manage" className="max-md:[&>aside]:hidden [&>main]:min-w-0"><div className="space-y-5 p-4 sm:p-6">
    <Suspense fallback={<p role="status">正在加载课程管理...</p>}><Workspace /></Suspense>
  </div></Layout>;
}
