"use client";

import { Suspense, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { CourseResourceManager } from "@/components/course/CourseResourceManager";
import { FormalCourseManager } from "@/components/course/FormalCourseManager";
import { getSession, type SessionInfo } from "@/lib/auth/client";
import { isDemoSessionId } from "@/lib/classes/formal-class-api";

export default function CourseManagePage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => {
    setSession(getSession());
    setSessionReady(true);
  }, []);
  const useFormalCourses = session?.role === "teacher" && !isDemoSessionId(session.id);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-[#7B8794]">
          加载中...
        </div>
      }
    >
      <Layout activeMenu="/course/manage">
        <div className="space-y-5 p-4 sm:p-6">
          {!sessionReady ? <p role="status">正在读取登录状态...</p> : useFormalCourses ? <FormalCourseManager /> : <CourseResourceManager />}
        </div>
      </Layout>
    </Suspense>
  );
}
