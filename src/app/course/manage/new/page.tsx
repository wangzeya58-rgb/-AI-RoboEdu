"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewManagedCoursePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/course/manage");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7F9] text-sm text-[#7B8794]">
      正在进入课程管理...
    </div>
  );
}
