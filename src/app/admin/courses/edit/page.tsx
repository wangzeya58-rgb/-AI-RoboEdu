"use client";

import { Suspense } from "react";
import { AdminCourseForm } from "@/components/portal/AdminCourseForm";

export default function AdminEditCoursePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-[#7B8794]">
          加载中...
        </div>
      }
    >
      <AdminCourseForm mode="edit" />
    </Suspense>
  );
}
