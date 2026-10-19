"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionInfo } from "@/lib/auth/client";
import { isDemoSessionId } from "@/lib/classes/formal-class-api";
import { subscribeClassStore } from "@/lib/classes/demo-class-store";
import { subscribeDemoCourses } from "@/lib/course/teacher-course-store";
import { FormalCourseApiError } from "./formal-course-api";
import { subscribeFormalCourses } from "./course-refresh";
import { loadReadableCourseCatalog, type CatalogCourse } from "./course-catalog";

export function useCourseCatalog(session: SessionInfo | null, ready: boolean) {
  const [items, setItems] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setError(null);
    if (!ready || !session) { setItems([]); setLoading(!ready); return; }
    setLoading(true);
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { reject(new Error("课程读取超时，请重试。")); controller.abort(); }, 15000);
    });
    Promise.race([loadReadableCourseCatalog(session, controller.signal), timeout])
      .then((value) => { if (!cancelled) setItems(value); })
      .catch((cause: unknown) => {
        if (!cancelled) {
          if (cause instanceof FormalCourseApiError && [401, 403].includes(cause.status)) setItems([]);
          setError(cause instanceof Error ? cause.message : "课程读取失败，请重试。");
        }
      })
      .finally(() => { clearTimeout(timer); if (!cancelled) setLoading(false); });
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [session, ready, revision]);
  useEffect(() => {
    setItems([]);
    if (!session) return;
    const demo = isDemoSessionId(session.id);
    const stopCourses = demo ? subscribeDemoCourses(retry) : subscribeFormalCourses(retry);
    const stopClasses = demo ? subscribeClassStore(retry) : () => {};
    window.addEventListener("focus", retry);
    const timer = setInterval(retry, 30000);
    return () => { stopCourses(); stopClasses(); clearInterval(timer); window.removeEventListener("focus", retry); };
  }, [session, retry]);
  return { items, loading, error, retry };
}
