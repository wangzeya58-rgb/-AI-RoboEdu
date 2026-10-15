"use client";

import { Suspense } from "react";
import { AdminCourseReview } from "@/components/portal/AdminCourseReview";

export default function CourseReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-[#7B8794]">
          加载中...
        </div>
      }
    >
      <AdminCourseReview />
    </Suspense>
  );
}
